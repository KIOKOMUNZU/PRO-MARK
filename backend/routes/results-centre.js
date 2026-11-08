'use strict';

const express = require('express');
const PDFDocument = require('pdfkit');
const db = require('../db');
const { authenticate, roles, schoolBoundary } = require('../middleware/auth');
const {
  getOptions,
  buildMerit,
  buildCompleteness,
  buildAnalytics,
  invalidateResultsCaches
} = require('../services/results-engine');

const router = express.Router();
router.use(authenticate);

const ALLOWED = [
  'SCHOOL_ADMIN', 'ADMIN', 'HEADTEACHER', 'DEPUTY_HEADTEACHER',
  'SENIOR_TEACHER', 'CLASS_TEACHER', 'TEACHER'
];

function canSeeAll(req) {
  return !['CLASS_TEACHER', 'TEACHER'].includes(req.user.role);
}

async function assignedClassIds(sid, userId) {
  const queries = [
    `SELECT DISTINCT cta.class_id
     FROM class_teacher_assignments cta
     JOIN teachers th ON th.id=cta.teacher_id AND th.school_id=cta.school_id
     WHERE cta.school_id=$1 AND th.user_id=$2 AND COALESCE(th.is_active,true)=true`,
    `SELECT DISTINCT tsa.class_id
     FROM teacher_subject_assignments tsa
     JOIN teachers th ON th.id=tsa.teacher_id AND th.school_id=tsa.school_id
     WHERE tsa.school_id=$1 AND th.user_id=$2 AND COALESCE(th.is_active,true)=true
       AND COALESCE(tsa.is_active,true)=true`
  ];
  const ids = new Set();
  for (const sql of queries) {
    try {
      const rows = (await db.query(sql, [sid, userId])).rows;
      for (const row of rows) {
        if (row.class_id) ids.add(String(row.class_id));
      }
    } catch (error) {
      if (error.code !== '42P01' && error.code !== '42703') throw error;
    }
  }
  return [...ids];
}

async function enforceScope(req, classId) {
  if (canSeeAll(req)) return;
  if (!classId) {
    throw Object.assign(new Error('Select one of your assigned classes.'), { status: 400 });
  }
  const allowed = await assignedClassIds(req.params.schoolId, req.user.user_id);
  if (!allowed.includes(String(classId))) {
    throw Object.assign(new Error('You can only view results for classes you are assigned to.'), { status: 403 });
  }
}

function fail(res, error) {
  const status = error.status || 400;
  res.status(status).json({ error: error.message || 'Unable to load results.' });
}

router.get('/:schoolId/options', schoolBoundary, roles(...ALLOWED), async (req, res) => {
  try {
    const options = await getOptions(req.params.schoolId, req.query);
    if (!canSeeAll(req)) {
      const allowed = await assignedClassIds(req.params.schoolId, req.user.user_id);
      options.classes = options.classes.filter(c => allowed.includes(String(c.id)));
    }
    options.can_see_all = canSeeAll(req);
    res.json(options);
  } catch (error) { fail(res, error); }
});

router.get('/:schoolId/completeness', schoolBoundary, roles(...ALLOWED), async (req, res) => {
  try {
    await enforceScope(req, req.query.class_id);
    res.json(await buildCompleteness(req.params.schoolId, req.query));
  } catch (error) { fail(res, error); }
});

router.get('/:schoolId/merit', schoolBoundary, roles(...ALLOWED), async (req, res) => {
  try {
    await enforceScope(req, req.query.class_id);
    res.json(await buildMerit(req.params.schoolId, req.query));
  } catch (error) { fail(res, error); }
});

router.get('/:schoolId/analytics', schoolBoundary, roles(...ALLOWED), async (req, res) => {
  try {
    await enforceScope(req, req.query.class_id);
    res.json(await buildAnalytics(req.params.schoolId, req.query));
  } catch (error) { fail(res, error); }
});

router.post('/:schoolId/refresh', schoolBoundary, roles(...ALLOWED), (req, res) => {
  invalidateResultsCaches();
  res.json({ ok: true });
});

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

router.get('/:schoolId/merit.csv', schoolBoundary, roles(...ALLOWED), async (req, res) => {
  try {
    await enforceScope(req, req.query.class_id);
    const merit = await buildMerit(req.params.schoolId, req.query);
    const subjects = merit.subjects || [];
    const header = [
      'Rank', 'Admission No', 'Assessment No', 'Learner', 'Class',
      ...subjects.map(s => s.subject_name),
      'Total', 'Average', 'Grade', 'Class Position', 'Overall Position'
    ];
    const lines = [header.map(csvCell).join(',')];
    merit.rows.forEach((row, index) => {
      const bySubject = new Map(row.subjects.map(s => [String(s.subject_id), s]));
      const values = [
        row.overall_rank ?? (row.average == null ? '' : index + 1),
        row.admission_no || '',
        row.assessment_no || '',
        row.name || '',
        row.class_name || '',
        ...subjects.map(s => {
          const found = bySubject.get(String(s.subject_id));
          return found && found.average != null ? found.average : '';
        }),
        row.total ?? '',
        row.average ?? '',
        row.grade || '',
        row.stream_rank ?? '',
        row.overall_rank ?? ''
      ];
      lines.push(values.map(csvCell).join(','));
    });
    const context = merit.context || {};
    const filename = `merit-${String(context.year_label || 'year').replace(/\W+/g, '-')}-${String(context.term_name || 'term').replace(/\W+/g, '-')}${context.class_name ? '-' + String(context.class_name).replace(/\W+/g, '-') : ''}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\ufeff' + lines.join('\r\n'));
  } catch (error) { fail(res, error); }
});

function text(value) {
  return value == null ? '' : String(value);
}

router.get('/:schoolId/merit.pdf', schoolBoundary, roles(...ALLOWED), async (req, res) => {
  try {
    await enforceScope(req, req.query.class_id);
    const sid = req.params.schoolId;
    const merit = await buildMerit(sid, req.query);
    const meta = (await db.query(
      `SELECT s.name school_name,si.logo_url,si.motto,si.address,si.contact_phone,
              si.primary_color,si.secondary_color
       FROM schools s LEFT JOIN school_identity si ON si.school_id=s.id
       WHERE s.id=$1`,
      [sid]
    )).rows[0] || {};

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 20, autoFirstPage: false });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    const done = new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
    doc.addPage({ size: 'A4', layout: 'landscape', margin: 20 });

    const navy = (() => {
      const value = String(meta.primary_color || '').toUpperCase();
      return value === '#17365D' ? '#17365D' : (meta.primary_color || '#17365D');
    })();
    const gold = (() => {
      const value = String(meta.secondary_color || '').toUpperCase();
      return value === '#D9A441' ? '#B8860B' : (meta.secondary_color || '#B8860B');
    })();
    const ink = '#1B2430';
    const muted = '#5B6675';
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 26;
    const tableWidth = pageWidth - margin * 2;
    const footerTop = pageHeight - 42;
    const contentBottom = footerTop - 8;
    const subjects = merit.subjects || [];
    const context = merit.context || {};

    const fixed = [30, 52, 132];
    const tail = [42, 44, 34, 40, 42];
    const subjectSpace = Math.max(0, tableWidth - fixed.reduce((a, b) => a + b, 0) - tail.reduce((a, b) => a + b, 0));
    const subjectWidth = subjects.length ? subjectSpace / subjects.length : 0;
    const widths = [...fixed, ...subjects.map(() => subjectWidth), ...tail];
    const rowHeight = 20;
    const headerHeight = 26;
    let y = 0;

    const gradeFill = grade => {
      const key = String(grade || '').toUpperCase();
      if (key === 'A' || key === 'EE') return '#E7F5EC';
      if (key === 'B' || key === 'ME') return '#E8F0FA';
      if (key === 'C' || key === 'AE') return '#FCF3DC';
      if (key === 'D' || key === 'BE') return '#FBE9E7';
      return '#F4F6F9';
    };

    const footer = () => {
      doc.strokeColor('#D8DEE6').lineWidth(0.7)
        .moveTo(margin, footerTop).lineTo(margin + tableWidth, footerTop).stroke();
      doc.fillColor(muted).font('Helvetica').fontSize(6.5)
        .text(
          `ZELIMU CBC · Generated ${new Date().toISOString().slice(0, 10)} · Page ${doc.page.index + 1}`,
          margin, pageHeight - 32, { width: tableWidth, align: 'right' }
        );
    };

    const pageHeader = () => {
      doc.fillColor(navy).font('Helvetica-Bold').fontSize(15)
        .text(text(meta.school_name || 'School'), margin, 28, { width: tableWidth });
      doc.fillColor(gold).font('Helvetica').fontSize(8)
        .text(text(meta.motto || 'Results · Merit · Progress'), margin, 47, { width: tableWidth });
      doc.fillColor(ink).font('Helvetica-Bold').fontSize(12)
        .text('MERIT LIST', margin, 66, { width: tableWidth });
      const bits = [
        context.year_label,
        context.term_name,
        context.class_name || 'All classes',
        context.year_state === 'HISTORICAL' ? 'HISTORICAL' : null
      ].filter(Boolean);
      doc.fillColor(muted).font('Helvetica').fontSize(8)
        .text(bits.join('   ·   '), margin, 82, { width: tableWidth });
      doc.moveTo(margin, 98).lineTo(margin + tableWidth, 98).strokeColor(gold).lineWidth(1.2).stroke();
      y = 108;
    };

    const tableHead = () => {
      let x = margin;
      doc.fillColor(navy).rect(margin, y, tableWidth, headerHeight).fill();
      const heads = [
        '#', 'ADM. NO.', 'LEARNER',
        ...subjects.map(s => String(s.subject_code || s.subject_name || '').toUpperCase()),
        'TOTAL', 'AVERAGE', 'GRADE', 'CLASS POS.', 'OVERALL POS.'
      ];
      heads.forEach((label, index) => {
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(index < 3 ? 6.5 : 5.6)
          .text(label, x + 2, y + 8, {
            width: widths[index] - 4,
            align: index < 3 ? 'left' : 'center',
            lineBreak: false,
            ellipsis: true
          });
        x += widths[index];
      });
      y += headerHeight;
    };

    pageHeader();
    tableHead();

    merit.rows.forEach((row, index) => {
      if (y + rowHeight > contentBottom) {
        footer();
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 20 });
        pageHeader();
        tableHead();
      }
      if (index % 2 === 0) {
        doc.fillColor('#FAFBFC').rect(margin, y, tableWidth, rowHeight).fill();
      }
      const bySubject = new Map(row.subjects.map(s => [String(s.subject_id), s]));
      const cells = [
        row.overall_rank == null ? '' : String(row.overall_rank),
        text(row.admission_no),
        text(row.name)
      ];
      let x = margin;
      cells.forEach((value, cellIndex) => {
        doc.fillColor(ink).font(cellIndex === 2 ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.6)
          .text(value, x + 3, y + 6, {
            width: widths[cellIndex] - 6,
            lineBreak: false,
            ellipsis: true
          });
        x += widths[cellIndex];
      });
      subjects.forEach(subject => {
        const found = bySubject.get(String(subject.subject_id));
        const value = found && found.average != null ? String(Math.round(found.average)) : '—';
        doc.fillColor(ink).font('Helvetica').fontSize(6.4)
          .text(value, x, y + 6, { width: subjectWidth, align: 'center' });
        x += subjectWidth;
      });
      const tailValues = [
        row.total == null ? '—' : String(Math.round(row.total)),
        row.average == null ? '—' : String(Math.round(row.average * 10) / 10),
        text(row.grade),
        row.stream_rank == null ? '—' : String(row.stream_rank),
        row.overall_rank == null ? '—' : String(row.overall_rank)
      ];
      tailValues.forEach((value, index) => {
        if (index === 2) {
          doc.fillColor(gradeFill(value)).rect(x, y, widths[fixed.length + subjects.length + index], rowHeight).fill();
        }
        doc.fillColor(ink).font('Helvetica-Bold').fontSize(6.4)
          .text(value, x, y + 6, {
            width: widths[fixed.length + subjects.length + index],
            align: 'center'
          });
        x += widths[fixed.length + subjects.length + index];
      });
      y += rowHeight;
    });

    if (!merit.rows.length) {
      doc.fillColor('#991B1B').font('Helvetica-Bold').fontSize(8)
        .text('No usable marks were found for this selection.', margin, y + 10, { width: tableWidth });
      if (merit.diagnostics) {
        doc.fillColor(ink).font('Helvetica').fontSize(7.5)
          .text(merit.diagnostics, margin, y + 26, { width: tableWidth });
      }
      y += 60;
    }

    if (merit.subject_rankings && merit.subject_rankings.length) {
      const summaryHeight = 20 + merit.subject_rankings.length * 14 + 16;
      if (y + summaryHeight > contentBottom) {
        footer();
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 20 });
        pageHeader();
      }
      y += 12;
      doc.fillColor(navy).font('Helvetica-Bold').fontSize(8)
        .text('SUBJECT AVERAGES · CLASS RANKING · SUBJECT TEACHERS', margin, y, { width: tableWidth });
      y += 14;
      const sWidths = [34, 220, 64, 46, 150];
      let sx = margin;
      doc.fillColor(navy).rect(margin, y, sWidths.reduce((a, b) => a + b, 0), 16).fill();
      ['RANK', 'SUBJECT', 'AVERAGE', 'GRADE', 'TEACHER'].forEach((label, index) => {
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(6)
          .text(label, sx + 3, y + 5, { width: sWidths[index] - 6 });
        sx += sWidths[index];
      });
      y += 16;
      merit.subject_rankings.forEach((subject, index) => {
        let cellX = margin;
        const values = [
          String(index + 1),
          text(subject.subject_name),
          subject.average == null ? '—' : String(Math.round(subject.average * 10) / 10),
          text(subject.grade),
          text(subject.teacher || 'Not assigned')
        ];
        values.forEach((value, column) => {
          doc.fillColor(ink).font(column === 1 ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.2)
            .text(value, cellX + 3, y + 3, { width: sWidths[column] - 6, lineBreak: false, ellipsis: true });
          cellX += sWidths[column];
        });
        y += 14;
      });
    }

    footer();
    doc.end();
    const buffer = await done;
    const filename = `merit-${String(context.year_label || 'year').replace(/\W+/g, '-')}-${String(context.term_name || 'term').replace(/\W+/g, '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.end(buffer);
  } catch (error) {
    console.error('[results-centre merit pdf]', error);
    if (!res.headersSent) fail(res, error);
  }
});

module.exports = router;

from pathlib import Path
import re

# 1. Write backend/services/docx-roster-parser.js
service_dir = Path("backend/services")
service_dir.mkdir(parents=True, exist_ok=True)
service_path = service_dir / "docx-roster-parser.js"

service_code = """const zlib = require('zlib');
const path = require('path');
const fs = require('fs');

/**
 * Pure Node.js zero-dependency .docx extractor and table parser.
 * Handles zipped XML, table cells, and embedded passport photos.
 */
function unzipDocx(buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error('Uploaded file is not a valid Microsoft Word (.docx) document');

  const totalEntries = buffer.readUInt16LE(eocd + 10);
  const cdOffset = buffer.readUInt32LE(eocd + 16);

  const entries = {};
  let pos = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (buffer.readUInt32LE(pos) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(pos + 10);
    const compSize = buffer.readUInt32LE(pos + 20);
    const fnLen = buffer.readUInt16LE(pos + 28);
    const extraLen = buffer.readUInt16LE(pos + 30);
    const commentLen = buffer.readUInt16LE(pos + 32);
    const localOffset = buffer.readUInt32LE(pos + 42);

    const filename = buffer.toString('utf8', pos + 46, pos + 46 + fnLen);

    const localFnLen = buffer.readUInt16LE(localOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localFnLen + localExtraLen;

    const compData = buffer.slice(dataStart, dataStart + compSize);
    let data;
    if (method === 0) {
      data = compData;
    } else if (method === 8) {
      try {
        data = zlib.inflateRawSync(compData);
      } catch (err) {
        data = null;
      }
    } else {
      data = compData;
    }
    entries[filename] = data;

    pos += 46 + fnLen + extraLen + commentLen;
  }
  return entries;
}

function parseRelationships(relsXml) {
  const map = {};
  if (!relsXml) return map;
  const relRegex = /<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g;
  let m;
  while ((m = relRegex.exec(relsXml)) !== null) {
    let target = m[2];
    if (!target.startsWith('word/')) {
      target = 'word/' + target.replace(/^\\/+/, '');
    }
    map[m[1]] = target;
  }
  return map;
}

function parseDocxTables(documentXml, relsMap, entries) {
  if (!documentXml) return [];
  const tables = [];
  const tblRegex = /<w:tbl[\\s\\S]*?<\\/w:tbl>/g;
  let tblMatch;

  while ((tblMatch = tblRegex.exec(documentXml)) !== null) {
    const tblXml = tblMatch[0];
    const rows = [];
    const trRegex = /<w:tr[\\s\\S]*?<\\/w:tr>/g;
    let trMatch;

    while ((trMatch = trRegex.exec(tblXml)) !== null) {
      const trXml = trMatch[0];
      const cells = [];
      const tcRegex = /<w:tc[\\s\\S]*?<\\/w:tc>/g;
      let tcMatch;

      while ((tcMatch = tcRegex.exec(trXml)) !== null) {
        const tcXml = tcMatch[0];
        
        const textParts = [];
        const tRegex = /<w:t[^>]*>([^<]*)<\\/w:t>/g;
        let tMatch;
        while ((tMatch = tRegex.exec(tcXml)) !== null) {
          textParts.push(tMatch[1]);
        }
        const text = textParts.join('').trim();

        let imageBuffer = null;
        let imageExt = 'jpg';
        const imgMatch = tcXml.match(/r:(?:embed|id)="([^"]+)"/);
        if (imgMatch && relsMap[imgMatch[1]]) {
          const targetPath = relsMap[imgMatch[1]];
          const buf = entries[targetPath] || entries[targetPath.replace('word/', '')];
          if (buf) {
            imageBuffer = buf;
            const extMatch = targetPath.match(/\\.([a-zA-Z0-9]+)$/);
            if (extMatch) imageExt = extMatch[1].toLowerCase();
          }
        }

        cells.push({
          text,
          hasImage: Boolean(imageBuffer),
          imageBuffer,
          imageExt
        });
      }
      if (cells.length) rows.push(cells);
    }
    if (rows.length) tables.push(rows);
  }
  return tables;
}

function splitThreeNames(fullName) {
  if (!fullName) return { first: 'Learner', middle: '', last: '' };
  const parts = String(fullName).trim().split(/\\s+/).filter(Boolean);
  if (parts.length === 1) return { first: parts[0], middle: '', last: parts[0] };
  if (parts.length === 2) return { first: parts[0], middle: '', last: parts[1] };
  const first = parts[0];
  const middle = parts.slice(1, -1).join(' ');
  const last = parts[parts.length - 1];
  return { first, middle, last };
}

function normalizeKenyanPhone(p) {
  if (!p) return null;
  let digits = String(p).replace(/[^0-9]/g, '');
  if (digits.startsWith('0') && digits.length === 10) return '+254' + digits.slice(1);
  if (digits.startsWith('254') && digits.length === 12) return '+' + digits;
  if (digits.startsWith('7') && digits.length === 9) return '+254' + digits;
  if (digits.startsWith('1') && digits.length === 9) return '+254' + digits;
  return digits.length >= 9 ? '+' + digits : p;
}

function normalizePathway(str, isSenior) {
  if (!str) return isSenior ? 'STEM' : 'EXPLORATORY';
  const s = String(str).toUpperCase();
  if (s.includes('STEM') || s.includes('SCIENCE') || s.includes('TECH') || s.includes('ENGINEER') || s.includes('MATH')) return 'STEM';
  if (s.includes('SOCIAL') || s.includes('HUMANIT') || s.includes('BUSINESS') || s.includes('LANG')) return 'SOCIAL_SCIENCES';
  if (s.includes('ART') || s.includes('SPORT') || s.includes('MUSIC') || s.includes('DRAMA')) return 'ARTS_SPORTS';
  return isSenior ? 'STEM' : 'EXPLORATORY';
}

function normalizeGender(g) {
  if (!g) return null;
  const s = String(g).trim().toUpperCase();
  if (s.startsWith('M')) return 'MALE';
  if (s.startsWith('F')) return 'FEMALE';
  return null;
}

function parseDateOfBirth(d) {
  if (!d) return null;
  const s = String(d).trim();
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(s)) return s;
  const m = s.match(/^(\\d{1,2})[\\/\\-\\.](\\d{1,2})[\\/\\-\\.](\\d{4})$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    const year = m[3];
    return `${year}-${month}-${day}`;
  }
  return null;
}

function extractLearnersFromDocx(docxBuffer, isSeniorSchool = false) {
  const entries = unzipDocx(docxBuffer);
  const docXml = entries['word/document.xml'] ? entries['word/document.xml'].toString('utf8') : null;
  const relsXml = entries['word/_rels/document.xml.rels'] ? entries['word/_rels/document.xml.rels'].toString('utf8') : null;

  if (!docXml) throw new Error('Could not find word/document.xml in uploaded file');

  const relsMap = parseRelationships(relsXml);
  const tables = parseDocxTables(docXml, relsMap, entries);

  if (!tables.length) {
    throw new Error('No tables found in this Word document. Please ensure learners are organized in a table.');
  }

  const table = tables.slice().sort((a, b) => b.length - a.length)[0];
  if (table.length < 2) {
    throw new Error('The table has fewer than 2 rows (needs header row + learner rows).');
  }

  const headerRow = table[0].map(c => c.text.toLowerCase());
  
  let photoCol = table[0].findIndex((c, i) => c.hasImage || /photo|passport|picture|image/i.test(c.text));
  if (photoCol === -1 && table[1] && table[1][0]?.hasImage) photoCol = 0;

  let assNoCol = headerRow.findIndex(h => /ass.*no|upi|nemis|index|assessment/i.test(h));
  let admNoCol = headerRow.findIndex(h => /adm.*no|admission|reg.*no/i.test(h));
  let nameCol = headerRow.findIndex(h => /name|learner|student/i.test(h) && !/parent|guardian|father|mother/i.test(h));
  let dobCol = headerRow.findIndex(h => /dob|birth|date of birth/i.test(h));
  let genderCol = headerRow.findIndex(h => /gender|sex/i.test(h));
  let pathwayCol = headerRow.findIndex(h => /pathway|track|stream|interest|career/i.test(h));
  let parentCol = headerRow.findIndex(h => /parent|guardian|father|mother/i.test(h));
  let phoneCol = headerRow.findIndex(h => /phone|mobile|contact|tel/i.test(h));

  if (admNoCol === -1) admNoCol = photoCol === 0 ? 1 : 0;
  if (assNoCol === -1) assNoCol = photoCol === 0 ? 2 : 1;
  if (nameCol === -1) nameCol = photoCol === 0 ? 3 : 2;

  const learners = [];

  for (let r = 1; r < table.length; r++) {
    const row = table[r];
    const rowText = row.map(c => c.text).join('').trim();
    if (!rowText && !row.some(c => c.hasImage)) continue;

    let photoBuffer = null;
    let photoExt = 'jpg';
    if (photoCol !== -1 && row[photoCol]?.hasImage) {
      photoBuffer = row[photoCol].imageBuffer;
      photoExt = row[photoCol].imageExt;
    } else {
      const imgCell = row.find(c => c.hasImage);
      if (imgCell) {
        photoBuffer = imgCell.imageBuffer;
        photoExt = imgCell.imageExt;
      }
    }

    const admNo = admNoCol !== -1 && row[admNoCol] ? row[admNoCol].text.trim() : `AUTO-${r}`;
    const assNo = assNoCol !== -1 && row[assNoCol] ? row[assNoCol].text.trim() : null;
    const rawName = nameCol !== -1 && row[nameCol] ? row[nameCol].text.trim() : `Learner ${r}`;
    const { first, middle, last } = splitThreeNames(rawName);

    const dob = dobCol !== -1 && row[dobCol] ? parseDateOfBirth(row[dobCol].text) : null;
    const gender = genderCol !== -1 && row[genderCol] ? normalizeGender(row[genderCol].text) : null;
    const rawPathway = pathwayCol !== -1 && row[pathwayCol] ? row[pathwayCol].text.trim() : '';
    const pathway = normalizePathway(rawPathway, isSeniorSchool);

    const parentName = parentCol !== -1 && row[parentCol] ? row[parentCol].text.trim() : null;
    const parentPhone = phoneCol !== -1 && row[phoneCol] ? normalizeKenyanPhone(row[phoneCol].text) : null;

    if (!admNo && !rawName) continue;

    learners.push({
      row_index: r,
      admission_no: admNo,
      assessment_no: assNo,
      raw_name: rawName,
      first_name: first,
      middle_name: middle,
      last_name: last,
      date_of_birth: dob,
      gender,
      cbc_pathway: pathway,
      pathway_track: rawPathway || (pathway === 'STEM' ? 'Pure Sciences' : 'General'),
      parent_name: parentName,
      parent_phone: parentPhone,
      has_photo: Boolean(photoBuffer),
      photo_buffer: photoBuffer,
      photo_ext: photoExt,
      photo_thumbnail: photoBuffer ? `data:image/${photoExt};base64,${photoBuffer.toString('base64')}` : null
    });
  }

  return {
    total_found: learners.length,
    photos_matched: learners.filter(l => l.has_photo).length,
    learners
  };
}

module.exports = {
  extractLearnersFromDocx,
  unzipDocx,
  splitThreeNames,
  normalizeKenyanPhone,
  normalizePathway
};
"""
service_path.write_text(service_code, encoding="utf-8")
print("✓ backend/services/docx-roster-parser.js created.")

# 2. Write backend/routes/docx-import.js
routes_dir = Path("backend/routes")
routes_path = routes_dir / "docx-import.js"

route_code = """const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { schoolBoundary, roles } = require('../middleware/auth');
const { extractLearnersFromDocx } = require('../services/docx-roster-parser');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

router.post(
  '/:schoolId/preview',
  schoolBoundary,
  roles('SCHOOL_ADMIN', 'ADMIN', 'CLASS_TEACHER', 'SENIOR_TEACHER'),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Please select a Microsoft Word (.docx) document.' });
      const { schoolId } = req.params;
      const { class_id } = req.body;

      let isSenior = false;
      let className = 'Selected Class';

      if (class_id) {
        const clsRes = await db.query(
          `SELECT cl.id, cl.name, cl.stream, sl.name AS level_name, ss.name AS section_name
           FROM classes cl
           LEFT JOIN school_levels sl ON sl.id = cl.school_level_id
           LEFT JOIN school_sections ss ON ss.id = sl.school_section_id
           WHERE cl.id = $1 AND cl.school_id = $2 LIMIT 1`,
          [class_id, schoolId]
        );
        if (clsRes.rows.length) {
          const row = clsRes.rows[0];
          className = `${row.name} ${row.stream || ''}`.trim();
          const lvl = String(row.level_name || '').toUpperCase();
          const sec = String(row.section_name || '').toUpperCase();
          isSenior = /SENIOR|GRADE_10|GRADE_11|GRADE_12|FORM_3|FORM_4|10|11|12/.test(lvl) || /SENIOR/.test(sec);
        }
      }

      const parsed = extractLearnersFromDocx(req.file.buffer, isSenior);

      const existingRes = await db.query(
        `SELECT id, admission_no, assessment_no, first_name, last_name
         FROM learners
         WHERE school_id = $1`,
        [schoolId]
      );
      const existingAdms = new Map();
      const existingAss = new Map();
      for (const row of existingRes.rows) {
        if (row.admission_no) existingAdms.set(row.admission_no.toLowerCase().trim(), row);
        if (row.assessment_no) existingAss.set(row.assessment_no.toLowerCase().trim(), row);
      }

      const learnersWithStatus = parsed.learners.map(l => {
        const dupAdm = l.admission_no ? existingAdms.get(l.admission_no.toLowerCase().trim()) : null;
        const dupAss = l.assessment_no ? existingAss.get(l.assessment_no.toLowerCase().trim()) : null;
        return {
          ...l,
          photo_buffer: undefined,
          is_duplicate: Boolean(dupAdm || dupAss),
          duplicate_reason: dupAdm
            ? `Admission no. ${l.admission_no} already exists (${dupAdm.first_name} ${dupAdm.last_name})`
            : dupAss
            ? `Assessment no. ${l.assessment_no} already exists (${dupAss.first_name} ${dupAss.last_name})`
            : null
        };
      });

      res.json({
        success: true,
        class_name: className,
        is_senior_school: isSenior,
        total_found: parsed.total_found,
        photos_matched: parsed.photos_matched,
        duplicates_count: learnersWithStatus.filter(l => l.is_duplicate).length,
        learners: learnersWithStatus
      });
    } catch (err) {
      console.error('Word document preview error:', err);
      res.status(400).json({ error: err.message || 'Unable to parse Word document.' });
    }
  }
);

router.post(
  '/:schoolId/commit',
  schoolBoundary,
  roles('SCHOOL_ADMIN', 'ADMIN', 'CLASS_TEACHER', 'SENIOR_TEACHER'),
  upload.single('file'),
  async (req, res) => {
    const client = await db.pool.connect();
    try {
      if (!req.file) return res.status(400).json({ error: 'Please select a Microsoft Word (.docx) document.' });
      const { schoolId } = req.params;
      const { class_id, academic_year_id } = req.body;

      if (!class_id || !academic_year_id) {
        return res.status(400).json({ error: 'Target Class and Academic Year are required.' });
      }

      const clsRes = await client.query(
        `SELECT cl.id, cl.name, cl.stream, sl.name AS level_name, ss.name AS section_name
         FROM classes cl
         LEFT JOIN school_levels sl ON sl.id = cl.school_level_id
         LEFT JOIN school_sections ss ON ss.id = sl.school_section_id
         WHERE cl.id = $1 AND cl.school_id = $2 LIMIT 1`,
        [class_id, schoolId]
      );
      if (!clsRes.rows.length) return res.status(404).json({ error: 'Class not found.' });

      const isSenior = /SENIOR|GRADE_10|GRADE_11|GRADE_12|FORM_3|FORM_4|10|11|12/.test(String(clsRes.rows[0].level_name || '').toUpperCase());
      const parsed = extractLearnersFromDocx(req.file.buffer, isSenior);

      if (!parsed.learners.length) return res.status(400).json({ error: 'No valid learner records found.' });

      const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads', schoolId);
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

      await client.query('BEGIN');
      const enrolled = [];
      const skipped = [];

      for (const l of parsed.learners) {
        const dup = await client.query(
          `SELECT id FROM learners WHERE school_id = $1 AND (
             (NULLIF(trim($2::text),'') IS NOT NULL AND lower(trim(admission_no))=lower(trim($2::text))) OR
             (NULLIF(trim($3::text),'') IS NOT NULL AND lower(trim(assessment_no))=lower(trim($3::text)))
           ) LIMIT 1`,
          [schoolId, l.admission_no || '', l.assessment_no || '']
        );

        if (dup.rows.length) {
          skipped.push({ admission_no: l.admission_no, reason: 'Already registered' });
          continue;
        }

        let photoUrl = null;
        if (l.photo_buffer) {
          const safeAdm = String(l.admission_no).replace(/[^a-zA-Z0-9_-]/g, '_');
          const photoFilename = `passport_${safeAdm}_${Date.now()}.${l.photo_ext}`;
          const photoPath = path.join(uploadDir, photoFilename);
          fs.writeFileSync(photoPath, l.photo_buffer);
          photoUrl = `/uploads/${schoolId}/${photoFilename}`;
        }

        const learnerRes = await client.query(
          `INSERT INTO learners (
             school_id, admission_no, assessment_no, first_name, middle_name, last_name,
             date_of_birth, gender, class_id, parent_phone, passport_photo_url
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id, admission_no, first_name, last_name`,
          [
            schoolId,
            l.admission_no || null,
            l.assessment_no || null,
            l.first_name,
            l.middle_name || null,
            l.last_name,
            l.date_of_birth || null,
            l.gender || null,
            class_id,
            l.parent_phone || null,
            photoUrl
          ]
        );

        const newLearner = learnerRes.rows[0];

        await client.query(
          `INSERT INTO learner_enrollments (school_id, learner_id, academic_year_id, class_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (learner_id, academic_year_id) DO UPDATE SET class_id = EXCLUDED.class_id`,
          [schoolId, newLearner.id, academic_year_id, class_id]
        );

        if (isSenior && l.cbc_pathway) {
          try {
            await client.query(
              `INSERT INTO report_pathway_guidance (
                 school_id, learner_id, academic_year_id, selected_pathway, track_specialisation
               ) VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (school_id, learner_id, academic_year_id, term_id)
               DO UPDATE SET selected_pathway = EXCLUDED.selected_pathway, track_specialisation = EXCLUDED.track_specialisation`,
              [schoolId, newLearner.id, academic_year_id, l.cbc_pathway, l.pathway_track || 'General']
            );
          } catch (_) {}
        }

        if (l.parent_name && l.parent_phone) {
          try {
            const pRes = await client.query(
              `INSERT INTO parents (school_id, first_name, last_name, phone)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT DO NOTHING RETURNING id`,
              [schoolId, l.parent_name, 'Parent', l.parent_phone]
            );
            const parentId = pRes.rows[0]?.id;
            if (parentId) {
              await client.query(
                `INSERT INTO parent_learners (school_id, parent_id, learner_id, relationship)
                 VALUES ($1, $2, $3, 'Parent')
                 ON CONFLICT DO NOTHING`,
                [schoolId, parentId, newLearner.id]
              );
            }
          } catch (_) {}
        }

        enrolled.push({
          id: newLearner.id,
          admission_no: newLearner.admission_no,
          name: `${newLearner.first_name} ${newLearner.last_name}`,
          photo_saved: Boolean(photoUrl),
          pathway: l.cbc_pathway
        });
      }

      await client.query('COMMIT');
      res.json({
        success: true,
        message: `Successfully enrolled ${enrolled.length} learner(s) with photos and records.`,
        enrolled_count: enrolled.length,
        skipped_count: skipped.length,
        enrolled,
        skipped
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Word document commit error:', err);
      res.status(500).json({ error: err.message || 'Unable to complete learner enrollment.' });
    } finally {
      client.release();
    }
  }
);

module.exports = router;
"""
routes_path.write_text(route_code, encoding="utf-8")
print("✓ backend/routes/docx-import.js created.")

# 3. Mount in backend/server.js
server_path = Path("backend/server.js")
if server_path.exists():
    server_src = server_path.read_text(encoding="utf-8")
    if 'docx-import' not in server_src:
        needle = 'app.use("/api/extended",require("./routes/extended"));'
        replacement = needle + 'app.use("/api/docx-import",require("./routes/docx-import"));'
        if needle in server_src:
            server_src = server_src.replace(needle, replacement, 1)
            server_path.write_text(server_src, encoding="utf-8")
            print("✓ backend/server.js: /api/docx-import mounted.")

# 4. Write public/js/docx-import-modal.js
js_dir = Path("public/js")
js_dir.mkdir(parents=True, exist_ok=True)
modal_path = js_dir / "docx-import-modal.js"

modal_code = """(function () {
  'use strict';

  function createModal() {
    if (document.getElementById('docxImportModal')) return;

    const modal = document.createElement('div');
    modal.id = 'docxImportModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-card" style="width: min(940px, 96vw); max-height: 92vh; border-radius: 18px; padding: 24px; box-shadow: 0 25px 80px rgba(0,0,0,0.4);">
        <button type="button" class="modal-close" id="docxCloseModal">&times;</button>
        
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: #17365D; color: #fff; display: grid; place-items: center; font-size: 22px;">📄</div>
          <div>
            <h2 style="margin: 0; font-size: 1.35rem; color: #17365D;">Word Document (.docx) Class Importer</h2>
            <p class="muted small" style="margin: 2px 0 0;">Upload a Word table with embedded passport photos for instant class enrollment.</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin: 16px 0; background: #f8fafc; padding: 14px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <label style="font-weight: 700; font-size: 0.82rem; color: #334155;">
            Target Academic Year
            <select id="docxYear" style="width: 100%; margin-top: 5px; padding: 8px; border-radius: 8px; border: 1px solid #cbd5e1;"></select>
          </label>
          <label style="font-weight: 700; font-size: 0.82rem; color: #334155;">
            Target Class
            <select id="docxClass" style="width: 100%; margin-top: 5px; padding: 8px; border-radius: 8px; border: 1px solid #cbd5e1;"></select>
          </label>
          <div style="display: flex; flex-direction: column; justify-content: center;">
            <span style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; font-weight: 800;">Curriculum Mode</span>
            <div id="docxCurriculumBadge" style="margin-top: 4px; display: inline-flex; align-items: center; font-size: 0.82rem; font-weight: 800; color: #047857; background: #d1fae5; padding: 4px 10px; border-radius: 999px;">
              🌱 Junior School (JSS): Exploratory
            </div>
          </div>
        </div>

        <div id="docxDropzone" style="border: 2px dashed #94a3b8; border-radius: 14px; padding: 26px 18px; text-align: center; cursor: pointer; background: #fafbfc; transition: border-color 0.2s, background 0.2s;">
          <input type="file" id="docxFileInput" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style="display: none;">
          <div style="font-size: 32px; margin-bottom: 6px;">📥</div>
          <b style="color: #17365D; font-size: 1rem;">Click to upload or drag & drop Word document (.docx)</b>
          <p class="muted small" style="margin: 4px 0 0;">Accepts Microsoft Word tables containing passport photos, full names, Adm/Ass numbers & parent contacts.</p>
        </div>

        <div id="docxStatusMessage" style="margin-top: 10px; font-size: 0.88rem; display: none;" class="status"></div>

        <div id="docxPreviewArea" style="display: none; margin-top: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="display: flex; gap: 10px; align-items: center;">
              <span class="pill" id="docxCountBadge" style="background: #17365D; color: #fff;">0 Learners</span>
              <span class="pill" id="docxPhotosBadge" style="background: #047857; color: #fff;">0 Photos Matched</span>
              <span class="pill" id="docxDupBadge" style="background: #e2e8f0; color: #334155; display: none;">0 Duplicates</span>
            </div>
          </div>

          <div style="max-height: 280px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 10px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; text-align: left;">
              <thead style="background: #f1f5f9; position: sticky; top: 0; z-index: 2;">
                <tr>
                  <th style="padding: 8px; border-bottom: 1px solid #cbd5e1;">Photo</th>
                  <th style="padding: 8px; border-bottom: 1px solid #cbd5e1;">Learner Name</th>
                  <th style="padding: 8px; border-bottom: 1px solid #cbd5e1;">Adm / Ass No.</th>
                  <th style="padding: 8px; border-bottom: 1px solid #cbd5e1;">DOB / Gender</th>
                  <th style="padding: 8px; border-bottom: 1px solid #cbd5e1;">CBC Pathway</th>
                  <th style="padding: 8px; border-bottom: 1px solid #cbd5e1;">Parent Contact</th>
                </tr>
              </thead>
              <tbody id="docxPreviewRows"></tbody>
            </table>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 18px; padding-top: 14px; border-top: 1px solid #e2e8f0;">
          <button type="button" class="btn secondary" id="docxCancelBtn">Cancel</button>
          <div style="display: flex; gap: 10px;">
            <button type="button" class="btn primary" id="docxCommitBtn" disabled style="background: #047857; border-color: #047857;">Confirm & Enrol Class</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
      modal.classList.remove('open');
      reset();
    };
    document.getElementById('docxCloseModal').onclick = close;
    document.getElementById('docxCancelBtn').onclick = close;

    let selectedFile = null;
    const dropzone = document.getElementById('docxDropzone');
    const fileInput = document.getElementById('docxFileInput');

    dropzone.onclick = () => fileInput.click();
    dropzone.ondragover = e => {
      e.preventDefault();
      dropzone.style.background = '#eff6ff';
      dropzone.style.borderColor = '#17365D';
    };
    dropzone.ondragleave = () => {
      dropzone.style.background = '#fafbfc';
      dropzone.style.borderColor = '#94a3b8';
    };
    dropzone.ondrop = e => {
      e.preventDefault();
      dropzone.style.background = '#fafbfc';
      dropzone.style.borderColor = '#94a3b8';
      if (e.dataTransfer.files?.length) handleFile(e.dataTransfer.files[0]);
    };
    fileInput.onchange = () => {
      if (fileInput.files?.length) handleFile(fileInput.files[0]);
    };

    function reset() {
      selectedFile = null;
      fileInput.value = '';
      document.getElementById('docxPreviewArea').style.display = 'none';
      document.getElementById('docxStatusMessage').style.display = 'none';
      document.getElementById('docxCommitBtn').disabled = true;
      document.getElementById('docxCommitBtn').textContent = 'Confirm & Enrol Class';
    }

    async function handleFile(file) {
      if (!file.name.toLowerCase().endsWith('.docx')) {
        alert('Please upload a Microsoft Word document (.docx)');
        return;
      }
      selectedFile = file;

      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const schoolId = user.school_id || new URLSearchParams(location.search).get('school_id');
      const token = localStorage.getItem('token');
      const classId = document.getElementById('docxClass').value;

      const status = document.getElementById('docxStatusMessage');
      status.style.display = 'block';
      status.className = 'status';
      status.textContent = 'Scanning Word document and extracting passport photos…';

      const formData = new FormData();
      formData.append('file', file);
      formData.append('class_id', classId);

      try {
        const response = await fetch(`/api/docx-import/${schoolId}/preview`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to parse Word document.');

        status.style.display = 'none';
        renderPreview(result);
      } catch (err) {
        status.style.display = 'block';
        status.className = 'status';
        status.style.color = '#b91c1c';
        status.textContent = `Upload error: ${err.message}`;
      }
    }

    function renderPreview(data) {
      const area = document.getElementById('docxPreviewArea');
      area.style.display = 'block';

      document.getElementById('docxCountBadge').textContent = `${data.total_found} Learners`;
      document.getElementById('docxPhotosBadge').textContent = `${data.photos_matched} Photos Matched`;

      const dupBadge = document.getElementById('docxDupBadge');
      if (data.duplicates_count > 0) {
        dupBadge.style.display = 'inline-flex';
        dupBadge.style.background = '#fef2f2';
        dupBadge.style.color = '#991b1b';
        dupBadge.textContent = `${data.duplicates_count} Existing / Duplicates`;
      } else {
        dupBadge.style.display = 'none';
      }

      const tbody = document.getElementById('docxPreviewRows');
      tbody.innerHTML = data.learners.map((l, i) => `
        <tr style="border-bottom: 1px solid #e2e8f0; ${l.is_duplicate ? 'background: #fff1f2;' : (i % 2 === 0 ? 'background: #ffffff;' : 'background: #f8fafc;')}">
          <td style="padding: 6px 8px;">
            ${l.photo_thumbnail 
              ? `<img src="${l.photo_thumbnail}" alt="Passport" style="width: 36px; height: 36px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1;">`
              : `<div style="width: 36px; height: 36px; border-radius: 6px; background: #e2e8f0; display: grid; place-items: center; font-size: 14px; color: #64748b;">👤</div>`
            }
          </td>
          <td style="padding: 6px 8px; font-weight: 700; color: #1e293b;">
            ${escapeHtml(l.first_name)} ${escapeHtml(l.middle_name || '')} ${escapeHtml(l.last_name)}
            ${l.is_duplicate ? `<div style="font-size: 10px; color: #b91c1c;">⚠️ ${escapeHtml(l.duplicate_reason || 'Duplicate')}</div>` : ''}
          </td>
          <td style="padding: 6px 8px; font-family: monospace;">
            <b>${escapeHtml(l.admission_no)}</b>
            ${l.assessment_no ? `<div class="muted small">${escapeHtml(l.assessment_no)}</div>` : ''}
          </td>
          <td style="padding: 6px 8px;">
            ${escapeHtml(l.date_of_birth || '—')} · ${escapeHtml(l.gender || '—')}
          </td>
          <td style="padding: 6px 8px;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 800; ${l.cbc_pathway === 'STEM' ? 'background: #dbeafe; color: #1e40af;' : (l.cbc_pathway === 'SOCIAL_SCIENCES' ? 'background: #fef3c7; color: #92400e;' : (l.cbc_pathway === 'ARTS_SPORTS' ? 'background: #f3e8ff; color: #6b21a8;' : 'background: #e2e8f0; color: #334155;'))}">
              ${escapeHtml(l.cbc_pathway)}
            </span>
          </td>
          <td style="padding: 6px 8px;">
            ${escapeHtml(l.parent_name || '')}
            <div style="font-family: monospace; font-size: 11px; color: #475569;">${escapeHtml(l.parent_phone || 'No phone')}</div>
          </td>
        </tr>
      `).join('');

      const commitBtn = document.getElementById('docxCommitBtn');
      commitBtn.disabled = data.total_found === 0;
      commitBtn.textContent = `Confirm & Enrol ${data.total_found} Learners`;

      commitBtn.onclick = async () => {
        if (!selectedFile) return;
        commitBtn.disabled = true;
        commitBtn.textContent = 'Enrolling learners & saving photos…';

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const schoolId = user.school_id || new URLSearchParams(location.search).get('school_id');
        const token = localStorage.getItem('token');
        const classId = document.getElementById('docxClass').value;
        const yearId = document.getElementById('docxYear').value;

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('class_id', classId);
        formData.append('academic_year_id', yearId);

        try {
          const res = await fetch(`/api/docx-import/${schoolId}/commit`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Enrollment failed.');

          alert(json.message || `Enrolled ${json.enrolled_count} learners successfully!`);
          modal.classList.remove('open');
          reset();

          if (typeof window.load === 'function') window.load();
        } catch (err) {
          alert(`Enrollment error: ${err.message}`);
          commitBtn.disabled = false;
          commitBtn.textContent = `Retry Enrollment`;
        }
      };
    }

    function escapeHtml(str) {
      return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
  }

  function syncClassOptions() {
    const classSel = document.getElementById('docxClass');
    const yearSel = document.getElementById('docxYear');
    if (!classSel || !yearSel) return;

    const stateYears = (window.state && window.state.years) || [];
    const stateClasses = (window.state && window.state.classes) || [];

    if (stateYears.length && !yearSel.options.length) {
      yearSel.innerHTML = stateYears.map(y => `<option value="${y.id}">${y.year_label}</option>`).join('');
    }
    if (stateClasses.length && !classSel.options.length) {
      classSel.innerHTML = stateClasses.map(c => `<option value="${c.id}" data-level="${c.level_name || ''}">${c.name} ${c.stream || ''} · ${c.level_name || ''}</option>`).join('');
    }

    const badge = document.getElementById('docxCurriculumBadge');
    const updateBadge = () => {
      const selected = classSel.selectedOptions[0];
      const level = String(selected?.dataset?.level || selected?.textContent || '').toUpperCase();
      const isSenior = /SENIOR|GRADE_10|GRADE_11|GRADE_12|FORM_3|FORM_4|10|11|12/.test(level);
      if (badge) {
        if (isSenior) {
          badge.textContent = '🎓 Senior School: CBC Pathways (STEM / Social / Arts)';
          badge.style.background = '#e0e7ff';
          badge.style.color = '#3730a3';
        } else {
          badge.textContent = '🌱 Junior School (JSS): Exploratory / Broad';
          badge.style.background = '#d1fae5';
          badge.style.color = '#047857';
        }
      }
    };

    classSel.onchange = updateBadge;
    updateBadge();
  }

  function injectImportButtons() {
    const lForm = document.getElementById('learnerForm');
    if (lForm && !document.getElementById('btnDocxImportLearnerForm')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'btnDocxImportLearnerForm';
      btn.className = 'btn secondary';
      btn.style.cssText = 'margin-bottom: 12px; font-weight: 800; background: #e0f2fe; color: #0369a1; border-color: #bae6fd;';
      btn.innerHTML = '📄 Import Class from Word (.docx) with Photos';
      btn.onclick = () => {
        createModal();
        syncClassOptions();
        document.getElementById('docxImportModal')?.classList.add('open');
      };
      lForm.parentNode.insertBefore(btn, lForm);
    }

    const admHost = document.getElementById('zelimuAdmissionsFormHostV2');
    if (admHost && !document.getElementById('btnDocxImportAdmissions')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'btnDocxImportAdmissions';
      btn.className = 'btn secondary';
      btn.style.cssText = 'margin: 10px 0; font-weight: 800; background: #e0f2fe; color: #0369a1; border-color: #bae6fd;';
      btn.innerHTML = '📄 Import Class Register (.docx)';
      btn.onclick = () => {
        createModal();
        syncClassOptions();
        document.getElementById('docxImportModal')?.classList.add('open');
      };
      admHost.parentNode.insertBefore(btn, admHost);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      createModal();
      injectImportButtons();
    });
  } else {
    createModal();
    injectImportButtons();
  }

  window.addEventListener('load', () => {
    injectImportButtons();
    syncClassOptions();
  });
})();
"""
modal_path.write_text(modal_code, encoding="utf-8")
print("✓ public/js/docx-import-modal.js created.")

# 5. Link script in public/dashboard.html
dash_path = Path("public/dashboard.html")
if dash_path.exists():
    dash_src = dash_path.read_text(encoding="utf-8")
    if 'docx-import-modal.js' not in dash_src:
        needle = '<script src="/js/zelimu-approved-dashboard.js?v=instant-complete-20261109"></script>'
        if needle in dash_src:
            dash_src = dash_src.replace(needle, needle + '\n<script src="/js/docx-import-modal.js?v=1"></script>', 1)
            dash_path.write_text(dash_src, encoding="utf-8")
            print("✓ public/dashboard.html: docx-import-modal.js linked.")

print("\nWord Document Learner Importer successfully installed!")

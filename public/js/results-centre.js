/* ZELIMU Results Command Centre — one screen for marks, merit and analytics */
(function () {
  'use strict';

  var root = document.getElementById('resultsCentre');
  if (!root) return;

  var token = localStorage.getItem('token');
  var user = {};
  try { user = JSON.parse(localStorage.getItem('user') || '{}') || {}; } catch (e) { user = {}; }
  var querySid = new URLSearchParams(location.search).get('school_id');
  var sid = user.school_id || querySid;
  if (!token || !sid) return;

  var state = {
    booted: false,
    tab: 'command',
    options: null,
    cmd: null,
    merit: null,
    analytics: null,
    busy: false,
    cmdSel: { year: '', term: '', type: '', class: '' },
    meritSel: { year: '', term: '', assessment: '', class: '', pass: 50, strict: false },
    analyticsSel: { year: '', term: '', class: '' },
    status: ''
  };

  var TYPE_LABEL = { '': 'All assessments', OPENER: 'Opener', MID_TERM: 'Mid Term', CAT: 'CATs', END_TERM: 'End Term' };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function api(path, opt) {
    opt = opt || {};
    var headers = Object.assign({ Authorization: 'Bearer ' + token }, opt.headers || {});
    var method = String(opt.method || 'GET').toUpperCase();
    if (opt.body && typeof opt.body !== 'string') {
      headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(opt.body);
    }
    return fetch(path, Object.assign({}, opt, { headers: headers })).then(function (res) {
      return res.text().then(function (raw) {
        var data = {};
        if (raw && raw.trim()) {
          try { data = JSON.parse(raw); } catch (e) { throw new Error('Server returned an invalid response (HTTP ' + res.status + ').'); }
        }
        if (res.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          location.href = '/login.html';
          throw new Error('Session expired. Please sign in again.');
        }
        if (!res.ok) throw new Error((data.error || 'Request failed') + ' [HTTP ' + res.status + ']');
        return data;
      });
    });
  }

  function num(value, digits) {
    if (value == null || value === '' || !isFinite(Number(value))) return '—';
    var n = Number(value);
    return n.toFixed(digits == null ? 1 : digits).replace(/\.0+$/, '');
  }

  function pct(value) {
    if (value == null || !isFinite(Number(value))) return '—';
    return Math.round(Number(value)) + '%';
  }

  function ago(value) {
    if (!value) return 'No marks yet';
    var then = new Date(value).getTime();
    if (!isFinite(then)) return '—';
    var diff = Math.max(0, Date.now() - then);
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + ' min ago';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
    var days = Math.floor(hours / 24);
    if (days < 30) return days + (days === 1 ? ' day ago' : ' days ago');
    return new Date(value).toLocaleDateString();
  }

  function badge(stateValue, text) {
    var key = String(stateValue || '').toLowerCase();
    if (key !== 'current' && key !== 'historical' && key !== 'upcoming') key = 'historical';
    return '<span class="zrc-badge ' + key + '">' + esc(text || stateValue || '') + '</span>';
  }

  function gradeClass(label) {
    var key = String(label || '').toUpperCase();
    if (key === 'A' || key === 'EE') return 'gA';
    if (key === 'B' || key === 'ME') return 'gB';
    if (key === 'C' || key === 'AE') return 'gC';
    if (key === 'D' || key === 'BE') return 'gD';
    if (key === 'E') return 'gE';
    return '';
  }

  function cellClass(percent) {
    if (percent == null) return 's0';
    if (percent >= 95) return 'g4';
    if (percent >= 75) return 'g3';
    if (percent >= 50) return 'g2';
    if (percent >= 25) return 'g1';
    return 'g0';
  }

  function download(path) {
    return fetch(path, { headers: { Authorization: 'Bearer ' + token } }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (raw) {
          var msg = 'Download failed';
          try { msg = JSON.parse(raw).error || msg; } catch (e) { /* keep default */ }
          throw new Error(msg + ' [HTTP ' + res.status + ']');
        });
      }
      var name = 'merit-list';
      var disposition = res.headers.get('Content-Disposition') || '';
      var match = /filename="?([^";]+)"?/i.exec(disposition);
      if (match) name = match[1];
      return res.blob().then(function (blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      });
    });
  }

  function qs(obj) {
    return Object.keys(obj).filter(function (key) {
      var value = obj[key];
      return value !== '' && value != null;
    }).map(function (key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]);
    }).join('&');
  }

  function option(value, label, selected) {
    return '<option value="' + esc(value) + '"' + (String(selected) === String(value) ? ' selected' : '') + '>' + esc(label) + '</option>';
  }

  function termOptions(yearId, selected) {
    var year = (state.options.years || []).filter(function (y) { return String(y.id) === String(yearId); })[0];
    var terms = year ? year.terms : [];
    if (!terms.length) return '<option value="">No term configured</option>';
    return terms.map(function (term) {
      return option(term.id, term.name + (term.state === 'CURRENT' ? ' · current' : ''), selected);
    }).join('');
  }

  function classOptions(selected, includeAll) {
    var classes = state.options.classes || [];
    var html = includeAll && state.options.can_see_all !== false ? option('', 'All classes', selected) : '';
    return html + classes.map(function (c) {
      return option(c.id, c.label + (c.learners != null ? ' · ' + c.learners + ' learners' : ''), selected);
    }).join('');
  }

  function shell() {
    root.classList.add('zrc');
    root.innerHTML = [
      '<div class="zrc-head">',
      '  <div>',
      '    <div class="zrc-eyebrow">ACADEMIC OPERATIONS · ONE RESULTS PIPELINE</div>',
      '    <h2>Results Command Centre</h2>',
      '    <p>Capture marks, reproduce the exact merit list and read the same analytics — all from one date-aware context. Report cards, merit and publishing use one scoring path.</p>',
      '  </div>',
      '  <div class="zrc-head-actions">',
      '    <button class="zrc-btn ghost" type="button" data-zrc-action="refresh">Refresh data</button>',
      '    <button class="zrc-btn gold" type="button" data-zrc-action="pack">Generate results pack</button>',
      '  </div>',
      '</div>',
      '<div class="zrc-tabs" role="tablist">',
      '  <button class="zrc-tab is-active" type="button" role="tab" data-zrc-tab="command">Results Command Centre</button>',
      '  <button class="zrc-tab" type="button" role="tab" data-zrc-tab="merit">Merit List Reproduction</button>',
      '  <button class="zrc-tab" type="button" role="tab" data-zrc-tab="analytics">Academic Analytics</button>',
      '</div>',
      '<div class="zrc-panel is-active" data-zrc-panel="command"><div class="zrc-loading">Loading the school calendar…</div></div>',
      '<div class="zrc-panel" data-zrc-panel="merit"><div class="zrc-loading">Merit list loads when you open this tab.</div></div>',
      '<div class="zrc-panel" data-zrc-panel="analytics"><div class="zrc-loading">Analytics load when you open this tab.</div></div>'
    ].join('');
  }

  function panel(name) {
    return root.querySelector('[data-zrc-panel="' + name + '"]');
  }

  function loadOptions(extra) {
    return api('/api/results-centre/' + sid + '/options' + (extra ? '?' + qs(extra) : '')).then(function (options) {
      state.options = options;
      var firstClass = (options.classes || [])[0];
      if (options.can_see_all === false && firstClass && !state.cmdSel.class) {
        state.cmdSel.class = String(firstClass.id);
        state.meritSel.class = String(firstClass.id);
        state.analyticsSel.class = String(firstClass.id);
      }
      return options;
    });
  }

  function currentYear() {
    var sel = state.options.years.filter(function (y) { return String(y.id) === String(state.cmdSel.year); })[0];
    return sel || state.options.year;
  }

  function contextBar(scope) {
    var year = (state.options.years || []).filter(function (y) { return String(y.id) === String(scope.year); })[0] || state.options.year;
    var terms = year ? year.terms : [];
    var term = terms.filter(function (t) { return String(t.id) === String(scope.term); })[0] || terms[0];
    if (scope === state.cmdSel) {
      return [
        '<div class="zrc-context">',
        '  <label class="zrc-field"><span>Academic year</span><div class="zrc-select-wrap">',
        '    <select data-zrc-scope="cmd" data-zrc-key="year">' + (state.options.years || []).map(function (y) {
          return option(y.id, y.label, scope.year);
        }).join('') + '</select>',
        badge(year ? year.state : '', year ? year.state : ''),
        '  </div></label>',
        '  <label class="zrc-field"><span>Term</span><div class="zrc-select-wrap">',
        '    <select data-zrc-scope="cmd" data-zrc-key="term">' + termOptions(scope.year, scope.term) + '</select>',
        badge(term ? term.state : '', term ? term.state : ''),
        '  </div></label>',
        '  <div class="zrc-field"><span>Assessment type</span><div class="zrc-seg" role="group" aria-label="Assessment type">',
        ['', 'OPENER', 'MID_TERM', 'CAT', 'END_TERM'].map(function (type) {
          return '<button type="button" data-zrc-type="' + type + '"' + (scope.type === type ? ' class="is-active"' : '') + '>' + TYPE_LABEL[type] + '</button>';
        }).join(''),
        '  </div></div>',
        '  <label class="zrc-field"><span>Class scope</span><select data-zrc-scope="cmd" data-zrc-key="class">' +
          classOptions(scope.class, true) + '</select></label>',
        '</div>'
      ].join('');
    }
    var scopeName = scope === state.meritSel ? 'merit' : 'analytics';
    var html = [
      '<div class="zrc-context">',
      '  <label class="zrc-field"><span>Academic year</span><div class="zrc-select-wrap">',
      '    <select data-zrc-scope="' + scopeName + '" data-zrc-key="year">' + (state.options.years || []).map(function (y) {
        return option(y.id, y.label, scope.year);
      }).join('') + '</select>',
      badge(year ? year.state : '', year ? year.state : ''),
      '  </div></label>',
      '  <label class="zrc-field"><span>Term</span><div class="zrc-select-wrap">',
      '    <select data-zrc-scope="' + scopeName + '" data-zrc-key="term">' + termOptions(scope.year, scope.term) + '</select>',
      badge(term ? term.state : '', term ? term.state : ''),
      '  </div></label>'
    ];
    if (scopeName === 'merit') {
      html.push(
        '  <label class="zrc-field"><span>Assessment reproduction</span><select data-zrc-scope="merit" data-zrc-key="assessment">',
        '<option value="">All exams in the term score</option>',
        '<option value="CAT"' + (scope.assessment === 'CAT' ? ' selected' : '') + '>All CATs grouped</option>',
        (state.options.assessments || []).map(function (a) {
          return option(a.id, a.name + (a.type ? ' · ' + String(a.type).replace(/_/g, ' ') : ''), scope.assessment);
        }).join(''),
        '</select></label>'
      );
      html.push('  <label class="zrc-field"><span>Class</span><select data-zrc-scope="merit" data-zrc-key="class">' + classOptions(scope.class, true) + '</select></label>');
    } else {
      html.push('  <label class="zrc-field"><span>Class scope</span><select data-zrc-scope="analytics" data-zrc-key="class">' + classOptions(scope.class, true) + '</select></label>');
    }
    html.push('</div>');
    return html.join('');
  }

  function kpi(label, value, small, foot, barPercent, tone) {
    var width = Math.max(0, Math.min(100, Number(barPercent) || 0));
    return [
      '<div class="zrc-kpi">',
      '<div class="zrc-kpi-label">' + esc(label) + '</div>',
      '<div class="zrc-kpi-value zrc-num">' + value + (small ? ' <small>' + small + '</small>' : '') + '</div>',
      '<div class="zrc-kpi-foot">' + foot + '</div>',
      '<div class="bar"><i class="' + (tone || '') + '" style="width:' + width + '%"></i></div>',
      '</div>'
    ].join('');
  }

  function renderCommand(data) {
    state.cmd = data;
    var k = data.kpis || {};
    var year = currentYear();
    var html = [contextBar(state.cmdSel)];
    if (year && year.state === 'HISTORICAL') {
      html.push('<div class="zrc-notice warn"><b>Historical academic year.</b> You are viewing ' + esc(year.label) + ', which closed on ' + esc(year.end_date || 'its end date') + '. This is not the current year and nothing here is treated as live.</div>');
    }
    html.push('<div class="zrc-kpis">');
    html.push(kpi('Marks captured', '<span class="zrc-num">' + Number(k.marks_entered || 0).toLocaleString() + '</span>', 'of ' + Number(k.marks_expected || 0).toLocaleString(), pct(k.marks_percent) + ' of expected entries', k.marks_percent, k.marks_percent >= 95 ? 'good' : 'warn'));
    html.push(kpi('Classes complete', '<span class="zrc-num">' + (k.classes_complete || 0) + '</span>', 'of ' + (k.classes_total || 0), 'Classes at 95% or better', k.classes_total ? (k.classes_complete / k.classes_total) * 100 : 0, 'good'));
    html.push(kpi('Report cards ready', '<span class="zrc-num">' + (k.report_cards_ready || 0) + '</span>', 'of ' + (k.learners || 0) + ' learners', k.learners ? pct((k.report_cards_ready / k.learners) * 100) + ' fully scored' : 'No learners in scope', k.learners ? (k.report_cards_ready / k.learners) * 100 : 0));
    html.push(kpi('Last mark captured', esc(ago(k.last_mark_at)), '', k.published ? 'Published ' + ago(k.published_at) : 'Not published yet', k.published ? 100 : 0, k.published ? 'good' : 'warn'));
    html.push('</div>');

    html.push('<div class="zrc-card">');
    html.push('<div class="zrc-card-head"><div><h3>Mark entry completeness</h3><div class="zrc-sub">Class × subject coverage for the selected context. 95% is the readiness threshold.</div></div><div class="zrc-sub">' + esc(data.context.term_name || '') + ' · ' + esc(data.context.year_label || '') + '</div></div>');
    html.push('<div class="zrc-matrix-wrap">');
    if (!data.rows || !data.rows.length) {
      html.push('<div class="zrc-empty">No class or subject configuration is available for this context yet.</div>');
    } else {
      html.push('<table class="zrc-matrix"><thead><tr><th class="zrc-sticky">Class</th><th>Learners</th>');
      (data.subject_columns || []).forEach(function (s) {
        html.push('<th title="' + esc(s.name) + '">' + esc(s.code || s.name) + '</th>');
      });
      html.push('</tr></thead><tbody>');
      data.rows.forEach(function (row) {
        html.push('<tr><td class="zrc-sticky">' + esc(row.class_name) + '</td><td class="zrc-num">' + row.learners + '</td>');
        var byId = {};
        (row.cells || []).forEach(function (c) { byId[String(c.subject_id)] = c; });
        (data.subject_columns || []).forEach(function (s) {
          var cell = byId[String(s.id)];
          if (!cell) {
            html.push('<td><span class="zrc-cell s0">—</span></td>');
          } else {
            html.push('<td><span class="zrc-cell ' + cellClass(cell.percent) + '" title="' + cell.entered + ' of ' + cell.expected + ' learners scored">' + cell.percent + '%</span></td>');
          }
        });
        html.push('</tr>');
      });
      html.push('</tbody></table>');
    }
    html.push('</div>');
    html.push('<div class="zrc-legend"><span><i style="background:#fdecec"></i>Below 25%</span><span><i style="background:#fdf0e2"></i>25–49%</span><span><i style="background:#fbf6e3"></i>50–74%</span><span><i style="background:#eaf4e1"></i>75–94%</span><span><i style="background:#dff0e7"></i>95%+ ready</span><span><i style="background:#f4f6f9"></i>No subject</span></div>');
    html.push('</div>');

    html.push('<div class="zrc-chart-grid">');
    html.push('<div class="zrc-chart-card"><h3>Pending mark entry</h3><div class="zrc-sub">Lowest coverage first — chase these before printing results.</div>');
    if (data.pending && data.pending.length) {
      html.push('<ul class="zrc-pending">');
      data.pending.forEach(function (p) {
        html.push('<li><span><b>' + esc(p.class_name) + '</b> · ' + esc(p.subject_name || p.subject_code) + '</span><span class="pct">' + p.entered + '/' + p.expected + ' · ' + p.percent + '%</span></li>');
      });
      html.push('</ul>');
    } else {
      html.push('<div class="zrc-notice ok">Every configured class and subject is at 95% or better for this context.</div>');
    }
    html.push('</div>');

    html.push('<div class="zrc-chart-card"><h3>Results pipeline</h3><div class="zrc-sub">The same order the school publishes each term.</div><div class="zrc-pipeline">');
    (data.pipeline || []).forEach(function (step, index) {
      html.push('<div class="zrc-step ' + step.status + '"><div class="dot">' + (step.status === 'complete' ? '✓' : index + 1) + '</div><div class="txt"><b>' + esc(step.label) + '</b><span>' + esc(step.detail) + '</span></div></div>');
    });
    html.push('</div><div class="zrc-pack"><div class="zrc-sub">' + (k.merit_ready ? 'Merit is ready to reproduce for this context.' : 'Capture marks to unlock merit and report generation.') + '</div><button class="zrc-btn primary" type="button" data-zrc-action="pack">Generate results pack</button></div></div>');
    html.push('</div>');

    panel('command').innerHTML = html.join('');
  }

  function loadCommand() {
    var scope = state.cmdSel;
    panel('command').innerHTML = '<div class="zrc-loading">Loading command centre…</div>';
    return api('/api/results-centre/' + sid + '/completeness?' + qs({
      academic_year_id: scope.year, term_id: scope.term,
      assessment_type: scope.type, class_id: scope.class
    })).then(renderCommand).catch(function (error) {
      panel('command').innerHTML = contextBar(scope) + '<div class="zrc-notice error">' + esc(error.message) + '</div>';
    });
  }

  function meritTable(data) {
    var subjects = data.subjects || [];
    var multiClass = !data.context.class_id;
    var html = ['<div class="zrc-table-wrap"><table class="zrc-table"><thead><tr>'];
    html.push('<th class="center">#</th><th>Learner</th><th>ADM. NO.</th>');
    if (multiClass) html.push('<th>Class</th>');
    subjects.forEach(function (s) { html.push('<th class="num" title="' + esc(s.subject_name) + '">' + esc(s.subject_code || s.subject_name) + '</th>'); });
    html.push('<th class="num">Total</th><th class="num">Avg</th><th class="center">Grade</th><th class="num">Overall pos.</th></tr></thead><tbody>');
    if (!data.rows || !data.rows.length) {
      html.push('<tr><td colspan="' + (7 + subjects.length + (multiClass ? 1 : 0)) + '" class="zrc-empty">No learners in this scope.</td></tr>');
    }
    (data.rows || []).forEach(function (row, index) {
      var rank = row.stream_rank != null ? row.stream_rank : (row.average == null ? '—' : index + 1);
      var byId = {};
      (row.subjects || []).forEach(function (s) { byId[String(s.subject_id)] = s; });
      html.push('<tr' + (Number(rank) > 0 && Number(rank) <= 3 ? ' class="top"' : '') + '>');
      html.push('<td class="center rank zrc-num">' + esc(rank) + '</td>');
      html.push('<td class="name">' + esc(row.name) + '</td>');
      html.push('<td class="adm">' + esc(row.admission_no || row.assessment_no || '—') + '</td>');
      if (multiClass) html.push('<td>' + esc(row.class_name || '—') + '</td>');
      subjects.forEach(function (s) {
        var found = byId[String(s.subject_id)];
        if (!found || found.average == null) {
          html.push('<td class="num">—</td>');
        } else {
          html.push('<td class="num" title="' + esc(found.grade || '') + '">' + num(found.average, 1) + '</td>');
        }
      });
      html.push('<td class="num total">' + num(row.total, 1) + '</td>');
      html.push('<td class="num avg">' + num(row.average, 1) + '</td>');
      html.push('<td class="center"><span class="zrc-grade ' + gradeClass(row.grade) + '">' + esc(row.grade || '—') + '</span></td>');
      html.push('<td class="num">' + (row.overall_rank != null ? row.overall_rank + (row.overall_rank_total ? ' / ' + row.overall_rank_total : '') : '—') + '</td>');
      html.push('</tr>');
    });
    html.push('</tbody>');
    if (data.rows && data.rows.length && subjects.length) {
      html.push('<tfoot><tr><td></td><td class="name">Subject average</td><td></td>');
      if (multiClass) html.push('<td></td>');
      var ranking = {};
      (data.subject_rankings || []).forEach(function (s) { ranking[String(s.subject_id)] = s; });
      subjects.forEach(function (s) {
        var r = ranking[String(s.subject_id)];
        html.push('<td class="num total">' + (r ? num(r.average, 1) : '—') + '</td>');
      });
      html.push('<td></td><td></td><td></td><td></td></tr></tfoot>');
    }
    html.push('</table></div>');
    return html.join('');
  }

  function renderMerit(data) {
    state.merit = data;
    var stats = data.stats || {};
    var rows = data.rows || [];
    if (state.meritSel.strict) {
      rows = rows.filter(function (row) {
        return (row.subjects || []).length > 0 && row.subjects.every(function (s) { return s.average != null; });
      });
    }
    var view = Object.assign({}, data, { rows: rows });
    var html = [contextBar(state.meritSel)];
    if (!rows.length) {
      html.push('<div class="zrc-notice warn">' + esc(data.diagnostics || 'No marks are available for this reproduction.') + '</div>');
    }
    html.push('<div class="zrc-chips">');
    html.push('<div class="zrc-chip"><span>Mean score</span><strong>' + num(stats.mean, 2) + '</strong><em>out of 100</em></div>');
    html.push('<div class="zrc-chip"><span>Mean grade</span><strong>' + esc(stats.mean_grade || '—') + '</strong><em>grading system</em></div>');
    html.push('<div class="zrc-chip"><span>Top score</span><strong>' + num(stats.top, 2) + '</strong><em>highest average</em></div>');
    html.push('<div class="zrc-chip"><span>Lowest score</span><strong>' + num(stats.lowest, 2) + '</strong><em>needs support</em></div>');
    html.push('<div class="zrc-chip"><span>Pass rate</span><strong>' + pct(stats.pass_rate) + '</strong><em>at ' + num(stats.pass_mark, 0) + '% and above</em></div>');
    html.push('<div class="zrc-chip"><span>Ranked learners</span><strong>' + (stats.ranked || 0) + '</strong><em>of ' + (stats.learners || 0) + ' in scope</em></div>');
    html.push('</div>');
    html.push('<div class="zrc-merit-layout"><aside class="zrc-rail">');
    html.push('<h3>Reproduction settings</h3>');
    html.push('<label class="zrc-field"><span>Pass mark (%)</span><input type="number" min="0" max="100" step="1" data-zrc-merit-input="pass" value="' + esc(state.meritSel.pass) + '"></label>');
    html.push('<label class="zrc-check"><input type="checkbox" data-zrc-merit-input="strict" ' + (state.meritSel.strict ? 'checked' : '') + '> Only fully scored learners</label>');
    html.push('<div class="zrc-notice small" style="margin:10px 0 0"><b>' + esc(data.context.assessment_label || 'All assessments') + '</b><br>' + esc(data.context.year_label || '') + ' · ' + esc(data.context.term_name || '') + (data.context.class_name ? ' · ' + esc(data.context.class_name) : ' · all classes') + '</div>');
    html.push('<button class="zrc-btn primary" type="button" data-zrc-action="merit-load">Reproduce merit list</button>');
    html.push('<button class="zrc-btn" type="button" data-zrc-action="merit-pdf">Official PDF</button>');
    html.push('<button class="zrc-btn" type="button" data-zrc-action="merit-csv">Excel / CSV</button>');
    html.push('<button class="zrc-btn" type="button" data-zrc-action="merit-copy">Copy table</button>');
    html.push('<button class="zrc-btn" type="button" data-zrc-action="merit-print">Print</button>');
    html.push('</aside><div class="zrc-merit-main">');
    html.push('<div class="zrc-card"><div class="zrc-card-head"><div><h3>Ranked merit register</h3><div class="zrc-sub">' + esc(data.context.assessment_label || 'Term score') + ' · ' + rows.length + ' learner(s) shown</div></div><div class="zrc-sub">' + esc(data.context.year_label || '') + ' · ' + esc(data.context.term_name || '') + '</div></div>' + meritTable(view) + '</div>');
    html.push('</div></div>');
    panel('merit').innerHTML = html.join('');
    var status = root.querySelector('[data-zrc-status]');
    if (status) status.textContent = state.status;
  }

  function loadMerit() {
    var scope = state.meritSel;
    panel('merit').innerHTML = '<div class="zrc-loading">Reproducing the merit list…</div>';
    var params = {
      academic_year_id: scope.year, term_id: scope.term, class_id: scope.class,
      pass_mark: scope.pass
    };
    if (scope.assessment) {
      if (scope.assessment === 'CAT') params.assessment_type = 'CAT';
      else params.assessment_id = scope.assessment;
    }
    return api('/api/results-centre/' + sid + '/merit?' + qs(params)).then(renderMerit).catch(function (error) {
      panel('merit').innerHTML = contextBar(scope) + '<div class="zrc-notice error">' + esc(error.message) + '</div>';
    });
  }

  /* ---------- SVG chart primitives ---------- */

  function svg(width, height, body, label) {
    return '<svg class="zrc-chart" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + esc(label || 'chart') + '" preserveAspectRatio="xMidYMid meet">' + body + '</svg>';
  }

  function barChart(categories, series, label) {
    var W = 560, H = 260, left = 38, right = 12, top = 14, bottom = 56;
    var plotW = W - left - right, plotH = H - top - bottom;
    var max = 100;
    var groups = Math.max(categories.length, 1);
    var groupW = plotW / groups;
    var barW = Math.min(26, (groupW * 0.62) / Math.max(series.length, 1));
    var body = [];
    for (var g = 0; g <= 4; g++) {
      var y = top + (plotH * g) / 4;
      var value = Math.round(max - (max * g) / 4);
      body.push('<line class="zrc-grid-line" x1="' + left + '" y1="' + y.toFixed(1) + '" x2="' + (W - right) + '" y2="' + y.toFixed(1) + '"></line>');
      body.push('<text class="zrc-axis-label" x="' + (left - 6) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + value + '</text>');
    }
    categories.forEach(function (category, index) {
      var centre = left + groupW * index + groupW / 2;
      var totalBars = series.length * barW;
      series.forEach(function (item, sIndex) {
        var value = item.values[index];
        if (value == null) return;
        var height = Math.max(0, (Number(value) / max) * plotH);
        var x = centre - totalBars / 2 + sIndex * barW;
        body.push('<rect class="zrc-bar' + (sIndex > 0 ? ' prev' : '') + '" x="' + x.toFixed(1) + '" y="' + (top + plotH - height).toFixed(1) + '" width="' + (barW - 3).toFixed(1) + '" height="' + height.toFixed(1) + '" rx="2"><title>' + esc(category + ': ' + num(value, 1)) + '</title></rect>');
      });
      body.push('<text class="zrc-axis-label" x="' + centre.toFixed(1) + '" y="' + (top + plotH + 16) + '" text-anchor="middle">' + esc(String(category).slice(0, 14)) + '</text>');
    });
    body.push('<line class="zrc-axis" x1="' + left + '" y1="' + (top + plotH) + '" x2="' + (W - right) + '" y2="' + (top + plotH) + '"></line>');
    return svg(W, H, body.join(''), label);
  }

  function lineChart(points, label, secondary) {
    var W = 560, H = 240, left = 38, right = 14, top = 16, bottom = 44;
    var plotW = W - left - right, plotH = H - top - bottom;
    if (!points.length) return '<div class="zrc-empty">No trend data yet.</div>';
    var step = points.length > 1 ? plotW / (points.length - 1) : 0;
    function xy(values) {
      return values.map(function (value, index) {
        var x = left + (points.length > 1 ? step * index : plotW / 2);
        var y = top + plotH - (Math.max(0, Math.min(100, Number(value) || 0)) / 100) * plotH;
        return [x, y];
      });
    }
    var body = [];
    for (var g = 0; g <= 4; g++) {
      var y = top + (plotH * g) / 4;
      body.push('<line class="zrc-grid-line" x1="' + left + '" y1="' + y + '" x2="' + (W - right) + '" y2="' + y + '"></line>');
      body.push('<text class="zrc-axis-label" x="' + (left - 6) + '" y="' + (y + 3) + '" text-anchor="end">' + (100 - g * 25) + '</text>');
    }
    function draw(values, extraClass, dots) {
      var coords = xy(values);
      body.push('<path class="zrc-line ' + (extraClass || '') + '" d="' + coords.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ') + '"></path>');
      if (dots) coords.forEach(function (p, i) {
        body.push('<circle class="zrc-dot" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.2"><title>' + esc(points[i].label + ': ' + num(values[i], 1)) + '</title></circle>');
      });
    }
    if (secondary && secondary.length === points.length) draw(secondary, 'prev', false);
    draw(points.map(function (p) { return p.mean; }), '', true);
    points.forEach(function (p, index) {
      var x = left + (points.length > 1 ? step * index : plotW / 2);
      body.push('<text class="zrc-axis-label" x="' + x.toFixed(1) + '" y="' + (H - bottom + 18) + '" text-anchor="middle">' + esc(String(p.label).slice(0, 12)) + '</text>');
      body.push('<text class="zrc-axis-label" x="' + x.toFixed(1) + '" y="' + (H - bottom + 32) + '" text-anchor="middle" style="font-weight:700;fill:#17365d">' + num(p.mean, 1) + '</text>');
    });
    body.push('<line class="zrc-axis" x1="' + left + '" y1="' + (top + plotH) + '" x2="' + (W - right) + '" y2="' + (top + plotH) + '"></line>');
    return svg(W, H, body.join(''), label);
  }

  var DONUT_COLORS = ['#17365d', '#2e5f96', '#b8860b', '#0f7a52', '#a45a0b', '#a51f1f', '#8a94a3', '#6b4f9e'];

  function donut(items, label) {
    var total = items.reduce(function (sum, item) { return sum + Number(item.count || 0); }, 0);
    if (!total) return '<div class="zrc-empty">No graded learners yet.</div>';
    var W = 300, H = 220, cx = 110, cy = 110, r = 78, inner = 48;
    var body = [];
    var angle = -Math.PI / 2;
    items.forEach(function (item, index) {
      var slice = (Number(item.count) / total) * Math.PI * 2;
      var end = angle + slice;
      var large = slice > Math.PI ? 1 : 0;
      var x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
      var x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
      var x3 = cx + inner * Math.cos(end), y3 = cy + inner * Math.sin(end);
      var x4 = cx + inner * Math.cos(angle), y4 = cy + inner * Math.sin(angle);
      body.push('<path class="zrc-donut-seg" fill="' + DONUT_COLORS[index % DONUT_COLORS.length] + '" d="M' + x1.toFixed(1) + ' ' + y1.toFixed(1) +
        ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2.toFixed(1) + ' ' + y2.toFixed(1) +
        ' L' + x3.toFixed(1) + ' ' + y3.toFixed(1) +
        ' A' + inner + ' ' + inner + ' 0 ' + large + ' 0 ' + x4.toFixed(1) + ' ' + y4.toFixed(1) + ' Z"><title>' + esc(item.label + ': ' + item.count) + '</title></path>');
      angle = end;
    });
    body.push('<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" style="font:700 24px Georgia,serif;fill:#0f2745">' + total + '</text>');
    body.push('<text x="' + cx + '" y="' + (cy + 16) + '" text-anchor="middle" style="font:600 10px Segoe UI,sans-serif;fill:#7b8695;letter-spacing:.08em">LEARNERS</text>');
    var legend = items.map(function (item, index) {
      return '<span><i style="background:' + DONUT_COLORS[index % DONUT_COLORS.length] + '"></i>' + esc(item.label) + ' · <b>' + item.count + '</b></span>';
    }).join('');
    return svg(W, H, body.join(''), label) + '<div class="zrc-legend-row">' + legend + '</div>';
  }

  function hbars(items, label) {
    if (!items.length) return '<div class="zrc-empty">No subject data yet.</div>';
    var W = 560, rowH = 30, top = 6, left = 150, right = 44;
    var H = top + items.length * rowH + 6;
    var plotW = W - left - right;
    var body = [];
    items.forEach(function (item, index) {
      var y = top + index * rowH;
      var width = Math.max(2, (Math.max(0, Math.min(100, Number(item.mean) || 0)) / 100) * plotW);
      body.push('<text class="zrc-axis-label" x="' + (left - 8) + '" y="' + (y + 17) + '" text-anchor="end" style="fill:#354051;font-weight:600">' + esc(String(item.name).slice(0, 22)) + '</text>');
      body.push('<rect x="' + left + '" y="' + (y + 6) + '" width="' + plotW + '" height="14" rx="4" fill="#eef1f6"></rect>');
      body.push('<rect class="zrc-bar' + (index % 2 ? ' gold' : '') + '" x="' + left + '" y="' + (y + 6) + '" width="' + width.toFixed(1) + '" height="14" rx="4"><title>' + esc(item.name + ': ' + num(item.mean, 1)) + '</title></rect>');
      body.push('<text class="zrc-axis-label" x="' + (W - right + 6) + '" y="' + (y + 17) + '" style="font-weight:700;fill:#0f2745">' + num(item.mean, 1) + '</text>');
    });
    return svg(W, H, body.join(''), label);
  }

  function heatColor(value) {
    if (value == null) return '#f4f6f9';
    if (value >= 80) return '#0f7a52';
    if (value >= 70) return '#3f8f63';
    if (value >= 60) return '#b8860b';
    if (value >= 50) return '#c98a1e';
    if (value >= 40) return '#c2622b';
    return '#a83a32';
  }

  function heatmap(rows, cols, values, label) {
    if (!rows.length || !cols.length) return '<div class="zrc-empty">No subject mastery data yet.</div>';
    var W = 560, left = 118, top = 58, cellH = 26, cellW = Math.max(24, (W - left - 8) / cols.length);
    var H = top + rows.length * cellH + 8;
    var body = [];
    cols.forEach(function (col, index) {
      var x = left + index * cellW + cellW / 2;
      body.push('<text class="zrc-heat col-label" x="' + x.toFixed(1) + '" y="' + (top - 8) + '">' + esc(String(col.name).slice(0, 9)) + '</text>');
    });
    rows.forEach(function (row, rowIndex) {
      var y = top + rowIndex * cellH;
      body.push('<text class="zrc-heat row-label" x="' + (left - 8) + '" y="' + (y + cellH / 2) + '">' + esc(String(row).slice(0, 16)) + '</text>');
      cols.forEach(function (col, colIndex) {
        var value = values[rowIndex] ? values[rowIndex][colIndex] : null;
        body.push('<rect x="' + (left + colIndex * cellW + 1) + '" y="' + (y + 1) + '" width="' + (cellW - 2) + '" height="' + (cellH - 2) + '" rx="3" fill="' + heatColor(value) + '"><title>' + esc(row + ' · ' + col.name + ': ' + (value == null ? 'no data' : num(value, 1))) + '</title></rect>');
        if (value != null) body.push('<text x="' + (left + colIndex * cellW + cellW / 2) + '" y="' + (y + cellH / 2) + '">' + num(value, 0) + '</text>');
      });
    });
    return svg(W, H, body.join(''), label);
  }

  function sparkline(values) {
    if (!values || values.length < 2) return '';
    var W = 120, H = 34, pad = 2;
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    var span = max - min || 1;
    var points = values.map(function (value, index) {
      return [pad + (index * (W - pad * 2)) / (values.length - 1), H - pad - ((value - min) / span) * (H - pad * 2)];
    });
    var line = points.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var area = line + ' L' + (W - pad) + ' ' + (H - pad) + ' L' + pad + ' ' + (H - pad) + ' Z';
    return '<svg class="zrc-sparkline" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><path class="area" d="' + area + '"></path><path d="' + line + '"></path></svg>';
  }

  function deltaChip(value, suffix) {
    if (value == null) return '<span class="zrc-delta flat">no prior term</span>';
    var n = Number(value);
    var cls = n > 0.05 ? 'up' : n < -0.05 ? 'down' : 'flat';
    var arrow = n > 0.05 ? '▲' : n < -0.05 ? '▼' : '■';
    return '<span class="zrc-delta ' + cls + '">' + arrow + ' ' + (n > 0 ? '+' : '') + num(n, 1) + (suffix || '') + '</span>';
  }

  function analyticsKpi(label, value, small, foot, sparkValues) {
    return [
      '<div class="zrc-kpi">',
      '<div class="zrc-kpi-label">' + esc(label) + '</div>',
      '<div class="zrc-kpi-value zrc-num">' + value + (small ? ' <small>' + small + '</small>' : '') + '</div>',
      '<div class="zrc-kpi-foot">' + foot + '</div>',
      sparkValues ? sparkline(sparkValues) : '',
      '</div>'
    ].join('');
  }

  function renderAnalytics(data) {
    state.analytics = data;
    var k = data.kpis || {};
    var trend = data.trend || [];
    var spark = trend.map(function (t) { return Number(t.mean) || 0; });
    var html = [contextBar(state.analyticsSel)];
    if (data.context && data.context.year_state === 'HISTORICAL') {
      html.push('<div class="zrc-notice warn"><b>Historical year selected.</b> Charts compare terms inside ' + esc(data.context.year_label) + '. The current year is not substituted.</div>');
    }
    html.push('<div class="zrc-analytics-kpis">');
    html.push(analyticsKpi('Mean score', num(k.mean, 2), '', deltaChip(k.mean_delta) + ' <span class="zrc-sub">vs ' + esc(data.by_class.series.length > 1 ? data.by_class.series[1].name : 'previous term') + '</span>', spark));
    html.push(analyticsKpi('Mean grade', esc(k.mean_grade || '—'), '', 'Same grading bands as report cards', null));
    html.push(analyticsKpi('Pass rate', pct(k.pass_rate), '', deltaChip(k.pass_delta) + ' <span class="zrc-sub">at ' + num(k.pass_mark, 0) + '%+</span>', null));
    html.push(analyticsKpi('Ranked learners', String(k.learners || 0), '', 'Learners with usable marks', null));
    html.push('</div>');

    html.push('<div class="zrc-chart-grid">');
    html.push('<div class="zrc-chart-card wide"><h3>Mean score by class</h3><div class="zrc-sub">Current term against the previous term, on a fixed 0–100 scale.</div>' +
      barChart(data.by_class.categories, data.by_class.series, 'Mean score by class') +
      '<div class="zrc-legend-row">' + data.by_class.series.map(function (s, index) {
        return '<span><i style="background:' + (index ? '#c9d3e2' : '#17365d') + '"></i>' + esc(s.name) + '</span>';
      }).join('') + '</div></div>');

    html.push('<div class="zrc-chart-card"><h3>Grade distribution</h3><div class="zrc-sub">Every graded learner in this context.</div>' +
      donut(data.grade_distribution || [], 'Grade distribution') + '</div>');

    html.push('<div class="zrc-chart-card"><h3>Term mean trend</h3><div class="zrc-sub">Every term in ' + esc(data.context.year_label) + ', computed on the same path.</div>' +
      lineChart(trend, 'Term mean trend') + '</div>');

    html.push('<div class="zrc-chart-card"><h3>Top subjects by mean</h3><div class="zrc-sub">Strongest six subjects in this scope.</div>' +
      hbars((data.subjects || []).slice(0, 6), 'Top subjects') + '</div>');

    html.push('<div class="zrc-chart-card wide"><h3>Subject mastery by class</h3><div class="zrc-sub">Mean score per class and subject — darker red is support needed, green is secure.</div>' +
      heatmap(data.heatmap.rows, data.heatmap.cols, data.heatmap.values, 'Subject mastery by class') +
      '<div class="zrc-legend-row"><span><i style="background:#a83a32"></i>Below 40</span><span><i style="background:#c98a1e"></i>40–59</span><span><i style="background:#b8860b"></i>60–69</span><span><i style="background:#3f8f63"></i>70–79</span><span><i style="background:#0f7a52"></i>80+</span></div></div>');

    if (data.progression && data.progression.length) {
      html.push('<div class="zrc-chart-card"><h3>Assessment-type progression</h3><div class="zrc-sub">How the cohort performed in each assessment form this term.</div>' +
        hbars(data.progression.map(function (p) { return { name: String(p.type || 'Other').replace(/_/g, ' '), mean: p.mean }; }), 'Assessment progression') + '</div>');
    }

    if (data.multi_year && data.multi_year.length > 1) {
      html.push('<div class="zrc-chart-card"><h3>Multi-year mean</h3><div class="zrc-sub">School mean across academic years with recorded marks.</div>' +
        lineChart(data.multi_year.map(function (y) { return { label: y.year_label, mean: y.mean }; }), 'Multi-year mean') + '</div>');
    }

    var movement = data.movement || {};
    html.push('<div class="zrc-chart-card"><h3>Learner movement</h3><div class="zrc-sub">Change against the previous term.</div><div class="zrc-chips" style="margin:0">');
    html.push('<div class="zrc-chip"><span>Improved</span><strong>' + (movement.improved || 0) + '</strong><em>+0.5 or more</em></div>');
    html.push('<div class="zrc-chip"><span>Stable</span><strong>' + (movement.stable || 0) + '</strong><em>within ±0.5</em></div>');
    html.push('<div class="zrc-chip"><span>Declined</span><strong>' + (movement.declined || 0) + '</strong><em>−0.5 or worse</em></div>');
    html.push('</div>');
    if (movement.top && movement.top.length) {
      html.push('<div class="zrc-sub" style="margin-top:12px;font-weight:700;color:#0f2745">Top improvers</div><ul class="zrc-pending">');
      movement.top.slice(0, 4).forEach(function (m) {
        html.push('<li><span><b>' + esc(m.name) + '</b> · ' + esc(m.class_name || '') + '</span><span class="pct">' + deltaChip(m.delta) + '</span></li>');
      });
      html.push('</ul>');
    }
    html.push('</div>');

    if (data.at_risk && data.at_risk.length) {
      html.push('<div class="zrc-chart-card wide"><h3>Learners needing support</h3><div class="zrc-sub">Below 40%, or down 5 points or more since the previous term.</div><div class="zrc-table-wrap" style="max-height:320px"><table class="zrc-table"><thead><tr><th>Learner</th><th>Class</th><th class="num">Current</th><th class="num">Previous</th><th class="num">Change</th></tr></thead><tbody>');
      data.at_risk.forEach(function (row) {
        html.push('<tr><td class="name">' + esc(row.name) + '</td><td>' + esc(row.class_name || '—') + '</td><td class="num">' + num(row.average, 1) + '</td><td class="num">' + num(row.previous, 1) + '</td><td class="num">' + deltaChip(row.delta) + '</td></tr>');
      });
      html.push('</tbody></table></div></div>');
    }

    html.push('</div>');
    panel('analytics').innerHTML = html.join('');
  }

  function loadAnalytics() {
    var scope = state.analyticsSel;
    panel('analytics').innerHTML = '<div class="zrc-loading">Building analytics…</div>';
    return api('/api/results-centre/' + sid + '/analytics?' + qs({
      academic_year_id: scope.year, term_id: scope.term, class_id: scope.class
    })).then(renderAnalytics).catch(function (error) {
      panel('analytics').innerHTML = contextBar(scope) + '<div class="zrc-notice error">' + esc(error.message) + '</div>';
    });
  }

  function loadTab(tab) {
    if (tab === 'command') return loadCommand();
    if (tab === 'merit') return loadMerit();
    return loadAnalytics();
  }

  function switchTab(tab) {
    state.tab = tab;
    root.querySelectorAll('[data-zrc-tab]').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-zrc-tab') === tab);
    });
    root.querySelectorAll('[data-zrc-panel]').forEach(function (target) {
      target.classList.toggle('is-active', target.getAttribute('data-zrc-panel') === tab);
    });
    if (tab === 'command' && !state.cmd) loadCommand();
    if (tab === 'merit' && !state.merit) loadMerit();
    if (tab === 'analytics' && !state.analytics) loadAnalytics();
  }

  function scopeFor(name) {
    return name === 'merit' ? state.meritSel : name === 'analytics' ? state.analyticsSel : state.cmdSel;
  }

  function meritParams() {
    var scope = state.meritSel;
    var params = { academic_year_id: scope.year, term_id: scope.term, class_id: scope.class, pass_mark: scope.pass };
    if (scope.assessment === 'CAT') params.assessment_type = 'CAT';
    else if (scope.assessment) params.assessment_id = scope.assessment;
    return params;
  }

  function toast(message, tone) {
    state.status = message;
    var existing = root.querySelector('[data-zrc-status]');
    if (existing) existing.remove();
    var el = document.createElement('div');
    el.setAttribute('data-zrc-status', '');
    el.className = 'zrc-notice ' + (tone || 'ok');
    el.textContent = message;
    el.style.position = 'fixed';
    el.style.right = '22px';
    el.style.bottom = '22px';
    el.style.zIndex = '9999';
    el.style.maxWidth = '360px';
    el.style.boxShadow = '0 8px 24px rgba(16,35,60,.18)';
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 4200);
  }

  function onChanged(input) {
    var scopeName = input.getAttribute('data-zrc-scope');
    var key = input.getAttribute('data-zrc-key');
    var scope = scopeFor(scopeName);
    scope[key] = input.value;
    if (key === 'assessment') scope.assessment = input.value;
    if (key === 'year') {
      var year = (state.options.years || []).filter(function (y) { return String(y.id) === String(input.value); })[0];
      var terms = year ? year.terms : [];
      scope.term = terms.filter(function (t) { return t.state === 'CURRENT'; }).map(function (t) { return String(t.id); })[0] ||
        (terms[0] ? String(terms[0].id) : '');
      if (scopeName === 'merit') scope.assessment = '';
    }
    if (scopeName === 'merit' && key === 'term') scope.assessment = '';
    if (scopeName === 'merit') {
      loadOptions({ academic_year_id: scope.year, term_id: scope.term }).then(loadMerit).catch(function (error) { toast(error.message, 'error'); });
      return;
    }
    if (scopeName === 'analytics') { loadAnalytics(); return; }
    loadCommand();
  }

  function bind() {
    root.addEventListener('click', function (event) {
      var button = event.target.closest('[data-zrc-action],[data-zrc-tab],[data-zrc-type]');
      if (!button) return;
      var tab = button.getAttribute('data-zrc-tab');
      if (tab) { switchTab(tab); return; }
      var type = button.getAttribute('data-zrc-type');
      if (type !== null) {
        state.cmdSel.type = type;
        loadCommand();
        return;
      }
      var action = button.getAttribute('data-zrc-action');
      if (!action) return;
      if (action === 'refresh') {
        button.disabled = true;
        api('/api/results-centre/' + sid + '/refresh', { method: 'POST' }).then(function () {
          state.merit = null; state.analytics = null;
          return loadOptions({ academic_year_id: state.cmdSel.year, term_id: state.cmdSel.term });
        }).then(function () {
          return loadTab(state.tab);
        }).then(function () {
          toast('Results data refreshed.');
        }).catch(function (error) { toast(error.message, 'error'); }).then(function () { button.disabled = false; });
        return;
      }
      if (action === 'pack' || action === 'merit-pdf') {
        var packParams;
        if (action === 'pack' && state.tab === 'command') {
          packParams = { academic_year_id: state.cmdSel.year, term_id: state.cmdSel.term, class_id: state.cmdSel.class };
          if (state.cmdSel.type) packParams.assessment_type = state.cmdSel.type;
        } else {
          packParams = meritParams();
        }
        toast('Building the official merit PDF…');
        download('/api/results-centre/' + sid + '/merit.pdf?' + qs(packParams)).catch(function (error) { toast(error.message, 'error'); });
        return;
      }
      if (action === 'merit-csv') {
        download('/api/results-centre/' + sid + '/merit.csv?' + qs(meritParams())).catch(function (error) { toast(error.message, 'error'); });
        return;
      }
      if (action === 'merit-load') { loadMerit(); return; }
      if (action === 'merit-print') { window.print(); return; }
      if (action === 'merit-copy') {
        var data = state.merit;
        if (!data || !data.rows || !data.rows.length) { toast('Nothing to copy yet.', 'warn'); return; }
        var subjects = data.subjects || [];
        var lines = [['Rank', 'Learner', 'ADM NO', ...subjects.map(function (s) { return s.subject_name; }), 'Total', 'Average', 'Grade', 'Position'].join('\t')];
        data.rows.forEach(function (row, index) {
          var byId = {};
          (row.subjects || []).forEach(function (s) { byId[String(s.subject_id)] = s; });
          lines.push([
            row.stream_rank != null ? row.stream_rank : index + 1,
            row.name, row.admission_no || '',
            ...subjects.map(function (s) { return byId[String(s.subject_id)] ? byId[String(s.subject_id)].average : ''; }),
            row.total, row.average, row.grade, row.overall_rank || ''
          ].join('\t'));
        });
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(lines.join('\n')).then(function () { toast('Merit table copied to the clipboard.'); }, function () { toast('Copy failed. Use Excel / CSV instead.', 'error'); });
        } else {
          toast('Copy is not available in this browser. Use Excel / CSV.', 'warn');
        }
      }
    });

    root.addEventListener('change', function (event) {
      var target = event.target;
      if (target.matches('[data-zrc-scope]')) { onChanged(target); return; }
      if (target.matches('[data-zrc-merit-input="strict"]')) {
        state.meritSel.strict = target.checked;
        if (state.merit) renderMerit(state.merit);
      }
    });

    root.addEventListener('input', function (event) {
      var target = event.target;
      if (target.matches('[data-zrc-merit-input="pass"]')) {
        state.meritSel.pass = target.value === '' ? 50 : Number(target.value);
      }
    });
  }

  var bootPromise = null;
  function boot() {
    if (bootPromise) return bootPromise;
    state.booted = true;
    shell();
    bind();
    bootPromise = loadOptions().then(function (options) {
      var yearId = String(options.current_year_id || (options.years[0] ? options.years[0].id : ''));
      var termId = String(options.current_term_id || '');
      if (!termId) {
        var year = (options.years || []).filter(function (y) { return String(y.id) === yearId; })[0];
        termId = year && year.terms[0] ? String(year.terms[0].id) : '';
      }
      state.cmdSel.year = yearId;
      state.cmdSel.term = termId;
      state.meritSel.year = yearId;
      state.meritSel.term = termId;
      state.analyticsSel.year = yearId;
      state.analyticsSel.term = termId;
      return loadCommand();
    }).catch(function (error) {
      panel('command').innerHTML = '<div class="zrc-notice error">' + esc(error.message) + '</div>';
    });
    return bootPromise;
  }

  window.ZRC = {
    activate: function () { boot(); },
    open: function (tab) {
      return boot().then(function () {
        if (tab === 'command' || tab === 'merit' || tab === 'analytics') switchTab(tab);
      });
    },
    refresh: function () { return boot().then(function () { state.merit = null; state.analytics = null; return loadTab(state.tab); }); }
  };

  if (root.classList.contains('nav-active')) boot();
})();

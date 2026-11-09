import re
from pathlib import Path

print("\n--- Applying ZELIMU CBC Live Dashboard & Class Import Patch ---")

# 1. Update backend/schema-compat.js
schema_file = Path("backend/schema-compat.js")
if schema_file.exists():
    text = schema_file.read_text(encoding="utf-8")
    if "ALTER TABLE learners ADD COLUMN IF NOT EXISTS cbc_pathway text" not in text:
        target = "await db.query(`ALTER TABLE learners ADD COLUMN IF NOT EXISTS passport_photo_url text`);"
        replacement = target + "\n  await db.query(`ALTER TABLE learners ADD COLUMN IF NOT EXISTS cbc_pathway text`);"
        if target in text:
            text = text.replace(target, replacement, 1)
            schema_file.write_text(text, encoding="utf-8")
            print("✓ backend/schema-compat.js: cbc_pathway column registered.")

# 2. Update backend/routes/people.js
people_file = Path("backend/routes/people.js")
if people_file.exists():
    text = people_file.read_text(encoding="utf-8")
    old_upd = """    const upd=(await c.query(`UPDATE learners SET admission_no=COALESCE($3,admission_no),assessment_no=COALESCE($4,assessment_no),
      first_name=$5,middle_name=$6,last_name=$7,date_of_birth=COALESCE($8,date_of_birth),gender=COALESCE($9,gender),
      parent_phone=COALESCE($10,parent_phone),class_id=$11,is_active=true WHERE id=$1 AND school_id=$2 RETURNING *`,
      [learner.id,sid,adm,ass,first,clean(r.middle_name)||null,last,r.date_of_birth||null,clean(r.gender)||null,clean(r.parent_phone)||null,b.class_id])).rows[0];"""
    
    new_upd = """    const photo=clean(r.passport_photo_url)||clean(r.photo_url)||clean(r.photo)||null;
    const pathway=clean(r.cbc_pathway)||clean(r.pathway)||clean(r.track)||null;
    const upd=(await c.query(`UPDATE learners SET admission_no=COALESCE($3,admission_no),assessment_no=COALESCE($4,assessment_no),
      first_name=$5,middle_name=$6,last_name=$7,date_of_birth=COALESCE($8,date_of_birth),gender=COALESCE($9,gender),
      parent_phone=COALESCE($10,parent_phone),class_id=$11,
      passport_photo_url=COALESCE($12,passport_photo_url),cbc_pathway=COALESCE($13,cbc_pathway),
      is_active=true WHERE id=$1 AND school_id=$2 RETURNING *`,
      [learner.id,sid,adm,ass,first,clean(r.middle_name)||null,last,r.date_of_birth||null,clean(r.gender)||null,clean(r.parent_phone)||null,b.class_id,photo,pathway])).rows[0];"""

    old_ins = """    learner=(await c.query(`INSERT INTO learners(school_id,admission_no,assessment_no,first_name,middle_name,last_name,date_of_birth,gender,class_id,parent_phone)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [sid,adm,ass,first,clean(r.middle_name)||null,last,r.date_of_birth||null,clean(r.gender)||null,b.class_id,clean(r.parent_phone)||null])).rows[0];"""

    new_ins = """    learner=(await c.query(`INSERT INTO learners(school_id,admission_no,assessment_no,first_name,middle_name,last_name,date_of_birth,gender,class_id,parent_phone,passport_photo_url,cbc_pathway)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [sid,adm,ass,first,clean(r.middle_name)||null,last,r.date_of_birth||null,clean(r.gender)||null,b.class_id,clean(r.parent_phone)||null,photo,pathway])).rows[0];"""

    old_enr = """   await c.query(`INSERT INTO learner_enrollments(school_id,learner_id,academic_year_id,class_id,status)
     VALUES($1,$2,$3,$4,'ACTIVE')
     ON CONFLICT(learner_id,academic_year_id) DO UPDATE SET class_id=EXCLUDED.class_id,status='ACTIVE',ended_at=NULL`,
     [sid,learner.id,b.academic_year_id,b.class_id]); enrolled++;"""

    new_enr = """   await c.query(`INSERT INTO learner_enrollments(school_id,learner_id,academic_year_id,class_id,status)
     VALUES($1,$2,$3,$4,'ACTIVE')
     ON CONFLICT(learner_id,academic_year_id) DO UPDATE SET class_id=EXCLUDED.class_id,status='ACTIVE',ended_at=NULL`,
     [sid,learner.id,b.academic_year_id,b.class_id]); enrolled++;
   const pName = clean(r.parent_name)||clean(r.guardian_name)||null;
   const pPhone = clean(r.parent_phone)||null;
   if (pName || pPhone) {
     try {
       const pParts = (pName || 'Parent').split(/\\s+/).filter(Boolean);
       const pFirst = pParts[0] || 'Parent', pLast = pParts.slice(1).join(' ') || 'Guardian';
       let pg = null;
       if (pPhone) {
         pg = (await c.query(`SELECT id FROM parent_guardians WHERE school_id=$1 AND phone=$2 LIMIT 1`, [sid, pPhone])).rows[0];
       }
       if (!pg) {
         pg = (await c.query(`INSERT INTO parent_guardians(school_id, first_name, last_name, phone, relationship) VALUES($1, $2, $3, $4, 'Parent/Guardian') RETURNING id`, [sid, pFirst, pLast, pPhone])).rows[0];
       }
       if (pg) {
         await c.query(`INSERT INTO learner_guardians(learner_id, parent_guardian_id, is_primary) VALUES($1, $2, true) ON CONFLICT DO NOTHING`, [learner.id, pg.id]);
       }
     } catch(e) {}
   }
   if (pathway) {
     try {
       await c.query(
         `INSERT INTO report_pathway_guidance (
            school_id, learner_id, academic_year_id, selected_pathway, track_specialisation
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (school_id, learner_id, academic_year_id)
          DO UPDATE SET selected_pathway = EXCLUDED.selected_pathway, track_specialisation = EXCLUDED.track_specialisation`,
         [sid, learner.id, b.academic_year_id, pathway, clean(r.pathway_track) || (pathway === 'STEM' ? 'Pure Sciences' : 'General')]
       );
     } catch(e) {}
   }"""

    if old_upd in text and old_ins in text and old_enr in text:
        text = text.replace(old_upd, new_upd, 1)
        text = text.replace(old_ins, new_ins, 1)
        text = text.replace(old_enr, new_enr, 1)
        people_file.write_text(text, encoding="utf-8")
        print("✓ backend/routes/people.js: bulk learner endpoint updated with photo, pathway and guardian saving.")

# 3. Update public/js/docx-import-modal.js
modal_file = Path("public/js/docx-import-modal.js")
if modal_file.exists():
    text = modal_file.read_text(encoding="utf-8")
    if "window.zelimuOpenDocxImport" not in text:
        target = "window.addEventListener('load', () => {"
        replacement = """window.zelimuOpenDocxImport = function(classId) {
    createModal();
    syncClassOptions();
    if (classId) {
      const sel = document.getElementById('docxClass');
      if (sel) sel.value = String(classId);
    }
    document.getElementById('docxImportModal')?.classList.add('open');
  };

  window.addEventListener('load', () => {"""
        if target in text:
            text = text.replace(target, replacement, 1)
            modal_file.write_text(text, encoding="utf-8")
            print("✓ public/js/docx-import-modal.js: window.zelimuOpenDocxImport registered.")

# 4. Update public/dashboard.html
dash_file = Path("public/dashboard.html")
if dash_file.exists():
    text = dash_file.read_text(encoding="utf-8")
    start_str = "$('classListLearners').innerHTML=inactiveNote+`<div class=\"card-subsection learner-bulk-box\""
    end_str = "async function loadClassReportRegister()"
    start_idx = text.find(start_str)
    end_idx = text.find(end_str, start_idx)
    if start_idx != -1 and end_idx != -1:
        replacement = r"""$('classListLearners').innerHTML=inactiveNote+`<div class="card-subsection learner-bulk-box" style="margin-bottom:12px; border: 1px solid rgba(214,166,79,.3); border-radius: 14px; padding: 18px; background: rgba(11,26,48,.65);">
  <div class="section-title" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
    <h4 style="margin:0; font-size:1.15rem; color:#f0c465;">ADD LEARNERS FROM EXCEL / WORD / CLIPBOARD</h4>
    <span class="pill" style="background:#0284c7; color:#fff; font-weight:700;">Paste rows or upload Word table</span>
  </div>
  <p class="muted small" style="margin-bottom:12px; line-height:1.5;">
    Copy rows from Excel, Word tables or Google Sheets and paste below. Expected standard column order: <b>Passport Photo URL | Assessment No | Admission No | Full Name | DOB | Gender | CBC Pathway / Track | Parent / Guardian Name | Parent Phone</b>. Headers are auto-detected, or paste directly without headers in this order. You can also upload a Word (.docx) document register with embedded photos.
  </p>
  <textarea id="classBulkLearnerPaste" rows="5" style="width:100%; border-radius:8px; font-family:monospace; font-size:12px; padding:10px; background:rgba(6,16,33,.85); color:#f4f6f9; border:1px solid rgba(214,166,79,.25);" placeholder="Passport Photo URL\tAssessment No\tAdmission No\tFull Name\tDOB\tGender\tCBC Pathway\tParent / Guardian Name\tParent Phone"></textarea>
  <div class="actions" style="margin-top:10px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
    <button type="button" class="btn primary" id="classBulkLearnerImport" style="background:#d6a64f; color:#081322; font-weight:800;">IMPORT PASTED LEARNERS</button>
    <button type="button" class="btn secondary" id="classBulkWordBtn" style="background:#1e3a8a; color:#fff; border-color:#3b82f6; font-weight:700;">📄 UPLOAD WORD (.DOCX) REGISTER</button>
    <button type="button" class="btn secondary" id="classBulkLearnerExport">EXPORT CLASS LEARNERS (CSV)</button>
    <span id="classBulkLearnerMsg" class="muted small" style="margin-left:8px;"></span>
  </div>
</div>
<table class="class-register-table">
  <thead>
    <tr>
      <th>#</th>
      <th>Photo</th>
      <th>ADM. NO.</th>
      <th>ASSES. NO.</th>
      <th>Learner (A–Z)</th>
      <th>Gender</th>
      <th>DOB</th>
      <th>CBC Pathway</th>
      <th>Parent Phone</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map((x,i)=>`<tr>
      <td>${i+1}</td>
      <td><span style="display:inline-flex; width:30px; height:30px; border-radius:50%; overflow:hidden; background:#0f2744; border:1px solid #d6a64f; align-items:center; justify-content:center; font-size:11px; color:#d6a64f;">${x.passport_photo_url ? `<img src="${esc(x.passport_photo_url)}" style="width:100%; height:100%; object-fit:cover;" onerror="this.parentElement.innerHTML='🎓'"/>` : '🎓'}</span></td>
      <td>${esc(x.admission_no||'')}</td>
      <td>${esc(x.assessment_no||'')}</td>
      <td><b>${esc([x.first_name,x.middle_name,x.last_name].filter(Boolean).join(' '))}</b></td>
      <td>${esc(x.gender||'—')}</td>
      <td>${esc(x.date_of_birth?String(x.date_of_birth).slice(0,10):'—')}</td>
      <td><span class="pill mini" style="font-size:10px; background:rgba(214,166,79,.15); color:#e8bf74; border:1px solid rgba(214,166,79,.3);">${esc(x.cbc_pathway||x.selected_pathway||'—')}</span></td>
      <td>${esc(x.parent_phone||'—')}</td>
      <td>${esc(x.status||'ACTIVE')} ${['SCHOOL_ADMIN','ADMIN','CLASS_TEACHER','SENIOR_TEACHER'].includes(user.role)?`<button type="button" class="btn mini secondary class-list-edit-learner" data-learner-id="${x.id}">EDIT</button> <button type="button" class="btn mini danger class-list-remove-learner" data-learner-id="${x.id}">REMOVE</button>`:''}</td>
    </tr>`).join('')||'<tr><td colspan="10">No active learners in this class.</td></tr>'}
  </tbody>
</table>`;}catch(e){$('classListLearners').innerHTML=`<div class="notice">${esc(e.message)}</div>`;}}
$('classListCards')?.addEventListener('click',e=>{const b=e.target.closest('button[data-class-id]');if(!b)return;if(b.classList.contains('class-list-pdf')){openProtectedPdf(`/api/people/${sid}/classes/${b.dataset.classId}/pdf`).catch(x=>alert(x.message));}else openClassList(b.dataset.classId);});
$('classListBack')?.addEventListener('click',()=>{$('classListDetail').style.display='none';$('classListCards').style.display='grid';});
$('classListLearners')?.addEventListener('click',async e=>{const edit=e.target.closest('.class-list-edit-learner');if(edit){const l=(state.learners||[]).find(x=>String(x.id)===String(edit.dataset.learnerId));if(!l)return;const v=(label,current='')=>{const x=prompt(label,current??'');return x===null?null:x.trim()};const first=v('First name:',l.first_name);if(first===null)return;const middle=v('Middle name:',l.middle_name||'');if(middle===null)return;const last=v('Last name:',l.last_name);if(last===null)return;const adm=v('Admission number:',l.admission_no||'');if(adm===null)return;const ass=v('Assessment number:',l.assessment_no||'');if(ass===null)return;const gender=v('Gender (Male/Female):',l.gender||'');if(gender===null)return;const dob=v('Date of birth (YYYY-MM-DD):',l.date_of_birth?String(l.date_of_birth).slice(0,10):'');if(dob===null)return;const phone=v('Parent/guardian phone:',l.parent_phone||'');if(phone===null)return;const y=$('learnerFilterYear')?.value||state.years?.[0]?.id;try{await api(`/api/people/${sid}/learners/${l.id}`,{method:'PATCH',body:{first_name:first,middle_name:middle,last_name:last,admission_no:adm,assessment_no:ass,gender,date_of_birth:dob,parent_phone:phone,class_id:l.class_id,academic_year_id:y}});await load();await openClassList(l.class_id);alert('Learner updated successfully.');}catch(x){alert(x.message);}return;}const b=e.target.closest('.class-list-remove-learner');if(!b)return;const l=(state.learners||[]).find(x=>String(x.id)===String(b.dataset.learnerId));const reason=prompt(`Reason for removing ${l?[l.first_name,l.last_name].filter(Boolean).join(' '):'this learner'} from class:`);if(reason===null)return;if(!reason.trim())return alert('A reason is required.');const c=(state.classes||[]).find(x=>String(x.id)===String(l?.class_id));const y=$('learnerFilterYear')?.value||state.years?.[0]?.id;if(!y)return alert('Select the academic year first.');try{await api(`/api/people/${sid}/learners/${b.dataset.learnerId}/remove-from-class`,{method:'POST',body:{academic_year_id:y,reason}});await load();await openClassList(c?.id||'');alert('Learner removed from class. Historical records remain preserved.');}catch(x){alert(x.message);}});
$('classTeacherAddLearner')?.addEventListener('click',()=>{const title=$('classListTitle').textContent||'';const c=(state.classes||[]).find(x=>title.startsWith(String(x.name)));if(c){showSection('people');if($('learnerClass'))$('learnerClass').value=c.id;$('learnerFirstName')?.focus();}});
document.addEventListener('click',async e=>{
  const wb=e.target.closest('#classBulkWordBtn');
  if(wb){
    const classId=(window._openClassListId||'');
    if(typeof window.zelimuOpenDocxImport==='function'){
      window.zelimuOpenDocxImport(classId);
    } else {
      const modal=document.getElementById('docxImportModal');
      if(modal){
        const sel=document.getElementById('docxClass');
        if(sel && classId) sel.value=String(classId);
        modal.classList.add('open');
      } else {
        alert('Word document importer is ready. Please ensure docx-import-modal.js is loaded.');
      }
    }
    return;
  }
  const ex=e.target.closest('#classBulkLearnerExport');
  if(ex){
    const classId=(window._openClassListId||'');
    const c=(state.classes||[]).find(x=>String(x.id)===String(classId));
    const yearId=$('learnerFilterYear')?.value||state.years?.[0]?.id;
    if(!c||!yearId)return alert('Select the class and academic year first.');
    const rows=(state.learners||[]).filter(x=>String(x.class_id)===String(c.id)&&x.is_active!==false);
    const escCsv=v=>{const x=String(v??'');return /[\",\r\n]/.test(x)?`"${x.replace(/\"/g,'\"\"')}"`:x;};
    const header=['Passport Photo URL','Assessment No','Admission No','First Name','Middle Name','Last Name','Gender','Date of Birth','CBC Pathway','Parent Phone'];
    const lines=[header.join(',')].concat(rows.map(r=>[r.passport_photo_url||'',r.assessment_no||'',r.admission_no||'',r.first_name||'',r.middle_name||'',r.last_name||'',r.gender||'',r.date_of_birth?String(r.date_of_birth).slice(0,10):'',r.cbc_pathway||r.selected_pathway||'',r.parent_phone||''].map(escCsv).join(',')));
    const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'});
    const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;
    a.download=`ZELIMU-CBC-${String(c.name||'CLASS').replace(/[^a-z0-9_-]/gi,'-')}-LEARNERS.csv`;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);
    return;
  }
  const b=e.target.closest('#classBulkLearnerImport');
  if(!b)return;
  const text=$('classBulkLearnerPaste')?.value||'';
  const msg=$('classBulkLearnerMsg');
  const classId=(window._openClassListId||'');
  const c=(state.classes||[]).find(x=>String(x.id)===String(classId));
  const yearId=$('learnerFilterYear')?.value||state.years?.[0]?.id;
  if(!text.trim())return alert('Paste learner rows from Excel or Word first.');
  if(!c||!yearId)return alert('Select the class and academic year first.');
  const lines=text.trim().split(/\r?\n/).filter(Boolean);
  const delim=lines[0].includes('\t')?'\t':(lines[0].includes(',')?',':(lines[0].includes(';')?';':'\t'));
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const mapHeader=h=>{
    const n=norm(h);
    if(n.includes('photo')||n.includes('passport')||n.includes('image')||n.includes('avatar'))return'passport_photo_url';
    if(n.includes('assessment')||n.includes('assesno')||n==='assno'||n==='assessno'||n==='upi'||n==='nemis')return'assessment_no';
    if(n.includes('admission')||n==='admno'||n==='admnumber'||n==='admissionnumber'||n==='adm')return'admission_no';
    if(n.includes('learnername')||n.includes('studentname')||n.includes('fullname')||n==='name'||n==='learner')return'full_name';
    if(n==='firstname'||n==='fname'||n==='first')return'first_name';
    if(n==='middlename'||n==='mname'||n==='middle')return'middle_name';
    if(n==='lastname'||n==='surname'||n==='familyname'||n==='last')return'last_name';
    if(n.includes('dob')||n.includes('dateofbirth')||n==='birthdate'||n==='birth')return'date_of_birth';
    if(n==='gender'||n==='sex')return'gender';
    if(n.includes('pathway')||n.includes('track')||n.includes('specialisation')||n.includes('cbcpathway'))return'cbc_pathway';
    if(n.includes('parentname')||n.includes('guardianname')||n==='parent'||n==='guardian')return'parent_name';
    if(n.includes('phone')||n.includes('mobile')||n.includes('guardiancontact')||n.includes('parentcontact')||n.includes('parentphone')||n.includes('guardianphone'))return'parent_phone';
    if(n==='class'||n==='classname'||n==='grade')return'ignored_class';
    return null;
  };
  const split=line=>line.split(delim).map(x=>x.trim().replace(/^"|"$/g,''));
  const parseFullName=name=>{
    const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
    if(!parts.length)return{};
    if(parts.length===1)return{first_name:parts[0],last_name:parts[0]};
    return{first_name:parts[0],last_name:parts[parts.length-1],middle_name:parts.slice(1,-1).join(' ')};
  };
  const hs=split(lines[0]);
  let keys=hs.map(mapHeader);
  let start=0;
  let valid=keys.some(Boolean);
  if(!valid){
    const cols=split(lines[0]);
    if(cols.length>=8){
      if(/^https?:\/\/|^\/uploads\/|\.(png|jpe?g|webp)$/i.test(cols[0])){
        keys=['passport_photo_url','assessment_no','admission_no','full_name','date_of_birth','gender','cbc_pathway','parent_name','parent_phone'];
      }else{
        keys=['assessment_no','admission_no','full_name','date_of_birth','gender','cbc_pathway','parent_name','parent_phone'];
      }
    }else if(cols.length===7){
      keys=['admission_no','full_name','gender','date_of_birth','cbc_pathway','parent_name','parent_phone'];
    }else{
      keys=['admission_no','full_name','gender','date_of_birth','parent_phone'];
    }
  }else start=1;
  const rows=lines.slice(start).map(line=>{
    const cells=split(line),r={};
    keys.forEach((k,i)=>{if(k&&k!=='ignored_class')r[k]=cells[i]||''});
    cells.forEach(cell=>{
      const val=(cell||'').trim();
      if(!val)return;
      if(!r.passport_photo_url && /^https?:\/\/|^\/uploads\/|\.(png|jpe?g|webp)$/i.test(val)) r.passport_photo_url=val;
      else if(!r.parent_phone && /^(07|01|\+?254)\d{7,9}$/.test(val.replace(/[\s-]/g,''))) r.parent_phone=val;
      else if(!r.gender && /^(male|female|m|f)$/i.test(val)) r.gender=/^m/i.test(val)?'Male':'Female';
      else if(!r.date_of_birth && (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(val)||/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/.test(val))) r.date_of_birth=val;
      else if(!r.cbc_pathway && /^(stem|social\s*sciences?|arts?\s*(?:&|and)\s*sports?|exploratory)/i.test(val)) r.cbc_pathway=val;
    });
    if(r.full_name){
      const n=parseFullName(r.full_name);
      r.first_name=r.first_name||n.first_name;
      r.middle_name=r.middle_name||n.middle_name;
      r.last_name=r.last_name||n.last_name;
    }
    if(!r.first_name||!r.last_name){
      const n=parseFullName(cells.find(v=>v&&v.trim()&&!/^https?:\/\/|^\d+$/.test(v))||'');
      r.first_name=r.first_name||n.first_name;
      r.middle_name=r.middle_name||n.middle_name;
      r.last_name=r.last_name||n.last_name;
    }
    return r;
  }).filter(r=>r.first_name&&r.last_name);
  if(!rows.length)return alert('No usable learner rows found. Paste learner rows with Assessment No, Admission No, Full Name, DOB, Gender, CBC Pathway, Parent Phone.');
  try{
    b.disabled=true;
    if(msg)msg.textContent=`Importing ${rows.length} learner(s) with CBC details…`;
    const r=await api(`/api/people/${sid}/learners/bulk`,{method:'POST',body:{academic_year_id:yearId,class_id:c.id,rows}});
    if(msg)msg.textContent=`Imported: ${r.created} new, ${r.updated} updated, ${r.skipped} skipped.`;
    $('classBulkLearnerPaste').value='';
    await load();
    await openClassList(c.id);
  }catch(x){
    if(msg)msg.textContent=x.message;
    alert(x.message);
  }finally{
    b.disabled=false;
  }
});
"""
        new_text = text[:start_idx] + replacement + "\n" + text[end_idx:]
        dash_file.write_text(new_text, encoding="utf-8")
        print("✓ public/dashboard.html: class register bulk import updated.")

# 5. Update public/js/zelimu-approved-dashboard.js
js_file = Path("public/js/zelimu-approved-dashboard.js")
if js_file.exists():
    text = js_file.read_text(encoding="utf-8")
    start = text.find('const shortcuts=[')
    end = text.find(';', start) + 1
    old_shortcuts = text[start:end]

    new_shortcuts = """const moduleIcons = {
  learners: '<g class="ah-bob"><path d="M32 12L52 22 32 32 12 22Z" fill="rgba(56,189,248,0.2)"/><path d="M12 22l20 10 20-10"/><path d="M18 25v14c0 6 6 11 14 11s14-5 14-11V25"/><circle cx="48" cy="24" r="2.5" fill="#38bdf8"/><path d="M48 26.5v12" stroke-width="2"/></g><path class="ah-draw" d="M22 42c3 3 6.5 4.5 10 4.5s7-1.5 10-4.5"/><circle class="ah-twinkle" cx="50" cy="14" r="2.5"/>',
  marks: '<rect x="12" y="10" width="32" height="44" rx="6" fill="rgba(74,222,128,0.15)"/><path d="M20 20h16M20 28h12"/><path class="ah-draw" d="M20 36h14"/><g class="ah-write"><path d="M40 42l14-14 6 6-14 14-8 2z" fill="rgba(74,222,128,0.3)"/><path d="M49 33l6 6"/></g><circle class="ah-twinkle" cx="20" cy="44" r="2"/>',
  reports: '<rect x="10" y="10" width="44" height="38" rx="6" fill="rgba(251,113,133,0.15)"/><path d="M18 20h22M18 28h16M18 36h10"/><g class="ah-twinkle"><circle cx="44" cy="38" r="8" fill="#081322"/><path d="M40 44l-4 10 8-4 8 4-4-10"/><circle cx="44" cy="38" r="4" fill="rgba(251,113,133,0.4)"/></g>',
  finance: '<ellipse cx="32" cy="18" rx="18" ry="7" fill="rgba(240,196,101,0.25)"/><path d="M14 18v12c0 3.8 8 7 18 7s18-3.2 18-7V18"/><path d="M14 30v12c0 3.8 8 7 18 7s18-3.2 18-7V30"/><circle class="ah-twinkle" cx="44" cy="14" r="3"/><path class="ah-draw" d="M28 22h8M32 19v6"/>',
  timetable: '<rect x="10" y="14" width="44" height="38" rx="6" fill="rgba(167,139,250,0.15)"/><path d="M10 26h44M24 14v38M38 14v38"/><g class="ah-spin"><circle cx="48" cy="44" r="8" fill="#081322"/><path d="M48 38v6l4 2"/></g>',
  staff: '<rect x="14" y="14" width="36" height="42" rx="6" fill="rgba(45,212,191,0.15)"/><circle cx="32" cy="28" r="7" fill="rgba(45,212,191,0.28)"/><path d="M20 44c0-5 5.5-8 12-8s12 3 12 8"/><path d="M26 14V8h12v6"/><circle class="ah-twinkle" cx="46" cy="18" r="2"/>',
  sms: '<g class="ah-bob"><path d="M10 32L54 12 38 52l-8-12z" fill="rgba(251,146,60,0.2)"/><path d="M30 40L54 12"/></g><path class="ah-dash" d="M8 44h10M12 50h8"/><circle class="ah-twinkle" cx="48" cy="46" r="3"/>',
  branding: '<path d="M32 8L50 16v16c0 14-8 22-18 26C22 54 14 46 14 32V16z" fill="rgba(232,121,249,0.16)"/><circle class="ah-ring" cx="32" cy="30" r="10"/><path class="ah-draw" d="M26 30l4 4 8-8"/>'
};

const kpiIcons = {
  learners: '<path d="M32 14L48 22 32 30 16 22Z" fill="rgba(56,189,248,0.25)" stroke="#38bdf8"/><path d="M20 25v12c0 5 5 9 12 9s12-4 12-9V25" stroke="#38bdf8"/><circle cx="32" cy="48" r="3" fill="#38bdf8"/>',
  staff: '<circle cx="32" cy="24" r="8" fill="rgba(45,212,191,0.25)" stroke="#2dd4bf"/><path d="M18 44c0-5 6-8 14-8s14 3 14 8" stroke="#2dd4bf"/><circle class="ah-twinkle" cx="44" cy="16" r="2.5" fill="#2dd4bf"/>',
  attendance: '<circle cx="32" cy="32" r="18" stroke="#60a5fa" fill="rgba(96,165,250,0.15)"/><path d="M32 20v12l8 5" stroke="#60a5fa"/><circle cx="32" cy="32" r="3" fill="#60a5fa"/>',
  finance: '<ellipse cx="32" cy="20" rx="14" ry="6" fill="rgba(240,196,101,0.25)" stroke="#f0c465"/><path d="M18 20v10c0 3.3 6.3 6 14 6s14-2.7 14-6V20" stroke="#f0c465"/><path d="M18 30v10c0 3.3 6.3 6 14 6s14-2.7 14-6V30" stroke="#f0c465"/>',
  assessments: '<rect x="16" y="12" width="32" height="40" rx="5" fill="rgba(74,222,128,0.15)" stroke="#4ade80"/><path d="M22 22h14M22 30h10M22 38h16" stroke="#4ade80"/><path d="M38 22l3 3 7-7" stroke="#4ade80"/>',
  tasks: '<rect x="14" y="14" width="36" height="36" rx="6" fill="rgba(167,139,250,0.15)" stroke="#a78bfa"/><path d="M22 26l4 4 10-10M22 38h16" stroke="#a78bfa"/>'
};

const shortcuts=[
  ['Learner Management','pm24_4','ROSTER & ENROLLMENT','#38bdf8','learners'],
  ['Assessment Entry','pm24_8','CBC MARKS & SCORES','#4ade80','marks'],
  ['Generate Reports','pm24_11','A4 CBC REPORT CARDS','#fb7185','reports'],
  ['Fee Management','pm24_28','TREASURY & INVOICES','#f0c465','finance'],
  ['Timetable Generator','pm24_19','LESSONS & SCHEDULES','#a78bfa','timetable'],
  ['Staff Management','pm24_3','TEACHERS & ACCOUNTS','#2dd4bf','staff'],
  ['Parent Communication','pm24_15','BULK SMS & NOTICES','#fb923c','sms'],
  ['School Branding','pm24_21','CRESTS & STAMPS','#e879f9','branding']
];"""

    old_metric = """function metric(name,icon,id,target,note){return `<button type="button" class="z7-kpi" data-z7-target="${target}"><span class="z7-kpi-icon">${icon}</span><span><div class="z7-kpi-name">${name}</div><div class="z7-kpi-number" id="${id}">—</div><div class="z7-kpi-note">${note}</div></span></button>`}"""

    new_metric = """function metric(name,iconKey,id,target,note,hue='#f0c465'){
  const svg = kpiIcons[iconKey] || `<circle cx="32" cy="32" r="16" stroke="${hue}" fill="none"/>`;
  return `<button type="button" class="z7-kpi z7-live-kpi" data-z7-target="${target}" style="--c:${hue};">
    <span class="z7-kpi-medal">
      <span class="z7-kpi-bubbles"><i></i><i></i></span>
      <svg class="z7-kpi-svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        ${svg}
      </svg>
    </span>
    <span class="z7-kpi-meta">
      <div class="z7-kpi-name">${name}</div>
      <div class="z7-kpi-number" id="${id}">—</div>
      <div class="z7-kpi-note">${note}</div>
    </span>
  </button>`;
}"""

    old_brand = """<aside class="z7-side"><div class="z7-brand"><span class="z7-logo">🎓</span><div><strong>ZELIMU CBC</strong><small>Smart Schools. Brighter Futures.</small></div></div>"""

    new_brand = """<aside class="z7-side"><div class="z7-brand"><span class="z7-logo z7-rotating-logo" title="ZELIMU CBC Engine"><svg class="z7-seal-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="22" stroke="url(#z7GoldGrad)" stroke-width="2" stroke-dasharray="4 2"/><circle cx="24" cy="24" r="18" fill="rgba(8,19,34,0.9)" stroke="rgba(240,196,101,0.5)" stroke-width="1.2"/><circle cx="24" cy="4" r="2.5" fill="#f0c465" filter="drop-shadow(0 0 4px #f0c465)"/><circle cx="44" cy="24" r="2" fill="#38bdf8" filter="drop-shadow(0 0 4px #38bdf8)"/><circle cx="24" cy="44" r="2.5" fill="#4ade80" filter="drop-shadow(0 0 4px #4ade80)"/><circle cx="4" cy="24" r="2" fill="#fb7185" filter="drop-shadow(0 0 4px #fb7185)"/><path d="M24 13L37 19.5L24 26L11 19.5L24 13Z" fill="url(#z7GoldGrad)" stroke="#fff" stroke-width="0.8"/><path d="M16 22.5V29C16 32 20 34.5 24 34.5C28 34.5 32 32 32 29V22.5" stroke="#f0c465" stroke-width="1.6" stroke-linecap="round"/><path d="M34 21V29" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round"/><circle cx="34" cy="30" r="1.5" fill="#38bdf8"/><defs><linearGradient id="z7GoldGrad" x1="11" y1="13" x2="37" y2="34.5" gradientUnits="userSpaceOnUse"><stop stop-color="#fff8db"/><stop offset="0.5" stop-color="#f0c465"/><stop offset="1" stop-color="#b8862f"/></linearGradient></defs></svg></span><div><strong>ZELIMU CBC</strong><small>Smart Schools. Brighter Futures.</small></div></div>"""

    old_kpi_block = """<div class="z7-kpis">${metric('Learners','♟','z7Learners','pm24_4','Enrolled learners')}${metric('Staff','♟','z7Staff','pm24_3','Registered personnel')}${metric('Attendance','▦','z7Attendance','pm24_13','Daily attendance')}${metric('Fee Collection','▤','z7Fees','pm24_28','School finance')}${metric('Assessments','▣','z7Assessments','pm24_7','Assessment records')}${metric('Pending Tasks','☑','z7Tasks','pm24_2','Review workflows')}</div>"""

    new_kpi_block = """<div class="z7-kpis">${metric('Learners','learners','z7Learners','pm24_4','Enrolled learners','#38bdf8')}${metric('Staff','staff','z7Staff','pm24_3','Registered personnel','#2dd4bf')}${metric('Attendance','attendance','z7Attendance','pm24_13','Daily attendance','#60a5fa')}${metric('Fee Collection','finance','z7Fees','pm24_28','School finance','#f0c465')}${metric('Assessments','assessments','z7Assessments','pm24_7','Assessment records','#4ade80')}${metric('Pending Tasks','tasks','z7Tasks','pm24_2','Review workflows','#a78bfa')}</div>"""

    old_workspace = """<div class="z7-workspace">"""
    new_workspace = """<div class="z7-workspace"><div class="z7-bubbles" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>"""

    old_shortcuts_map = """<div class="z7-sectiontitle">Module Shortcuts</div><div class="z7-shortcuts">${shortcuts.map(([ic,name,target])=>`<button type="button" class="z7-shortcut" data-z7-target="${target}"><span class="bubble">${ic}</span><span>${name}</span></button>`).join('')}</div>"""

    new_shortcuts_map = """<div class="z7-sectiontitle">Module Shortcuts · Live Control System</div><div class="z7-shortcuts">${shortcuts.map(([name,target,tag,hue,iconKey],i)=>`<button type="button" class="z7-shortcut z7-live-tile" data-z7-target="${target}" style="--c:${hue};--d:${i*60}ms;"><span class="z7-shortcut-medal"><span class="z7-medal-bubbles"><i></i><i></i><i></i><i></i></span><svg class="z7-shortcut-svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${moduleIcons[iconKey]}</svg></span><span class="z7-shortcut-meta"><strong>${name}</strong><small>${tag}</small></span></button>`).join('')}</div>"""

    if old_shortcuts and old_metric in text and old_brand in text:
        text = text.replace(old_shortcuts, new_shortcuts, 1)
        text = text.replace(old_metric, new_metric, 1)
        text = text.replace(old_brand, new_brand, 1)
        if old_kpi_block in text:
            text = text.replace(old_kpi_block, new_kpi_block, 1)
        if old_workspace in text and new_workspace not in text:
            text = text.replace(old_workspace, new_workspace, 1)
        if old_shortcuts_map in text:
            text = text.replace(old_shortcuts_map, new_shortcuts_map, 1)
        js_file.write_text(text, encoding="utf-8")
        print("✓ public/js/zelimu-approved-dashboard.js: rotating seal, particles and live module tiles configured.")

# 6. Update public/css/zelimu-gold-command-centre.css
css_file = Path("public/css/zelimu-gold-command-centre.css")
if css_file.exists():
    text = css_file.read_text(encoding="utf-8")
    if "/* ZELIMU CBC — LIVE DASHBOARD THEME & ROTATING LOGO */" not in text:
        extra_css = """
/* ZELIMU CBC — LIVE DASHBOARD THEME & ROTATING LOGO */

/* 1. CONTINUOUS ROTATING DASHBOARD LOGO */
body .z7-logo.z7-rotating-logo {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 48px !important;
  height: 48px !important;
  flex-shrink: 0 !important;
  animation: z7RotateRound 12s linear infinite !important;
  transform-origin: center center !important;
  filter: drop-shadow(0 0 10px rgba(240,196,101,.7)) drop-shadow(0 0 20px rgba(56,189,248,.4)) !important;
  transition: transform .3s ease !important;
  cursor: pointer !important;
}
body .z7-logo.z7-rotating-logo:hover {
  animation-duration: 4s !important;
  filter: drop-shadow(0 0 16px rgba(240,196,101,.95)) drop-shadow(0 0 28px rgba(56,189,248,.65)) !important;
}
@keyframes z7RotateRound {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.z7-seal-svg {
  width: 100% !important;
  height: 100% !important;
  display: block !important;
}

/* 2. DAZZLING PARTICLE BUBBLES OVER THE DASHBOARD */
body .z7-bubbles {
  position: fixed !important;
  inset: 0 !important;
  left: 255px !important;
  pointer-events: none !important;
  z-index: 0 !important;
  overflow: hidden !important;
}
@media (max-width: 900px) {
  body .z7-bubbles { left: 0 !important; }
}
body .z7-bubbles i {
  position: absolute !important;
  bottom: -15px !important;
  left: var(--x) !important;
  width: var(--s) !important;
  height: var(--s) !important;
  border-radius: 50% !important;
  background: radial-gradient(circle at 30% 30%, #fff 25%, var(--bcolor, #f0c465) 75%, transparent 95%) !important;
  box-shadow: 0 0 10px var(--bcolor, #f0c465), 0 0 22px rgba(240,196,101,.35) !important;
  animation: z7BubbleRise var(--dur) linear infinite !important;
  animation-delay: var(--del) !important;
  opacity: 0 !important;
}
@keyframes z7BubbleRise {
  0% { transform: translateY(0) scale(0.6); opacity: 0; }
  12% { opacity: 0.85; }
  85% { opacity: 0.75; }
  100% { transform: translateY(-105vh) scale(1.35); opacity: 0; }
}

body .z7-bubbles i:nth-child(1){--x:5%;--s:3.5px;--dur:8.2s;--del:-1.2s;--bcolor:#f0c465}
body .z7-bubbles i:nth-child(2){--x:13%;--s:5px;--dur:11.4s;--del:-4.5s;--bcolor:#38bdf8}
body .z7-bubbles i:nth-child(3){--x:21%;--s:2.5px;--dur:7.8s;--del:-2.3s;--bcolor:#4ade80}
body .z7-bubbles i:nth-child(4){--x:29%;--s:4.5px;--dur:12.6s;--del:-7.1s;--bcolor:#fb7185}
body .z7-bubbles i:nth-child(5){--x:37%;--s:3px;--dur:9.1s;--del:-3.4s;--bcolor:#f0c465}
body .z7-bubbles i:nth-child(6){--x:45%;--s:5.5px;--dur:13.2s;--del:-5.8s;--bcolor:#a78bfa}
body .z7-bubbles i:nth-child(7){--x:53%;--s:2.5px;--dur:8.5s;--del:-0.8s;--bcolor:#38bdf8}
body .z7-bubbles i:nth-child(8){--x:61%;--s:4px;--dur:10.7s;--del:-6.2s;--bcolor:#fbbf24}
body .z7-bubbles i:nth-child(9){--x:69%;--s:3px;--dur:9.8s;--del:-2.9s;--bcolor:#34d399}
body .z7-bubbles i:nth-child(10){--x:77%;--s:5px;--dur:12.1s;--del:-8.4s;--bcolor:#f472b6}
body .z7-bubbles i:nth-child(11){--x:84%;--s:2.5px;--dur:7.4s;--del:-1.9s;--bcolor:#38bdf8}
body .z7-bubbles i:nth-child(12){--x:92%;--s:4px;--dur:10.2s;--del:-4.1s;--bcolor:#f0c465}
body .z7-bubbles i:nth-child(13){--x:9%;--s:3px;--dur:9.5s;--del:-6.7s;--bcolor:#a78bfa}
body .z7-bubbles i:nth-child(14){--x:25%;--s:4.5px;--dur:11.8s;--del:-3.1s;--bcolor:#38bdf8}
body .z7-bubbles i:nth-child(15){--x:41%;--s:2px;--dur:8.1s;--del:-5.2s;--bcolor:#4ade80}
body .z7-bubbles i:nth-child(16){--x:58%;--s:5px;--dur:12.9s;--del:-1.5s;--bcolor:#fb7185}
body .z7-bubbles i:nth-child(17){--x:66%;--s:3.5px;--dur:10.5s;--del:-7.8s;--bcolor:#f0c465}
body .z7-bubbles i:nth-child(18){--x:81%;--s:4px;--dur:9.2s;--del:-3.7s;--bcolor:#2dd4bf}
body .z7-bubbles i:nth-child(19){--x:17%;--s:2.5px;--dur:8.9s;--del:-5.9s;--bcolor:#fbbf24}
body .z7-bubbles i:nth-child(20){--x:74%;--s:4.5px;--dur:11.1s;--del:-2.4s;--bcolor:#38bdf8}

/* 3. LIVE MODULE SHORTCUTS WITH GLOWING TILES & MEDALS */
body .z7-shortcuts {
  display: grid !important;
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 16px !important;
  margin-top: 14px !important;
}
@media (min-width: 1400px) {
  body .z7-shortcuts { grid-template-columns: repeat(8, minmax(0, 1fr)) !important; }
}
@media (max-width: 768px) {
  body .z7-shortcuts { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
}

body .z7-shortcut.z7-live-tile {
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  gap: 10px !important;
  padding: 18px 12px 16px !important;
  min-height: 128px !important;
  border-radius: 16px !important;
  background: linear-gradient(160deg, color-mix(in srgb, var(--c, #f0c465) 12%, #0b1c38) 0%, #081226 75%) !important;
  border: 1px solid color-mix(in srgb, var(--c, #f0c465) 30%, rgba(23,54,93,.6)) !important;
  box-shadow: 0 10px 28px -12px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.08) !important;
  transition: transform .25s ease, border-color .25s ease, box-shadow .25s ease !important;
  overflow: hidden !important;
  cursor: pointer !important;
}
body .z7-shortcut.z7-live-tile::after {
  content: "" !important;
  position: absolute !important;
  inset: 0 !important;
  border-radius: 16px !important;
  pointer-events: none !important;
  background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,.08) 50%, transparent 70%) !important;
  transform: translateX(-120%) !important;
  animation: z7Sheen 6s ease-in-out infinite !important;
  animation-delay: var(--d, 0ms) !important;
}
@keyframes z7Sheen {
  0%, 60% { transform: translateX(-120%); }
  90%, 100% { transform: translateX(120%); }
}
body .z7-shortcut.z7-live-tile:hover {
  transform: translateY(-4px) scale(1.02) !important;
  border-color: color-mix(in srgb, var(--c, #f0c465) 80%, #fff) !important;
  box-shadow: 0 18px 40px -12px color-mix(in srgb, var(--c, #f0c465) 55%, transparent),
              0 0 0 1px color-mix(in srgb, var(--c, #f0c465) 45%, transparent),
              inset 0 1px 0 rgba(255,255,255,.18) !important;
}
body .z7-shortcut-medal {
  position: relative !important;
  width: 48px !important;
  height: 48px !important;
  border-radius: 50% !important;
  display: grid !important;
  place-items: center !important;
  background: radial-gradient(circle at 35% 35%, color-mix(in srgb, var(--c, #f0c465) 35%, transparent), #081226 80%) !important;
  border: 1.5px solid color-mix(in srgb, var(--c, #f0c465) 60%, transparent) !important;
  box-shadow: 0 0 18px color-mix(in srgb, var(--c, #f0c465) 40%, transparent),
              inset 0 0 14px color-mix(in srgb, var(--c, #f0c465) 20%, transparent) !important;
  color: var(--c, #f0c465) !important;
  transition: transform .25s ease, box-shadow .25s ease !important;
}
body .z7-shortcut.z7-live-tile:hover .z7-shortcut-medal {
  transform: scale(1.1) !important;
  box-shadow: 0 0 28px color-mix(in srgb, var(--c, #f0c465) 75%, transparent),
              inset 0 0 20px color-mix(in srgb, var(--c, #f0c465) 40%, transparent) !important;
}
body .z7-shortcut-svg {
  width: 28px !important;
  height: 28px !important;
  position: relative !important;
  z-index: 2 !important;
}
body .z7-shortcut-meta strong {
  display: block !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  color: #f1f5f9 !important;
  line-height: 1.25 !important;
  letter-spacing: .2px !important;
}
body .z7-shortcut-meta small {
  display: block !important;
  font-size: 8.5px !important;
  font-weight: 600 !important;
  letter-spacing: 1.4px !important;
  color: var(--c, #f0c465) !important;
  margin-top: 2px !important;
}

/* 4. LIVE KPI METRIC CARDS WITH GLOWING MEDALS */
body .z7-kpi.z7-live-kpi {
  position: relative !important;
  display: flex !important;
  align-items: center !important;
  gap: 14px !important;
  padding: 16px 18px !important;
  border-radius: 16px !important;
  background: linear-gradient(155deg, color-mix(in srgb, var(--c, #f0c465) 10%, #0c1a30) 0%, #071120 80%) !important;
  border: 1px solid color-mix(in srgb, var(--c, #f0c465) 26%, rgba(255,255,255,.08)) !important;
  box-shadow: 0 10px 24px rgba(0,0,0,.35) !important;
  transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease !important;
  cursor: pointer !important;
}
body .z7-kpi.z7-live-kpi:hover {
  transform: translateY(-3px) !important;
  border-color: color-mix(in srgb, var(--c, #f0c465) 60%, transparent) !important;
  box-shadow: 0 16px 36px -10px color-mix(in srgb, var(--c, #f0c465) 40%, transparent) !important;
}
body .z7-kpi-medal {
  position: relative !important;
  width: 44px !important;
  height: 44px !important;
  border-radius: 50% !important;
  display: grid !important;
  place-items: center !important;
  background: radial-gradient(circle at 35% 35%, color-mix(in srgb, var(--c, #f0c465) 30%, transparent), #071120 80%) !important;
  border: 1.5px solid color-mix(in srgb, var(--c, #f0c465) 50%, transparent) !important;
  box-shadow: 0 0 16px color-mix(in srgb, var(--c, #f0c465) 35%, transparent) !important;
  color: var(--c, #f0c465) !important;
  flex-shrink: 0 !important;
}
body .z7-kpi.z7-live-kpi:hover .z7-kpi-medal {
  transform: scale(1.08) !important;
}
body .z7-kpi-svg {
  width: 24px !important;
  height: 24px !important;
}
body .z7-kpi-number {
  font-size: 1.55rem !important;
  font-weight: 800 !important;
  color: #fff !important;
  text-shadow: 0 0 12px color-mix(in srgb, var(--c, #f0c465) 35%, transparent) !important;
}

/* 5. SVG ANIMATIONS (SHARED WITH ASSESSMENT HUB) */
.ah-bob { animation: ahBob 3.5s ease-in-out infinite alternate; }
@keyframes ahBob { from { transform: translateY(0); } to { transform: translateY(-3px); } }

.ah-draw { stroke-dasharray: 60; stroke-dashoffset: 60; animation: ahDraw 2.4s ease-out forwards infinite; }
@keyframes ahDraw { 0% { stroke-dashoffset: 60; } 50%, 100% { stroke-dashoffset: 0; } }

.ah-spin { transform-origin: center; animation: ahSpin 8s linear infinite; }
@keyframes ahSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.ah-twinkle { animation: ahTwinkle 2s ease-in-out infinite alternate; }
@keyframes ahTwinkle { 0% { opacity: 0.3; transform: scale(0.8); } 100% { opacity: 1; transform: scale(1.2); } }

.ah-ring { animation: ahPulse 2s ease-in-out infinite; transform-origin: center; }
@keyframes ahPulse { 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.1); opacity: 0.4; } }

.ah-write { animation: ahWrite 2.8s ease-in-out infinite; }
@keyframes ahWrite { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-2px, -3px); } }

.ah-dash { stroke-dasharray: 4 2; animation: ahDash 1.6s linear infinite; }
@keyframes ahDash { to { stroke-dashoffset: -12; } }

.ah-grow { animation: ahGrow 3s ease-in-out infinite alternate; transform-origin: bottom; }
@keyframes ahGrow { 0% { transform: scaleY(0.65); } 100% { transform: scaleY(1); } }
"""
        css_file.write_text(text + extra_css, encoding="utf-8")
        print("✓ public/css/zelimu-gold-command-centre.css: live theme, bubbles and glowing medals added.")

print("\n--- All Live Dashboard and Import Patches Applied Successfully! ---")

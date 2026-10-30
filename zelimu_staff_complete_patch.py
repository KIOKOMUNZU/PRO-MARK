from pathlib import Path
import sys
root=Path.cwd(); bp=root/'backend/routes/people.js'; hp=root/'public/dashboard.html'
if not bp.exists() or not hp.exists(): sys.exit('Missing source files. No changes made.')
b=bp.read_text(); h=hp.read_text()
if 'ZELIMU STAFF MANAGEMENT V2' in b or 'zelimuStaffHubV2' in h: sys.exit('Staff V2 already installed. No changes made.')
required=['ZELIMU STAFF API V1','zelimuStaffForm','teacherForm','zelimuOpenPeopleMode(mode)','function zelimuLoadStaff()']
if any(x not in b+h for x in required): sys.exit('Staff V1 installation not detected. No changes made.')
anchor="router.get('/:schoolId/staff',schoolBoundary"
if b.count(anchor)!=1: sys.exit('Unexpected staff route structure. No changes made.')
api=r'''// ZELIMU STAFF MANAGEMENT V2 — school-scoped unified directory and profile editing.
router.get('/:schoolId/staff-management',schoolBoundary,roles('SCHOOL_ADMIN','ADMIN','HEADTEACHER','DEPUTY_HEADTEACHER'),async(req,res)=>{
 try{
  const sid=req.params.schoolId;
  const t=await db.query(`SELECT t.id,'TEACHER'::text staff_type,t.staff_no,t.first_name,t.last_name,t.email,
   p.phone,COALESCE(p.designation,'Teacher') designation,p.department,p.employment_type,p.employment_date,
   p.tsc_number,p.qualifications,p.notes,t.is_active
   FROM teachers t LEFT JOIN teacher_staff_profiles p ON p.teacher_id=t.id AND p.school_id=t.school_id
   WHERE t.school_id=$1`,[sid]);
  const n=await db.query(`SELECT id,'NON_TEACHING'::text staff_type,staff_no,first_name,last_name,email,phone,designation,department,
   employment_type,employment_date,NULL::text tsc_number,NULL::text qualifications,NULL::text notes,is_active
   FROM non_teaching_staff WHERE school_id=$1`,[sid]);
  res.json([...t.rows,...n.rows].sort((a,b)=>String(a.last_name).localeCompare(String(b.last_name))));
 }catch(e){console.error('staff-management GET',e);res.status(500).json({error:'Unable to load staff profiles. Apply migration 031.'});}
});
router.patch('/:schoolId/staff-management/:type/:id',schoolBoundary,roles('SCHOOL_ADMIN','ADMIN'),async(req,res)=>{
 const sid=req.params.schoolId,id=req.params.id,type=req.params.type,b=req.body||{};
 if(!['teacher','non-teaching'].includes(type)||!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({error:'Invalid staff record.'});
 const str=(v,max=250)=>String(v??'').trim().slice(0,max);
 const name=str(b.first_name),last=str(b.last_name),designation=str(b.designation);
 if(!name||!last||!designation)return res.status(400).json({error:'Names and designation are required.'});
 const date=b.employment_date||null;
 if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))return res.status(400).json({error:'Invalid employment date.'});
 const c=await db.pool.connect();
 try{
  await c.query('BEGIN');let q;
  if(type==='teacher'){
   q=await c.query('UPDATE teachers SET first_name=$3,last_name=$4,email=$5,is_active=$6 WHERE school_id=$1 AND id=$2 RETURNING id',
    [sid,id,name,last,str(b.email)||null,b.is_active!==false]);
   if(!q.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:'Teacher not found.'});}
   await c.query(`INSERT INTO teacher_staff_profiles(school_id,teacher_id,phone,designation,department,employment_type,employment_date,tsc_number,qualifications,notes)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT(teacher_id) DO UPDATE SET phone=EXCLUDED.phone,designation=EXCLUDED.designation,department=EXCLUDED.department,
    employment_type=EXCLUDED.employment_type,employment_date=EXCLUDED.employment_date,tsc_number=EXCLUDED.tsc_number,
    qualifications=EXCLUDED.qualifications,notes=EXCLUDED.notes,updated_at=now()`,
    [sid,id,str(b.phone)||null,designation,str(b.department)||null,str(b.employment_type)||null,date,str(b.tsc_number)||null,str(b.qualifications,2000)||null,str(b.notes,2000)||null]);
  }else{
   q=await c.query(`UPDATE non_teaching_staff SET first_name=$3,last_name=$4,email=$5,phone=$6,designation=$7,department=$8,
    employment_type=$9,employment_date=$10,is_active=$11 WHERE school_id=$1 AND id=$2 RETURNING id`,
    [sid,id,name,last,str(b.email)||null,str(b.phone)||null,designation,str(b.department)||null,str(b.employment_type)||null,date,b.is_active!==false]);
   if(!q.rowCount){await c.query('ROLLBACK');return res.status(404).json({error:'Staff record not found.'});}
  }
  await c.query('COMMIT');res.json({ok:true,id});
 }catch(e){await c.query('ROLLBACK').catch(()=>{});console.error('staff-management PATCH',e);res.status(400).json({error:'Unable to update staff record.'});}
 finally{c.release();}
});
'''
b=b.replace(anchor,api+anchor,1)
# Extend teacher registration without changing its existing teacher insert or login links.
old_post="res.status(201).json(q.rows[0]);}catch(e){res.status(400).json({error:e.code==='23505'?'That staff number already exists in this school.':e.message});}});"
if b.count(old_post)!=1:sys.exit('Teacher POST handler differs. No changes made.')
new_post="""if(q.rows[0] && [b.phone,b.designation,b.department,b.employment_type,b.employment_date,b.tsc_number,b.qualifications].some(Boolean)){
 await db.query(`INSERT INTO teacher_staff_profiles(school_id,teacher_id,phone,designation,department,employment_type,employment_date,tsc_number,qualifications)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(teacher_id) DO NOTHING`,
 [req.params.schoolId,q.rows[0].id,clean(b.phone)||null,clean(b.designation)||'Teacher',clean(b.department)||null,clean(b.employment_type)||null,b.employment_date||null,clean(b.tsc_number)||null,clean(b.qualifications)||null]);
 }res.status(201).json(q.rows[0]);}catch(e){res.status(400).json({error:e.code==='23505'?'That staff number already exists in this school.':e.message});}});"""
b=b.replace(old_post,new_post,1)
# UI sits immediately before existing teacher form inside People grid. Existing forms untouched.
needle='<form id="teacherForm">'
if h.count(needle)!=1:sys.exit('Teacher form structure differs. No changes made.')
ui=r'''<div id="zelimuStaffHubV2" class="card" style="grid-column:1/-1;padding:14px;margin-bottom:12px;display:none">
<h3>Staff Management</h3><div id="zelimuStaffTabsV2" class="actions" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
<button type="button" class="btn secondary" data-staff-tab="teacher">Register Teacher</button>
<button type="button" class="btn secondary" data-staff-tab="nonteaching">Register Non-Teaching Staff</button>
<button type="button" class="btn secondary" data-staff-tab="directory">Staff Directory</button>
<button type="button" class="btn secondary" data-staff-tab="profiles">Staff Profiles</button>
<button type="button" class="btn secondary" data-staff-tab="employment">Employment Records</button></div>
<div id="zelimuStaffManagePanelV2" style="display:none">
<label>Search staff <input id="zelimuStaffSearchV2" type="search" placeholder="Name, staff number, designation or department"></label>
<label>Staff category <select id="zelimuStaffFilterV2"><option value="">All staff</option><option value="TEACHER">Teaching staff</option><option value="NON_TEACHING">Non-teaching staff</option></select></label>
<div id="zelimuStaffResultsV2" class="directory" aria-live="polite"></div>
<form id="zelimuStaffEditV2" style="display:none;margin-top:14px" autocomplete="off"><h3 id="zelimuStaffEditTitleV2">Staff Profile</h3>
<input type="hidden" name="id"><input type="hidden" name="staff_type">
<div class="zelimu-staff-fields-v2">
<label>First name<input name="first_name" required></label><label>Last name<input name="last_name" required></label>
<label>Email<input name="email" type="email"></label><label>Phone<input name="phone" type="tel"></label>
<label>Designation<input name="designation" required></label><label>Department<input name="department"></label>
<label>Employment type<select name="employment_type"><option value="">Not specified</option><option>Permanent</option><option>Contract</option><option>Casual</option><option>Intern</option><option>Temporary</option></select></label>
<label>Employment start date<input name="employment_date" type="date"></label>
<label class="zelimu-teacher-only-v2">TSC number (if applicable)<input name="tsc_number"></label>
<label class="zelimu-teacher-only-v2">Qualifications<input name="qualifications"></label>
<label class="zelimu-teacher-only-v2">Professional notes<input name="notes"></label>
<label>Employment status<select name="is_active"><option value="true">Active</option><option value="false">Inactive</option></select></label>
</div><button class="btn primary" type="submit">Save Staff Profile</button>
<button class="btn secondary" type="button" id="zelimuStaffCancelV2">Cancel</button></form></div></div>'''
h=h.replace(needle,ui+needle,1)
# Fields are inside the existing teacher form; existing submission uses FormData.
teacher_fields='''<label>Phone<input name="phone" type="tel"></label><label>Designation<input name="designation" value="Teacher"></label><label>Department<input name="department"></label><label>Employment type<select name="employment_type"><option value="">Not specified</option><option>Permanent</option><option>Contract</option><option>Casual</option><option>Intern</option></select></label><label>Employment start date<input name="employment_date" type="date"></label><label>TSC number (if applicable)<input name="tsc_number"></label><label>Qualifications<input name="qualifications"></label>'''
needle_form='<label>Email<input name="email" type="email"></label><button class="btn" type="submit">Add teacher</button></form>'
if h.count(needle_form)!=1:sys.exit('Teacher registration fields differ. No changes made.')
h=h.replace(needle_form,'<label>Email<input name="email" type="email"></label>'+teacher_fields+'<button class="btn" type="submit">Add teacher</button></form>',1)
# Make staff hub visible only in teacher mode, hide the teacher and staff forms on directory tabs.
needle2=" if(teacher)zelimuLoadStaff();"
if h.count(needle2)!=1:sys.exit('Staff mode handler differs. No changes made.')
h=h.replace(needle2," if(teacher){zelimuStaffTabV2('teacher');}else{const hub=document.getElementById('zelimuStaffHubV2');if(hub)hub.style.display='none';}",1)
js=r'''// ZELIMU STAFF MANAGEMENT V2
let zelimuStaffRecordsV2=[];
function zelimuStaffTabV2(tab){
 const hub=document.getElementById('zelimuStaffHubV2'),t=document.getElementById('teacherForm'),n=document.getElementById('zelimuStaffArea');
 if(!hub)return;hub.style.display='block';
 if(t)t.style.display=tab==='teacher'?'':'none';
 if(n)n.style.display=tab==='nonteaching'?'':'none';
 const panel=document.getElementById('zelimuStaffManagePanelV2');if(panel)panel.style.display=['directory','profiles','employment'].includes(tab)?'block':'none';
 hub.dataset.tab=tab;
 hub.querySelectorAll('[data-staff-tab]').forEach(x=>{x.setAttribute('aria-pressed',String(x.dataset.staffTab===tab));});
 const oldDirectory=document.getElementById('teacherSearch')?.closest('.portal-toolbar');if(oldDirectory)oldDirectory.style.display='none';
 if(tab==='nonteaching')zelimuLoadStaff();
 if(['directory','profiles','employment'].includes(tab))zelimuStaffLoadV2();
}
async function zelimuStaffLoadV2(){
 const el=document.getElementById('zelimuStaffResultsV2');if(!el)return;el.textContent='Loading staff...';
 try{zelimuStaffRecordsV2=await api(`/api/people/${sid}/staff-management`);zelimuStaffRenderV2();}
 catch(e){el.textContent=e.message||'Unable to load staff. Apply migration 031.';}
}
function zelimuStaffRenderV2(){
 const el=document.getElementById('zelimuStaffResultsV2');if(!el)return;el.replaceChildren();
 const q=(document.getElementById('zelimuStaffSearchV2')?.value||'').toLowerCase(),filter=document.getElementById('zelimuStaffFilterV2')?.value||'';
 const rows=zelimuStaffRecordsV2.filter(x=>(!filter||x.staff_type===filter)&&[x.staff_no,x.first_name,x.last_name,x.designation,x.department].join(' ').toLowerCase().includes(q));
 if(!rows.length){el.textContent='No matching staff records.';return;}
 for(const x of rows){const line=document.createElement('div');line.className='card';line.style.marginBottom='8px';
 const title=document.createElement('span');title.textContent=`${x.staff_no} · ${x.first_name} ${x.last_name} · ${x.designation||'Teacher'} · ${x.is_active?'Active':'Inactive'}`;
 const btn=document.createElement('button');btn.type='button';btn.className='btn secondary';btn.textContent='View / Edit';btn.style.marginLeft='12px';
 btn.addEventListener('click',()=>zelimuStaffEditOpenV2(x));line.append(title,btn);el.appendChild(line);}
}
function zelimuStaffEditOpenV2(x){
 const form=document.getElementById('zelimuStaffEditV2');if(!form)return;form.style.display='block';
 for(const k of ['id','staff_type','first_name','last_name','email','phone','designation','department','employment_type','employment_date','tsc_number','qualifications','notes','is_active']){
  const field=form.elements.namedItem(k);if(field)field.value=k==='is_active'?String(x.is_active!==false):k==='employment_date'?String(x[k]||'').slice(0,10):x[k]||'';
 }
 form.querySelectorAll('.zelimu-teacher-only-v2').forEach(el=>el.style.display=x.staff_type==='TEACHER'?'':'none');
 document.getElementById('zelimuStaffEditTitleV2').textContent=`Staff Profile · ${x.staff_no}`;form.scrollIntoView({block:'nearest'});
}
if(!window.__zelimuStaffV2Wired){window.__zelimuStaffV2Wired=true;
 document.addEventListener('click',e=>{const b=e.target.closest('[data-staff-tab]');if(b)zelimuStaffTabV2(b.dataset.staffTab);if(e.target.id==='zelimuStaffCancelV2')document.getElementById('zelimuStaffEditV2').style.display='none';});
 document.addEventListener('input',e=>{if(e.target.id==='zelimuStaffSearchV2')zelimuStaffRenderV2();});
 document.addEventListener('change',e=>{if(e.target.id==='zelimuStaffFilterV2')zelimuStaffRenderV2();});
 document.addEventListener('submit',async e=>{if(e.target.id!=='zelimuStaffEditV2')return;e.preventDefault();
 const f=e.target,body=Object.fromEntries(new FormData(f));const type=body.staff_type==='TEACHER'?'teacher':'non-teaching',id=body.id;
 body.is_active=body.is_active==='true';delete body.id;delete body.staff_type;
 const btn=f.querySelector('[type=submit]');btn.disabled=true;
 try{await api(`/api/people/${sid}/staff-management/${type}/${id}`,{method:'PATCH',body});f.style.display='none';await zelimuStaffLoadV2();alert('Staff profile updated.');}
 catch(err){alert(err.message||'Unable to save staff profile.');}finally{btn.disabled=false;}
 },true);
}
'''
anchorjs='function zelimuOpenPeopleMode(mode){'
if h.count(anchorjs)!=1:sys.exit('Mode function not unique. No changes made.')
h=h.replace(anchorjs,js+anchorjs,1)
# Styles scoped to staff management, avoid modifying unrelated forms.
style='''<style>/* ZELIMU STAFF MANAGEMENT V2 */
#people #zelimuStaffHubV2{height:auto!important;min-height:0!important}
#people .zelimu-staff-fields-v2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px;margin:12px 0}
#people .zelimu-staff-fields-v2 label{display:block;font-weight:600;font-size:13px}
#people .zelimu-staff-fields-v2 input,#people .zelimu-staff-fields-v2 select{box-sizing:border-box;width:100%;height:40px;min-height:40px;margin-top:4px;padding:7px 10px}
#people #zelimuStaffTabsV2 button[aria-pressed="true"]{outline:2px solid #16834a}
@media(max-width:750px){#people .zelimu-staff-fields-v2{grid-template-columns:1fr}}
</style>'''
if '</head>' not in h:sys.exit('Missing head. No changes made.')
h=h.replace('</head>',style+'</head>',1)
# The pre-existing teacher directory is hidden on staff tabs but should remain available elsewhere if mode changes.
for p,s in ((bp,b),(hp,h)):
 backup=p.with_name(p.name+'.before-staff-management-v2')
 if not backup.exists():backup.write_text(p.read_text())
 p.write_text(s)
print('Staff Management V2 installed: five tabs, unified directory, editable profiles and employment status.')
print('Apply database/031_staff_profiles.sql in Supabase before using the new directory/profile tabs.')

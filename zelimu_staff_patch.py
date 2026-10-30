from pathlib import Path
import sys
root=Path.cwd()
p=root/'backend/routes/people.js'; h=root/'public/dashboard.html'
if not p.exists() or not h.exists(): sys.exit('Missing expected project files. No changes made.')
s=p.read_text(); t=h.read_text()
if 'ZELIMU STAFF API V1' in s or 'zelimuStaffForm' in t: sys.exit('Staff repair already installed. No changes made.')
api_anchor="router.post('/:schoolId/teachers',schoolBoundary"
if s.count(api_anchor)!=1 or t.count('id="teacherForm"')!=1 or t.count('function zelimuOpenPeopleMode(mode){')!=1: sys.exit('Source differs from audited version. No changes made.')
api='''// ZELIMU STAFF API V1 — non-teaching staff, school-scoped and administrator-only.
router.get('/:schoolId/staff',schoolBoundary,roles('SCHOOL_ADMIN','ADMIN','HEADTEACHER','DEPUTY_HEADTEACHER'),async(req,res)=>{
 try{const q=await db.query('SELECT id,staff_no,first_name,last_name,email,phone,designation,department,employment_type,employment_date,is_active,created_at FROM non_teaching_staff WHERE school_id=$1 ORDER BY last_name,first_name',[req.params.schoolId]);res.json(q.rows);}
 catch(e){console.error('GET /staff',e);res.status(500).json({error:'Unable to load staff. Ensure the staff migration has been applied.'});}
});
router.post('/:schoolId/staff',schoolBoundary,roles('SCHOOL_ADMIN','ADMIN'),async(req,res)=>{
 const b=req.body||{},sid=req.params.schoolId;
 const staffNo=clean(b.staff_no),first=clean(b.first_name),last=clean(b.last_name),designation=clean(b.designation);
 if(!staffNo||!first||!last||!designation)return res.status(400).json({error:'Staff number, first name, last name and designation are required.'});
 if([staffNo,first,last,designation].some(x=>x.length>150))return res.status(400).json({error:'A field is too long.'});
 try{
  const conflict=await db.query('SELECT 1 FROM teachers WHERE school_id=$1 AND lower(staff_no)=lower($2) LIMIT 1',[sid,staffNo]);
  if(conflict.rowCount)return res.status(409).json({error:'Staff number is already used by a teacher.'});
  const q=await db.query(`INSERT INTO non_teaching_staff(school_id,staff_no,first_name,last_name,email,phone,designation,department,employment_type,employment_date)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,staff_no,first_name,last_name,email,phone,designation,department,employment_type,employment_date,is_active`,
    [sid,staffNo,first,last,clean(b.email)||null,clean(b.phone)||null,designation,clean(b.department)||null,clean(b.employment_type)||null,b.employment_date||null]);
  res.status(201).json(q.rows[0]);
 }catch(e){res.status(e.code==='23505'?409:400).json({error:e.code==='23505'?'Staff number already exists.':e.message});}
});
'''
s=s.replace(api_anchor,api+api_anchor,1)
form='''<div id="zelimuStaffArea" style="display:none;margin-top:18px"><div class="section-title"><div><h3>Non-Teaching Staff Registration</h3><p class="muted">Accountants, secretaries, drivers, cooks, security and support staff</p></div></div><form id="zelimuStaffForm" class="card"><label>Staff number<input name="staff_no" required maxlength="150"></label><label>First name<input name="first_name" required maxlength="150"></label><label>Last name<input name="last_name" required maxlength="150"></label><label>Email<input name="email" type="email"></label><label>Phone<input name="phone" type="tel"></label><label>Designation<input name="designation" required placeholder="Accountant, Driver, Secretary..."></label><label>Department<input name="department"></label><label>Employment type<select name="employment_type"><option value="">Select</option><option>Permanent</option><option>Contract</option><option>Casual</option><option>Intern</option></select></label><label>Employment date<input name="employment_date" type="date"></label><button class="btn primary" type="submit">REGISTER NON-TEACHING STAFF</button></form><h3>Non-Teaching Staff Directory</h3><div id="zelimuStaffDirectory" class="directory" aria-live="polite"></div></div>'''
# insert directly before teacher form, inside people section's grid. The form is not nested in another form.
t=t.replace('<form id="teacherForm">',form+'<form id="teacherForm">',1)
needle=" if(tForm)tForm.style.display=teacher?'':'none';"
if t.count(needle)!=1:sys.exit('Expected mode code missing. No changes made.')
t=t.replace(needle,''' const staffArea=document.getElementById('zelimuStaffArea');
 if(staffArea)staffArea.style.display=teacher?'':'none';
 if(teacher)zelimuLoadStaff();
'''+needle,1)
# existing teacher form still remains; staff area separately shown. Use delegated JS wired once.
anchor='function zelimuOpenPeopleMode(mode){'
js='''// ZELIMU STAFF UI V1
async function zelimuLoadStaff(){
 const host=document.getElementById('zelimuStaffDirectory');if(!host)return;
 host.textContent='Loading staff records...';
 try{
  const rows=await api(`/api/people/${sid}/staff`);
  host.replaceChildren();
  if(!rows.length){host.textContent='No non-teaching staff registered yet.';return;}
  for(const r of rows){const el=document.createElement('div');el.className='card';el.style.marginBottom='8px';el.textContent=`${r.staff_no} · ${r.first_name} ${r.last_name} · ${r.designation}${r.department?' · '+r.department:''}${r.is_active===false?' · Inactive':''}`;host.appendChild(el);}
 }catch(e){host.textContent=e.message||'Unable to load staff.';}
}
if(!window.__zelimuStaffSubmitWired){
 window.__zelimuStaffSubmitWired=true;
 document.addEventListener('submit',async e=>{
  if(e.target?.id!=='zelimuStaffForm')return;
  e.preventDefault();const form=e.target,btn=form.querySelector('button[type=submit]');
  if(btn)btn.disabled=true;
  try{await api(`/api/people/${sid}/staff`,{method:'POST',body:Object.fromEntries(new FormData(form))});form.reset();await zelimuLoadStaff();alert('Non-teaching staff registered successfully.');}
  catch(err){alert(err.message||'Staff registration failed.');}
  finally{if(btn)btn.disabled=false;}
 },true);
}
'''
t=t.replace(anchor,js+anchor,1)
for f in (p,h):
 backup=f.with_name(f.name+'.before-staff-functional-repair')
 if not backup.exists():backup.write_text(f.read_text())
p.write_text(s);h.write_text(t)
print('Staff API, registration form and directory installed; existing teacher form preserved.')
print('NEXT: Apply database/030_non_teaching_staff.sql in Supabase SQL Editor before using staff registration.')

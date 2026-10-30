from pathlib import Path
p=Path('public/dashboard.html')
s=p.read_text(encoding='utf-8')
old="function zelimuOpenAdmissionsV1(){\n zelimuOpenPeopleMode('admission');"
assert old in s, 'Admissions V1 function not found; file unchanged.'
replacement="""function zelimuEnsureAdmissionsWorkspace(){
 let workspace=document.getElementById('zelimuAdmissionsWorkspaceV2');
 if(workspace)return workspace;
 const people=document.getElementById('people');
 const form=document.getElementById('learnerForm');
 if(!people||!form)return null;
 workspace=document.createElement('section');
 workspace.id='zelimuAdmissionsWorkspaceV2';
 workspace.className='nav-managed-section card admin-only';
 workspace.innerHTML='<div class="section-title"><div><h2>Admissions · New Learner</h2><span class="pill">Register once · existing school classes</span></div></div><p class="muted small">Register a new learner using the school’s existing academic year and class records. Existing learners remain in Learner Enrollment &amp; Promotion.</p><div id="zelimuAdmissionsFormHostV2"></div>';
 people.parentNode.insertBefore(workspace,people.nextSibling);
 workspace.querySelector('#zelimuAdmissionsFormHostV2').appendChild(form);
 const heading=form.querySelector('h3');if(heading)heading.textContent='Register new learner · Admissions';
 return workspace;
}
function zelimuOpenAdmissionsV1(){
 const workspace=zelimuEnsureAdmissionsWorkspace();
 if(!workspace)return;
 showSection('people');
 document.getElementById('people')?.classList.remove('nav-active');
 workspace.classList.add('nav-active');
 workspace.scrollIntoView({block:'start'});
}
function zelimuUnusedAdmissionsV1(){
 zelimuOpenPeopleMode('admission');"""
s=s.replace(old,replacement,1)
# Add new section to managed section list so normal navigation closes it automatically.
# Existing showSection toggles only managed sections; explicit close on each navigation is safe.
anchor='function showSection(id){'
assert anchor in s
s=s.replace(anchor,"function showSection(id){\n  document.getElementById('zelimuAdmissionsWorkspaceV2')?.classList.remove('nav-active');",1)
p.write_text(s,encoding='utf-8')
print('Dedicated Admissions workspace installed; existing learner form preserved.')

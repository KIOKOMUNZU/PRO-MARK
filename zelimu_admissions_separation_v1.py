from pathlib import Path
p=Path('public/dashboard.html')
s=p.read_text()
if 'zelimu-admissions-v1' in s:
 print('Admissions separation already installed.');raise SystemExit(0)
needle='<button data-target="pm24_4"><span class="pm-icon">🎓</span><span>Learner Enrollment &amp; Promotion</span></button>'
assert needle in s
s=s.replace(needle,'<button data-target="people" data-admission-link="true"><span class="pm-icon">📝</span><span>Admissions · New Learner</span></button>\n      '+needle,1)
needle=" const teacher=mode==='teacher';"
assert needle in s
s=s.replace(needle," const teacher=mode==='teacher';\n const admission=mode==='admission';",1)
s=s.replace("if(lForm)lForm.style.display=teacher?'none':'';","if(lForm)lForm.style.display=admission?'':'none';",1)
s=s.replace("if(lDirectory)lDirectory.style.display=teacher?'none':'';","if(lDirectory)lDirectory.style.display=teacher||admission?'none':'';",1)
s=s.replace("if(title)title.textContent=teacher?'Teacher & Staff Registration':'Learner Enrollment & Promotion';","if(title)title.textContent=teacher?'Teacher & Staff Registration':admission?'Admissions · New Learner':'Learner Enrollment & Promotion';",1)
s=s.replace("if(pill)pill.textContent=teacher?'Teacher registration · directory':'Learner admission · directory';","if(pill)pill.textContent=teacher?'Teacher registration · directory':admission?'Register once · existing school classes':'Learner directory · class movement · promotion';",1)
s=s.replace("if(classLists)classLists.style.display=teacher?'none':'';","if(classLists)classLists.style.display=teacher||admission?'none':'';",1)
s=s.replace("promote.style.display=teacher?'none':'';","promote.style.display=teacher||admission?'none':'';",1)
s=s.replace("promotionPanel.style.display=teacher?'none':'';","promotionPanel.style.display=teacher||admission?'none':'';",1)
needle="async function openPM24(n){"
assert needle in s
s=s.replace(needle,"function zelimuOpenAdmissionsV1(){\n zelimuOpenPeopleMode('admission');\n const form=document.getElementById('learnerForm');\n if(form){form.querySelector('h3').textContent='Register new learner · Admissions';form.scrollIntoView({block:'start'});}\n}\n"+needle,1)
needle="    showSection(target);\n  });"
assert needle in s
s=s.replace(needle,"    if(b.dataset.admissionLink==='true'){zelimuOpenAdmissionsV1();return;}\n    showSection(target);\n  });",1)
p.write_text(s)
print('Admissions mode prepared; routing requires verification.')

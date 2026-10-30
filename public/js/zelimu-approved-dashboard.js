
/* ZELIMU CBC — SINGLE APPROVED COMMAND CENTRE RENDERER */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nav=[
 ['Command Centre',[['⌂','Command Centre','home']]],
 ['ADMINISTRATION',[
  ['⚙','School Administration Setup','pm24_2'],
  ['🎓','Learner Enrollment & Promotion','pm24_4'],
  ['👪','Parent & Guardian Management','pm24_5'],
  ['🕘','Daily Learner Attendance','pm24_13'],
  ['◉','Biometrics & Access Attendance','biometrics'],
  ['⚖','Discipline & Welfare Records','pm24_14'],
  ['📋','Class Lists & Registers','pm24_26'],
  ['🎓','School Leaving Certificates','leavingCertificates'],
  ['♙','Teacher & Staff Registration','pm24_3']
 ]],
 ['SCHOOL MANAGEMENT',[['♙','Admissions','admissions'],['♟','Learners','pm24_4'],['▣','Academics','pm24_6'],['☑','Assessments','pm24_7'],['▦','Timetable','pm24_19']]],
 ['FINANCE & RESOURCES',[['◫','Finance','pm24_28'],['▰','Transport','transport'],['⌂','Boarding','boarding'],['✣','Resources','pm24_25']]],
 ['PEOPLE & COMMUNICATION',[['♟','Staff / HR','staff_hr'],['✉','Communications','pm24_15'],['♟','Parent Portal','pm24_5']]],
 ['ANALYTICS & REPORTS',[['▥','Analytics','pm24_10'],['▤','Reports','pm24_11']]],
 ['SYSTEM CONTROL',[['◉','School Branding','pm24_21'],['⚙','Settings','pm24_2'],['◎','User Management','pm24_27']]]
];
const shortcuts=[
 ['♟','Learner Management','pm24_4'],['▣','Assessment Entry','pm24_8'],
 ['▤','Generate Reports','pm24_11'],['▥','Fee Management','pm24_28'],
 ['▦','Timetable Generator','pm24_19'],['♟','Staff Management','pm24_3'],
 ['✉','Parent Communication','pm24_15'],['⚙','School Branding','pm24_21']
];
function button(label,target,cls=''){return `<button type="button" class="${cls}" data-z7-target="${esc(target)}">${label}</button>`}
function metric(name,icon,id,target,note){return `<button type="button" class="z7-kpi" data-z7-target="${target}"><span class="z7-kpi-icon">${icon}</span><span><div class="z7-kpi-name">${name}</div><div class="z7-kpi-number" id="${id}">—</div><div class="z7-kpi-note">${note}</div></span></button>`}
function panel(title,body,link='',label='View All'){return `<section class="z7-panel"><div class="z7-panelhead"><h2>${title}</h2>${link?button(label,link,'z7-link'):''}</div>${body}</section>`}
function placeholder(message){return `<div class="z7-empty">${esc(message)}</div>`}
function chart(title){return `<svg class="z7-plot" viewBox="0 0 500 185" role="img" aria-label="${esc(title)}"><g stroke="#e7edf2" stroke-width="1">${[25,60,95,130,165].map(y=>`<line x1="34" y1="${y}" x2="488" y2="${y}"/>`).join('')}</g><line x1="34" y1="15" x2="34" y2="165" stroke="#ccd9e4"/><line x1="34" y1="165" x2="488" y2="165" stroke="#ccd9e4"/><text x="260" y="94" text-anchor="middle" font-size="12" fill="#788ba0">${esc(title)}</text></svg>`}
function getSchool(){const s=$('schoolTitle')?.textContent?.trim()||'';return s&&!/workspace/i.test(s)?s.split(' · ')[0]:'School workspace'}
function make(){
 const host=document.querySelector('.zelimu-command-v1')||document.querySelector('.zc-dashboard');
 if(!host||host.querySelector('.z7'))return;
 const sidebar=`<aside class="z7-side"><div class="z7-brand"><span class="z7-logo">🎓</span><div><strong>ZELIMU CBC</strong><small>Smart Schools. Brighter Futures.</small></div></div>${nav.map(([head,items],i)=>`${i?`<div class="z7-navhead">${head}</div>`:''}<nav class="z7-nav">${items.map(([ic,name,target])=>`<button type="button" class="${target==='home'?'z7-current':''}" data-z7-target="${target}"><span class="zi">${ic}</span><span>${name}</span>${target!=='home'?'<span class="chev">›</span>':''}</button>`).join('')}</nav>`).join('')}<div class="z7-side-foot"><strong>🎓 ZELIMU CBC</strong><span>v4.0.9</span></div></aside>`;
 const toolbar=`<div class="z7-toolbar"><div class="z7-pickers"><span class="z7-pick z7-school-label" title="Current school"><span class="zi">▣</span><span id="z7School">SCHOOL</span></span><select class="z7-pick" id="z7SchoolSelect" aria-label="Switch school" hidden></select><select class="z7-pick" id="z7YearSelect" aria-label="Academic year"><option value="">Academic year</option></select><select class="z7-pick" id="z7TermSelect" aria-label="Current term"><option value="">Current term</option></select></div><div class="z7-toolbar-right"><input class="z7-search" id="z7Search" placeholder="Search learners, staff, modules, reports..." aria-label="Search modules"><button type="button" class="z7-bell" data-z7-target="announcements">♟</button><button type="button" class="z7-bell" data-z7-target="pm24_15">✉</button><div class="z7-user"><span class="z7-avatar">♙</span><span><span id="z7User">Signed-in user</span><small id="z7Role">School account</small></span></div><button type="button" id="z7SignOut" class="z7-signout">Sign Out</button></div></div>`;
 const actions=[['♟','New learner applications','admissions'],['▤','Fee payment verifications','pm24_28'],['♟','Leave requests (staff)','pm24_3'],['▣','Assessment entries (review)','pm24_7'],['▰','Transport route requests','transport'],['◈','Disciplinary reports','pm24_14']];
 const approvals=panel('Pending Approvals & Actions',actions.map(([ic,name,target])=>`<button type="button" class="z7-actionrow" data-z7-target="${target}"><span>${ic}</span><span>${name}</span><span>›</span></button>`).join(''),'pm24_2');
 const performance=panel('Academic Performance Trend',`<div style="display:flex;justify-content:flex-end;gap:8px"><span class="z7-select">All Classes ⌄</span><span class="z7-select">All Assessment Types ⌄</span></div>${chart('Awaiting verified assessment results')}<div class="z7-legend"><span style="color:#00835b">● Grade 7</span><span style="color:#eaa31c">● Grade 8</span><span style="color:#1479f3">● Grade 9</span></div>`,'pm24_10','Open Analytics');
 const attendance=panel('Attendance by Class',`<div style="text-align:right"><span class="z7-select">This Term ⌄</span></div>${chart('Awaiting class attendance records')}`,'pm24_13','Register');
 const activity=panel('Recent School Activity',`<table class="z7-table"><thead><tr><th>#</th><th>Learner / Staff</th><th>Activity</th><th>Date & Time</th><th>Status</th></tr></thead><tbody><tr><td colspan="5" style="text-align:center;padding:28px 8px">No verified recent activity loaded</td></tr></tbody></table>`,'pm24_2');
 const finance=panel('Fee Collection Overview',`<div class="z7-finance"><div class="z7-ring"><div class="z7-ringinner">—<small>Collection rate</small></div></div><div class="z7-finlist">🟢 Paid: —<div>🟠 Pending: —</div><div>🔴 Overdue: —</div></div></div><div style="color:#466182;font-size:11px">Monthly Collection (KSh)</div>${chart('Awaiting verified fee collections')}`,'pm24_28','This Term');
 const calendar=panel('School Calendar & Notices',`<div class="z7-tabs"><button type="button" class="selected" data-z7-tab="Upcoming">Upcoming</button><button type="button" data-z7-tab="Notices">Notices</button><button type="button" data-z7-tab="Events">Events</button></div><div class="z7-empty" id="z7Calendar">No upcoming school activities loaded</div>`,'announcements');
 host.innerHTML=`<div class="z7">${sidebar}${toolbar}<div class="z7-workspace"><div class="z7-heading"><div><h1>School Command Centre</h1><p id="z7Subtitle">Live school operations • ${esc(getSchool())}</p></div><div class="z7-heading-right"><div class="z7-date" id="z7Date"></div>${button('+ Quick Actions ⌄','pm24_4','z7-quick')}</div></div><div class="z7-kpis">${metric('Learners','♟','z7Learners','pm24_4','Enrolled learners')}${metric('Staff','♟','z7Staff','pm24_3','Registered personnel')}${metric('Attendance','▦','z7Attendance','pm24_13','Daily attendance')}${metric('Fee Collection','▤','z7Fees','pm24_28','School finance')}${metric('Assessments','▣','z7Assessments','pm24_7','Assessment records')}${metric('Pending Tasks','☑','z7Tasks','pm24_2','Review workflows')}</div><div class="z7-grid">${performance}${attendance}${approvals}</div><div class="z7-grid">${activity}${finance}${calendar}</div><div class="z7-sectiontitle">Module Shortcuts</div><div class="z7-shortcuts">${shortcuts.map(([ic,name,target])=>`<button type="button" class="z7-shortcut" data-z7-target="${target}"><span class="bubble">${ic}</span><span>${name}</span></button>`).join('')}</div></div></div>`;
 const today=$('z7Date');if(today)today.textContent=new Intl.DateTimeFormat('en-KE',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
 const user=(()=>{try{return JSON.parse(localStorage.getItem('user')||'{}')}catch{return {}}})();
 const name=[user.first_name,user.middle_name,user.last_name].filter(Boolean).join(' ').trim();
 if($('z7User'))$('z7User').textContent=name||user.name||user.email||'Signed-in user';
 if($('z7Role'))$('z7Role').textContent=user.role?String(user.role).replaceAll('_',' '):'Role unavailable';
 function sync(){
  for(const [from,to] of [['learnerCount','z7Learners'],['teacherCount','z7Staff']]){
   const value=$(from)?.textContent?.trim();
   if(value&&value!=='—'&&$(to)&&$(to).textContent!==value)$(to).textContent=value;
  }
  const s=user.school_name||getSchool();if($('z7School'))$('z7School').textContent=s;
  if($('z7Subtitle'))$('z7Subtitle').textContent='Live school operations • '+s;
  const year=$('anYear')?.selectedOptions?.[0]?.textContent?.trim()||$('markYear')?.selectedOptions?.[0]?.textContent?.trim();
  const term=$('anTerm')?.selectedOptions?.[0]?.textContent?.trim()||$('markTerm')?.selectedOptions?.[0]?.textContent?.trim();
  if(year&&$('z7Year'))$('z7Year').textContent=year;
  if(term&&$('z7Term'))$('z7Term').textContent=term;
 }
 for(const id of ['learnerCount','teacherCount','schoolTitle']){
  const node=$(id);if(node)new MutationObserver(sync).observe(node,{childList:true,characterData:true,subtree:true});
 }
 sync();window.addEventListener('load',sync,{once:true});
 const search=$('z7Search');if(search)search.addEventListener('keydown',e=>{
  if(e.key!=='Enter')return;
  const q=search.value.trim().toLowerCase();
  if(!q)return;
  const found=[...document.querySelectorAll('.z7-side button[data-z7-target]')].find(b=>b.textContent.toLowerCase().includes(q));
  if(found)found.click();else alert('No matching module found.');
 });
 host.addEventListener('click',e=>{
  const tab=e.target.closest('[data-z7-tab]');
  if(tab){host.querySelectorAll('[data-z7-tab]').forEach(x=>x.classList.toggle('selected',x===tab));$('z7Calendar').textContent=tab.dataset.z7Tab==='Upcoming'?'No upcoming school activities loaded':tab.dataset.z7Tab==='Notices'?'Open school announcements to view notices.':'No school events loaded';return}
  const b=e.target.closest('[data-z7-target]');if(!b)return;
  const target=b.dataset.z7Target;
  if(target==='home'){window.scrollTo({top:0,behavior:'smooth'});return}



   if(target==='admissions'){
     const section=document.getElementById('people');
     const form=document.getElementById('learnerForm');

     if(!section || !form){
       alert('Learner registration is not available.');
       return;
     }

     if(typeof window.showSection!=='function'){
       alert('The learner registration controller is unavailable.');
       return;
     }

     window.showSection('people');

     form.scrollIntoView({block:'start',behavior:'smooth'});
     const admission=form.querySelector('[name="admission_no"]');
     if(admission)admission.focus({preventScroll:true});
     return;
   }

   // Open existing operational modules without duplicating their backend.
   const operationalModules = {
     transport: 'transport_routes',
     boarding: 'boarding_rooms',
     staff_hr: 'hr_leave'
   };

   if(Object.prototype.hasOwnProperty.call(operationalModules,target)){
     const type=operationalModules[target];
     const control=[...document.querySelectorAll('[data-operations]')]
       .find(el=>el.dataset.operations===type);

     if(!control){
       alert('The '+target+' operational workspace is unavailable.');
       return;
     }

     const section=control.closest('section[id],div.section[id]');
     if(section && typeof window.showSection==='function'){
       window.showSection(section.id);
     }

     control.click();
     return;
   }

   const navButtons = [...document.querySelectorAll('#navTabs button[data-target]')];
   const original = navButtons.find(x => x.dataset.target === target);

   if (original) {
     original.click();
     return;
   }

   const aliases = {
     transport: ['transport'],
     boarding: ['boarding']
   };

   const names = aliases[target] || [];
   const match = navButtons.find(x =>
     names.some(name => x.textContent.toLowerCase().includes(name))
   );

   if (match) {
     match.click();
     return;
   }

   alert('Module unavailable in existing navigation: ' + target);

 });

 // ZELIMU_HEADER_CONTROLS_REPAIR_20261030
 function installHeaderControls(){
  const schoolSelect=$('z7SchoolSelect'), yearSelect=$('z7YearSelect'), termSelect=$('z7TermSelect');
  const schoolSource=$('ownerSchoolSwitch');
  const yearSource=$('anYear')||$('reportYear')||$('mYear');
  const termSource=$('anTerm')||$('reportTerm')||$('mTerm');
  function copyOptions(source,dest,placeholder){
   if(!source||!dest)return;
   const options=[...source.options];
   if(!options.length)return;
   const fingerprint=options.map(x=>x.value+':'+x.textContent).join('|');
   if(dest.dataset.sourceFingerprint!==fingerprint){
    dest.innerHTML='';
    options.forEach(x=>dest.add(new Option(x.textContent,x.value,x.defaultSelected,x.selected)));
    dest.dataset.sourceFingerprint=fingerprint;
   }
   dest.value=source.value;
   if(!dest.value && !options.some(x=>x.value===''))dest.selectedIndex=source.selectedIndex;
  }
  function refresh(){
   if(schoolSource && schoolSource.options.length && schoolSource.style.display!=='none'){
    copyOptions(schoolSource,schoolSelect);
    schoolSelect.hidden=false;
    const label=document.querySelector('.z7-school-label');if(label)label.hidden=true;
   }
   copyOptions(yearSource,yearSelect);
   copyOptions(termSource,termSelect);
   const account=(()=>{try{return JSON.parse(localStorage.getItem('user')||'{}')}catch{return {}}})();
   const fullName=[account.first_name,account.middle_name,account.last_name].filter(Boolean).join(' ').trim();
   const displayName=fullName||account.name||account.email||$('who')?.textContent?.split(' · ')[0]||'Signed-in user';
   if($('z7User'))$('z7User').textContent=displayName;
   if($('z7Role'))$('z7Role').textContent=String(account.role||'School account').replaceAll('_',' ');
  }
  schoolSelect?.addEventListener('change',()=>{
   if(!schoolSource)return;
   schoolSource.value=schoolSelect.value;
   schoolSource.dispatchEvent(new Event('change',{bubbles:true}));
  });
  yearSelect?.addEventListener('change',()=>{
   if(!yearSource)return;
   yearSource.value=yearSelect.value;
   yearSource.dispatchEvent(new Event('change',{bubbles:true}));
  });
  termSelect?.addEventListener('change',()=>{
   if(!termSource)return;
   termSource.value=termSelect.value;
   termSource.dispatchEvent(new Event('change',{bubbles:true}));
  });
  $('z7SignOut')?.addEventListener('click',()=>{
   const original=$('signOut');
   if(original){original.click();return;}
   localStorage.removeItem('token');localStorage.removeItem('user');
   location.replace('/login.html');
  });
  refresh();
  // Populate selectors after the original asynchronous dashboard data arrives.
  let count=0;
  const watch=setInterval(()=>{refresh();if(++count>=30)clearInterval(watch)},500);
  window.addEventListener('load',refresh,{once:true});
 }
 installHeaderControls();

}
function init(){make()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

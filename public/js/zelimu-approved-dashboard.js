
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
 ['SCHOOL MANAGEMENT',[['♙','Admissions','admissions'],['▣','Academics','pm24_6'],['☑','Assessments','pm24_7'],['▦','Timetable','pm24_19']]],
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
function chart(title,id){return `<div class="z7-chart-wrap"><div class="z7-chart-loading" id="${id}" role="status">${esc(title)}</div></div>`}
function getSchool(){const s=$('schoolTitle')?.textContent?.trim()||'';return s&&!/workspace/i.test(s)?s.split(' · ')[0]:'School workspace'}
function make(){
 const host=document.querySelector('.zelimu-command-v1')||document.querySelector('.zc-dashboard');
 if(!host||host.querySelector('.z7'))return;
 let dashboardNotices=[];
 const sidebar=`<aside class="z7-side"><div class="z7-brand"><span class="z7-logo">🎓</span><div><strong>ZELIMU CBC</strong><small>Smart Schools. Brighter Futures.</small></div></div>${nav.map(([head,items],i)=>`${i?`<div class="z7-navhead">${head}</div>`:''}<nav class="z7-nav">${items.map(([ic,name,target])=>`<button type="button" class="${target==='home'?'z7-current':''}" data-z7-target="${target}"><span class="zi">${ic}</span><span>${name}</span>${target!=='home'?'<span class="chev">›</span>':''}</button>`).join('')}</nav>`).join('')}<div class="z7-side-foot"><strong>🎓 ZELIMU CBC</strong><span>v4.0.9</span></div></aside>`;
 const toolbar=`<div class="z7-toolbar"><div class="z7-pickers"><span class="z7-pick z7-school-label" title="Current school"><span class="zi">▣</span><span id="z7School">SCHOOL</span></span><select class="z7-pick" id="z7SchoolSelect" aria-label="Switch school" hidden></select><select class="z7-pick" id="z7YearSelect" aria-label="Academic year"><option value="">Academic year</option></select><select class="z7-pick" id="z7TermSelect" aria-label="Current term"><option value="">Current term</option></select></div><div class="z7-toolbar-right"><input class="z7-search" id="z7Search" placeholder="Search learners, staff, modules, reports..." aria-label="Search modules"><button type="button" class="z7-bell" data-z7-target="announcements">♟</button><button type="button" class="z7-bell" data-z7-target="pm24_15">✉</button><div class="z7-user"><span class="z7-avatar">♙</span><span><span id="z7User">Signed-in user</span><small id="z7Role">School account</small></span></div><button type="button" id="z7SignOut" class="z7-signout">Sign Out</button></div></div>`;
 const actions=[['♟','New learner applications','admissions','admissions'],['▤','Outstanding fee balances','pm24_28','fees'],['♟','Leave requests (staff)','pm24_3','leave'],['▣','Open assessments','pm24_7','assessments'],['▰','Transport route requests','transport','transport'],['◈','Disciplinary reports','pm24_14','discipline']];
 const approvals=panel('Pending Approvals & Actions',actions.map(([ic,name,target,key])=>`<button type="button" class="z7-actionrow" data-z7-target="${target}"><span>${ic}</span><span>${name}</span><span class="z7-actioncount" id="z7Action-${key}">—</span><span>›</span></button>`).join(''),'pm24_2');
 const performance=panel('Academic Performance Trend',`<div class="z7-chart-context" id="z7PerformanceContext">Class averages from recorded marks</div>${chart('Loading verified assessment results…','z7PerformanceChart')}`,'pm24_10','Open Analytics');
 const attendance=panel('Attendance by Class',`<div class="z7-chart-context" id="z7AttendanceContext">Attendance rate by class for the selected term</div>${chart('Loading class attendance…','z7AttendanceChart')}`,'pm24_13','Register');
 const activity=panel('Recent School Activity',`<div id="z7Activity"><div class="z7-empty">Loading recent school activity…</div></div>`,'pm24_2');
 const finance=panel('Fee Collection Overview',`<div class="z7-finance"><div class="z7-ring" id="z7FeeRing"><div class="z7-ringinner" id="z7FeeRate">—<small>Collection rate</small></div></div><div class="z7-finlist" id="z7FeeSummary">Loading school finance…</div></div><div class="z7-chart-context">Recent confirmed payments (up to 100 records)</div>${chart('Loading fee collections…','z7FinanceChart')}`,'pm24_28','Open Finance');
 const calendar=panel('School Calendar & Notices',`<div class="z7-tabs"><button type="button" class="selected" data-z7-tab="Upcoming">Upcoming</button><button type="button" data-z7-tab="Notices">Notices</button><button type="button" data-z7-tab="Events">Events</button></div><div class="z7-empty" id="z7Calendar">No upcoming school activities loaded</div>`,'announcements');
 host.innerHTML=`<div class="z7">${sidebar}${toolbar}<div class="z7-workspace"><div class="z7-heading"><div><h1>School Command Centre</h1><p id="z7Subtitle">Live school operations • ${esc(getSchool())}</p><p class="z7-live-status"><span class="z7-live-dot"></span><span id="z7LiveStatus">Live school operations</span></p></div><div class="z7-heading-right"><div class="z7-date" id="z7Date"></div><button type="button" id="z7Refresh" class="z7-refresh">Refresh data</button>${button('+ Quick Actions ⌄','pm24_4','z7-quick')}</div></div><div class="z7-kpis">${metric('Learners','♟','z7Learners','pm24_4','Enrolled learners')}${metric('Staff','♟','z7Staff','pm24_3','Registered personnel')}${metric('Attendance','▦','z7Attendance','pm24_13','Daily attendance')}${metric('Fee Collection','▤','z7Fees','pm24_28','School finance')}${metric('Assessments','▣','z7Assessments','pm24_7','Assessment records')}${metric('Pending Tasks','☑','z7Tasks','pm24_2','Review workflows')}</div><div class="z7-grid">${performance}${attendance}${approvals}</div><div class="z7-grid">${activity}${finance}${calendar}</div><div class="z7-sectiontitle">Module Shortcuts</div><div class="z7-shortcuts">${shortcuts.map(([ic,name,target])=>`<button type="button" class="z7-shortcut" data-z7-target="${target}"><span class="bubble">${ic}</span><span>${name}</span></button>`).join('')}</div></div></div>`;
 const today=$('z7Date');if(today)today.textContent=new Intl.DateTimeFormat('en-KE',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
 const user=(()=>{try{return JSON.parse(localStorage.getItem('user')||'{}')}catch{return {}}})();
 const name=[user.first_name,user.middle_name,user.last_name].filter(Boolean).join(' ').trim();
 if($('z7User'))$('z7User').textContent=name||user.name||user.email||'Signed-in user';
 if($('z7Role'))$('z7Role').textContent=user.role?String(user.role).replaceAll('_',' '):'Role unavailable';
 // INSTANT CACHE HYDRATION: Show last verified counts immediately
 try {
   const sid = user.school_id || new URLSearchParams(location.search).get('school_id') || 'default';
   const cached = JSON.parse(localStorage.getItem('z7_cache_' + sid) || '{}');
   if (cached.learners && $('z7Learners')) $('z7Learners').textContent = cached.learners;
   if (cached.staff && $('z7Staff')) $('z7Staff').textContent = cached.staff;
   if (cached.assessments && $('z7Assessments')) $('z7Assessments').textContent = cached.assessments;
   if (cached.attendance && $('z7Attendance')) $('z7Attendance').textContent = cached.attendance;
   if (cached.fees && $('z7Fees')) $('z7Fees').textContent = cached.fees;
   if (cached.tasks && $('z7Tasks')) $('z7Tasks').textContent = cached.tasks;
 } catch(e) {}
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
 function renderCalendar(tab){
  const box=$('z7Calendar');if(!box)return;
  if(tab==='Notices'){
   box.innerHTML=dashboardNotices.length?`<div class="z7-notice-list">${dashboardNotices.slice(0,5).map(item=>`<article><p>${esc(item.message||'')}</p><small>${esc(new Intl.DateTimeFormat('en-KE',{day:'numeric',month:'short',year:'numeric'}).format(new Date(item.created_at)))}</small></article>`).join('')}</div>`:'<div class="z7-empty">No active school notices are available.</div>';
  }else if(tab==='Events'){
   box.innerHTML='<div class="z7-empty">No school calendar events are configured yet.</div>';
  }else{
   box.innerHTML='<div class="z7-empty">No upcoming school activities are available. See Notices for current announcements.</div>';
  }
 }
 const search=$('z7Search');if(search)search.addEventListener('keydown',e=>{
  if(e.key!=='Enter')return;
  const q=search.value.trim().toLowerCase();
  if(!q)return;
  const found=[...document.querySelectorAll('.z7-side button[data-z7-target]')].find(b=>b.textContent.toLowerCase().includes(q));
  if(found)found.click();else alert('No matching module found.');
 });
 host.addEventListener('click',e=>{
  const tab=e.target.closest('[data-z7-tab]');
  if(tab){host.querySelectorAll('[data-z7-tab]').forEach(x=>x.classList.toggle('selected',x===tab));renderCalendar(tab.dataset.z7Tab);return}
  const b=e.target.closest('[data-z7-target]');if(!b)return;
  const target=b.dataset.z7Target;
  if(target==='home'){window.scrollTo({top:0,behavior:'smooth'});return}



   if(target==='admissions'){
     const admissionButton=document.querySelector('#navTabs button[data-admission-link="true"]');
     if(admissionButton){
       admissionButton.click();
     }else{
       alert('Admissions workspace is unavailable.');
     }
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
 function installLiveDashboard(){
  const schoolId=user.school_id||new URLSearchParams(location.search).get('school_id');
  if(!schoolId)return;
  const roles=String(user.role||'').toUpperCase();
  const admin=['SCHOOL_ADMIN','ADMIN'].includes(roles);
  const leadership=['SCHOOL_ADMIN','ADMIN','HEADTEACHER','DEPUTY_HEADTEACHER','SENIOR_TEACHER','CLASS_TEACHER'].includes(roles);
  const canAudit=['PLATFORM_OWNER','SCHOOL_ADMIN','ADMIN','HEADTEACHER','DEPUTY_HEADTEACHER','SENIOR_TEACHER'].includes(roles);
  const canFinance=['SCHOOL_ADMIN','ADMIN','HEADTEACHER','DEPUTY_HEADTEACHER','SENIOR_TEACHER'].includes(roles);
  let loading=false,queued=false;
  const number=value=>Number.isFinite(Number(value))?Number(value):0;
  const money=value=>`KSh ${number(value).toLocaleString('en-KE',{maximumFractionDigits:0})}`;
  const dateLabel=value=>{
   const date=new Date(value);
   return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat('en-KE',{day:'numeric',month:'short'}).format(date);
  };
  const dateTimeLabel=value=>{
   const date=new Date(value);
   return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat('en-KE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(date);
  };
  const showEmpty=(id,message,isError=false)=>{
   const node=$(id);if(node)node.innerHTML=`<div class="z7-empty${isError?' z7-error':''}">${esc(message)}</div>`;
  };
  const request=async(path)=>{
   const response=await fetch(path,{headers:{Authorization:'Bearer '+(localStorage.getItem('token')||'')}});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||`Request failed (${response.status})`);
   return result;
  };
  const query=(values)=>new URLSearchParams(Object.entries(values).filter(([,value])=>Boolean(value))).toString();
  const renderBars=(id,title,rows,format=value=>`${Math.round(value)}%`)=>{
   const node=$(id);if(!node)return;
   if(!rows.length){showEmpty(id,title);return;}
   const width=600,left=175,right=55,rowHeight=31,top=18,height=top+rows.length*rowHeight+12,plot=width-left-right;
   const grid=[0,25,50,75,100].map(value=>{
    const x=left+plot*value/100;
    return `<line class="z7-gridline" x1="${x}" y1="${top-6}" x2="${x}" y2="${height-8}"/><text class="z7-axislabel" x="${x}" y="${height-1}" text-anchor="middle">${value}%</text>`;
   }).join('');
   const bars=rows.map((row,index)=>{
    const value=Math.max(0,Math.min(100,number(row.value))),y=top+index*rowHeight;
    const label=String(row.label||'Class');
    const clipped=label.length>24?label.slice(0,22)+'…':label;
    return `<text class="z7-barlabel" x="${left-10}" y="${y+14}" text-anchor="end"><title>${esc(label)}</title>${esc(clipped)}</text><rect class="z7-bar" x="${left}" y="${y}" width="${plot*value/100}" height="18" rx="5" style="--bar-index:${index}"><title>${esc(label)}: ${esc(format(value))}</title></rect><text class="z7-barvalue" x="${Math.min(width-right+5,left+plot*value/100+7)}" y="${y+14}">${esc(format(value))}</text>`;
   }).join('');
   node.innerHTML=`<svg class="z7-plot z7-live-plot" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">${grid}${bars}</svg>`;
  };
  const renderPerformance=(rows,yearLabel,termLabel)=>{
   const node=$('z7PerformanceChart');
   if(!node)return;
   if(!rows.length){showEmpty('z7PerformanceChart','No verified marks are available for this academic year yet.');return;}
   const periods=[...new Map(rows.map(row=>[String(row.term_no),{no:number(row.term_no),name:row.term_name||`Term ${row.term_no}`}])).values()].sort((a,b)=>a.no-b.no);
   const classes=[...new Set(rows.map(row=>`${row.class_name}${row.stream?' · '+row.stream:''}`))];
   const chosen=classes.slice(0,5),width=600,height=230,left=48,right=20,top=20,bottom=43,plotW=width-left-right,plotH=height-top-bottom;
   const grid=[0,25,50,75,100].map(value=>{const y=top+plotH*(1-value/100);return `<line class="z7-gridline" x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"/><text class="z7-axislabel" x="${left-8}" y="${y+4}" text-anchor="end">${value}%</text>`}).join('');
   const xAt=index=>periods.length<2?left+plotW/2:left+plotW*index/(periods.length-1);
   const xLabels=periods.map((period,index)=>`<text class="z7-axislabel" x="${xAt(index)}" y="${height-12}" text-anchor="middle">${esc(period.name)}</text>`).join('');
   const palette=['#00825c','#e69a10','#1479f3','#8755c7','#db5265'];
   const lines=chosen.map((className,seriesIndex)=>{
    const values=periods.map(period=>rows.find(row=>`${row.class_name}${row.stream?' · '+row.stream:''}`===className&&number(row.term_no)===period.no));
    let active=false,path='';
    const points=values.map((row,index)=>{
     if(!row||row.average==null){active=false;return '';}
     const x=xAt(index),y=top+plotH*(1-Math.max(0,Math.min(100,number(row.average)))/100);
     path+=`${active?'L':'M'}${x},${y} `;active=true;
     return `<circle cx="${x}" cy="${y}" r="4" fill="${palette[seriesIndex]}"><title>${esc(className)} · ${esc(periods[index].name)}: ${number(row.average).toFixed(1)}%</title></circle>`;
    }).join('');
    return `<path class="z7-line" d="${path}" stroke="${palette[seriesIndex]}"/>${points}`;
   }).join('');
   const legend=chosen.map((name,index)=>`<span><i style="background:${palette[index]}"></i>${esc(name)}</span>`).join('');
   node.innerHTML=`<svg class="z7-plot z7-live-plot" viewBox="0 0 ${width} ${height}" role="img" aria-label="Assessment average trends by class for ${esc(yearLabel||'the selected academic year')}">${grid}${xLabels}${lines}</svg><div class="z7-legend">${legend}</div><p class="z7-chart-note">${chosen.length<classes.length?`Showing ${chosen.length} of ${classes.length} classes. `:''}Historical averages across terms in ${esc(yearLabel||'the selected academic year')}; selected period: ${esc(termLabel||'all terms')}.</p>`;
  };
  const renderAttendance=(rows)=>{
   if(!rows.length){showEmpty('z7AttendanceChart','No attendance records have been entered for this academic period.');$('z7AttendanceContext').textContent='Attendance rate by class for the selected term';return null;}
   const latest=rows.reduce((value,row)=>String(row.attendance_date)>value?String(row.attendance_date):value,'');
   const byClass=new Map();
   for(const row of rows.filter(item=>String(item.attendance_date).slice(0,10)===latest)){
    const name=`${row.class_name||'Class'}${row.stream?' · '+row.stream:''}`;
    if(!byClass.has(name))byClass.set(name,{total:0,present:0});
    const item=byClass.get(name);item.total++;
    if(['PRESENT','LATE'].includes(String(row.status||'').toUpperCase()))item.present++;
   }
   const chartRows=[...byClass].map(([label,data])=>({label,value:data.total?data.present*100/data.total:0})).sort((a,b)=>a.label.localeCompare(b.label));
   renderBars('z7AttendanceChart',`Attendance rate by class on ${latest}`,chartRows,value=>`${value.toFixed(1)}%`);
   $('z7AttendanceContext').textContent=`Latest register: ${dateLabel(latest)} · ${rows.filter(row=>String(row.attendance_date).slice(0,10)===latest).length} learner records`;
   return {date:latest,...[...byClass.values()].reduce((sum,item)=>({total:sum.total+item.total,present:sum.present+item.present}),{total:0,present:0})};
  };
  const renderFinance=(data,loadError)=>{
   const summary=data?.summary;
   if(!summary){$('z7FeeRate').innerHTML='—<small>Collection rate</small>';const message=loadError?`Finance could not load: ${loadError}`:'Finance overview is not available for this account role.';$('z7FeeSummary').textContent=message;showEmpty('z7FinanceChart',message,true);return null;}
   const charged=number(summary.charged),collected=number(summary.collected),rate=charged?Math.min(100,collected/charged*100):0;
   $('z7FeeRate').innerHTML=`${rate.toFixed(0)}%<small>Collection rate</small>`;
   $('z7FeeRing').style.background=`conic-gradient(#00825c ${rate}%, #e5eee9 ${rate}% 100%)`;
   const charges=data.charges||[],today=new Date().toISOString().slice(0,10);
   const overdue=charges.filter(charge=>number(charge.balance)>0&&charge.due_on&&String(charge.due_on).slice(0,10)<today);
   $('z7FeeSummary').innerHTML=`Collected: <b>${esc(money(collected))}</b><div>Outstanding: <b>${esc(money(summary.outstanding))}</b></div><div>Overdue charges: <b>${overdue.length}</b></div>`;
   const months=new Map();
   for(const payment of (data.payments||[]).filter(item=>item.status==='CONFIRMED')){
    const key=String(payment.payment_date||'').slice(0,7);if(!/^\d{4}-\d{2}$/.test(key))continue;
    months.set(key,(months.get(key)||0)+number(payment.amount));
   }
   const recent=[...months].sort(([a],[b])=>a.localeCompare(b)).slice(-6);
   if(!recent.length){showEmpty('z7FinanceChart','No confirmed fee payments are available to chart.');}
   else{
    const max=Math.max(...recent.map(([,value])=>value),1);
    const rows=recent.map(([key,value])=>({label:new Intl.DateTimeFormat('en-KE',{month:'short',year:'2-digit'}).format(new Date(`${key}-01T00:00:00`)),value:value/max*100,amount:value}));
    const node=$('z7FinanceChart'),width=600,height=220,left=48,right=22,top=18,bottom=42,plotW=width-left-right,plotH=height-top-bottom,slot=plotW/rows.length;
    const grid=[0,25,50,75,100].map(value=>{const y=top+plotH*(1-value/100);return `<line class="z7-gridline" x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"/><text class="z7-axislabel" x="${left-8}" y="${y+4}" text-anchor="end">${value}%</text>`}).join('');
    const bars=rows.map((row,index)=>{const h=plotH*row.value/100,x=left+slot*index+slot*.2,y=top+plotH-h;return `<rect class="z7-bar" x="${x}" y="${y}" width="${slot*.6}" height="${h}" rx="5"><title>${esc(row.label)}: ${esc(money(row.amount))}</title></rect><text class="z7-axislabel" x="${x+slot*.3}" y="${height-13}" text-anchor="middle">${esc(row.label)}</text>`}).join('');
    node.innerHTML=`<svg class="z7-plot z7-live-plot" viewBox="0 0 ${width} ${height}" role="img" aria-label="Recent monthly confirmed fee collections">${grid}${bars}</svg><p class="z7-chart-note">Monthly amounts are based on the latest 100 payment records.</p>`;
   }
   return {overdue:overdue.length,outstanding:number(summary.outstanding)};
  };
  const renderActivity=(audit,attendance)=>{
   const node=$('z7Activity');if(!node)return;
   let rows=[];
   if(Array.isArray(audit)&&audit.length){
    rows=audit.slice(0,8).map(item=>({
     person:[item.first_name,item.last_name].filter(Boolean).join(' ')||item.email||'School user',
     activity:String(item.action||'School update').replaceAll('_',' ').toLowerCase(),
     date:item.created_at,timed:true,status:'Logged'
    }));
   }else if(Array.isArray(attendance)){
    rows=attendance.slice().sort((a,b)=>String(b.attendance_date).localeCompare(String(a.attendance_date))).slice(0,8).map(item=>({
     person:[item.first_name,item.middle_name,item.last_name].filter(Boolean).join(' ')||'Learner',
     activity:`Attendance recorded · ${String(item.class_name||'').trim()}`,
     date:item.attendance_date,status:item.status||'Recorded'
    }));
   }
   if(!rows.length){node.innerHTML='<div class="z7-empty">No recent school activity is available for this period.</div>';return;}
   node.innerHTML=`<div class="z7-table-wrap"><table class="z7-table"><thead><tr><th>#</th><th>Learner / Staff</th><th>Activity</th><th>Date & Time</th><th>Status</th></tr></thead><tbody>${rows.map((row,index)=>`<tr><td>${index+1}</td><td>${esc(row.person)}</td><td>${esc(row.activity)}</td><td>${esc(row.timed?dateTimeLabel(row.date):dateLabel(row.date))}</td><td><span class="z7-activity-status">${esc(String(row.status||'Recorded').replaceAll('_',' '))}</span></td></tr>`).join('')}</tbody></table></div>`;
  };
  const load=async()=>{
   if(loading){queued=true;return;}
   loading=true;queued=false;
   const live=$('z7LiveStatus'),refreshButton=$('z7Refresh');
   if(live)live.textContent='Refreshing live school data…';
   if(refreshButton)refreshButton.disabled=true;
   const year=$('z7YearSelect')?.value||'',term=$('z7TermSelect')?.value||'';
   let classId='';
   if(roles==='CLASS_TEACHER'){
    const assignmentResult=await Promise.allSettled([request(`/api/people/${encodeURIComponent(schoolId)}/my-class-teacher-assignments`)]);
    if(assignmentResult[0].status==='fulfilled'){
     const assignments=assignmentResult[0].value||[];
     classId=(assignments.find(item=>!year||String(item.academic_year_id)===String(year))||{}).class_id||'';
    }else console.warn('Command Centre class assignment unavailable:',assignmentResult[0].reason?.message||assignmentResult[0].reason);
   }
   const filters=query({academic_year_id:year,term_id:term,class_id:classId});
   const periodQuery=filters?`?${filters}`:'';
   const sid=encodeURIComponent(schoolId);
   const loadOptional=(allowed,path)=>allowed?request(path):Promise.resolve(null);
   const attendanceRequest=roles==='CLASS_TEACHER'&&!classId?Promise.reject(new Error('No assigned class is available for attendance.')):request(`/api/operations/${sid}/attendance${periodQuery}`);
   const requests=[
    request(`/api/operations/${sid}/overview${periodQuery}`),
    attendanceRequest,
    loadOptional(leadership&&roles!=='PLATFORM_OWNER'&&year&&term,`/api/communications/${sid}/analytics${periodQuery}`),
    loadOptional(canFinance,`/api/finance/${sid}/overview`),
    loadOptional(admin,`/api/people/${sid}/admission-applications`),
    loadOptional(leadership&&roles!=='PLATFORM_OWNER',`/api/extended/${sid}/hr_leave`),
    Promise.resolve(null),
    loadOptional(canAudit,`/api/operations/${sid}/audit`),
    request(`/api/documents/${sid}/announcements`)
   ];
   const results=await Promise.allSettled(requests);
   const resultAt=index=>results[index].status==='fulfilled'?results[index].value:null;
   const errorAt=index=>results[index].status==='rejected'?results[index].reason:null;
   const failures=results.filter(item=>item.status==='rejected');
   failures.forEach(item=>console.warn('Command Centre data unavailable:',item.reason?.message||item.reason));
   const overview=resultAt(0),attendanceRows=resultAt(1),analytics=resultAt(2),finance=resultAt(3),admissions=resultAt(4),leave=resultAt(5),audit=resultAt(7),notices=resultAt(8);
   if(Array.isArray(notices)){
    dashboardNotices=notices;
    const selectedTab=document.querySelector('[data-z7-tab].selected')?.dataset.z7Tab||'Upcoming';
    renderCalendar(selectedTab);
   }else if(document.querySelector('[data-z7-tab].selected')?.dataset.z7Tab==='Notices'){
    showEmpty('z7Calendar',`School notices could not be loaded: ${errorAt(8)?.message||'request failed'}`,true);
   }
   if(overview){
    $('z7Learners').textContent=number(overview.learners).toLocaleString('en-KE');
    $('z7Staff').textContent=number(overview.teachers).toLocaleString('en-KE');
    $('z7Assessments').textContent=number(overview.assessments?.total).toLocaleString('en-KE');
   }else{
    for(const id of ['z7Learners','z7Staff','z7Assessments'])$(id).textContent='—';
   }
   const daily=Array.isArray(attendanceRows)?renderAttendance(attendanceRows):null;
   if(!Array.isArray(attendanceRows))showEmpty('z7AttendanceChart',`Attendance data could not be loaded: ${errorAt(1)?.message||'request failed'}`,true);
   $('z7Attendance').textContent=daily?`${daily.total?Math.round(daily.present/daily.total*100):0}%`:'—';
   const attendanceNote=$('z7Attendance')?.parentElement?.querySelector('.z7-kpi-note');
   if(attendanceNote)attendanceNote.textContent=daily?`${daily.present} present / late of ${daily.total} · ${dateLabel(daily.date)}`:'Daily attendance unavailable';
   if(analytics)renderPerformance(analytics.class_trends||[],$('z7YearSelect')?.selectedOptions?.[0]?.textContent, $('z7TermSelect')?.selectedOptions?.[0]?.textContent);
   else showEmpty('z7PerformanceChart',!year||!term?'Select an academic year and term to view assessment trends.':!leadership||roles==='PLATFORM_OWNER'?'Assessment trends are not available to this account role.':`Assessment analytics could not be loaded: ${errorAt(2)?.message||'request failed'}`,Boolean(year&&term&&leadership&&roles!=='PLATFORM_OWNER'));
   const financeResult=renderFinance(finance,errorAt(3)?.message);
   $('z7Fees').textContent=finance?.summary?money(finance.summary.collected):'—';
   const pendingAdmissions=Array.isArray(admissions)?admissions.filter(row=>['PENDING_REVIEW','PENDING'].includes(String(row.status||'').toUpperCase())).length:null;
   const pendingLeave=Array.isArray(leave)?leave.filter(row=>String(row.data?.status||'').toUpperCase()==='PENDING').length:null;
   const pendingTransport=null;
   const openAssessments=number(overview?.assessments?.open);
   const openDiscipline=number(overview?.discipline?.open);
   const pendingFees=financeResult?Number(financeResult.outstanding>0):null;
   const tasks=[pendingAdmissions,pendingFees,pendingLeave,openAssessments,pendingTransport,openDiscipline].filter(Number.isFinite).reduce((sum,value)=>sum+value,0);
   $('z7Tasks').textContent=tasks.toLocaleString('en-KE');
   try {
     const sid = schoolId || 'default';
     localStorage.setItem('z7_cache_' + sid, JSON.stringify({
       learners: $('z7Learners')?.textContent,
       staff: $('z7Staff')?.textContent,
       assessments: $('z7Assessments')?.textContent,
       attendance: $('z7Attendance')?.textContent,
       fees: $('z7Fees')?.textContent,
       tasks: $('z7Tasks')?.textContent
     }));
   } catch(e) {}
   const setAction=(key,value)=>{const node=$(`z7Action-${key}`);if(node)node.textContent=value===null?'—':typeof value==='number'?value.toLocaleString('en-KE'):String(value);};
   setAction('admissions',pendingAdmissions);
   setAction('fees',financeResult?money(financeResult.outstanding):null);
   setAction('leave',pendingLeave);
   setAction('assessments',Number.isFinite(Number(overview?.assessments?.open))?openAssessments:null);
   setAction('transport','Not tracked');
   setAction('discipline',overview?openDiscipline:null);
   renderActivity(Array.isArray(audit)?audit:null,Array.isArray(attendanceRows)?attendanceRows:null);
   if(live){
    const updated=new Intl.DateTimeFormat('en-KE',{hour:'numeric',minute:'2-digit'}).format(new Date());
    const sources=['school overview','attendance','performance analytics','finance','applications','staff leave','','activity','notices'];
    const failedSources=results.flatMap((result,index)=>result.status==='rejected'&&sources[index]?[sources[index]]:[]);
    live.textContent=`${failedSources.length?`Unavailable: ${failedSources.slice(0,2).join(', ')}${failedSources.length>2?'…':''} · `:''}Updated ${updated} · refreshes every minute`;
   }
   if(refreshButton)refreshButton.disabled=false;
   loading=false;
   if(queued){queued=false;setTimeout(load,100);}
  };
  $('z7Refresh')?.addEventListener('click',load);
  $('z7YearSelect')?.addEventListener('change',()=>setTimeout(load,900));
  $('z7TermSelect')?.addEventListener('change',load);
  setTimeout(load, 30);
  let attempts=0;
  const waitForPeriod=setInterval(()=>{
   attempts++;
   if(($('z7YearSelect')?.value&&$('z7TermSelect')?.value)||attempts>=6){
    clearInterval(waitForPeriod);
    if($('z7YearSelect')?.value&&$('z7TermSelect')?.value)load();
   }
  },300);
  setInterval(()=>{if(document.visibilityState==='visible')load();},60000);
 }
 installLiveDashboard();

}
function init(){make()}
// IMMEDIATE SYNCHRONOUS EXECUTION: Do NOT wait for DOMContentLoaded if host is ready
const hostEl=document.querySelector('.zelimu-command-v1')||document.querySelector('.zc-dashboard');
if(hostEl){init();}
else if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init,{once:true});}
else{init();}
})();

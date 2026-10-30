from pathlib import Path
p=Path('public/js/zelimu-approved-dashboard.js')
c=Path('public/css/zelimu-approved-dashboard.css')
s=p.read_text(encoding='utf-8')
if 'ZELIMU_HEADER_CONTROLS_REPAIR_20261030' in s:
 print('Header repair already installed; no duplicate changes.')
 raise SystemExit(0)
assert 'const toolbar=`' in s and 'host.addEventListener' in s and s.rstrip().endswith('})();'), 'Unexpected dashboard version; no changes made'
old='<span class="z7-pick"><span class="zi">▣</span><span id="z7School">SCHOOL</span>⌄</span><span class="z7-pick"><span class="zi">▦</span><span id="z7Year">Academic year</span>⌄</span><span class="z7-pick"><span class="zi">▣</span><span id="z7Term">Current term</span>⌄</span>'
new='<span class="z7-pick z7-school-label" title="Current school"><span class="zi">▣</span><span id="z7School">SCHOOL</span></span><select class="z7-pick" id="z7SchoolSelect" aria-label="Switch school" hidden></select><select class="z7-pick" id="z7YearSelect" aria-label="Academic year"><option value="">Academic year</option></select><select class="z7-pick" id="z7TermSelect" aria-label="Current term"><option value="">Current term</option></select>'
assert s.count(old)==1, 'Header controls differ; no changes made'
s=s.replace(old,new,1)
olduser='<div class="z7-user"><span class="z7-avatar">♙</span><span><span id="z7User">School Administrator</span><small id="z7Role">School account</small></span></div>'
newuser='<div class="z7-user"><span class="z7-avatar">♙</span><span><span id="z7User">Signed-in user</span><small id="z7Role">School account</small></span></div><button type="button" id="z7SignOut" class="z7-signout">Sign Out</button>'
assert s.count(olduser)==1, 'User header differs; no changes made'
s=s.replace(olduser,newuser,1)
insert=r'''
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
'''
# add before the closing brace of make(), not after it
needle='\n}\nfunction init(){make()}'
assert s.count(needle)==1, 'Dashboard initialization differs; no changes made'
s=s.replace(needle,'\n'+insert+needle,1)
style='''\n/* ZELIMU_HEADER_CONTROLS_REPAIR_20261030 */
body .z7-toolbar .z7-pick[hidden],body .z7-toolbar .z7-school-label[hidden]{display:none!important}
body .z7-toolbar select.z7-pick{cursor:pointer;max-width:190px;min-width:125px;font-family:inherit;appearance:auto}
body .z7-toolbar .z7-school-label{max-width:210px;overflow:hidden;text-overflow:ellipsis}
body .z7-toolbar .z7-user{min-width:0;max-width:210px;white-space:normal}
body .z7-toolbar #z7User{display:block;overflow-wrap:anywhere;line-height:1.25}
body .z7-toolbar .z7-signout{border:1px solid #a51d29;background:#fff;color:#a51d29;border-radius:7px;padding:9px 12px;font-weight:700;cursor:pointer;white-space:nowrap}
body .z7-toolbar .z7-signout:hover{background:#fff1f2}
body .z7-toolbar{height:auto;min-height:70px;flex-wrap:wrap}
body .z7-toolbar-right{flex-wrap:wrap}
'''
oldcss=c.read_text(encoding='utf-8')
p.with_name(p.name+'.before-header-repair').write_text(p.read_text(encoding='utf-8'),encoding='utf-8')
c.with_name(c.name+'.before-header-repair').write_text(oldcss,encoding='utf-8')
p.write_text(s,encoding='utf-8')
c.write_text(oldcss+style,encoding='utf-8')
print('Patched real visible toolbar and account controls. Original files backed up.')

from pathlib import Path
p=Path('public/dashboard.html')
s=p.read_text(encoding='utf-8')
marker='ZELIMU RESPONSIVE HEADER REPAIR 20261030'
if marker in s:
 print('Responsive header already installed; no changes made.');raise SystemExit(0)
if '<header>' not in s or 'id="who"' not in s or 'id="signOut"' not in s:
 raise SystemExit('Expected dashboard header not found. No changes made.')
css='''
<style>/* ZELIMU RESPONSIVE HEADER REPAIR 20261030 */
/* Keep the header in normal document flow, never over the dashboard. */
body .page{min-width:0!important;max-width:100%!important}
body .page > header{position:relative!important;top:auto!important;left:auto!important;right:auto!important;z-index:30!important;box-sizing:border-box!important;width:100%!important;max-width:100%!important;height:auto!important;min-height:72px!important;padding:12px 16px!important;display:flex!important;flex-wrap:wrap!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;background:#fff!important}
body .page > header .brand-lockup{display:flex!important;flex:1 1 300px!important;min-width:0!important;align-items:center!important;flex-wrap:wrap!important;gap:10px!important}
body .page > header .pm-brand{min-width:0!important;max-width:100%!important}
body .page > header #schoolTitle{max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;color:#064c39}
body .page > header .header-actions{display:flex!important;align-items:center!important;justify-content:flex-end!important;flex:0 1 auto!important;min-width:0!important;flex-wrap:wrap!important;gap:8px!important}
body .page > header #ownerSchoolSwitch{max-width:220px!important}
body .page > header #who{max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
body .page > header #signOut{display:none!important}
#zelimuAccountToggle{display:flex;align-items:center;gap:9px;border:1px solid #d7e7df;background:#f5faf7;border-radius:30px;padding:5px 11px;cursor:pointer;max-width:245px;color:#073f30;font:inherit}
#zelimuAvatar{display:grid;place-items:center;width:34px;height:34px;min-width:34px;border-radius:50%;background:#087c53;color:#fff;font-weight:800;overflow:hidden}
#zelimuAvatar img{width:100%;height:100%;object-fit:cover}
#zelimuAccountName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:700;max-width:150px}
#zelimuAccountMenu{position:absolute;right:16px;top:calc(100% - 4px);width:min(290px,calc(100vw - 32px));background:#fff;border:1px solid #d8e8df;border-radius:12px;box-shadow:0 12px 32px #0a392d2b;padding:12px;z-index:1000}
#zelimuAccountMenu[hidden]{display:none!important}
#zelimuAccountMenu button{display:block;width:100%;margin-top:7px;text-align:left;padding:10px;border:1px solid #dce7e1;border-radius:8px;background:#f7faf8;color:#083f32;cursor:pointer}
#zelimuAccountMenu button:last-child{color:#a92323}
#zelimuMobileMenu{display:none;border:1px solid #cce3d6;background:#f3faf6;border-radius:8px;padding:8px 10px;color:#064b36;font-size:14px}
/* Protect all immediate dashboard sections from floating above the header. */
body .page > header + *{clear:both}
@media(max-width:900px){body .page > header{padding:10px!important;gap:8px!important}body .page > header .brand-lockup{flex:1 1 180px!important}body .page > header #who{display:none!important}#zelimuMobileMenu{display:inline-flex;align-items:center}#zelimuAccountName{max-width:95px}body .page > header #ownerSchoolSwitch{max-width:160px!important}}
@media(max-width:600px){body .page > header{min-height:64px!important;align-items:center!important}body .page > header .brand-lockup{flex:1 1 120px!important}body .page > header .pm-brand img{max-width:34px!important;max-height:34px!important}body .page > header #schoolTitle{max-width:180px;font-size:12px}body .page > header .header-actions{flex:0 1 auto!important}#zelimuAccountName{display:none}#zelimuAccountToggle{padding:4px}body .page > header #ownerSchoolSwitch{max-width:130px!important;font-size:11px!important}#zelimuAccountMenu{right:8px}}
</style>
'''
s=s.replace('</head>',css+'</head>',1)
js='''
<script>/* ZELIMU RESPONSIVE HEADER REPAIR 20261030 */
(function(){
 function init(){
  const header=document.querySelector('.page > header');if(!header||document.getElementById('zelimuAccountToggle'))return;
  const actions=header.querySelector('.header-actions');if(!actions)return;
  const mobile=document.createElement('button');mobile.id='zelimuMobileMenu';mobile.type='button';mobile.textContent='☰ Menu';mobile.setAttribute('aria-label','Toggle navigation');
  header.insertBefore(mobile,header.firstChild);
  mobile.addEventListener('click',()=>{
    const nav=document.getElementById('navTabs');const side=nav?.closest('aside,nav,.sidebar,.pm-sidebar,.module-sidebar');
    if(!side){nav?.scrollIntoView({behavior:'smooth',block:'start'});return;}
    const open=side.classList.toggle('zelimu-mobile-open');
    if(open){side.style.setProperty('display','block','important');side.scrollIntoView({behavior:'smooth',block:'start'});}else{side.style.removeProperty('display');}
    mobile.setAttribute('aria-expanded',String(open));
  });
  const toggle=document.createElement('button');toggle.id='zelimuAccountToggle';toggle.type='button';toggle.setAttribute('aria-label','Open account menu');toggle.setAttribute('aria-expanded','false');
  const avatar=document.createElement('span');avatar.id='zelimuAvatar';avatar.textContent='👤';
  const name=document.createElement('span');name.id='zelimuAccountName';name.textContent='My Account';
  toggle.append(avatar,name);
  const menu=document.createElement('div');menu.id='zelimuAccountMenu';menu.hidden=true;
  const label=document.createElement('div');label.style.fontWeight='700';label.textContent='Account';menu.append(label);
  const role=document.createElement('div');role.style.fontSize='12px';role.style.color='#577369';menu.append(role);
  const profile=document.createElement('button');profile.type='button';profile.textContent='My profile';profile.onclick=()=>{menu.hidden=true;const target=document.querySelector('[data-target="account"],[data-target="profile"],#accountPanel,#profilePanel');if(target){target.click?.();target.scrollIntoView?.({block:'start'});}else alert('Account profile is not configured in this dashboard yet.');};menu.append(profile);
  const sign=document.createElement('button');sign.type='button';sign.textContent='Sign out';sign.onclick=()=>document.getElementById('signOut')?.click();menu.append(sign);
  actions.append(toggle);header.append(menu);
  toggle.onclick=()=>{menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden));};
  document.addEventListener('click',e=>{if(!menu.contains(e.target)&&!toggle.contains(e.target)){menu.hidden=true;toggle.setAttribute('aria-expanded','false');}});
  const refresh=()=>{const raw=document.getElementById('who')?.textContent?.trim()||'';name.textContent=raw||'My Account';role.textContent=document.getElementById('roleCaption')?.textContent?.trim()||'';avatar.textContent=(raw.match(/[A-Za-z]/)||['👤'])[0].toUpperCase();};
  refresh();const who=document.getElementById('who');if(who){new MutationObserver(refresh).observe(who,{subtree:true,childList:true,characterData:true});}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
</script>
'''
s=s.replace('</body>',js+'</body>',1)
p.write_text(s,encoding='utf-8')
print('Responsive header and account dropdown installed; existing school/year/term controls preserved.')

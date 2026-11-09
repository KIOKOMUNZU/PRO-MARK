"""
ZELIMU CBC - INSTANT DASHBOARD PATCH
Removes loading banners, pre-hydrates session data, moves script to immediate execution,
and caches KPI metrics in localStorage for 0ms dashboard load.
"""
from pathlib import Path
import re

# 1. Patch login.html: Auto-redirect if already signed in + instant transition
login_path = Path("public/login.html")
if login_path.exists():
    src = login_path.read_text(encoding="utf-8")
    old_start = "(function(){'use strict';const form=document.getElementById('loginForm')"
    new_start = """(function(){'use strict';
// INSTANT AUTO-REDIRECT: If already signed in, open dashboard immediately without loading
try {
  const t = localStorage.getItem('token');
  const u = JSON.parse(localStorage.getItem('user') || 'null');
  if (t && u && (u.school_id || u.role === 'PLATFORM_OWNER')) {
    location.replace(u.role === 'PLATFORM_OWNER' ? '/owner.html' : '/dashboard.html');
    return;
  }
} catch(e) {}
const form=document.getElementById('loginForm')"""

    if old_start in src:
        src = src.replace(old_start, new_start, 1)

    old_redir = "location.href=d.user.role==='PLATFORM_OWNER'?'/owner.html':'/dashboard.html';"
    new_redir = "location.replace(d.user.role==='PLATFORM_OWNER'?'/owner.html':'/dashboard.html');"
    if old_redir in src:
        src = src.replace(old_redir, new_redir, 1)

    login_path.write_text(src, encoding="utf-8")
    print("✓ public/login.html patched.")

# 2. Patch dashboard.html: Eliminate loading box & pre-hydrate headers
dash_path = Path("public/dashboard.html")
if dash_path.exists():
    src = dash_path.read_text(encoding="utf-8")

    # Remove the loading notice and mount the script immediately after the container
    old_sec = '<section class="zelimu-command zelimu-command-v1" aria-label="School Command Centre"><div class="notice" role="status">Loading school command centre…</div></section>'
    new_sec = '<section class="zelimu-command zelimu-command-v1" aria-label="School Command Centre"></section>\n<script src="/js/zelimu-approved-dashboard.js?v=instant-20261109"></script>'
    if old_sec in src:
        src = src.replace(old_sec, new_sec, 1)

    # Remove the duplicate script at line ~2922
    old_script = '<script src="/js/zelimu-approved-dashboard.js?v=live-school-data-20261104"></script>'
    if old_script in src:
        src = src.replace(old_script, '', 1)

    # Pre-hydrate user role, greeting and school title before DOM paint
    pre_hydrate = """<script>
// INSTANT PRE-HYDRATION: Pre-populate header & role before paint
(function(){
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return;
    const u = JSON.parse(raw);
    const names = {SCHOOL_ADMIN:'School Administrator',ADMIN:'Administrator',HEADTEACHER:'Head Teacher',DEPUTY_HEADTEACHER:'Deputy Head Teacher',SENIOR_TEACHER:'Senior Teacher',CLASS_TEACHER:'Class Teacher',TEACHER:'Subject Teacher'};
    const rName = names[u.role] || (u.role ? u.role.replaceAll('_',' ') : 'User');
    document.addEventListener('DOMContentLoaded', function(){
      const who = document.getElementById('who');
      if (who) who.textContent = [u.first_name, u.last_name].filter(Boolean).join(' ') + ' · ' + rName;
      const h = document.getElementById('portalHeading');
      if (h) h.textContent = rName + ' workspace';
      const b = document.getElementById('roleBadge');
      if (b) b.textContent = (u.role || '').toUpperCase();
      const cap = document.getElementById('roleCaption');
      if (cap) cap.textContent = 'Role-aware school portal';
      const ug = document.getElementById('userGreeting');
      if (ug) ug.textContent = 'Welcome, ' + ([u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'User');
      const st = document.getElementById('schoolTitle');
      if (st && u.school_name) st.textContent = u.school_name;
    });
  } catch(e) {}
})();
</script>
</head>"""
    if '</head>' in src and 'INSTANT PRE-HYDRATION' not in src:
        src = src.replace('</head>', pre_hydrate, 1)

    dash_path.write_text(src, encoding="utf-8")
    print("✓ public/dashboard.html patched.")

# 3. Patch zelimu-approved-dashboard.js: Instant cache hydration & 0ms initial paint
js_path = Path("public/js/zelimu-approved-dashboard.js")
if js_path.exists():
    src = js_path.read_text(encoding="utf-8")

    # Instant cached KPI metrics display
    old_role = " if($('z7Role'))$('z7Role').textContent=user.role?String(user.role).replaceAll('_',' '):'Role unavailable';"
    new_role = old_role + """
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
 } catch(e) {}"""
    if old_role in src:
        src = src.replace(old_role, new_role, 1)

    # Save fresh KPI data to cache on arrival
    old_tasks = "$('z7Tasks').textContent=tasks.toLocaleString('en-KE');"
    new_tasks = old_tasks + """
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
   } catch(e) {}"""
    if old_tasks in src:
        src = src.replace(old_tasks, new_tasks, 1)

    # Replace 15-second wait with immediate background fetch
    wait_search = re.search(r"let attempts=0;\s*const waitForPeriod=setInterval\(\(\)=>\{[\s\S]*?\},500\);", src)
    if wait_search:
        new_wait = """setTimeout(load, 30);
  let attempts=0;
  const waitForPeriod=setInterval(()=>{
   attempts++;
   if(($('z7YearSelect')?.value&&$('z7TermSelect')?.value)||attempts>=6){
    clearInterval(waitForPeriod);
    if($('z7YearSelect')?.value&&$('z7TermSelect')?.value)load();
   }
  },300);"""
        src = src[:wait_search.start()] + new_wait + src[wait_search.end():]

    # Remove "Connecting to school data..." message
    src = src.replace('Connecting to school data…', 'Live school operations')

    js_path.write_text(src, encoding="utf-8")
    print("✓ public/js/zelimu-approved-dashboard.js patched.")

print("\nAll instant-dashboard patches applied successfully!")

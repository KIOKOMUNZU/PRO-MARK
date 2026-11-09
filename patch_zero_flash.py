from pathlib import Path
import re

# 1. Patch dashboard.html: Insert Zero-Flash Shield into <head>
dash_path = Path("public/dashboard.html")
if dash_path.exists():
    dash_src = dash_path.read_text(encoding="utf-8")
    top_head_needle = '<meta name="viewport" content="width=device-width,initial-scale=1">'
    shield_css = """<meta name="viewport" content="width=device-width,initial-scale=1">
<style id="z7-clean-viewport">
  /* ZERO-FLASH SHIELD: Permanently eliminate all legacy headers, heroes & unselected sections */
  body main.page > header,
  body main.page > .portal-hero,
  body main.page > .zelimu-legacy-stats,
  body main.page > #announcementBanner,
  body main.page > #passwordPanel:not(.zelimu-password-open),
  body main.page > .nav-managed-section:not(.nav-active),
  body main.page > #teacherMarking:not(.nav-active) {
    display: none !important;
  }
  body main.page {
    padding: 0 !important;
    margin: 0 !important;
    max-width: 100% !important;
    background: #0f1e17 !important;
  }
  .zelimu-command-v1 {
    display: block !important;
    margin: 0 !important;
    padding: 0 !important;
    min-height: 100vh !important;
  }
  /* The approved modern command centre (.z7) has its own sidebar & navigation */
  body:has(.z7) .pm-workflow-intro,
  .zc-sidebar-hidden .pm-workflow-intro {
    display: none !important;
  }
</style>"""
    if 'z7-clean-viewport' not in dash_src and top_head_needle in dash_src:
        dash_src = dash_src.replace(top_head_needle, shield_css, 1)
        dash_path.write_text(dash_src, encoding="utf-8")
        print("✓ public/dashboard.html: Zero-flash shield installed.")
    else:
        print("public/dashboard.html: Already shielded or needle not matched.")

# 2. Patch zelimu-approved-dashboard.js: Render synchronously immediately
js_path = Path("public/js/zelimu-approved-dashboard.js")
if js_path.exists():
    js_src = js_path.read_text(encoding="utf-8")
    pattern = re.compile(r"function init\(\)\{make\(\)\}\s*if\(document\.readyState==='loading'\)document\.addEventListener\('DOMContentLoaded',init,\{once:true\}\);else init\(\);\s*\}\)\(\);")
    match = pattern.search(js_src)
    if match:
        new_code = """function init(){make()}
// IMMEDIATE SYNCHRONOUS EXECUTION: Do NOT wait for DOMContentLoaded if host is ready
const hostEl=document.querySelector('.zelimu-command-v1')||document.querySelector('.zc-dashboard');
if(hostEl){init();}
else if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init,{once:true});}
else{init();}
})();"""
        js_src = js_src[:match.start()] + new_code + js_src[match.end():]
        js_path.write_text(js_src, encoding="utf-8")
        print("✓ public/js/zelimu-approved-dashboard.js: Synchronous instant mount enabled.")
    else:
        print("public/js/zelimu-approved-dashboard.js: Pattern already updated.")

print("\nZero-flash patch applied successfully!")

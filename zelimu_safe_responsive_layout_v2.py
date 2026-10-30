#!/usr/bin/env python3
from pathlib import Path
p=Path("public/css/zelimu-approved-dashboard.css")
html=Path("public/dashboard.html")
if not p.exists() or not html.exists():
    raise SystemExit("Expected ZELIMU dashboard files missing. Nothing changed.")
if "zelimuStaffHubV2" not in html.read_text(encoding="utf-8"):
    raise SystemExit("Staff Management V2 not found in dashboard. Nothing changed.")
s=p.read_text(encoding="utf-8")
if ".z7-toolbar" not in s or ".z7-grid" not in s:
    raise SystemExit("Expected dashboard CSS not found. Nothing changed.")
start="/* ZELIMU SAFE RESPONSIVE LAYOUT V2 START */"
end="/* ZELIMU SAFE RESPONSIVE LAYOUT V2 END */"
if start in s and end in s:
    s=s[:s.index(start)]+s[s.index(end)+len(end):]
css=r"""
/* ZELIMU SAFE RESPONSIVE LAYOUT V2 START */
/* CSS only: preserve the HTML, scripts, routes, and existing staff management. */
body:has(.z7) main.page { min-width:0!important; }
body .z7,body .z7 * { min-width:0; }
body .z7-toolbar {
  box-sizing:border-box!important;
  min-height:70px!important;
  height:auto!important;
  display:flex!important;
  flex-wrap:wrap!important;
  align-items:center!important;
  justify-content:space-between!important;
  gap:10px 14px!important;
  padding:10px 18px!important;
}
body .z7-toolbar-right {display:flex!important;flex-wrap:wrap!important;gap:9px!important;min-width:0!important;}
body .z7-toolbar .z7-school-label {max-width:clamp(125px,18vw,260px)!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
body .z7-toolbar .z7-pick {max-width:190px!important;min-width:100px!important;flex:0 1 auto!important;}
body .z7-toolbar .z7-search {width:clamp(145px,20vw,300px)!important;max-width:100%!important;box-sizing:border-box!important;}
body .z7-toolbar .z7-user {min-width:0!important;max-width:200px!important;}
body .z7-grid {grid-template-columns:minmax(0,1.36fr) minmax(0,.84fr) minmax(0,.78fr)!important;}
body .z7-grid > * {min-width:0!important;}
body .z7-panel {min-width:0!important;}
@media (max-width:1250px) and (min-width:751px) {
 body .z7-toolbar {gap:8px!important;padding:9px 12px!important;}
 body .z7-toolbar .z7-search {width:180px!important;}
 body .z7-grid {grid-template-columns:repeat(2,minmax(0,1fr))!important;}
 body .z7-grid > .z7-panel:first-child {grid-column:1/-1!important;}
}
@media (max-width:750px) {
 body main.page {padding-left:0!important;width:100%!important;min-width:0!important;}
 body .z7-toolbar {position:relative!important;left:auto!important;right:auto!important;top:auto!important;width:100%!important;height:auto!important;min-height:0!important;flex-wrap:wrap!important;padding:12px!important;gap:10px!important;}
 body .z7-toolbar-right {width:100%!important;justify-content:flex-start!important;}
 body .z7-toolbar .z7-search {display:block!important;width:100%!important;flex:1 1 100%!important;}
 body .z7-toolbar .z7-school-label {max-width:calc(100vw - 100px)!important;}
 body .z7-toolbar .z7-pick {max-width:calc(50vw - 24px)!important;min-width:0!important;}
 body .z7-grid {grid-template-columns:minmax(0,1fr)!important;}
 body .z7-grid > .z7-panel:first-child {grid-column:auto!important;}
 body .z7-panel {max-width:100%!important;overflow-wrap:anywhere;}
}
/* ZELIMU SAFE RESPONSIVE LAYOUT V2 END */
"""
p.write_text(s.rstrip()+"\n\n"+css,encoding="utf-8")
print("Applied CSS-only responsive layout. No HTML or JavaScript modified.")

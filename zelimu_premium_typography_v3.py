#!/usr/bin/env python3
from pathlib import Path
p=Path("public/css/zelimu-approved-dashboard.css")
h=Path("public/dashboard.html")
j=Path("public/js/zelimu-approved-dashboard.js")
if not all(x.exists() for x in (p,h,j)):
    raise SystemExit("ZELIMU source files missing; no changes made.")
if "zelimuStaffHubV2" not in h.read_text(encoding="utf-8") or "z7-toolbar" not in j.read_text(encoding="utf-8"):
    raise SystemExit("Expected working dashboard not found; no changes made.")
s=p.read_text(encoding="utf-8")
start="/* ZELIMU PREMIUM TYPOGRAPHY V3 START */"
end="/* ZELIMU PREMIUM TYPOGRAPHY V3 END */"
if start in s:
    if end not in s: raise SystemExit("Incomplete previous styling marker; no changes made.")
    s=s[:s.index(start)]+s[s.index(end)+len(end):]
css=r"""
/* ZELIMU PREMIUM TYPOGRAPHY V3 START */
/* Scoped, CSS-only: no changes to dashboard HTML, JS, database or handlers. */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
body .z7,body .z7-toolbar,body .z7-side,body .z7-workspace{
 font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif!important;
 -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}
body .z7 h1,body .z7 h2,body .z7 h3,body .z7-heading h1,
body .z7-panelhead strong,body .z7-brand strong{
 font-family:'Plus Jakarta Sans','Inter',system-ui,sans-serif!important;
 letter-spacing:-.025em!important;
}
body .z7-toolbar{
 background:#f9fcfa!important;border-bottom:1px solid #d7e7dd!important;
 box-shadow:0 3px 14px rgba(5,65,47,.055)!important;
 gap:12px!important;align-items:center!important;
}
body .z7-pickers{display:flex!important;flex-wrap:wrap!important;gap:9px!important;min-width:0!important;align-items:center!important}
body .z7-toolbar .z7-school-label{
 max-width:none!important;min-width:180px!important;width:auto!important;
 display:flex!important;align-items:center!important;
 background:#eaf5ee!important;border:1px solid #badcc8!important;
 border-left:4px solid #087c55!important;
 padding:8px 12px!important;white-space:normal!important;
 color:#064e3b!important;overflow:visible!important;
 font-size:13px!important;line-height:1.35!important;
 font-weight:800!important;box-sizing:border-box!important;
}
body .z7-toolbar .z7-school-label #z7School{
 display:block!important;white-space:normal!important;overflow-wrap:anywhere!important;
 max-width:250px!important;
}
body .z7-toolbar select.z7-pick{
 font-family:'Inter',system-ui,sans-serif!important;font-size:13px!important;
 font-weight:700!important;min-height:42px!important;
 border:1px solid #d2e2d8!important;background:#fff!important;
 border-radius:9px!important;color:#163e31!important;
}
body .z7-toolbar-right{display:flex!important;align-items:center!important;flex-wrap:wrap!important;gap:10px!important;min-width:0!important}
body .z7-search{
 font-family:'Inter',system-ui,sans-serif!important;
 font-size:13px!important;border:1px solid #d8e5dc!important;
 border-radius:9px!important;background:#fff!important;
 min-height:42px!important;
}
body .z7-user{color:#103d2e!important;font-size:13px!important;font-weight:700!important;white-space:normal!important}
body .z7-user small{font-size:11px!important;color:#60796d!important}
body .z7-avatar{background:#e1f1e7!important;color:#08734e!important;border:2px solid #b8d9c5!important}
body .z7-signout{font-family:'Inter',system-ui,sans-serif!important;border-radius:9px!important;font-weight:700!important}
body .z7-workspace{background:#f7faf7!important;min-width:0!important}
body .z7-heading h1{color:#133e30!important;font-size:clamp(24px,2.5vw,34px)!important;line-height:1.2!important}
body .z7-panel{border-color:#dce9df!important;border-radius:12px!important}
body .z7-kpi{border-radius:11px!important}
body .z7-side{background:#053c30!important}
body .z7-nav button{font-family:'Inter',system-ui,sans-serif!important;line-height:1.35!important}
body .z7-navhead{letter-spacing:.075em!important}
@media(max-width:1250px){
 body .z7-toolbar .z7-school-label{min-width:140px!important}
 body .z7-toolbar .z7-school-label #z7School{max-width:180px!important}
}
@media(max-width:750px){
 body .z7-toolbar{height:auto!important;min-height:0!important;padding:10px 12px!important}
 body .z7-pickers{width:100%!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important}
 body .z7-toolbar .z7-school-label{grid-column:1/-1!important;min-width:0!important}
 body .z7-toolbar .z7-school-label #z7School{max-width:none!important}
 body .z7-toolbar select.z7-pick{min-width:0!important;width:100%!important;max-width:none!important}
 body .z7-toolbar-right{width:100%!important}
 body .z7-search{width:100%!important;flex:1 1 100%!important}
 body .z7-user{flex:1 1 auto!important}
 body .z7-heading h1{font-size:25px!important}
}
@media(prefers-reduced-motion:reduce){body .z7 *{scroll-behavior:auto!important}}
/* ZELIMU PREMIUM TYPOGRAPHY V3 END */
"""
p.write_text(s.rstrip()+"\n\n"+css,encoding="utf-8")
print("Premium typography and school-header colours applied. Only CSS changed.")

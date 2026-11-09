from pathlib import Path
import re

dash_path = Path("public/dashboard.html")
if dash_path.exists():
    dash_src = dash_path.read_text(encoding="utf-8")

    # 1. Update Zero-Flash Shield in <head>
    new_style = """<style id="z7-clean-viewport">
  /* ZERO-FLASH SHIELD: Pure instant Command Centre presentation */
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #0f1e17 !important;
    color: #e5ece8 !important;
  }
  body main.page {
    padding: 0 !important;
    margin: 0 !important;
    max-width: 100% !important;
    background: #0f1e17 !important;
  }
  #zelimuLegacyBridge,
  body main.page > header,
  body main.page > .portal-hero,
  body main.page > .zelimu-legacy-stats,
  body main.page > #announcementBanner,
  body main.page > .pm-workflow-intro,
  body main.page > #passwordPanel:not(.zelimu-password-open),
  body main.page > .nav-managed-section:not(.nav-active) {
    display: none !important;
  }
  .zelimu-command-v1 {
    display: block !important;
    margin: 0 !important;
    padding: 0 !important;
    min-height: 100vh !important;
  }
</style>"""

    if '<style id="z7-clean-viewport">' in dash_src:
        dash_src = re.sub(r'<style id="z7-clean-viewport">[\s\S]*?</style>', new_style, dash_src, count=1)

    # 2. Reorganize DOM: Make Command Centre #1 element directly inside <main class="page">
    pattern = re.compile(r'<main class="page">\s*(<header>[\s\S]*?</header>\s*<section class="portal-hero card">[\s\S]*?</section>\s*<div id="announcementBanner"[^>]*></div>\s*<section id="passwordPanel"[\s\S]*?</section>\s*<section id="teacherMarking"[\s\S]*?</section>\s*<div class="grid three zelimu-legacy-stats">[\s\S]*?</div>)\s*<section class="zelimu-command zelimu-command-v1"[^>]*></section>\s*<script src="/js/zelimu-approved-dashboard.js[^"]*"></script>')

    m = pattern.search(dash_src)
    if m:
        legacy_block = m.group(1)
        replacement = f"""<main class="page">
<section class="zelimu-command zelimu-command-v1" aria-label="School Command Centre"></section>
<script src="/js/zelimu-approved-dashboard.js?v=instant-complete-20261109"></script>
<div id="zelimuLegacyBridge" hidden style="display:none !important">
{legacy_block}
</div>"""
        dash_src = dash_src[:m.start()] + replacement + dash_src[m.end():]
        dash_path.write_text(dash_src, encoding="utf-8")
        print("✓ public/dashboard.html: Navy blue & white flash permanently eliminated.")
    else:
        dash_path.write_text(dash_src, encoding="utf-8")
        print("✓ public/dashboard.html: Viewport style updated.")

print("\nNavy & White removal patch applied successfully!")

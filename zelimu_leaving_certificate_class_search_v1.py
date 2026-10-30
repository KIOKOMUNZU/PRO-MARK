from pathlib import Path
p=Path('public/dashboard.html')
s=p.read_text()
old='<label>Learner<select name="learner_id" required id="lcLearner"><option value="">Select learner</option></select></label>'
new='''<div class="lc-chooser"><label>1. Grade / Class<select id="lcClass" required><option value="">Select class first</option></select></label><label>2. Search learner<input id="lcSearch" type="search" placeholder="Name or admission number" disabled></label><label>3. Learner<select name="learner_id" required id="lcLearner" disabled><option value="">Select class first</option></select></label><small id="lcSearchStatus">Choose a class first.</small></div>'''
loader="$('lcLearner').innerHTML='<option value=\"\">Select learner</option>'+(fin.learners||[]).map(l=>`<option value=\"${esc(l.id)}\">${esc([l.first_name,l.middle_name,l.last_name].filter(Boolean).join(' '))} (${esc(l.admission_no||'')})</option>`).join('');"
anchor="$('feeStructureReload')?.addEventListener('click',fees);"
if not all(x in s for x in [old,loader,anchor,'zelimuStaffHubV2']):raise SystemExit('Expected source not found; nothing changed')
js='''function zelimuLCFilter(){
 const cl=$('lcClass'),q=$('lcSearch'),sel=$('lcLearner'),msg=$('lcSearchStatus');
 const classes=Array.isArray(state.classes)?state.classes:[],learners=Array.isArray(state.learners)?state.learners:[];
 const previousClass=cl.value,previousLearner=sel.value;
 const names=new Map(classes.filter(c=>c.id).map(c=>[String(c.id),[c.name||c.class_name||c.level_name||'Class',c.stream||''].filter(Boolean).join(' ')]));
 learners.forEach(l=>{if(l.class_id&&!names.has(String(l.class_id)))names.set(String(l.class_id),l.class_name||'Class');});
 cl.replaceChildren(new Option('Select grade / class',''),...[...names].sort((a,b)=>a[1].localeCompare(b[1],undefined,{numeric:true})).map(([id,name])=>new Option(name,id)));
 if(names.has(previousClass))cl.value=previousClass;
 q.disabled=!cl.value;sel.disabled=!cl.value;
 if(!cl.value){sel.replaceChildren(new Option('Select class first',''));msg.textContent='Select a class first.';return;}
 const term=q.value.trim().toLowerCase();
 const matches=learners.filter(l=>String(l.class_id||'')===cl.value).filter(l=>!term||[l.first_name,l.middle_name,l.last_name,l.admission_no,l.assessment_no].some(v=>String(v||'').toLowerCase().includes(term)));
 sel.replaceChildren(new Option('Select learner',''),...matches.slice(0,100).map(l=>new Option([l.first_name,l.middle_name,l.last_name].filter(Boolean).join(' ')+' ('+(l.admission_no||'—')+')',l.id)));
 if(matches.some(l=>String(l.id)===previousLearner))sel.value=previousLearner;
 msg.textContent=matches.length>100?matches.length+' matches; type more to narrow results.':matches.length+' learner(s) found.';
}
$('lcClass')?.addEventListener('change',()=>{$('lcSearch').value='';zelimuLCFilter();});
$('lcSearch')?.addEventListener('input',zelimuLCFilter);
'''
s=s.replace(old,new,1).replace(loader,'zelimuLCFilter();',1).replace(anchor,js+anchor,1)
css='''<style id="lc-chooser-style">#leavingCertificates .lc-chooser{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:12px 0 18px;padding:16px;background:#f4faf6;border:1px solid #d6e8dc;border-radius:12px}#leavingCertificates .lc-chooser label:nth-child(3),#leavingCertificates .lc-chooser small{grid-column:1/-1}#leavingCertificates .lc-chooser input,#leavingCertificates .lc-chooser select{box-sizing:border-box;width:100%;min-height:44px;margin-top:6px}@media(max-width:700px){#leavingCertificates .lc-chooser{grid-template-columns:minmax(0,1fr)}#leavingCertificates .lc-chooser label:nth-child(3),#leavingCertificates .lc-chooser small{grid-column:1}}</style>'''
s=s.replace('</head>',css+'</head>',1)
p.write_text(s)
print('Certificate class-first learner search installed.')

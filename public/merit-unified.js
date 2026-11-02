/* ZELIMU CBC unified merit configuration. Isolated from legacy dashboard scripts. */
(()=>{'use strict';
const $=id=>document.getElementById(id),root=$('meritUnifiedMount');if(!root)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const user=(()=>{try{return JSON.parse(localStorage.getItem('user')||'{}')}catch{return {}}})();
const sid=user.school_id||new URLSearchParams(location.search).get('school_id');
const admin=['SCHOOL_ADMIN','ADMIN','HEADTEACHER'].includes(user.role);
const style=document.createElement('style');style.textContent=`
#meritUnifiedMount{font-family:inherit;color:#143b2c}#meritUnifiedMount .mu-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}#meritUnifiedMount h3{font-size:1.3rem;margin:0;color:#075b3b}#meritUnifiedMount h4{margin:16px 0 10px;font-size:1rem;color:#124a36}#meritUnifiedMount .mu-muted{color:#536e60;font-size:.9rem;margin:6px 0 12px}#meritUnifiedMount .mu-box{border:1px solid #d3e5d9;border-radius:12px;background:white;padding:16px;margin:12px 0}#meritUnifiedMount .mu-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}#meritUnifiedMount .mu-assessment{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 6px;border-bottom:1px solid #e3eee6}#meritUnifiedMount .mu-assessment:last-child{border:0}#meritUnifiedMount .mu-assessment label{display:flex;gap:12px;align-items:center;cursor:pointer;flex:1}#meritUnifiedMount .mu-assessment input[type=checkbox]{width:20px;height:20px;accent-color:#078455}#meritUnifiedMount .mu-status{font-size:.8rem;color:#567064}#meritUnifiedMount .mu-btn{background:#087b51;color:white;border:0;border-radius:9px;padding:11px 15px;font-weight:700;cursor:pointer}#meritUnifiedMount .mu-btn:disabled{opacity:.5;cursor:not-allowed}#meritUnifiedMount .mu-secondary{background:#e7f4eb;color:#0b6040}#meritUnifiedMount .mu-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}#meritUnifiedMount select,#meritUnifiedMount input[type=number]{min-height:40px;padding:8px;border:1px solid #b9d2c3;border-radius:8px;background:white;max-width:100%}#meritUnifiedMount .mu-choice{display:block;padding:9px 0}#meritUnifiedMount .mu-choice input{accent-color:#087b51;margin-right:8px}#meritUnifiedMount .mu-table{overflow:auto}#meritUnifiedMount table{width:100%;border-collapse:collapse;min-width:540px}#meritUnifiedMount td,#meritUnifiedMount th{padding:10px;border-bottom:1px solid #e1ebe5;text-align:left}#meritUnifiedMount th{background:#f0f8f2}#meritUnifiedMount .mu-alert{padding:10px;border-radius:8px;background:#f0f7f2;margin-top:10px}#meritUnifiedMount .mu-weights{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}#meritUnifiedMount .mu-weights label{display:grid;gap:5px} @media(max-width:680px){#meritUnifiedMount .mu-grid{grid-template-columns:1fr}#meritUnifiedMount .mu-box{padding:11px}}`;
document.head.appendChild(style);
root.innerHTML=`<div class="mu-head"><div><h3>🏆 Merit &amp; Ranking Management</h3><p class="mu-muted">Choose assessments, calculate learner performance and preview class rankings.</p></div><span class="pill">ZELIMU CBC</span></div><div class="mu-box"><h4>Academic context</h4><p class="mu-muted">Use the Academic Year, Term and Class selectors in Examination Setup.</p><div class="mu-grid"><div><b>Year</b><div id="muYear">—</div></div><div><b>Term</b><div id="muTerm">—</div></div><div><b>Class</b><div id="muClass">—</div></div></div></div><div class="mu-box" id="muCatCreator">
<h4>Create CAT assessments</h4>
<p class="mu-muted">Create a CAT for the selected academic year, term and class.</p>
<div class="mu-row">
<label>CAT name
<input id="muCatName" type="text" placeholder="CAT 1">
</label>
<label>Maximum marks
<input id="muCatMax" type="number" min="1" value="100">
</label>
<button type="button" class="mu-btn" id="muCreateCat">
Create CAT
</button>
</div>
<p class="mu-muted" id="muCatStatus">
CAT creation is not yet connected.
</p>
</div>
<div class="mu-box"><h4>Step 1 — Select assessments for overall merit</h4><p class="mu-muted">Select any exams or CATs. Assessments not selected are excluded from this combined preview, not deleted.</p><button class="mu-btn mu-secondary" id="muLoad">Load class assessments</button><div id="muAssessments" style="margin-top:12px">Load assessments to begin.</div></div><div class="mu-box"><h4>Step 2 — Choose calculation method</h4><label class="mu-choice"><input type="radio" name="muMode" value="CAT_GROUP" checked> Average selected CATs as one component</label><label class="mu-choice"><input type="radio" name="muMode" value="INDIVIDUAL"> Count each selected assessment equally</label><label class="mu-choice"><input type="radio" name="muMode" value="CUSTOM"> Assign custom percentage weights</label><div id="muWeights" hidden></div></div><div class="mu-box"><h4>Step 3 — Save and preview</h4><p id="muSummary" class="mu-muted">Select a class and load its assessments.</p><div class="mu-row"><button class="mu-btn" id="muSave">Save configuration</button><button class="mu-btn mu-secondary" id="muPreview">Preview merit</button><button class="mu-btn mu-secondary" id="muCsv" disabled>Export CSV</button></div><div id="muMessage" class="mu-alert" role="status">No configuration loaded.</div><div id="muResults" class="mu-table"></div><p class="mu-muted">Preview only. Official Merit PDF and report cards remain unchanged; use the existing Merit Lists module for official documents.</p></div>`;
const message=(s)=>{$('muMessage').textContent=s};let loaded=null,dirty=true,previewRows=null;
function context(){const c={academic_year_id:$('asYear')?.value,term_id:$('asTerm')?.value,class_id:$('asClass')?.value};if(!sid||Object.values(c).some(v=>!v))throw Error('Select a year, term and specific class in the Analytics filters first.');return c}
function labels(){for(const [a,b] of [['asYear','muYear'],['asTerm','muTerm'],['asClass','muClass']])$(b).textContent=$(a)?.selectedOptions?.[0]?.textContent||'Not selected'}
async function api(path,options={}){const r=await fetch(path,{...options,headers:{Authorization:'Bearer '+(localStorage.getItem('token')||''),...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||data.message||'Request failed ('+r.status+')');return data}
const selected=()=>root.querySelectorAll('.mu-group-check:checked').length
  ? [...root.querySelectorAll('.mu-group-check:checked')]
      .flatMap(x=>x.dataset.ids.split(',').filter(Boolean))
  : [];const mode=()=>root.querySelector('input[name=muMode]:checked')?.value||'CAT_GROUP';

function assessmentGroups(){
  const groups=new Map();
  for(const a of loaded?.assessments||[]){
    const key=[String(a.assessment_type||'').toUpperCase(),
      String(a.name||'').trim().toUpperCase()].join('|');
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(a);
  }
  return [...groups.entries()].map(([key,rows])=>({
    key,
    name:rows[0].name,
    ids:rows.map(a=>String(a.id))
  }));
}
function drawWeights(saved={}){
  const weights=$('muWeights');
  weights.hidden=mode()!=='CUSTOM';
  if(weights.hidden)return;

  const ids=new Set(selected());
  const groups=assessmentGroups().filter(g=>g.ids.some(id=>ids.has(id)));

  weights.innerHTML=
    '<p class="mu-muted">Set one percentage for each examination group. Total must equal 100%.</p>'+
    '<div class="mu-weights">'+groups.map(g=>{
      const previous=g.ids.find(id=>saved[id]!==undefined);
      const value=previous===undefined?(100/groups.length).toFixed(2):saved[previous];
      return `<label>${esc(g.name)} (%)
        <input class="mu-weight" data-group="${esc(g.key)}"
        type="number" min="0" max="100" step="0.01"
        value="${esc(value)}"></label>`;
    }).join('')+'</div><p class="mu-muted" id="muTotal"></p>';

  weights.querySelectorAll('input').forEach(x=>
    x.addEventListener('input',()=>{dirty=true;update()})
  );
  update();
}
function update(){const n=selected().length,c=selected().filter(id=>{const a=loaded?.assessments?.find(x=>x.id===id);return /CAT|CONTINUOUS/i.test((a?.assessment_type||'')+' '+(a?.name||''))}).length;const w=[...root.querySelectorAll('.mu-weight')];const total=w.reduce((s,x)=>s+Number(x.value||0),0);$('muSummary').textContent=`${n} assessments selected, including ${c} CATs. `+(mode()==='CUSTOM'?`Custom weight total: ${total.toFixed(2)}%.`:mode()==='CAT_GROUP'?'Selected CATs count together as one average component.':'Each selected assessment counts equally.');if($('muTotal'))$('muTotal').textContent='Total: '+total.toFixed(2)+'% (must equal 100%)'}
function reset(){loaded=null;dirty=true;previewRows=null;$('muAssessments').textContent='Context changed. Load class assessments again.';$('muResults').innerHTML='';$('muCsv').disabled=true;labels();message('Select Load class assessments to continue.');update()}
async function load(){const c=context();labels();message('Loading assessments…');const data=await api(`/api/merit-flex/${sid}/setup?${new URLSearchParams(c)}`);loaded={c,assessments:data.assessments||[]};const ids=data.profile?.selected_assessment_ids||loaded.assessments.map(x=>x.id);const group=new Map();for(const a of loaded.assessments){const key=[a.name,a.assessment_type].join('|').toLowerCase();if(!group.has(key))group.set(key,[]);group.get(key).push(a)}$('muAssessments').innerHTML=`<p class="mu-muted">${loaded.assessments.length} assessment records found. Choose only the exams you want to combine.</p>`+([...group.values()].map(rows=>{
  const allIds=rows.map(a=>String(a.id));
  const checked=allIds.every(id=>ids.includes(id));
  const partial=!checked&&allIds.some(id=>ids.includes(id));
  return `<div class="mu-assessment">
    <label>
      <input type="checkbox" class="mu-group-check"
        data-ids="${esc(allIds.join(','))}"
        ${checked?'checked':''}>
      <span>
        <b>${esc(rows[0].name||rows[0].assessment_type)}</b>
        <br><small>${esc(rows[0].assessment_type||'Assessment')}
        · ${allIds.length} assessment record(s)</small>
      </span>
    </label>
    <span class="mu-status">${checked?'Included':partial?'Partially selected':'Excluded'}</span>
  </div>`;
}).join('')||'<p>No assessments configured for this class and term. Create them in Assessment Control first.</p>');root.querySelectorAll('.mu-group-check').forEach(x=>x.addEventListener('change',()=>{dirty=true;drawWeights();update();message('Selection changed. Save before previewing.')}));const m=data.profile?.cat_group_mode||'CAT_GROUP';root.querySelector(`input[name=muMode][value="${m}"]`)?.click();drawWeights(data.profile?.custom_weights||{});dirty=!data.profile;update();if(!admin)$('muSave').disabled=true;message(data.profile?'Saved configuration loaded.':'No configuration saved yet.');$('muResults').innerHTML='';$('muCsv').disabled=true}
async function save(){if(!admin)throw Error('Only an administrator or headteacher can save.');if(!loaded)throw Error('Load class assessments first.');const ids=selected();if(!ids.length)throw Error('Select at least one assessment.');const custom={};if(mode()==='CUSTOM'){for(const x of root.querySelectorAll('.mu-weight')){
  const n=Number(x.value);
  if(!Number.isFinite(n)||n<0||n>100)
    throw Error('Enter valid weights from 0 to 100.');
  const group=assessmentGroups().find(g=>g.key===x.dataset.group);
  if(!group)throw Error('Assessment group not found.');
  for(const id of group.ids.filter(id=>ids.includes(id)))
    custom[id]=n;
}const sum=[...root.querySelectorAll('.mu-weight')].reduce((a,x)=>a+Number(x.value||0),0);if(Math.abs(sum-100)>.02)throw Error('Custom percentages must total 100%. Current total: '+sum.toFixed(2)+'%.')}message('Saving configuration…');await api(`/api/merit-flex/${sid}/profile`,{method:'PUT',body:JSON.stringify({...loaded.c,selected_assessment_ids:ids,cat_group_mode:mode(),custom_weights:custom})});dirty=false;message('Configuration saved successfully. You can preview merit now.');$('muResults').innerHTML='';$('muCsv').disabled=true}
async function preview(){if(!loaded)throw Error('Load class assessments first.');if(dirty)throw Error('Save your changes before previewing.');message('Calculating merit preview…');const data=await api(`/api/merit-flex/${sid}/preview?${new URLSearchParams(loaded.c)}`);previewRows=data.rows||[];$('muResults').innerHTML=`<p class="mu-muted"><b>Preview only</b> · Complete: ${esc(data.summary?.complete||0)} · Incomplete: ${esc(data.summary?.incomplete||0)}</p><table><thead><tr><th>Rank</th><th>Learner</th><th>Admission</th><th>Average</th><th>Status</th></tr></thead><tbody>${previewRows.slice().sort((a,b)=>(a.class_rank??99999)-(b.class_rank??99999)).map(r=>`<tr><td>${esc(r.class_rank==null?'—':r.class_rank+'/'+r.class_rank_total)}</td><td>${esc([r.first_name,r.last_name].filter(Boolean).join(' '))}</td><td>${esc(r.admission_no)}</td><td>${r.average==null?'—':esc(Number(r.average).toFixed(2))+'%'}</td><td>${r.complete?'Complete':'Incomplete'}</td></tr>`).join('')}</tbody></table>`;$('muCsv').disabled=false;message('Merit preview ready. Official reports are unchanged.')}
function csv(){if(!previewRows)return;const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const lines=[['Rank','Learner','Admission','Average (%)','Status'],...previewRows.map(r=>[r.class_rank,[r.first_name,r.last_name].filter(Boolean).join(' '),r.admission_no,r.average,r.complete?'Complete':'Incomplete'])];const blob=new Blob(['\ufeff'+lines.map(r=>r.map(q).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='zelimu-flexible-merit-preview.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}

async function createCat(){
  if(!admin)
    throw Error('Only an administrator or headteacher can create CATs.');

  const c=context();
  const name=$('muCatName').value.trim().toUpperCase().replace(/\s+/g,' ');
  const max=Number($('muCatMax').value);

  if(!/^CAT [1-9][0-9]?$/.test(name))
    throw Error('Enter CAT 1, CAT 2, CAT 3, etc.');

  if(!Number.isFinite(max)||max<=0||max>1000)
    throw Error('Maximum marks must be between 1 and 1000.');

  const btn=$('muCreateCat');
  btn.disabled=true;
  $('muCatStatus').textContent='Creating '+name+' for assigned subjects…';

  try{
    const result=await api(`/api/merit-flex/${sid}/cats`,{
      method:'POST',
      body:JSON.stringify({
        ...c,
        name,
        max_mark:max
      })
    });

    $('muCatStatus').textContent=result.message||
      `${name} created successfully.`;

    await load();

    message('CAT assessment list refreshed. Select assessments and save your merit configuration.');
  }finally{
    btn.disabled=false;
  }
}

$('muCreateCat').addEventListener('click',async()=>{
  try{
    await createCat();
  }catch(e){
    $('muCatStatus').textContent='CAT creation failed: '+e.message;
  }
});

if(!admin){
  $('muCreateCat').disabled=true;
  $('muCatStatus').textContent='CAT creation requires administrator access.';
}

for(const [id,fn] of [['muLoad',load],['muSave',save],['muPreview',preview]])$(id).addEventListener('click',async()=>{try{await fn()}catch(e){message(e.message)}});$('muCsv').addEventListener('click',csv);root.querySelectorAll('input[name=muMode]').forEach(x=>x.addEventListener('change',()=>{dirty=true;drawWeights();update();message('Calculation method changed. Save before previewing.')}));['asYear','asTerm','asClass'].forEach(id=>$(id)?.addEventListener('change',reset));labels();
})();

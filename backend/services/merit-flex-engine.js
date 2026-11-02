'use strict';
function average(values){return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;}
function subjectResult(marks,ids,mode,catIds){
 const byId=new Map();for(const m of marks||[]){const id=String(m.assessment_id);if(!ids.includes(id))continue;if(byId.has(id))return {complete:false,score:null,reason:'DUPLICATE_MARK'};if(m.percent!=null&&Number.isFinite(Number(m.percent)))byId.set(id,Number(m.percent));}
 const missing=ids.filter(id=>!byId.has(id));if(missing.length)return {complete:false,score:null,reason:'MISSING_MARKS',missing};
 const main=ids.filter(id=>!catIds.includes(id)).map(id=>byId.get(id));const cats=ids.filter(id=>catIds.includes(id)).map(id=>byId.get(id));
 const parts=mode==='CAT_GROUP'?[...main,...(cats.length?[average(cats)]:[])]:[...main,...cats];
 return {complete:true,score:average(parts),reason:null};
}
function calculate(learners,subjectIds,selected,mode,catIds){
 const ids=selected.map(String),cats=catIds.map(String),out=[];
 for(const l of learners){const subjects=subjectIds.map(subject_id=>({subject_id,...subjectResult(l.marks.filter(m=>String(m.subject_id)===String(subject_id)),ids,mode,cats)}));const complete=subjects.length>0&&subjects.every(s=>s.complete);out.push({...l,marks:undefined,subjects,complete,average:complete?average(subjects.map(s=>s.score)):null,incomplete_reason:complete?null:'MISSING_SUBJECT_OR_ASSESSMENT_MARKS'});}
 const ranked=out.filter(r=>r.complete).sort((a,b)=>b.average-a.average);let last=null,rank=0;ranked.forEach((r,i)=>{if(last===null||Math.abs(r.average-last)>1e-8)rank=i+1;r.class_rank=rank;r.class_rank_total=ranked.length;last=r.average});return out.map(r=>({...r,class_rank:r.class_rank??null,class_rank_total:ranked.length}));
}
module.exports={average,subjectResult,calculate};

'use strict';
// Deterministic, bounded backtracking timetable allocator; no external services.
const days=[1,2,3,4,5];
function minutes(s){const a=String(s).split(':').map(Number);return a[0]*60+a[1]}
function hh(m){return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
function generate({requirements,settings={}}){
 const start=minutes(settings.start_time||'08:00'), duration=Number(settings.lesson_minutes||40), perDay=Number(settings.periods_per_day||8);
 const dayList=Array.isArray(settings.days)&&settings.days.length?settings.days:days;
 if(dayList.some(d=>!Number.isInteger(d)||d<1||d>7)||new Set(dayList).size!==dayList.length)throw Error('Timetable days must be unique integers between 1 and 7');
 if(!Number.isFinite(start)||!Number.isInteger(start))throw Error('Invalid timetable start time');
 if(!Number.isInteger(duration)||duration<20||duration>120||!Number.isInteger(perDay)||perDay<1||perDay>12||start<360||start+duration*perDay>1200)throw Error('Invalid timetable bell schedule');
 const blocked=new Set((settings.blocked||[]).map(x=>`${x.day}:${x.period}`));
 const unavailable=new Set((settings.teacher_unavailable||[]).map(x=>`${x.teacher_id}:${x.day}:${x.period}`));
 const slots=dayList.flatMap(day=>Array.from({length:perDay},(_,i)=>({day,period:i+1,start_time:hh(start+i*duration),end_time:hh(start+(i+1)*duration)})).filter(s=>!blocked.has(`${s.day}:${s.period}`)));
 const tasks=[];const requirementKeys=new Set();for(const r of requirements){const key=`${r.class_id}:${r.subject_id}:${r.teacher_id}`;if(requirementKeys.has(key))throw Error('Duplicate class/subject/teacher lesson requirement');requirementKeys.add(key);const n=Number(r.lessons_per_week);if(!r.class_id||!r.subject_id||!r.teacher_id||!Number.isInteger(n)||n<1||n>slots.length)throw Error('Each requirement needs a class, subject, teacher and valid lesson count');for(let i=0;i<n;i++)tasks.push({...r,sequence:i});}
 if(tasks.length>400)throw Error('Maximum 400 lessons per generation');
 const occupiedClass=new Set(),occupiedTeacher=new Set(),occupiedRoom=new Set(),subjectDay=new Map(),out=[];
 // Constrained first: teacher conflicts, larger lesson requirements, then stable IDs.
 const counts=new Map();for(const t of tasks)counts.set(t.teacher_id,(counts.get(t.teacher_id)||0)+1);
 tasks.sort((a,b)=>(counts.get(b.teacher_id)-counts.get(a.teacher_id))||(String(a.class_id).localeCompare(String(b.class_id)))||(String(a.subject_id).localeCompare(String(b.subject_id))));
 let attempts=0;const limit=120000;
 function place(i){if(i===tasks.length)return true;if(++attempts>limit)return false;const t=tasks[i];const choices=slots.filter(s=>!occupiedClass.has(`${t.class_id}:${s.day}:${s.period}`)&&!occupiedTeacher.has(`${t.teacher_id}:${s.day}:${s.period}`)&&(!t.room||!occupiedRoom.has(`${t.room}:${s.day}:${s.period}`))&&!unavailable.has(`${t.teacher_id}:${s.day}:${s.period}`));
 choices.sort((a,b)=>(subjectDay.get(`${t.class_id}:${t.subject_id}:${a.day}`)||0)-(subjectDay.get(`${t.class_id}:${t.subject_id}:${b.day}`)||0)||a.period-b.period||a.day-b.day);
 for(const s of choices){const ck=`${t.class_id}:${s.day}:${s.period}`,tk=`${t.teacher_id}:${s.day}:${s.period}`,rk=`${t.room}:${s.day}:${s.period}`,dk=`${t.class_id}:${t.subject_id}:${s.day}`;occupiedClass.add(ck);occupiedTeacher.add(tk);if(t.room)occupiedRoom.add(rk);subjectDay.set(dk,(subjectDay.get(dk)||0)+1);out.push({...s,class_id:t.class_id,subject_id:t.subject_id,teacher_id:t.teacher_id,room:t.room||''});if(place(i+1))return true;out.pop();occupiedClass.delete(ck);occupiedTeacher.delete(tk);if(t.room)occupiedRoom.delete(rk);subjectDay.set(dk,subjectDay.get(dk)-1)}return false}
 const complete=place(0);return {complete,scheduled:complete?out.sort((a,b)=>a.day-b.day||a.period-b.period||String(a.class_id).localeCompare(String(b.class_id))):[],required:tasks.length,attempts,reason:complete?null:'No conflict-free schedule found within search limit; adjust lessons, teacher availability or periods.'};
}
module.exports={generate};

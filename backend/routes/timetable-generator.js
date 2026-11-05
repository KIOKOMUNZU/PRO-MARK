'use strict';
const express=require('express');const db=require('../db');const {authenticate,roles,schoolBoundary}=require('../middleware/auth');const {generate}=require('../services/timetable-generator');
const router=express.Router();router.use(authenticate);
const admin=roles('PLATFORM_OWNER','SCHOOL_ADMIN','ADMIN','HEADTEACHER','DEPUTY_HEADTEACHER');
router.post('/:schoolId/generate',schoolBoundary,admin,async(req,res)=>{
 const sid=req.params.schoolId,b=req.body||{};
 try{
  const payload={
   ...b,
   requirements:Array.isArray(b.requirements)?b.requirements:(Array.isArray(b.lessons)?b.lessons:[]),
   settings:{
    ...(b.settings||{}),
    start_time:b.start_time ?? (b.settings&&b.settings.start_time) ?? '08:00',
    lesson_minutes:b.lesson_minutes ?? (b.settings&&b.settings.lesson_minutes) ?? 40,
    periods_per_day:b.periods_per_day ?? (b.settings&&b.settings.periods_per_day) ?? 8,
    days:b.days ?? (b.settings&&b.settings.days) ?? [1,2,3,4,5],
    blocked:b.blocked ?? (b.settings&&b.settings.blocked) ?? [],
    teacher_unavailable:b.teacher_unavailable ?? (b.settings&&b.settings.teacher_unavailable) ?? []
   }
  };
  if(!Array.isArray(payload.requirements)||!payload.requirements.length||payload.requirements.length>100)return res.status(400).json({error:'Provide 1–100 class/subject/teacher lesson requirements.'});
  const ids=(key)=>[...new Set(payload.requirements.map(r=>r[key]).filter(Boolean))];
  for(const [key,table] of [['class_id','classes'],['subject_id','subjects'],['teacher_id','teachers']]){
   const values=ids(key);const found=await db.query(`SELECT id FROM ${table} WHERE school_id=$1 AND id=ANY($2::uuid[])`,[sid,values]);if(found.rows.length!==values.length)return res.status(403).json({error:`Invalid or other-school ${key}`});
  }
  if(b.academic_year_id){const x=await db.query('SELECT id FROM academic_years WHERE school_id=$1 AND id=$2',[sid,b.academic_year_id]);if(!x.rowCount)throw Error('Academic year does not belong to school')}
  if(b.term_id){const x=await db.query('SELECT id FROM terms WHERE school_id=$1 AND id=$2',[sid,b.term_id]);if(!x.rowCount)throw Error('Term does not belong to school')}
  const result=generate(payload);if(!result.complete)return res.status(422).json(result);
  if(!b.save)return res.json({...result,preview:true});
  // School-scoped advisory transaction lock prevents two simultaneous generators racing.
  const client=await db.pool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[sid+':timetable']);
   const existing=await client.query('SELECT count(*)::int n FROM timetable_entries WHERE school_id=$1 AND academic_year_id IS NOT DISTINCT FROM $2::uuid AND term_id IS NOT DISTINCT FROM $3::uuid',[sid,b.academic_year_id||null,b.term_id||null]);
   if(existing.rows[0].n&&!b.replace){await client.query('ROLLBACK');return res.status(409).json({error:'Timetable already has entries for this year/term. Enable replace to regenerate.'})}
   if(b.replace)await client.query('DELETE FROM timetable_entries WHERE school_id=$1 AND academic_year_id IS NOT DISTINCT FROM $2::uuid AND term_id IS NOT DISTINCT FROM $3::uuid',[sid,b.academic_year_id||null,b.term_id||null]);
   for(const x of result.scheduled)await client.query('INSERT INTO timetable_entries(school_id,academic_year_id,term_id,class_id,subject_id,teacher_id,day_of_week,start_time,end_time,room,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[sid,b.academic_year_id||null,b.term_id||null,x.class_id,x.subject_id,x.teacher_id,x.day,x.start_time,x.end_time,x.room,'Generated automatically']);
   await client.query('COMMIT');res.status(201).json({...result,saved:true});
  }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e}finally{client.release()}
 }catch(e){res.status(400).json({error:e.message})}
});module.exports=router;

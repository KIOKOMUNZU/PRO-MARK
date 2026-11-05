'use strict';
const express=require('express');
const db=require('../db');
const {authenticate,roles,schoolBoundary}=require('../middleware/auth');
const router=express.Router();
router.use(authenticate);
const admin=roles('PLATFORM_OWNER','SCHOOL_ADMIN','ADMIN','HEADTEACHER','DEPUTY_HEADTEACHER');
const reader=roles('PLATFORM_OWNER','SCHOOL_ADMIN','ADMIN','HEADTEACHER','DEPUTY_HEADTEACHER','SENIOR_TEACHER');
const parseJson=(value)=>{
  if(value===undefined||value===null||value==='')return null;
  if(typeof value==='string'){
    try{return JSON.parse(value);}catch{return value;}
  }
  return value;
};
router.get('/:schoolId/config',schoolBoundary,reader,async(req,res)=>{
  try{
    const q=await db.query(`SELECT * FROM timetable_configurations WHERE school_id=$1 ORDER BY is_active DESC, created_at DESC`,[req.params.schoolId]);
    res.json(q.rows);
  }catch(e){res.status(400).json({error:e.message});}
});
router.post('/:schoolId/config',schoolBoundary,admin,async(req,res)=>{
  try{
    const sid=req.params.schoolId;
    const b=req.body||{};
    if(!b.name)throw Error('Timetable configuration name is required');
    const teachingDays=Array.isArray(b.teaching_days)?b.teaching_days:((Array.isArray(parseJson(b.teaching_days))?parseJson(b.teaching_days):[1,2,3,4,5]));
    const periodsPerDay=Number(b.periods_per_day||b.lessons_per_day||8);
    if(!Number.isInteger(periodsPerDay)||periodsPerDay<1||periodsPerDay>12)throw Error('Periods per day must be between 1 and 12');
    const q=await db.query(`INSERT INTO timetable_configurations(school_id,academic_year_id,term_id,name,description,effective_start_date,effective_end_date,teaching_days,periods_per_day,period_start_times,period_end_times,break_periods,lunch_periods,is_active)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14)
      RETURNING *`,[
      sid,
      b.academic_year_id||null,
      b.term_id||null,
      b.name,
      b.description||'',
      b.effective_start_date||null,
      b.effective_end_date||null,
      JSON.stringify(teachingDays),
      periodsPerDay,
      JSON.stringify(parseJson(b.period_start_times)||[]),
      JSON.stringify(parseJson(b.period_end_times)||[]),
      JSON.stringify(parseJson(b.break_periods)||[]),
      JSON.stringify(parseJson(b.lunch_periods)||[]),
      b.is_active!==false
    ]);
    res.status(201).json(q.rows[0]);
  }catch(e){res.status(400).json({error:e.message});}
});
router.get('/:schoolId/requirements',schoolBoundary,reader,async(req,res)=>{
  try{
    const q=await db.query(`SELECT tr.*,c.name class_name,s.name subject_name,te.first_name teacher_first_name,te.last_name teacher_last_name
      FROM timetable_requirements tr
      JOIN classes c ON c.id=tr.class_id
      JOIN subjects s ON s.id=tr.subject_id
      LEFT JOIN teachers te ON te.id=tr.teacher_id
      WHERE tr.school_id=$1 ORDER BY c.name,s.name`,[req.params.schoolId]);
    res.json(q.rows);
  }catch(e){res.status(400).json({error:e.message});}
});
router.post('/:schoolId/requirements',schoolBoundary,admin,async(req,res)=>{
  try{
    const sid=req.params.schoolId;
    const b=req.body||{};
    if(!b.class_id||!b.subject_id||!b.teacher_id)throw Error('Class, subject and teacher are required');
    if(!Number.isInteger(Number(b.lessons_per_week))||Number(b.lessons_per_week)<1||Number(b.lessons_per_week)>30)throw Error('Lessons per week must be between 1 and 30');
    const q=await db.query(`INSERT INTO timetable_requirements(school_id,academic_year_id,term_id,class_id,subject_id,teacher_id,lessons_per_week,preferred_day,preferred_period,room_requirement,notes)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *`,[
      sid,
      b.academic_year_id||null,
      b.term_id||null,
      b.class_id,
      b.subject_id,
      b.teacher_id,
      Number(b.lessons_per_week),
      b.preferred_day!==undefined&&b.preferred_day!==null?Number(b.preferred_day):null,
      b.preferred_period!==undefined&&b.preferred_period!==null?Number(b.preferred_period):null,
      b.room_requirement||'',
      b.notes||''
    ]);
    res.status(201).json(q.rows[0]);
  }catch(e){res.status(400).json({error:e.message});}
});
module.exports=router;

const express=require('express');
const crypto=require('crypto');
const db=require('../db');
const {authenticate,roles,schoolBoundary}=require('../middleware/auth');
const router=express.Router();
router.use(authenticate);
const FINANCE_ROLES=['SCHOOL_ADMIN','ADMIN'];
const money=n=>Math.round((Number(n)||0)*100)/100;

const validDate=value=>{
 if(value===undefined||value===null||value==='')return true;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))return false;
 const d=new Date(String(value)+'T00:00:00Z');
 return !Number.isNaN(d.getTime()) &&
        d.toISOString().slice(0,10)===String(value);
};
const validMoney=value=>
 Number.isFinite(Number(value)) &&
 Number(value)>0 &&
 Math.round(Number(value)*100)/100===Number(value);


router.get('/:schoolId/overview',schoolBoundary,roles(...FINANCE_ROLES,'HEADTEACHER','DEPUTY_HEADTEACHER','SENIOR_TEACHER'),async(req,res)=>{
 try{
  const sid=req.params.schoolId;
  const [structures,learners,charges,payments,summary]=await Promise.all([
   db.query(`SELECT fs.*,ay.year_label,c.name class_name,c.stream FROM school_fee_structures fs LEFT JOIN academic_years ay ON ay.id=fs.academic_year_id LEFT JOIN classes c ON c.id=fs.class_id WHERE fs.school_id=$1 ORDER BY fs.is_active DESC,fs.created_at DESC`,[sid]),
   db.query(`SELECT l.id,l.admission_no,l.first_name,l.middle_name,l.last_name,l.class_id,c.name class_name,c.stream FROM learners l LEFT JOIN classes c ON c.id=l.class_id WHERE l.school_id=$1 AND COALESCE(l.is_active,true)=true ORDER BY c.name,c.stream,l.last_name,l.first_name`,[sid]),
   db.query(`SELECT ch.id,ch.learner_id,ch.description,ch.amount,ch.due_on,ch.created_at,l.admission_no,l.first_name,l.middle_name,l.last_name,c.name class_name,c.stream,COALESCE((SELECT sum(a.amount) FROM school_fee_payment_allocations a JOIN school_fee_payments p ON p.id=a.payment_id AND p.status='CONFIRMED' WHERE a.charge_id=ch.id),0) amount_paid FROM school_fee_charges ch JOIN learners l ON l.id=ch.learner_id LEFT JOIN classes c ON c.id=l.class_id WHERE ch.school_id=$1 ORDER BY ch.due_on NULLS LAST,ch.created_at DESC LIMIT 500`,[sid]),
   db.query(`SELECT p.*,l.admission_no,l.first_name,l.middle_name,l.last_name FROM school_fee_payments p JOIN learners l ON l.id=p.learner_id WHERE p.school_id=$1 ORDER BY p.payment_date DESC,p.created_at DESC LIMIT 100`,[sid]),
   db.query(`SELECT COALESCE((SELECT sum(amount) FROM school_fee_charges WHERE school_id=$1),0) charged, COALESCE((SELECT sum(p.amount) FROM school_fee_payments p WHERE p.school_id=$1 AND p.status='CONFIRMED'),0) collected, COALESCE((SELECT sum(ch.amount-COALESCE((SELECT sum(a.amount) FROM school_fee_payment_allocations a JOIN school_fee_payments p ON p.id=a.payment_id AND p.status='CONFIRMED' WHERE a.charge_id=ch.id),0)) FROM school_fee_charges ch WHERE ch.school_id=$1),0) outstanding`,[sid])
  ]);
  res.json({structures:structures.rows,learners:learners.rows,charges:charges.rows.map(x=>({...x,amount_paid:money(x.amount_paid),balance:money(Number(x.amount)-Number(x.amount_paid))})),payments:payments.rows,summary:summary.rows[0]});
 }catch(e){console.error('School finance overview failed:',e);res.status(500).json({error:'Unable to load school finance records. Apply database migration 028_school_finance_core.sql if it has not been applied.'});}
});

router.post('/:schoolId/structures',schoolBoundary,roles(...FINANCE_ROLES),async(req,res)=>{
 try{
  const sid=req.params.schoolId,b=req.body||{};
  const name=String(b.name||'').trim(),amount=Number(b.amount);
  if(!name||!validMoney(b.amount))return res.status(400).json({error:'Fee name and an amount greater than zero are required.'});
  if(!validDate(b.due_on))
    return res.status(400).json({error:'Invalid fee due date.'});
  const currency=String(b.currency||'KES').trim().toUpperCase();if(currency!=='KES')return res.status(400).json({error:'This first school-finance release supports KES only so payments cannot be allocated across different currencies.'});
  if(b.academic_year_id){const q=await db.query('SELECT 1 FROM academic_years WHERE id=$1 AND school_id=$2',[b.academic_year_id,sid]);if(!q.rowCount)return res.status(400).json({error:'Academic year does not belong to this school.'});}
  if(b.class_id){const q=await db.query('SELECT 1 FROM classes WHERE id=$1 AND school_id=$2',[b.class_id,sid]);if(!q.rowCount)return res.status(400).json({error:'Class does not belong to this school.'});}
  const q=await db.query(`INSERT INTO school_fee_structures(school_id,name,academic_year_id,class_id,amount,currency,due_on,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[sid,name,b.academic_year_id||null,b.class_id||null,money(amount),currency,b.due_on||null,req.user.user_id]);
  await db.query(`INSERT INTO audit_log(school_id,user_id,action,entity_type,entity_id,details) VALUES($1,$2,'SCHOOL_FEE_STRUCTURE_CREATED','school_fee_structure',$3,$4::jsonb)`,[sid,req.user.user_id,q.rows[0].id,JSON.stringify({name,amount,currency,class_id:b.class_id||null,academic_year_id:b.academic_year_id||null})]).catch(()=>{});
  res.status(201).json(q.rows[0]);
 }catch(e){console.error('Create fee structure failed:',e);res.status(400).json({error:'Could not create fee structure. Ensure migration 028_school_finance_core.sql has been applied.'});}
});

router.post('/:schoolId/structures/:structureId/assign',schoolBoundary,roles(...FINANCE_ROLES),async(req,res)=>{
 const sid=req.params.schoolId,c=await db.pool.connect();
 try{
  await c.query('BEGIN');
  const f=(await c.query('SELECT * FROM school_fee_structures WHERE id=$1 AND school_id=$2 AND is_active=true FOR UPDATE',[req.params.structureId,sid])).rows[0];
  if(!f)throw Object.assign(new Error('Active fee structure not found.'),{status:404});
  if(!f.class_id)throw Object.assign(new Error('Choose a class on this fee structure before assigning it to learners.'),{status:400});
  const learners=(await c.query(`SELECT id FROM learners WHERE school_id=$1 AND class_id=$2 AND COALESCE(is_active,true)=true ORDER BY admission_no`,[sid,f.class_id])).rows;
  let created=0;
  for(const l of learners){const r=await c.query(`INSERT INTO school_fee_charges(school_id,learner_id,fee_structure_id,description,amount,due_on,academic_year_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(school_id,learner_id,fee_structure_id) DO NOTHING`,[sid,l.id,f.id,f.name,f.amount,f.due_on,f.academic_year_id,req.user.user_id]);created+=r.rowCount;}
  await c.query('COMMIT');res.status(201).json({assigned:created,already_assigned:learners.length-created,total_learners:learners.length});
 }catch(e){await c.query('ROLLBACK').catch(()=>{});res.status(e.status||400).json({error:e.message||'Unable to assign fee structure.'});}finally{c.release();}
});

router.post('/:schoolId/payments',schoolBoundary,roles(...FINANCE_ROLES),async(req,res)=>{
 const sid=req.params.schoolId,b=req.body||{},amount=Number(b.amount),c=await db.pool.connect();
 try{
  if(!b.learner_id||!validMoney(b.amount))throw Object.assign(new Error('Learner and payment amount greater than zero are required.'),{status:400});
  if(!validDate(b.payment_date))
    throw Object.assign(new Error('Invalid payment date.'),{status:400});
  const method=String(b.payment_method||'CASH').toUpperCase();
  if(!['CASH','MPESA','BANK','CHEQUE'].includes(method))
    throw Object.assign(new Error('Unsupported payment method.'),{status:400});
  const learner=(await c.query('SELECT id FROM learners WHERE id=$1 AND school_id=$2',[b.learner_id,sid])).rows[0];if(!learner)throw Object.assign(new Error('Learner does not belong to this school.'),{status:400});
  const currency=String(b.currency||'KES').toUpperCase();if(currency!=='KES')throw Object.assign(new Error('This first school-finance release supports KES only.'),{status:400});
  const receipt=`ZFC-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  await c.query('BEGIN');
  const payment=(await c.query(`INSERT INTO school_fee_payments(school_id,learner_id,receipt_no,amount,currency,payment_method,reference,payment_date,notes,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7,COALESCE($8::date,CURRENT_DATE),$9,$10) RETURNING *`,[sid,b.learner_id,receipt,money(amount),currency,String(b.payment_method||'CASH').toUpperCase(),String(b.reference||'').trim(),b.payment_date||null,String(b.notes||''),req.user.user_id])).rows[0];
  let remaining=money(amount),allocated=0;
  const charges=(await c.query(`SELECT ch.id,ch.amount-COALESCE((SELECT sum(a.amount) FROM school_fee_payment_allocations a JOIN school_fee_payments p ON p.id=a.payment_id AND p.status='CONFIRMED' WHERE a.charge_id=ch.id),0) balance FROM school_fee_charges ch WHERE ch.school_id=$1 AND ch.learner_id=$2 AND ch.amount>COALESCE((SELECT sum(a.amount) FROM school_fee_payment_allocations a JOIN school_fee_payments p ON p.id=a.payment_id AND p.status='CONFIRMED' WHERE a.charge_id=ch.id),0) ORDER BY ch.due_on NULLS LAST,ch.created_at,ch.id FOR UPDATE`,[sid,b.learner_id])).rows;
  for(const ch of charges){if(remaining<=0)break;const part=money(Math.min(remaining,Number(ch.balance)));if(part<=0)continue;await c.query(`INSERT INTO school_fee_payment_allocations(school_id,payment_id,charge_id,amount) VALUES($1,$2,$3,$4)`,[sid,payment.id,ch.id,part]);remaining=money(remaining-part);allocated=money(allocated+part);}
  await c.query(`INSERT INTO audit_log(school_id,user_id,action,entity_type,entity_id,details) VALUES($1,$2,'SCHOOL_FEE_PAYMENT_RECORDED','school_fee_payment',$3,$4::jsonb)`,[sid,req.user.user_id,payment.id,JSON.stringify({receipt_no:receipt,amount:money(amount),currency,learner_id:b.learner_id,allocated,unallocated:remaining})]);
  await c.query('COMMIT');res.status(201).json({payment,allocated,unallocated:remaining});
 }catch(e){await c.query('ROLLBACK').catch(()=>{});res.status(e.status||400).json({error:e.message||'Unable to record payment.'});}finally{c.release();}
});

module.exports=router;

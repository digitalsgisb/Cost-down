import { defaultCatalog } from './catalog.js';

export const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const monthFields=months.map(m=>'actual'+m);
export function savingMonthActive(row,index){
 if(!row.start||!row.savingYear)return false;
 const month=`${row.savingYear}-${String(index+1).padStart(2,'0')}`;
 return /^\d{4}-\d{2}-\d{2}$/.test(row.start)&&row.start.slice(0,7)<=month;
}
export const savingMonthCount=row=>months.filter((_,index)=>savingMonthActive(row,index)).length;
export function plannedSavingForMonth(row,index){
 if(!savingMonthActive(row,index))return 0;
 if(row.planFrequency==='Yearly'){
  const first=months.findIndex((_,i)=>savingMonthActive(row,i));
  return index===first?Number(row.planAnnual||0):0;
 }
 return Number(row.planMonthly||0);
}
export function monthlySavings(row){
 const monthly=row.savingYear!==''&&row.savingYear!=null;
 const plan=monthly?Math.round(months.reduce((sum,_,index)=>sum+plannedSavingForMonth(row,index),0)*100)/100:Number(row.plan||0);
 const actual=monthly?Math.round(monthFields.reduce((sum,key,index)=>sum+(savingMonthActive(row,index)?Number(row[key]||0):0),0)*100)/100:Number(row.reported||0);
 // Retain legacy workbook columns as derived mirrors, never separate approvals.
 return {...row,plan,reported:actual,verified:actual,hod:'Approved',finance:'Verified',gap:actual-plan,achievement:plan?actual/plan*100:0};
}
export const fields = ['id','department','item','category','pic','priority','status','start','target','plan','reported','verified','gap','achievement','progress','hod','finance','updated','next','evidence','image','area','planMonthly','savingYear',...monthFields,'planFrequency','planAnnual'];
export const statuses = ['Not Started','In Progress','At Risk','On Hold','Completed'];
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
export const overdue = (r, day=today()) => !!r.target && r.target < day && r.status !== 'Completed';
export const fingerprint = r => JSON.stringify(fields.filter(k=>!['gap','achievement','verified','hod','finance'].includes(k)).map(k=>r[k]??''));
export function validate(r,catalog=defaultCatalog) {
 const errors=[];
 if(r.planFrequency&&!['Monthly','Yearly'].includes(r.planFrequency))errors.push('Select Monthly or Yearly for plan frequency.');
 if(r.planFrequency==='Yearly'&&(typeof r.planAnnual!=='number'||!Number.isFinite(r.planAnnual)||r.planAnnual<0))errors.push('Yearly planned saving must be a non-negative amount.');
 if(r.savingYear!==''&&r.savingYear!=null){
  if(!r.start)errors.push('Start Date is required to calculate savings from the project start month.');
  if(!Number.isInteger(Number(r.savingYear))||Number(r.savingYear)<2000||Number(r.savingYear)>2100)errors.push('Reporting year must be between 2000 and 2100.');
  for(const key of ['planMonthly',...monthFields])if(r[key]!==''&&r[key]!=null&&(typeof r[key]!=='number'||!Number.isFinite(r[key])||r[key]<0))errors.push(`${key} must be a non-negative amount.`);
 }

 for(const k of ['id','item','pic']) if(typeof r[k]!=='string'||!r[k].trim()) errors.push(`${k} is required.`);
 if(!/^[A-Za-z0-9_-]{1,64}$/.test(r.id||'')) errors.push('ID must use letters, numbers, underscores or hyphens (max 64).');
 if(!catalog.departments.some(d=>d.name===r.department)) errors.push('Select a valid department.');
 if(!statuses.includes(r.status)||!['High','Medium','Low'].includes(r.priority)) errors.push('Invalid status or priority.');
 for(const k of ['plan','reported','verified','progress']) if(typeof r[k]!=='number'||!Number.isFinite(r[k])||r[k]<0) errors.push(`${k} must be a non-negative number.`);
 if(r.progress>100) errors.push('Progress cannot exceed 100%.');
 if(r.status==='Completed'&&r.progress!==100) errors.push('Completed activities require 100% progress.');
 for(const k of ['start','target']) if(r[k]&&(!/^\d{4}-\d{2}-\d{2}$/.test(r[k])||Number.isNaN(Date.parse(r[k]))||new Date(r[k]).toISOString().slice(0,10)!==r[k])) errors.push(`Invalid ${k} date.`);
 if(r.start&&r.target&&r.start>r.target) errors.push('Target date must follow the start date.');
 if(r.evidence) { try { if(new URL(r.evidence).protocol!=='https:') throw Error(); } catch { errors.push('Evidence must be an HTTPS URL.'); } }
 if(r.image&&!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(r.image)) errors.push('Invalid activity image. Attach a JPEG, PNG or WebP file.');
 for(const k of fields) if(typeof r[k]==='string'&&r[k].length>(k==='image'?45000:4000)) errors.push(`${k} is too long.`);
 return errors;
}

export const assignedDepartments = user => user?.departments || (user?.department ? [user.department] : []);

// Historical demo/template records remain readable; rules apply when saving.
export function authorize(user, next, previous) {
 const deny=()=>{throw Object.assign(Error('Your assigned role cannot make this change.'),{status:403});};
 if(!previous) {
  if(!['PIC','Admin'].includes(user.role)) deny();
  if(user.role==='PIC'&&(next.pic!==user.pic||!assignedDepartments(user).includes(next.department))) deny();
  return;
 }
 if(next.id!==previous.id) deny();
 const changed=fields.filter(k=>!['gap','achievement','updated','verified','hod','finance'].includes(k)&&next[k]!==previous[k]);
 if(user.role==='Admin') return;
 if(user.role==='PIC') {
  if(next.department!==previous.department||previous.pic!==user.pic||!assignedDepartments(user).includes(previous.department)||next.pic!==user.pic||!assignedDepartments(user).includes(next.department)) deny();
 } else deny();
}


export const departmentCodes={'Prod RF':'RF','Prod Conv':'CV','Quality Mgmt':'QM','RnD':'RD','Mat Mgmt':'MM','Maintenance':'MT','DTU':'DT','OIS':'OS'};
export function nextActivityId(rows,department,day=today(),catalog=defaultCatalog){
 const code=catalog.departments.find(d=>d.name===department)?.code;
 if(!code)throw Object.assign(Error('Select a valid department.'),{status:400});
 const prefix=day.slice(2,4)+day.slice(5,7)+code;
 const suffixes=rows.map(r=>String(r.id||'')).filter(id=>id.startsWith(prefix)&&/^\d+$/.test(id.slice(prefix.length))).map(id=>Number(id.slice(prefix.length)));
 const next=Math.max(0,...suffixes)+1;
 return prefix+String(next).padStart(2,'0');
}

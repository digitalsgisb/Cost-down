import { defaultCatalog } from './catalog.js';

export const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const monthFields=months.map(m=>'actual'+m);
export function savingMonthActive(row,index){
 if(!row.start||!row.savingYear)return false;
 const month=`${row.savingYear}-${String(index+1).padStart(2,'0')}`;
 return /^\d{4}-\d{2}-\d{2}$/.test(row.start)&&row.start.slice(0,7)<=month;
}
export const savingMonthCount=row=>months.filter((_,index)=>savingMonthActive(row,index)).length;
export function monthlySavings(row){
 if(row.savingYear===''||row.savingYear==null)return row;
 return {...row,plan:Math.round(Number(row.planMonthly)*savingMonthCount(row)*100)/100,reported:Math.round(monthFields.reduce((sum,key,index)=>sum+(savingMonthActive(row,index)?Number(row[key]||0):0),0)*100)/100};
}
export const fields = ['id','department','item','category','pic','priority','status','start','target','plan','reported','verified','gap','achievement','progress','hod','finance','updated','next','evidence','image','area','planMonthly','savingYear',...monthFields];
export const statuses = ['Not Started','In Progress','At Risk','On Hold','Completed'];
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
export const overdue = (r, day=today()) => !!r.target && r.target < day && r.status !== 'Completed';
export const fingerprint = r => JSON.stringify(fields.filter(k=>!['gap','achievement'].includes(k)).map(k=>r[k]??''));
export function validate(r,catalog=defaultCatalog) {
 const errors=[];
 if(r.savingYear!==''&&r.savingYear!=null){
  if(!r.start)errors.push('Start Date is required to calculate savings from the project start month.');
  if(!Number.isInteger(Number(r.savingYear))||Number(r.savingYear)<2000||Number(r.savingYear)>2100)errors.push('Reporting year must be between 2000 and 2100.');
  for(const key of ['planMonthly',...monthFields])if(r[key]!==''&&r[key]!=null&&(typeof r[key]!=='number'||!Number.isFinite(r[key])||r[key]<0))errors.push(`${key} must be a non-negative amount.`);
 }

 for(const k of ['id','item','pic']) if(typeof r[k]!=='string'||!r[k].trim()) errors.push(`${k} is required.`);
 if(!/^[A-Za-z0-9_-]{1,64}$/.test(r.id||'')) errors.push('ID must use letters, numbers, underscores or hyphens (max 64).');
 if(!catalog.departments.some(d=>d.name===r.department)) errors.push('Select a valid department.');
 if(!statuses.includes(r.status)||!['High','Medium','Low'].includes(r.priority)) errors.push('Invalid status or priority.');
 if(!['Pending','Approved','Rejected'].includes(r.hod)||!['Pending','Verified','Rejected'].includes(r.finance)) errors.push('Invalid approval.');
 for(const k of ['plan','reported','verified','progress']) if(typeof r[k]!=='number'||!Number.isFinite(r[k])||r[k]<0) errors.push(`${k} must be a non-negative number.`);
 if(r.progress>100) errors.push('Progress cannot exceed 100%.');
 if(r.status==='Completed'&&r.progress!==100) errors.push('Completed activities require 100% progress.');
 for(const k of ['start','target']) if(r[k]&&(!/^\d{4}-\d{2}-\d{2}$/.test(r[k])||Number.isNaN(Date.parse(r[k]))||new Date(r[k]).toISOString().slice(0,10)!==r[k])) errors.push(`Invalid ${k} date.`);
 if(r.start&&r.target&&r.start>r.target) errors.push('Target date must follow the start date.');
 if(r.evidence) { try { if(new URL(r.evidence).protocol!=='https:') throw Error(); } catch { errors.push('Evidence must be an HTTPS URL.'); } }
 if(r.image&&!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(r.image)) errors.push('Invalid activity image. Attach a JPEG, PNG or WebP file.');
 if(r.finance==='Verified'&&r.hod!=='Approved') errors.push('HOD approval is required before Finance verification.');
 if(r.finance==='Verified'&&!r.evidence) errors.push('Evidence is required before Finance verification.');
 for(const k of fields) if(typeof r[k]==='string'&&r[k].length>(k==='image'?45000:4000)) errors.push(`${k} is too long.`);
 return errors;
}

export const assignedDepartments = user => user?.departments || (user?.department ? [user.department] : []);

// Historical demo/template records remain readable; rules apply when saving.
export function authorize(user, next, previous) {
 const deny=()=>{throw Object.assign(Error('Your assigned role cannot make this change.'),{status:403});};
 if(!previous) {
  if(!['PIC','Admin'].includes(user.role)||next.hod!=='Pending'||next.finance!=='Pending'||next.verified!==0) deny();
  if(user.role==='PIC'&&(next.pic!==user.pic||!assignedDepartments(user).includes(next.department))) deny();
  return;
 }
 if(next.id!==previous.id) deny();
 const changed=fields.filter(k=>!['gap','achievement','updated'].includes(k)&&next[k]!==previous[k]);
 if(user.role==='Admin') {
  if(changed.some(k=>['verified','hod','finance'].includes(k))) deny();
 } else if(user.role==='PIC') {
  if(next.department!==previous.department||previous.pic!==user.pic||!assignedDepartments(user).includes(previous.department)||next.pic!==user.pic||!assignedDepartments(user).includes(next.department)||changed.some(k=>['verified','hod','finance'].includes(k))) deny();
 } else if(user.role==='HOD') {
  if(!assignedDepartments(user).includes(previous.department)||changed.some(k=>k!=='hod'&&k!=='next')) deny();
 } else if(user.role==='Finance') {
  if(changed.some(k=>!['verified','finance','next'].includes(k))) deny();
 } else deny();
}

export function resetApprovals(next, previous, role) {
 if(previous&&['PIC','Admin'].includes(role)&&fields.some(k=>!['updated','gap','achievement','_row'].includes(k)&&next[k]!==previous[k])) return {...next,hod:'Pending',finance:'Pending',verified:0};
 if(previous&&role==='HOD'&&next.hod!=='Approved') return {...next,finance:'Pending',verified:0};
 return next;
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

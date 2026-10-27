import { fields, fingerprint, months, monthFields, monthlySavings } from '../src/domain.js';
const dates=new Set(['start','target','updated']);
const numbers=new Set(['plan','reported','verified','progress']);
const epoch=Date.UTC(1899,11,30);
export const fromSerial=v=>typeof v==='number'?new Date(epoch+v*86400000).toISOString().slice(0,10):v||'';
export const toSerial=v=>v?Math.round((Date.parse(`${v}T00:00:00Z`)-epoch)/86400000):'';
export const headers=['Activity ID','Department','Initiative / Cost Down Item','Category','PIC','Priority','Status','Start Date','Target Date','Plan Saving (RM)','PIC Actual (RM)','Finance Verified (RM)','Saving Gap (RM)','Achievement %','Progress %','HOD Approval','Finance Approval','Last Update','Issue / Next Action','Evidence Link'];

export class SheetsDatabase {
 constructor(request,spreadsheetId){this.request=request;this.base=`/spreadsheets/${encodeURIComponent(spreadsheetId)}`;}
 async read(){
  const data=await this.request(`${this.base}/values/${encodeURIComponent("'Activities'!A4:AL204")}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`);
  const [head,...values]=data.values||[];
  if(!head||headers.some((h,i)=>head[i]!==h)) throw Object.assign(Error('Activities sheet headers do not match the database template (A4:T4).'),{status:409});
  if((head[20]&&head[20]!=='Activity Image')||(!head[20]&&values.some(row=>row[20])))throw Object.assign(Error('Column U is already used. Reserve U for Activity Image before attaching pictures.'),{status:409});
  if((head[21]&&head[21]!=='Area')||(!head[21]&&values.some(row=>row[21])))throw Object.assign(Error('Column V is already used. Reserve V for Area before saving.'),{status:409});
  const extra=['Planned Saving Monthly (RM)','Reporting Year',...months.map(m=>m+' Actual Saving (RM)'),'Plan Frequency','Planned Saving Yearly (RM)'];
  extra.forEach((title,i)=>{if((head[22+i]&&head[22+i]!==title)||(!head[22+i]&&values.some(row=>row[22+i]!==undefined&&row[22+i]!=='')))throw Object.assign(Error('Savings columns W:AL are already used. Check the sheet headers.'),{status:409});});
  const rows=values.map((row,i)=>({...Object.fromEntries(fields.map((k,j)=>[k,dates.has(k)?fromSerial(row[j]):numbers.has(k)?Number(row[j])||0:['planMonthly','planAnnual','savingYear',...monthFields].includes(k)?(row[j]==null||row[j]===''?'':Number(row[j])):row[j]??''])),_row:i+5})).filter(r=>r.id).map(monthlySavings);
  if(new Set(rows.map(r=>r.id)).size!==rows.length) throw Object.assign(Error('Duplicate activity IDs in Google Sheets. Correct them before saving.'),{status:409});
  return rows;
 }
 async save(next,previous,version){
  next=monthlySavings(next);
  const rows=await this.read();const current=rows.find(r=>r.id===next.id);
  if(previous&&(!current||fingerprint(current)!==version)) throw Object.assign(Error('Activity changed in Google Sheets. Refresh and review before saving.'),{status:409});
  if(!previous&&current) throw Object.assign(Error('Activity ID already exists.'),{status:409});
  const row=current?._row??Math.max(4,...rows.map(r=>r._row))+1;
  if(row>204) throw Object.assign(Error('Template capacity reached: 200 activities.'),{status:409});
  const value=k=>dates.has(k)?toSerial(next[k]):next[k]??'';
  // RAW treats all user strings as literal text. M:N are omitted entirely.
  await this.request(`${this.base}/values:batchUpdate`,'POST',{valueInputOption:'RAW',data:[
   {range:`'Activities'!A${row}:L${row}`,values:[fields.slice(0,12).map(value)]},
   {range:`'Activities'!O${row}:AL${row}`,values:[fields.slice(14).map(value)]},
   {range:"'Activities'!U4:AL4",values:[['Activity Image','Area','Planned Saving Monthly (RM)','Reporting Year',...months.map(m=>m+' Actual Saving (RM)'),'Plan Frequency','Planned Saving Yearly (RM)']]}
  ]});
  return {...Object.fromEntries(fields.map(k=>[k,next[k]??''])),_row:row};
 }
}

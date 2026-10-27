import {defaultCatalog} from '../src/catalog.js';
import {updateCatalog} from '../server/catalog.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { monthlySavings,savingMonthCount,savingMonthActive,plannedSavingForMonth,monthFields,nextActivityId,departmentCodes,validate,authorize,overdue,fingerprint } from '../src/domain.js';
import { demo } from '../src/sample.js';
import { SheetsDatabase,fromSerial,toSerial,headers } from '../server/sheets.js';
const row={...demo[0],evidence:'https://example.com/evidence'};
test('valid savings, progress and evidence validation',()=>{
 assert.deepEqual(validate(row),[]);
 assert.match(validate({...row,progress:101,plan:-1,hod:'Pending',evidence:''}).join(' '),/Progress/);
 assert.match(validate({...row,start:'2026-02-30'}).join(' '),/Invalid start/);
 assert.match(validate({...row,evidence:'javascript:alert(1)'}).join(' '),/HTTPS/);
});
test('PIC owns its activity and derived actual overrides the legacy verified field',()=>{
 const user={role:'PIC',pic:row.pic,department:row.department};
 assert.doesNotThrow(()=>authorize(user,{...row,reported:5},row));
 assert.equal(monthlySavings({...row,verified:5}).verified,row.reported);
 assert.throws(()=>authorize({...user,pic:'another'},row,row),/assigned role/);
 assert.throws(()=>authorize({...user,role:'Management'},row,row),/assigned role/);
});
test('Actual entered is final and former approval roles cannot alter activities',()=>{
 const r=monthlySavings({...row,reported:20,verified:1,hod:'Pending',finance:'Rejected',evidence:''});
 assert.equal(r.verified,20);assert.equal(r.finance,'Verified');assert.deepEqual(validate(r),[]);
 assert.throws(()=>authorize({role:'HOD',department:row.department},{...r,reported:99},r));
 assert.throws(()=>authorize({role:'Finance'},{...r,reported:99},r));
});

test('overdue excludes completed and future activities',()=>{
 assert.equal(overdue({...row,target:'2026-10-25'},'2026-10-26'),true);
 assert.equal(overdue({...row,target:'2026-10-26'},'2026-10-26'),false);
 assert.equal(overdue({...row,status:'Completed',target:'2026-10-01'},'2026-10-26'),false);
});
test('Google Sheets serial date round trip',()=>assert.equal(fromSerial(toSerial('2026-10-26')),'2026-10-26'));
test('Sheets batch write protects formulas, limits capacity, detects stale and duplicate IDs',async()=>{
 const calls=[];const wb=new SheetsDatabase(async(...args)=>{calls.push(args);return {};},'spreadsheet');
 wb.read=async()=>[{...row,_row:5}];
 await wb.save({...row,verified:4},row,fingerprint(row));
 assert.equal(calls.length,1);assert.match(calls[0][0],/values:batchUpdate/);
 assert.equal(calls[0][2].valueInputOption,'RAW');
 assert.deepEqual(calls[0][2].data.map(d=>d.range),["'Activities'!A5:L5","'Activities'!O5:AL5","'Activities'!U4:AL4"]);
 await assert.rejects(wb.save(row,row,'stale'),/changed/);
 await assert.rejects(wb.save(row,null,null),/already exists/);
 wb.read=async()=>[{...row,_row:204}];
 await assert.rejects(wb.save({...row,id:'NEW'},null,null),/capacity/);
});
test('Sheets read validates schema and converts dates, including blank trailing cells',async()=>{
 const db=new SheetsDatabase(async()=>({values:[headers,['A','Prod RF','Test','Material','Owner','High','Not Started',toSerial('2026-10-26')]]}),'id');
 const [row]=await db.read();assert.equal(row.start,'2026-10-26');assert.equal(row.evidence,'');assert.equal(row._row,5);
 const invalid=new SheetsDatabase(async()=>({values:[['Incorrect header']]}),'id');await assert.rejects(invalid.read(),/headers/);
 const duplicate=new SheetsDatabase(async()=>({values:[headers,['A'],['A']]}),'id');await assert.rejects(duplicate.read(),/Duplicate/);
});
test('user strings are literal values and zero amounts are retained',async()=>{
 let body;const db=new SheetsDatabase(async(_path,_method,b)=>{body=b;return {};},'id');db.read=async()=>[];
 await db.save({...row,id:'NEW',item:'=IMPORTXML("https://example.com")',plan:0},null,null);
 assert.equal(body.data[0].values[0][2],'=IMPORTXML("https://example.com")');assert.equal(body.data[0].values[0][9],0);assert.equal(body.valueInputOption,'RAW');
});

test('PIC can create in both assigned departments but cannot move existing activities or use other departments',()=>{
 const user={role:'PIC',pic:'Tester',departments:['Prod RF','Prod Conv']};
 const activity={...row,pic:'Tester',hod:'Pending',finance:'Pending',verified:0};
 for(const department of user.departments)assert.doesNotThrow(()=>authorize(user,{...activity,department}));
 assert.throws(()=>authorize(user,{...activity,department:'OIS'}));
 assert.throws(()=>authorize(user,{...activity,department:'Prod Conv'},{...activity,department:'Prod RF'}));
 assert.throws(()=>authorize(user,{...activity,pic:'Other'}));
});

test('Admin creates activities for any department without approval requirements',()=>{
 const activity={...row,department:'Prod Conv',pic:'Assigned PIC',hod:'Pending',finance:'Pending',verified:0};
 assert.doesNotThrow(()=>authorize({role:'Admin'},activity));
 assert.throws(()=>authorize({role:'Management'},activity));
 assert.doesNotThrow(()=>authorize({role:'Admin'},monthlySavings(activity)));
 assert.equal(monthlySavings({...activity,verified:1}).verified,activity.reported);
 assert.doesNotThrow(()=>authorize({role:'Admin'},activity,activity));
});

test('Automatic IDs sequence separately by department and Malaysian creation month',()=>{
 const rows=[{id:'2610RF01'},{id:'2610RF03'},{id:'2610CV09'},{id:'2609RF99'},{id:'CD-001'}];
 assert.equal(nextActivityId(rows,'Prod RF','2026-10-26'),'2610RF04');
 assert.equal(nextActivityId(rows,'Prod Conv','2026-10-26'),'2610CV10');
 assert.equal(nextActivityId(rows,'Prod RF','2026-11-01'),'2611RF01');
 assert.equal(nextActivityId([{id:'2610RF99'}],'Prod RF','2026-10-26'),'2610RF100');
 for(const [department,code] of Object.entries(departmentCodes))assert.equal(nextActivityId([],department,'2026-10-26'),'2610'+code+'01');
 assert.throws(()=>nextActivityId([],'Invalid','2026-10-26'));
});

test('Optional activity image is validated and participates in permissions and stale checks',()=>{
 assert.deepEqual(validate({...row,image:''}),[]);
 assert.deepEqual(validate({...row,image:'data:image/jpeg;base64,/9j/2Q=='}),[]);
 assert.match(validate({...row,image:'https://example.com/photo'}).join(' '),/Invalid activity image/);
 assert.match(validate({...row,image:'data:image/jpeg;base64,'+'A'.repeat(45000)}).join(' '),/too long/);
 assert.notEqual(fingerprint(row),fingerprint({...row,image:'data:image/jpeg;base64,/9j/2Q=='}));
 assert.throws(()=>authorize({role:'Finance'},{...row,image:'data:image/jpeg;base64,/9j/2Q=='},row));
});

test('Monthly amounts total correctly, retain blanks and reject invalid savings',()=>{
 const r=monthlySavings({...row,savingYear:2026,start:'2026-01-01',planMonthly:100,actualJan:0,actualFeb:20.15,actualMar:30.25});
 assert.equal(r.plan,1200);assert.equal(r.reported,50.4);assert.equal(r.actualJan,0);assert.equal(r.actualApr,undefined);
 assert.equal(monthlySavings(row).reported,row.reported);
 assert.deepEqual(validate(r),[]);
 assert.match(validate({...r,actualJan:-1}).join(' '),/actualJan/);
 assert.match(validate({...r,savingYear:1999}).join(' '),/Reporting year/);
 assert.throws(()=>authorize({role:'Finance'},{...r,actualFeb:99},r));
 assert.equal(monthlySavings({...r,actualFeb:99}).verified,monthlySavings({...r,actualFeb:99}).reported);
});
test('Monthly saving fields round-trip through the sheet without overwriting formulas',async()=>{
 let body;const input=monthlySavings({...row,id:'MONTHLY',savingYear:2026,start:'2026-01-01',planMonthly:125.5,actualJan:50,actualFeb:0,actualMar:''});
 const db=new SheetsDatabase(async(_url,_method,b)=>{body=b;return {};},'id');db.read=async()=>[];
 await db.save(input,null,null);
 assert.equal(body.data[1].values[0][8],125.5);assert.equal(body.data[1].values[0][9],2026);
 assert.deepEqual(body.data[1].values[0].slice(10,13),[50,0,'']);
 const values=[...body.data[0].values[0],'','',...body.data[1].values[0]];
 const reader=new SheetsDatabase(async()=>({values:[[...headers,'Activity Image','Area','Planned Saving Monthly (RM)','Reporting Year',...['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m=>m+' Actual Saving (RM)')],values]}),'id');
 const [saved]=await reader.read();assert.equal(saved.reported,50);assert.equal(saved.plan,1506);assert.equal(saved.actualFeb,0);assert.equal(saved.actualMar,'');
});

test('Catalog edits retain department identity and new codes generate activity IDs',()=>{
 let catalog=updateCatalog(defaultCatalog,{kind:'departments',key:'Prod RF',label:'RF Production',code:'ZZ'});
 assert.equal(catalog.departments[0].name,'Prod RF');assert.equal(catalog.departments[0].code,'RF');
 catalog=updateCatalog(catalog,{kind:'departments',label:'Assembly',code:'AS'});
 assert.equal(nextActivityId([],'Assembly','2026-10-26',catalog),'2610AS01');
 assert.deepEqual(validate({...row,department:'Assembly'},catalog),[]);
 assert.throws(()=>updateCatalog(catalog,{kind:'departments',label:'Duplicate',code:'AS'}));
 assert.throws(()=>updateCatalog(catalog,{kind:'categories',label:'material'}));
 const renamed=updateCatalog(catalog,{kind:'categories',key:'Material',label:'Raw Material'});
 assert.equal(renamed.categories[0].name,'Material');assert.equal(renamed.categories[0].label,'Raw Material');
});

test('Savings count only start month through December in the reporting year',()=>{
 const base={...row,savingYear:2026,start:'2026-09-15',planMonthly:1000,actualJan:500,actualAug:600,actualSep:800,actualOct:900,actualNov:1000,actualDec:1100};
 assert.equal(savingMonthCount(base),4);assert.equal(savingMonthActive(base,7),false);assert.equal(savingMonthActive(base,8),true);
 const result=monthlySavings(base);assert.equal(result.plan,4000);assert.equal(result.reported,3800);assert.equal(result.actualJan,500);
 assert.equal(monthlySavings({...base,start:'2026-12-31'}).plan,1000);
 assert.equal(monthlySavings({...base,start:'2026-01-31'}).plan,12000);
 assert.equal(monthlySavings({...base,start:'2025-09-01'}).plan,12000);
 assert.equal(monthlySavings({...base,start:'2027-01-01'}).plan,0);
 assert.equal(monthlySavings({...base,start:''}).plan,0);
 assert.match(validate({...base,start:''}).join(' '),/Start Date is required/);
});

test('Admin edits existing activities while owner restrictions remain enforced',()=>{
 const updated={...row,item:'Updated initiative',department:'Prod Conv',pic:'New PIC',area:'Line 2',actualOct:250};
 assert.doesNotThrow(()=>authorize({role:'Admin'},updated,row));
 const saved=monthlySavings(updated);assert.equal(saved.verified,saved.reported);
 for(const [key,value] of [['id','CHANGED']])assert.throws(()=>authorize({role:'Admin'},{...row,[key]:value},row));
 const owner={role:'PIC',pic:row.pic,departments:[row.department]};
 assert.doesNotThrow(()=>authorize(owner,{...row,item:'Owner change'},row));
 assert.throws(()=>authorize({...owner,pic:'Other PIC'},{...row,item:'Forbidden'},row));
});

test('Yearly one-time plans count once while monthly plans multiply active months',()=>{
 const row={id:'YEAR',department:'Prod RF',item:'One-time saving',category:'Material',pic:'Owner',priority:'Medium',status:'Not Started',progress:0,start:'2026-09-01',savingYear:2026,planFrequency:'Yearly',planAnnual:1000,planMonthly:1000,actualSep:250,actualOct:750};
 const yearly=monthlySavings(row);assert.equal(yearly.plan,1000);assert.equal(yearly.reported,1000);assert.equal(yearly.verified,1000);assert.equal(yearly.achievement,100);assert.deepEqual(validate(yearly),[]);
 assert.equal(monthlySavings({...row,planFrequency:'Monthly'}).plan,4000);
 assert.equal(plannedSavingForMonth(row,8),1000);assert.equal(plannedSavingForMonth(row,9),0);
 assert.equal(monthsForPlan(row),yearly.plan);
 assert.equal(monthlySavings({...row,start:'2025-09-01'}).plan,1000);
 assert.equal(plannedSavingForMonth({...row,start:'2025-09-01'},0),1000);
 assert.equal(monthlySavings({...row,start:'2027-01-01'}).plan,0);
 assert.match(validate({...yearly,planAnnual:-1}).join(' '),/Yearly/);
 assert.match(validate({...yearly,planFrequency:'Invalid'}).join(' '),/frequency/);
 function monthsForPlan(r){return Array.from({length:12},(_,i)=>plannedSavingForMonth(r,i)).reduce((a,b)=>a+b,0);}
});
test('Yearly plan frequency and amount survive Google Sheets round trip',async()=>{
 let body;const db=new SheetsDatabase(async(_url,_method,value)=>{body=value;return {};},'id');db.read=async()=>[];
 const input=monthlySavings({...row,id:'YEARLY',start:'2026-09-01',savingYear:2026,planFrequency:'Yearly',planAnnual:2500,actualOct:500});
 await db.save(input,null,null);
 assert.deepEqual(body.data[1].values[0].slice(-2),['Yearly',2500]);
 const header=[...headers,...body.data[2].values[0]];const values=[...body.data[0].values[0],'','',...body.data[1].values[0]];
 const reader=new SheetsDatabase(async()=>({values:[header,values]}),'id');const [saved]=await reader.read();assert.equal(saved.planFrequency,'Yearly');assert.equal(saved.planAnnual,2500);assert.equal(saved.plan,2500);assert.equal(saved.reported,500);
});

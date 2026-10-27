import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { fields,fingerprint } from '../src/domain.js';
import { demo } from '../src/sample.js';
import { headers } from '../server/sheets.js';

test('API authentication, workflow save, audit and conflict protection',async()=>{
 const auditDir=await mkdtemp(join(tmpdir(),'costdown-'));let record={...demo[0],evidence:'https://example.com/proof'};let writes=0;
 const services={verifyIdentity:async token=>{
  if(!['pic','finance','unassigned','admin'].includes(token))throw Object.assign(Error('Invalid token'),{status:401});
  return {id:token,name:'Tester'};
 },request:async(url,method,body)=>{
  if(method==='POST'){writes++;const left=body.data[0].values[0],right=body.data[1].values[0];record=Object.fromEntries(fields.map((k,i)=>[k,i<12?left[i]:i>=14?right[i-14]:record[k]]));return {};}
  return {values:[headers,fields.map(k=>record[k]??'')]};
 }};
 const app=createApp({clientId:'google-client',spreadsheetId:'sheet',auditDir,users:{pic:{role:'PIC',pic:record.pic,department:record.department},finance:{role:'Finance'},admin:{role:'Admin'}}},services);
 const server=app.listen(0);await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 const post=(body,role='pic')=>fetch(base+'/api/activities',{method:'POST',headers:{Authorization:`Bearer ${role}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  assert.equal((await fetch(base+'/api/activities')).status,401);
  assert.equal((await post({activity:record},'invalid')).status,401);
  assert.equal((await post({activity:record},'unassigned')).status,403);
  const config=await(await fetch(base+'/api/config')).json();assert.equal(config.clientId,'google-client');assert.equal(config.users,undefined);
  const response=await post({activity:{...record,reported:12},version:fingerprint(record)});
  assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.finance,'Verified');assert.equal(saved.verified,12);assert.equal(writes,1);
  assert.match(await readFile(join(auditDir,'audit.jsonl'),'utf8'),/committed/);
  assert.equal((await post({activity:saved,version:'stale'})).status,409);
  const normalized=await post({activity:{...saved,finance:'Rejected',verified:999},version:fingerprint(saved)});assert.equal(normalized.status,200);assert.equal((await normalized.json()).verified,12);
  assert.equal((await post({activity:{...saved,finance:'Verified',verified:20},version:fingerprint(saved)},'finance')).status,403);
  const adminEdit=await post({activity:{...saved,item:'Admin corrected activity'},version:fingerprint(saved)},'admin');
  assert.equal(adminEdit.status,200);const edited=await adminEdit.json();assert.equal(edited.item,'Admin corrected activity');assert.equal(edited.finance,'Verified');assert.equal(edited.verified,12);

 }finally{await new Promise(r=>server.close(r));await rm(auditDir,{recursive:true,force:true});}
});


test('Admin manages persistent PIC invitations; verified sign-in binds ID and disabling revokes access',async()=>{
 const auditDir=await mkdtemp(join(tmpdir(),'costdown-admin-'));
 const services={verifyIdentity:async token=>({id:token,email:token==='pic-id'?'pic@example.com':'admin@example.com',name:'Tester'}),request:async()=>({values:[headers]})};
 const config={clientId:'client',spreadsheetId:'sheet',auditDir,users:{admin:{role:'Admin',email:'admin@example.com'},manager:{role:'Management'}}};
 let server=createApp(config,services).listen(0);await new Promise(r=>server.once('listening',r));
 let base=`http://127.0.0.1:${server.address().port}`;
 const call=(path,token,body)=>fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 try{
  const assignment={email:'pic@example.com',pic:'PIC Tester',departments:['Prod RF','Prod Conv']};
  assert.equal((await call('/api/admin/catalog','manager',{kind:'categories',label:'Custom'})).status,403);
  assert.equal((await call('/api/admin/catalog','admin',{kind:'departments',label:'Assembly',code:'AS'})).status,200);
  assert.equal((await call('/api/admin/catalog','admin',{kind:'departments',label:'Duplicate code',code:'AS'})).status,400);
  assert.equal((await call('/api/admin/catalog','admin',{kind:'categories',label:'Packaging'})).status,200);
  assert.equal((await call('/api/admin/catalog','admin',{kind:'categories',label:'packaging'})).status,400);
  assert.equal((await call('/api/admin/catalog','admin',{kind:'departments',key:'Prod RF',label:'RF Production'})).status,200);
  const lists=await(await call('/api/catalog','admin')).json();assert.equal(lists.departments.find(d=>d.name==='Prod RF').label,'RF Production');
  assert.equal((await call('/api/admin/users','admin',{email:'assembly@example.com',pic:'Assembly PIC',departments:['Assembly']})).status,200);

  assert.equal((await call('/api/admin/users','manager')).status,403);
  assert.equal((await call('/api/admin/users','admin',{...assignment,departments:['Unknown']})).status,400);
  assert.equal((await call('/api/admin/users','admin',{...assignment,email:'admin@example.com'})).status,400);
  assert.equal((await call('/api/admin/users','admin',assignment)).status,200);
  const me=await(await call('/api/me','pic-id')).json();assert.equal(me.role,'PIC');assert.deepEqual(me.departments,assignment.departments);
  assert.equal((await call('/api/admin/users','pic-id')).status,403);
  const stored=JSON.parse(await readFile(join(auditDir,'users.json'),'utf8'));assert.equal(stored.find(u=>u.email==='pic@example.com').id,'pic-id');
  await new Promise(r=>server.close(r));server=createApp(config,services).listen(0);await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await call('/api/me','pic-id')).status,200);
  assert.equal((await call('/api/admin/users','admin',{...assignment,disabled:true})).status,200);
  assert.equal((await call('/api/me','pic-id')).status,403);
 }finally{await new Promise(r=>server.close(r));await rm(auditDir,{recursive:true,force:true});}
});

test('Concurrent new dashboard activities receive distinct server-generated IDs',async()=>{
 const auditDir=await mkdtemp(join(tmpdir(),'costdown-ids-'));const rows=[];
 const services={verifyIdentity:async()=>({id:'admin'}),request:async(path,method,body)=>{
  if(method==='POST'){const left=body.data[0].values[0],right=body.data[1].values[0];rows.push([...left,'','',...right]);return {};}
  return {values:[[...headers,'Activity Image','Area','Planned Saving Monthly (RM)','Reporting Year',...['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m=>m+' Actual Saving (RM)')],...rows]};
 }};
 const server=createApp({clientId:'client',spreadsheetId:'sheet',auditDir,users:{admin:{role:'Admin'}}},services).listen(0);await new Promise(r=>server.once('listening',r));
 try{
  const activity={...demo[0],id:'',department:'Prod RF',hod:'Pending',finance:'Pending',verified:0,savingYear:2026,start:'2026-01-01',planMonthly:100,actualJan:30,actualFeb:70,reported:999,plan:999};
  const save=()=>fetch(`http://127.0.0.1:${server.address().port}/api/activities`,{method:'POST',headers:{Authorization:'Bearer admin','Content-Type':'application/json'},body:JSON.stringify({activity,version:null})});
  const responses=await Promise.all([save(),save()]);assert.deepEqual(responses.map(r=>r.status),[200,200]);
  const saved=await Promise.all(responses.map(r=>r.json()));assert.equal(saved[0].plan,1200);assert.equal(saved[0].reported,100);assert.match(saved[0].id,/^\d{4}RF01$/);assert.equal(saved[1].id,saved[0].id.slice(0,-2)+'02');
 }finally{await new Promise(r=>server.close(r));await rm(auditDir,{recursive:true,force:true});}
});

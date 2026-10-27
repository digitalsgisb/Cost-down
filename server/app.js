import express from 'express';
import { appendFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { SheetsDatabase } from './sheets.js';
import { createGoogleServices } from './google.js';
import {catalogStore,updateCatalog} from './catalog.js';
import { userStore, validatePic } from './users.js';
import { authorize, validate, fingerprint, today, nextActivityId, monthlySavings, monthFields } from '../src/domain.js';

export function createApp(config={}, services=createGoogleServices(config)) {
 const app=express();app.disable('x-powered-by');app.use(express.json({limit:'128kb'}));
 // Google Identity Services requires this referrer policy for HTTP localhost.
 app.use((req,res,next)=>{
  if(req.hostname==='localhost'||req.hostname==='127.0.0.1')res.set('Referrer-Policy','no-referrer-when-downgrade');
  next();
 });
 let queue=Promise.resolve();
 const catalogs=catalogStore(config.auditDir||'data');
 const accounts=userStore(config.auditDir||'data');
 const serial=fn=>{const job=queue.then(fn);queue=job.catch(()=>{});return job;};
 const audit=async event=>{await mkdir(config.auditDir||'data',{recursive:true});await appendFile(resolve(config.auditDir||'data','audit.jsonl'),JSON.stringify({...event,at:new Date().toISOString()})+'\n');};
 const configured=!!(config.clientId&&config.spreadsheetId);
 app.get('/api/health',(_req,res)=>res.json({ok:true,provider:'google-sheets',configured}));
 app.get('/api/config',(_req,res)=>res.json({configured,clientId:config.clientId||''}));
 app.use('/api',async(req,res,next)=>{
  try {
   if(!configured) throw Object.assign(Error('Configure GOOGLE_CLIENT_ID and GOOGLE_SPREADSHEET_ID on the server.'),{status:503});
   const token=req.headers.authorization;
   if(!token?.startsWith('Bearer ')) throw Object.assign(Error('Google sign-in required.'),{status:401});
   const me=await services.verifyIdentity(token.slice(7));
   const assignment=await serial(async()=>{
    const users=await accounts.read();
    const account=users.find(u=>u.id===me.id)||users.find(u=>!u.id&&u.email===me.email?.toLowerCase());
    if(account){if(account.disabled)return null;if(!account.id){account.id=me.id;await accounts.save(users);}return account;}
    return config.users?.[me.id];
   });
   if(!assignment||!['Admin','PIC','HOD','Finance','Management'].includes(assignment.role)) throw Object.assign(Error('Ask your administrator to assign your account a dashboard role. Google account ID: '+me.id),{status:403});
   req.user={...assignment,id:me.id,name:me.name,email:me.email};
   req.database=new SheetsDatabase(services.request,config.spreadsheetId);next();
  } catch(e){next(e);}
 });
 app.get('/api/me',(req,res)=>res.json(req.user));
 app.get('/api/catalog',async(req,res,next)=>{try{res.json(await catalogs.read());}catch(e){next(e);}});
 const admin=(req,res,next)=>req.user.role==='Admin'?next():res.status(403).json({error:'Admin access required.'});
 app.post('/api/admin/catalog',admin,async(req,res,next)=>{try{res.json(await serial(async()=>{const previous=await catalogs.read();const next=updateCatalog(previous,req.body);await audit({actor:req.user.id,action:'catalog update',request:req.body});await catalogs.save(next);return next;}));}catch(e){next(e);}});
 app.get('/api/admin/users',admin,async(req,res,next)=>{try{res.json(await accounts.read());}catch(e){next(e);}});
 app.post('/api/admin/users',admin,async(req,res,next)=>{try{res.json(await serial(async()=>{
  const value=validatePic(req.body,await catalogs.read());const users=await accounts.read();const previous=users.find(u=>u.email===value.email);
  if(Object.values(config.users||{}).some(u=>u.email?.toLowerCase()===value.email)||previous?.role==='Admin')throw Object.assign(Error('This account is reserved for administration.'),{status:400});
  if(previous?.id&&config.users?.[previous.id])throw Object.assign(Error('This account is configured by the server administrator.'),{status:400});
  const saved={...value,...(previous?.id?{id:previous.id}:{})};
  await audit({actor:req.user.id,action:'PIC assignment',before:previous,after:saved});
  await accounts.save([...users.filter(u=>u.email!==value.email),saved]);return saved;
 }));}catch(e){next(e);}});
 app.get('/api/activities',async(req,res,next)=>{try{res.json(await req.database.read());}catch(e){next(e);}});
 app.post('/api/activities',async(req,res,next)=>{
  try {res.json(await serial(async()=>{
   let {activity,version}=req.body;
   if(!activity||typeof activity!=='object') throw Object.assign(Error('Activity is required.'),{status:400});
   const all=await req.database.read();const previous=all.find(r=>r.id===activity.id);
   if((previous&&!version)||(!previous&&version)) throw Object.assign(Error('Activity exists or was removed. Refresh before saving.'),{status:409});
   if(previous&&fingerprint(previous)!==version) throw Object.assign(Error('Activity has changed. Refresh before saving.'),{status:409});
   const catalog=await catalogs.read();
   if(!previous)activity={...activity,id:nextActivityId(all,activity.department,today(),catalog)};
   if(previous?.savingYear&&Number(activity.savingYear)!==Number(previous.savingYear))throw Object.assign(Error('Reporting year cannot be changed. Create a new activity for another year.'),{status:400});
   if(previous&&!previous.savingYear&&previous.reported>0&&activity.savingYear&&!monthFields.some(k=>Number(activity[k])>0))throw Object.assign(Error('Allocate the previous PIC total to the correct months before saving.'),{status:400});
   activity=monthlySavings(activity);
   authorize(req.user,activity,previous);
   const nextRow={...activity,updated:today()};
   const errors=validate(nextRow,catalog);
   if(!catalog.categories.some(c=>c.name===nextRow.category)&&(!previous||nextRow.category!==previous.category))errors.push('Select a valid category.');if(errors.length) throw Object.assign(Error(errors.join(' ')),{status:400});
   const operation=randomUUID();await audit({operation,state:'attempt',actor:req.user.id,role:req.user.role,before:previous,after:nextRow});
   let saved;
   try{saved=await req.database.save(nextRow,previous,version);}catch(e){await audit({operation,state:'failed',error:e.message});throw e;}
   try{await audit({operation,state:'committed'});}catch{throw Object.assign(Error('Google Sheet saved, but audit completion failed. Refresh before any retry and contact your administrator.'),{status:503});}
   return saved;
  }));}catch(e){next(e);}
 });
 app.use('/api',(_req,res)=>res.status(404).json({error:'API route not found.'}));
 app.use(express.static(resolve('dist')));
 app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/index.html')));
 app.use((err,_req,res,_next)=>{if(!err.status) console.error(err);res.status(err.status||500).json({error:err.status?err.message:'Server operation failed. Refresh before retrying.'});});
 return app;
}


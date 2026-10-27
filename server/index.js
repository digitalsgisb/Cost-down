import dotenv from 'dotenv';
import { createApp } from './app.js';
dotenv.config({path:'.env.local'});dotenv.config();
let users;
try {users=JSON.parse(process.env.DASHBOARD_USERS||'{}');} catch {throw Error('DASHBOARD_USERS must be valid JSON.');}
createApp({clientId:process.env.GOOGLE_CLIENT_ID,spreadsheetId:process.env.GOOGLE_SPREADSHEET_ID,workspaceDomain:process.env.GOOGLE_WORKSPACE_DOMAIN,users,auditDir:process.env.AUDIT_DIR}).listen(Number(process.env.PORT)||3001,()=>console.log('Cost Down API listening on port '+(process.env.PORT||3001)));

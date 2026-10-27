import dotenv from 'dotenv';
import {createGoogleServices} from '../server/google.js';
import {SheetsDatabase} from '../server/sheets.js';
import {months} from '../src/domain.js';
dotenv.config({path:'.env.local',quiet:true});
const id=process.env.GOOGLE_SPREADSHEET_ID;
const services=createGoogleServices({clientId:process.env.GOOGLE_CLIENT_ID});
const database=new SheetsDatabase(services.request,id);
await database.read(); // Validates that the new columns contain no unrelated data.
const base='/spreadsheets/'+encodeURIComponent(id);
const metadata=await services.request(base+'?fields=sheets.properties');
const sheet=metadata.sheets.find(s=>s.properties.title==='Activities')?.properties;
if(!sheet)throw Error('Activities sheet not found.');
if(sheet.gridProperties.columnCount<38)await services.request(base+':batchUpdate','POST',{requests:[{appendDimension:{sheetId:sheet.sheetId,dimension:'COLUMNS',length:38-sheet.gridProperties.columnCount}}]});
await services.request(base+'/values:batchUpdate','POST',{valueInputOption:'RAW',data:[{range:"'Activities'!U4:AL4",values:[['Activity Image','Area','Planned Saving Monthly (RM)','Reporting Year',...months.map(m=>m+' Actual Saving (RM)'),'Plan Frequency','Planned Saving Yearly (RM)']]}]});
console.log(JSON.stringify({monthlyColumnsReady:true,activities:(await database.read()).length}));

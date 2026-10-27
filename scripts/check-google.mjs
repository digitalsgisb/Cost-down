import dotenv from 'dotenv';
import { createGoogleServices } from '../server/google.js';
import { SheetsDatabase,headers } from '../server/sheets.js';
dotenv.config({path:'.env.local',quiet:true});
try {
 const config={clientId:process.env.GOOGLE_CLIENT_ID,spreadsheetId:process.env.GOOGLE_SPREADSHEET_ID};
 const services=createGoogleServices(config);
 const rows=await new SheetsDatabase(services.request,config.spreadsheetId).read();
 console.log(JSON.stringify({provider:'google-sheets',read:true,activities:rows.length}));
 if(process.argv.includes('--verify-write')){
  // read() already verified these exact header values. Write the same values
  // to prove server write access without adding records or touching formulas.
  const result=await services.request(`/spreadsheets/${encodeURIComponent(config.spreadsheetId)}/values:batchUpdate`,'POST',{
   valueInputOption:'RAW',data:[{range:"'Activities'!A4:T4",values:[headers]}]
  });
  if(result.totalUpdatedCells!==headers.length)throw Error('Unexpected header-write result.');
  const after=await new SheetsDatabase(services.request,config.spreadsheetId).read();
  if(after.length!==rows.length)throw Error('Activity count changed during setup check.');
  console.log(JSON.stringify({write:true,activityDataUnchanged:true,formulaColumnsUntouched:true}));
 }
}catch(e){console.error(e.message);process.exitCode=1;}

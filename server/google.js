import { GoogleAuth,OAuth2Client } from 'google-auth-library';

export function createGoogleServices(config,fetcher=fetch){
 const identity=new OAuth2Client(config.clientId);
 const auth=new GoogleAuth({scopes:['https://www.googleapis.com/auth/spreadsheets']});
 return {
  async verifyIdentity(token){
   try{
    const ticket=await identity.verifyIdToken({idToken:token,audience:config.clientId});const user=ticket.getPayload();
    if(!user?.sub||!user.email_verified||(config.workspaceDomain&&user.hd!==config.workspaceDomain)) throw Error('Account not permitted.');
    return {id:user.sub,name:user.name||user.email,email:user.email};
   }catch{throw Object.assign(Error('Google sign-in expired or account not permitted. Sign in again.'),{status:401});}
  },
  async request(path,method='GET',body){
   const token=await auth.getAccessToken();
   const response=await fetcher(`https://sheets.googleapis.com/v4${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
   if(!response.ok) throw Object.assign(Error(response.status===429?'Google Sheets is busy. Wait briefly before refreshing.':`Google Sheets request failed (${response.status}). Check service account access and refresh before retrying a save.`),{status:[409,429].includes(response.status)?response.status:502});
   return response.status===204?{}:response.json();
  }
 };
}

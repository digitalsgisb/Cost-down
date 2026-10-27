import { fingerprint } from './domain.js';
let credential='',settings;
export async function getSettings(){
 if(!settings){const res=await fetch('/api/config');if(!res.ok)throw Error('Backend unavailable. Start the Node server.');settings=await res.json();}
 return settings;
}
export function setCredential(value){credential=value;}
export function signOut(){credential='';window.google?.accounts?.id?.disableAutoSelect();}
async function api(path,body){
 if(!credential)throw Error('Sign in with Google to connect the database.');
 const res=await fetch(`/api${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${credential}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const data=await res.json().catch(()=>({error:'API unavailable. Start the Node server.'}));
 if(!res.ok)throw Error(data.error||'API request failed.');return data;
}
export const readIdentity=()=>api('/me');
export const readActivities=()=>api('/activities');
export const saveActivity=(activity,previous)=>api('/activities',{activity:previous?activity:{...activity,id:''},version:previous?fingerprint(previous):null});

export const readUsers=()=>api('/admin/users');
export const saveUser=user=>api('/admin/users',user);

export const readCatalog=()=>api('/catalog');
export const saveCatalogEntry=entry=>api('/admin/catalog',entry);

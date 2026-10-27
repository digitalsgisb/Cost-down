import React,{useEffect,useRef,useState} from 'react';
let scriptPromise;
function loadIdentity(){
 if(window.google?.accounts?.id)return Promise.resolve();
 if(!scriptPromise)scriptPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
  script.onload=resolve;script.onerror=()=>{scriptPromise=undefined;reject(Error('Could not load Google sign-in. Check your network and retry.'));};document.head.appendChild(script);
 });
 return scriptPromise;
}
export function GoogleSignIn({clientId,onCredential,onClose}){
 const ref=useRef(null),callback=useRef(onCredential);callback.current=onCredential;const[error,setError]=useState('');
 useEffect(()=>{let active=true;loadIdentity().then(()=>{
  if(!active)return;window.google.accounts.id.initialize({client_id:clientId,callback:response=>{if(active)callback.current(response.credential);},auto_select:false});
  window.google.accounts.id.renderButton(ref.current,{theme:'outline',size:'large',text:'signin_with'});
 }).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[clientId]);
 return <div className="modal-bg"><section role="dialog" aria-modal="true" aria-label="Connect Google Sheets" className="google-login"><h2>Connect Google Sheets</h2><p>Sign in with your assigned company Google account.</p><div ref={ref}/>{error&&<p role="alert">{error}</p>}<button className="outline" onClick={onClose}>Cancel</button></section></div>;
}

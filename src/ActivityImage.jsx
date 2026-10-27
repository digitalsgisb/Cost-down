import React,{useState} from 'react';

export function ActivityImage({value}){
 const [open,setOpen]=useState(false);
 if(!value||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)||value.length>45000)return null;
 return <><button type="button" className="activity-picture" aria-label="View activity picture" onClick={()=>setOpen(true)}><img src={value} alt="Cost down activity"/></button>{open&&<div className="modal-bg" onClick={()=>setOpen(false)}><div className="panel picture-preview" role="dialog" aria-modal="true" aria-label="Activity picture"><button type="button" className="outline" onClick={()=>setOpen(false)}>Close picture</button><img src={value} alt="Cost down activity enlarged"/></div></div>}</>;
}
export function ImageAttachment({value,onChange,disabled}){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function attach(event){
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  setError('');setBusy(true);let url;
  try{
   if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('Choose a JPEG, PNG or WebP image up to 10 MB.');
   url=URL.createObjectURL(file);const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Cannot read this image.'));img.src=url;});
   const canvas=document.createElement('canvas');const context=canvas.getContext('2d');let encoded='';
   for(const size of [800,600,400,280]){
    const scale=Math.min(1,size/Math.max(img.width,img.height));canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
    context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,0,0,canvas.width,canvas.height);
    encoded=canvas.toDataURL('image/jpeg',0.72);if(encoded.length<=45000)break;
   }
   if(encoded.length>45000)throw Error('Image is too detailed. Choose a smaller image.');
   onChange(encoded);
  }catch(e){setError(e.message);}finally{if(url)URL.revokeObjectURL(url);setBusy(false);}
 }
 return <div className="image-attachment"><label className="field"><span>Attach activity picture</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled||busy} onChange={attach}/></label><p className="form-note">Optional: one JPEG, PNG or WebP, up to 10 MB. A compressed copy is saved in Google Sheets.</p>{busy&&<p role="status">Preparing picture…</p>}{error&&<p role="alert">{error}</p>}<ActivityImage value={value}/>{value&&!disabled&&<button type="button" className="text-button" onClick={()=>onChange('')}>Remove picture</button>}</div>;
}

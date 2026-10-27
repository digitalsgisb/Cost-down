import React,{useEffect,useState} from 'react';
import {readUsers,saveUser} from './api';
import {useCatalog} from './CatalogContext';

const blank={email:'',pic:'',departments:[],disabled:false};
export function AdminUsers(){
 const catalog=useCatalog();const departments=catalog.departments.map(d=>d.name);
 const [users,setUsers]=useState([]),[form,setForm]=useState(blank),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{readUsers().then((data=>setUsers(data.filter(u=>u.role==='PIC')))).catch(e=>setMessage(e.message));},[]);
 const submit=async e=>{e.preventDefault();setBusy(true);setMessage('');try{await saveUser(form);setUsers((await readUsers()).filter(u=>u.role==='PIC'));setForm(blank);setMessage('PIC access saved. The PIC can sign in with this Google account.');}catch(e){setMessage(e.message);}finally{setBusy(false);}};
 return <section className="panel"><div className="panel-header"><div><h2>Manage PIC accounts</h2><p>Add a Google email, owner name and permitted departments. Access changes apply on the next server request.</p></div></div>
 <form onSubmit={submit} style={{padding:'24px'}}><div className="form-grid">
 <label className="field"><span>Google email</span><input type="email" required maxLength={254} value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
 <label className="field"><span>PIC / Owner name</span><input required maxLength={100} value={form.pic} onChange={e=>setForm({...form,pic:e.target.value})}/></label>
 <fieldset className="full"><legend>Permitted departments</legend><div className="flex flex-wrap gap-3">{departments.map(d=><label key={d}><input type="checkbox" checked={form.departments.includes(d)} onChange={e=>setForm({...form,departments:e.target.checked?[...form.departments,d]:form.departments.filter(x=>x!==d)})}/> {catalog.label('departments',d)}</label>)}</div></fieldset>
 <label><input type="checkbox" checked={form.disabled} onChange={e=>setForm({...form,disabled:e.target.checked})}/> Disable this PIC account</label>
 </div><div className="modal-actions"><button className="outline" type="button" onClick={()=>setForm(blank)}>Clear</button><button className="primary" disabled={busy||!form.departments.length}>{busy?'Saving…':'Save PIC'}</button></div>{message&&<p role="status">{message}</p>}</form>
 <div className="table-scroll"><table><thead><tr><th>Google email</th><th>PIC</th><th>Departments</th><th>Access</th><th/></tr></thead><tbody>{users.length===0&&<tr><td colSpan="5">No PIC accounts added yet.</td></tr>}{users.map(u=><tr key={u.email}><td>{u.email}</td><td>{u.pic}</td><td>{u.departments.map(d=>catalog.label('departments',d)).join(', ')}</td><td>{u.disabled?'Disabled':u.id?'Active':'Awaiting first sign-in'}</td><td><button className="text-button" onClick={()=>setForm({...u})}>Edit</button></td></tr>)}</tbody></table></div>
 </section>;
}

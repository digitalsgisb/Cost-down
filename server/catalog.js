import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {defaultCatalog} from '../src/catalog.js';

export function catalogStore(directory='data'){
 const path=resolve(directory,'catalog.json');
 return {
  async read(){try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return structuredClone(defaultCatalog);throw e;}},
  async save(catalog){await mkdir(directory,{recursive:true});await writeFile(path+'.tmp',JSON.stringify(catalog,null,2));await rename(path+'.tmp',path);},
 };
}
export function updateCatalog(current,request){
 const fail=message=>{throw Object.assign(Error(message),{status:400});};
 const {kind,key}=request;
 if(!['departments','categories'].includes(kind))fail('Select departments or categories.');
 const label=typeof request.label==='string'?request.label.trim():'';
 if(!label||label.length>100)fail('Enter a name of up to 100 characters.');
 const previous=current[kind].find(item=>item.name===key);
 if(key&&!previous)fail('This entry no longer exists. Refresh the page.');
 if(current[kind].some(item=>item.name!==previous?.name&&item.label.toLowerCase()===label.toLowerCase()))fail('This name already exists.');
 if(!previous&&current[kind].some(item=>item.name.toLowerCase()===label.toLowerCase()))fail('This name is already reserved.');
 const entry=previous?{...previous,label}:{name:label,label};
 if(kind==='departments'&&!previous){
  const code=String(request.code||'').trim().toUpperCase();
  if(!/^[A-Z]{2}$/.test(code)||current.departments.some(item=>item.code===code))fail('Enter a unique two-letter department code.');
  entry.code=code;
 }
 return {...current,[kind]:previous?current[kind].map(item=>item.name===key?entry:item):[...current[kind],entry]};
}

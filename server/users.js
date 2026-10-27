import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import {defaultCatalog} from '../src/catalog.js';

export function userStore(directory='data') {
 const file=resolve(directory,'users.json');
 return {
  async read(){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return [];throw e;}},
  async save(users){await mkdir(directory,{recursive:true});await writeFile(file+'.tmp',JSON.stringify(users,null,2));await rename(file+'.tmp',file);},
 };
}
export function validatePic(value,catalog=defaultCatalog){
 const email=String(value.email||'').trim().toLowerCase(),pic=String(value.pic||'').trim();
 const selected=[...new Set(Array.isArray(value.departments)?value.departments:[])];
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!pic||pic.length>100||!selected.length||selected.some(d=>!catalog.departments.some(item=>item.name===d)))throw Object.assign(Error('Enter a valid Google email, PIC name and at least one valid department.'),{status:400});
 return {email,pic,departments:selected,role:'PIC',disabled:value.disabled===true};
}

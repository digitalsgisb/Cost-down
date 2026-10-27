import {defaultCatalog} from '../../src/catalog.js';
import { test,expect } from '@playwright/test';
test.beforeEach(async({page})=>{await page.route('**/api/catalog',r=>r.fulfill({json:defaultCatalog}));});
test('five modules, filters and PIC activity creation preserve savings workflow',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByRole('heading',{name:'Cost Down Overview'})).toBeVisible();
 for(const [nav,title] of [['Departments','Department Performance'],['Activities','Cost Down Activities'],['Verification','Savings Verification'],['Progress','Activity Progress']]){
  await page.getByRole('button',{name:nav,exact:true}).click();await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
 }
 await page.getByRole('button',{name:'Activities',exact:true}).click();
 await page.getByRole('button',{name:'New Activity'}).click();
 await page.getByLabel('Start Date',{exact:true}).fill('2026-01-01');
 await expect(page.getByLabel('Activity ID',{exact:true})).toHaveValue('Automatic on save');await page.getByLabel('Cost down initiative *').fill('Test initiative');await page.getByLabel('PIC / Owner').fill('Test PIC');
 await page.getByRole('button',{name:'Save Activity'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByLabel('Search initiatives',{exact:true}).fill('Test initiative');await expect(page.getByRole('cell',{name:/Test initiative/})).toBeVisible();
 await page.getByRole('button',{name:'Clear filters'}).click();await page.getByLabel('PIC filter').selectOption('Test PIC');await expect(page.getByText('1 activities',{exact:true})).toBeVisible();
 expect(errors).toEqual([]);
 await page.getByRole('button',{name:'Clear filters'}).click();
 await page.getByLabel('Search initiatives',{exact:true}).fill('Test initiative');
 await page.getByRole('button',{name:'Edit',exact:true}).click();
 await page.getByLabel('Evidence Link (Google Drive / HTTPS URL)').fill('https://example.com/proof');
 await page.getByLabel('Oct Actual Saving (RM)').fill('500');
 await page.getByRole('button',{name:'Save Activity'}).click();
 await page.locator('.top-actions select').last().selectOption('HOD');
 await page.getByRole('button',{name:'Edit',exact:true}).click();
 await page.getByLabel('HOD Approval',{exact:true}).selectOption('Approved');
 await page.getByRole('button',{name:'Save Activity'}).click();
 await page.locator('.top-actions select').last().selectOption('Finance');
 await page.getByRole('button',{name:'Verification',exact:true}).click();
 await page.getByRole('button',{name:'Review',exact:true}).click();
 await page.getByLabel('Finance-Verified Amount (RM)').fill('400');
 await page.getByLabel('Finance Approval',{exact:true}).selectOption('Verified');
 await page.getByRole('button',{name:'Save Activity'}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.getByRole('table').getByText('Verified',{exact:true})).toBeVisible();
});

test('mobile navigation and layout',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.locator('.mobile-menu').click();await page.getByRole('button',{name:'Progress',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Activity Progress',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await expect.poll(async()=>page.locator('.sidebar').evaluate(el=>el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
 await page.screenshot({path:'test-results/mobile-progress.png',fullPage:true});
});

test('Google sign-in connects the sheet and sign-out restores demo mode',async({page})=>{
 await page.route('**/api/config',route=>route.fulfill({json:{configured:true,clientId:'test-client'}}));
 await page.route('https://accounts.google.com/gsi/client',route=>route.fulfill({contentType:'text/javascript',body:`window.google={accounts:{id:{initialize(options){this.callback=options.callback},renderButton(element){const button=document.createElement('button');button.textContent='Sign in with Google';button.onclick=()=>this.callback({credential:'test-id-token'});element.appendChild(button)},disableAutoSelect(){}}}};`}));
 await page.route('**/api/me',route=>route.fulfill({json:{id:'google-sub',name:'Test PIC',pic:'PIC - RF',department:'Prod RF',role:'PIC'}}));
 await page.route('**/api/activities',route=>route.fulfill({json:[]}));
 await page.goto('/');await page.getByRole('button',{name:'Connect Sheets'}).click();
 await page.getByRole('button',{name:'Sign in with Google',exact:true}).click();
 await expect(page.getByText('Google Sheets connected',{exact:true})).toBeVisible();
 await expect(page.locator('.top-actions select').last()).toBeDisabled();
 await page.getByRole('button',{name:'Activities',exact:true}).click();await page.getByRole('button',{name:'New Activity'}).click();
 await expect(page.getByLabel('PIC / Owner')).toHaveValue('PIC - RF');await expect(page.getByLabel('PIC / Owner')).toBeDisabled();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByText('Demo mode',{exact:true})).toBeVisible();
});




test('Admin adds a PIC with two departments through the administration page',async({page})=>{
 let users=[];
 await page.route('**/api/config',r=>r.fulfill({json:{configured:true,clientId:'test-client'}}));
 await page.route('https://accounts.google.com/gsi/client',r=>r.fulfill({contentType:'text/javascript',body:`window.google={accounts:{id:{initialize(o){this.callback=o.callback},renderButton(el){const b=document.createElement('button');b.textContent='Sign in with Google';b.onclick=()=>this.callback({credential:'token'});el.appendChild(b)},disableAutoSelect(){}}}};`}));
 await page.route('**/api/me',r=>r.fulfill({json:{id:'admin',name:'Haffizol',role:'Admin'}}));
 await page.route('**/api/activities',r=>r.fulfill({json:[]}));
 await page.route('**/api/admin/users',async r=>{if(r.request().method()==='POST'){users=[{...r.request().postDataJSON(),role:'PIC'}];await r.fulfill({json:users[0]});}else await r.fulfill({json:users});});
 await page.goto('/');await page.getByRole('button',{name:'Connect Sheets'}).click();await page.getByRole('button',{name:'Sign in with Google',exact:true}).click();
 await page.getByRole('button',{name:'Admin',exact:true}).click();
 await page.getByLabel('Google email').fill('pic@example.com');await page.getByLabel('PIC / Owner name').fill('Test Owner');
 await page.getByRole('checkbox',{name:'Prod RF',exact:true}).check();await page.getByRole('checkbox',{name:'Prod Conv',exact:true}).check();
 await page.getByRole('button',{name:'Save PIC',exact:true}).click();
 await expect(page.getByRole('cell',{name:'Prod RF, Prod Conv',exact:true})).toBeVisible();
 expect(users[0].departments).toEqual(['Prod RF','Prod Conv']);
 await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByLabel('Disable this PIC account').check();await page.getByRole('button',{name:'Save PIC',exact:true}).click();
 await expect(page.getByRole('cell',{name:'Disabled',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Activities',exact:true}).click();
 await page.getByRole('button',{name:'New Activity',exact:true}).click();
 await expect(page.getByLabel('PIC / Owner',{exact:true})).toBeEnabled();
 await page.getByLabel('Department',{exact:true}).selectOption('Prod Conv');
 await expect(page.getByLabel('Activity ID',{exact:true})).toHaveValue('Automatic on save');
 await page.getByLabel('Cost down initiative *',{exact:true}).fill('Admin initiative');
 await page.getByLabel('PIC / Owner',{exact:true}).fill('Assigned PIC');
 await page.getByLabel('AREA',{exact:true}).fill('RF Line 1');
 await page.getByLabel('Start Date',{exact:true}).fill('2026-01-01');
 await page.getByLabel('Planned Saving (RM / month)',{exact:true}).fill('100');
 await page.getByLabel('Jan Actual Saving (RM)',{exact:true}).fill('40');
 await page.getByLabel('Feb Actual Saving (RM)',{exact:true}).fill('60');
 await expect(page.getByLabel('PIC-Reported Actual Total (RM)',{exact:true})).toHaveValue(/100/);
 await expect(page.getByLabel('Annual Planned Saving (RM)',{exact:true})).toHaveValue(/1,200/);
 await page.getByLabel('Start Date',{exact:true}).fill('2026-09-01');
 await expect(page.getByLabel('Annual Planned Saving (RM)',{exact:true})).toHaveValue(/400/);
 await expect(page.getByLabel('Jan Actual Saving (RM)',{exact:true})).toBeDisabled();
 await expect(page.getByLabel('Sep Actual Saving (RM)',{exact:true})).toBeEnabled();
 await expect(page.getByLabel('PIC-Reported Actual Total (RM)',{exact:true})).toHaveValue(/0/);
 await page.getByLabel('Start Date',{exact:true}).fill('2026-01-01');
 await page.getByLabel('Attach activity picture').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
 await expect(page.getByRole('button',{name:'View activity picture',exact:true})).toBeVisible();
 await expect(page.getByLabel('Finance Approval',{exact:true})).toBeDisabled();
 await page.route('**/api/activities',async r=>r.fulfill({json:r.request().method()==='POST'?{...r.request().postDataJSON().activity,id:'2610RF01'}:[]}));
 await page.getByRole('button',{name:'Save Activity',exact:true}).click();
 await expect(page.getByRole('cell',{name:'Admin initiative',exact:false})).toBeVisible();
 await expect(page.getByRole('cell',{name:'RF Line 1',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'View activity picture',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Activity picture',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Close picture',exact:true}).click();
 await page.getByRole('button',{name:'Edit',exact:true}).click();
 await page.getByLabel('Cost down initiative *',{exact:true}).fill('Admin edited initiative');
 await page.getByLabel('Oct Actual Saving (RM)',{exact:true}).fill('25');
 await expect(page.getByLabel('Finance Approval',{exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Save Activity',exact:true}).click();
 await expect(page.getByRole('cell',{name:'Admin edited initiative',exact:false})).toBeVisible();

 let catalog=structuredClone(defaultCatalog);
 await page.route('**/api/admin/catalog',async r=>{const body=r.request().postDataJSON();catalog[body.kind].push({name:body.label,label:body.label,...(body.kind==='departments'?{code:body.code}:{})});await r.fulfill({json:catalog});});
 await page.getByRole('button',{name:'Admin',exact:true}).click();
 await page.getByLabel('Department name',{exact:true}).fill('Assembly');await page.getByLabel('Department code',{exact:true}).fill('AS');await page.getByRole('button',{name:'Add entry',exact:true}).click();
 await expect(page.getByRole('cell',{name:'Assembly',exact:true})).toBeVisible();
 await page.getByLabel('Manage list',{exact:true}).selectOption('categories');await page.getByLabel('Category name',{exact:true}).fill('Packaging');await page.getByRole('button',{name:'Add entry',exact:true}).click();
 await expect(page.getByRole('cell',{name:'Packaging',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Activities',exact:true}).click();await page.getByRole('button',{name:'New Activity',exact:true}).click();
 await page.getByLabel('Department',{exact:true}).selectOption('Assembly');await page.getByLabel('Category',{exact:true}).selectOption('Packaging');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();

});

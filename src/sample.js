export const departments=['Prod RF','Prod Conv','Quality Mgmt','RnD','Mat Mgmt','Maintenance','DTU','OIS'];
export const demo=[
 ['DEMO-001','Prod RF','Reduce roll-form material scrap','Material','RF Engineer','High','In Progress','2026-10-01','2026-12-15',180000,100000,85000,65,'Approved','Verified','Check scrap rate after tooling adjustment'],
 ['DEMO-002','Prod Conv','Improve cutting yield','Process','Conv Engineer','High','At Risk','2026-10-01','2026-11-25',160000,80000,65000,50,'Approved','Verified','Trial yield below target'],
 ['DEMO-003','Quality Mgmt','Reduce customer defect claims','Quality','QA Lead','Medium','In Progress','2026-09-15','2026-12-10',90000,58000,50000,70,'Approved','Verified','Confirm defect trend'],
 ['DEMO-004','RnD','Material substitution trial','Material','R&D Lead','High','Not Started','2026-10-20','2027-01-20',130000,0,0,10,'Pending','Pending','Awaiting customer approval'],
 ['DEMO-005','Mat Mgmt','Supplier consolidation','Procurement','Material Lead','High','Completed','2026-08-15','2026-10-10',210000,205000,195000,100,'Approved','Verified','Annualize contract savings'],
 ['DEMO-006','Maintenance','Reduce energy consumption','Energy','Maintenance Lead','Medium','In Progress','2026-09-01','2026-12-30',75000,42000,35000,55,'Approved','Verified','Meter reading verification'],
 ['DEMO-007','DTU','Digitize downtime recording','Automation','DTU Lead','Medium','In Progress','2026-09-20','2026-12-31',110000,30000,25000,60,'Approved','Verified','Quantify labor hours saved'],
 ['DEMO-008','OIS','Optimize office consumables','Administration','OIS Lead','Low','Completed','2026-08-01','2026-10-01',70000,56000,50000,100,'Approved','Verified','Quarterly supplier review'],
 ['DEMO-009','Prod RF','Changeover loss reduction','Process','RF Supervisor','High','At Risk','2026-10-01','2026-11-20',50000,12000,0,35,'Pending','Pending','Tooling delay'],
 ['DEMO-010','Prod Conv','Packaging material reduction','Material','Conv Supervisor','Medium','In Progress','2026-10-10','2027-01-10',40000,9000,0,20,'Pending','Pending','Await first batch'],
].map((a,i)=>({id:a[0],department:a[1],item:a[2],category:a[3],pic:a[4],priority:a[5],status:a[6],start:a[7],target:a[8],plan:a[9],reported:a[10],verified:a[11],progress:a[12],hod:a[13],finance:a[14],next:a[15],updated:'2026-10-25',evidence:'',_row:i+5}));

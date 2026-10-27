export const defaultCatalog={
 departments:[['Prod RF','RF'],['Prod Conv','CV'],['Quality Mgmt','QM'],['RnD','RD'],['Mat Mgmt','MM'],['Maintenance','MT'],['DTU','DT'],['OIS','OS']].map(([name,code])=>({name,label:name,code})),
 categories:['Material','Process','Quality','Energy','Procurement','Automation','Administration','Other'].map(name=>({name,label:name})),
};
export const catalogLabel=(catalog,kind,name)=>catalog[kind].find(item=>item.name===name)?.label||name;

import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const template=JSON.parse(html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
for(const m of template.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) if(m[1].trim()) new vm.Script(m[1]);
const source=template.slice(template.indexOf('class Component extends DCLogic'),template.lastIndexOf('</script>'));
let seq=0,confirm=true,local=new Map(),cookie=new Map();
const context=vm.createContext({DCLogic:class {},Date,Math,Promise,setTimeout,clearTimeout,URLSearchParams,
 C:new Proxy({},{get:()=> '#64748b'}),H:(tag,props,...children)=>({tag,props:props||{},children:children.flat(Infinity)}),
 uid:prefix=>prefix+'_'+(++seq),pad:n=>String(n).padStart(2,'0'),COUNTRIES:['Singapore'],
 location:{search:'',protocol:'https:'},navigator:{userAgent:'iPhone Safari',language:'en'},screen:{width:390,height:844},
 localStorage:{getItem:k=>local.get(k),setItem:(k,v)=>local.set(k,v)},
 document:{get cookie(){return [...cookie].map(([k,v])=>k+'='+v).join('; ');},set cookie(v){const [k,val]=v.split(';')[0].split('=');cookie.set(k,val);}},
 window:{confirm:()=>confirm,prompt:()=> 'Urgent family matter'}});
vm.runInContext(source+'\nglobalThis.App=Component;',context);
function fresh(){
 const app=new context.App();app.org={id:'org',employees:[{id:'a',name:'Yra'},{id:'b',name:'Niro'}],leaves:[],shifts:[],leaveTypes:[{name:'Annual',days:14}],activity:[]};
 app.emp=app.org.employees[1];app.session={type:'worker',orgId:'org',empId:'b'};app.db={orgs:[app.org]};
 app.flash=m=>app.message=m;app.forceUpdate=()=>{};app.setState=p=>Object.assign(app.state,p);app.t=s=>s;
 app.pullRemote=async()=>true;app.pushRemote=async()=>{app._online=true;return true;};app.log=()=>{};
 return app;
}
const leave=(id,empId,from,to=from,status='approved')=>({id,empId,from,to,status,days:Math.round((new Date(to)-new Date(from))/864e5)+1,type:'Annual'});
let a=fresh();a.org.leaves=[leave('old','a','2026-11-05','2026-11-12','pending')];
assert.equal(a.leaveEntries().length,8);await a.decideLeave('old@2026-11-05','approved');
assert.equal(a.leaveEntries().filter(x=>x.status==='approved').length,1);
assert.equal(a.leaveEntries().filter(x=>x.status==='pending').length,7);
await a.decideLeave('old@2026-11-06','rejected');assert.equal(a.leaveEntries()[1].status,'rejected');
assert.equal(a.org.leaves[0].from,'2026-11-05','Historical range retained');
a=fresh();a.org.leaves=[leave('booked','a','2026-10-31')];a.state.draft={lfrom:'2026-10-29',lto:'2026-10-31'};
await a.submitLeave('normal');assert.equal(a.org.leaves.length,1,'Overlap requires an explicit choice');
await a.submitLeave('clear');assert.deepEqual(a.org.leaves.slice(1).map(x=>x.from),['2026-10-29','2026-10-30']);
a.state.draft={lfrom:'2026-10-31',lto:'2026-10-31'};await a.submitLeave('appeal');assert.equal(a.org.leaves.length,3,'Appeal reason required');
a.state.draft.lappealReason='Urgent family matter';await a.submitLeave('appeal');assert.equal(a.org.leaves[3].appeal,true);
assert.equal(a.org.leaves[3].status,'pending');const appealId=a.leaveEntries().find(x=>x.appeal).id;
confirm=false;await a.decideLeave(appealId,'approved');assert.equal(a.leaveEntries().find(x=>x.id===appealId).status,'pending');
confirm=true;await a.decideLeave(appealId,'approved');assert.equal(a.leaveEntries().find(x=>x.id===appealId).status,'approved');
a.org.allowOverlappingLeave=true;a.state.draft={lfrom:'2026-10-31',lto:'2026-10-31'};await a.submitLeave('normal');assert.match(a.message,/already have leave/,'Same-worker duplicate blocked even when overlap allowed');
a=fresh();a.org.allowOverlappingLeave=true;a.org.leaves=[leave('booked','a','2026-10-31')];a.state.draft={lfrom:'2026-10-31',lto:'2026-10-31'};await a.submitLeave('normal');assert.equal(a.org.leaves.length,2);assert.equal(a.org.leaves[1].appeal,false);
a=fresh();a.state.draft={lfrom:'2026-11-12',lto:'2026-11-05'};await a.submitLeave('normal');assert.equal(a.org.leaves.length,0);
assert.equal(a.leaveDates('2026-02-30','2026-03-01').length,0);assert.equal(a.leaveDates('2028-02-28','2028-03-01').length,3);
a.org.leaves=[leave('range','b','2026-12-31','2027-01-02','pending')];a.org.shifts=[{id:'s1',empId:'b',date:'2026-12-31'},{id:'s2',empId:'b',date:'2027-01-01'}];
await a.decideLeave('range@2026-12-31','approved');assert.equal(a.org.shifts[0].cancelled,true);assert.equal(a.org.shifts[1].cancelled,undefined);
assert.equal(a.leaveEntries().filter(l=>l.status==='approved'&&l.from.startsWith('2026')).reduce((s,l)=>s+l.days,0),1);
await a.workerLeaveDay('range@2027-01-01',false);assert.equal(a.leaveEntries()[1].status,'withdrawn');assert.equal(a.leaveEntries()[2].status,'pending');
a=fresh();a.pullRemote=async()=>false;a.state.draft={lfrom:'2026-11-05',lto:'2026-11-05'};await a.submitLeave('normal');assert.equal(a.org.leaves.length,0,'Offline submission blocked');
// Revalidate writes against changes that arrive between reading and saving.
a=fresh();const remote={...a.org,leaves:[leave('other','a','2026-10-31')]};a.org.leaves=[leave('new','b','2026-10-31','2026-10-31','pending')];
assert.throws(()=>a.validateLeaveWrite(a.org,remote),/Leave changed/);
a.org.leaves[0].appeal=true;assert.doesNotThrow(()=>a.validateLeaveWrite(a.org,remote));
// Device backup recovery selects only an ID that matches the approved registration.
a=fresh();local.set('attenda_device_id_v1','dev2_regenerated');cookie.set('attenda_device_id_v1','dev2_approved');
a.idbGetDeviceId=async()=> 'dev2_approved';a.idbSetDeviceId=()=>{};a.legacyFp=()=> 'dev_old';
await a.initDeviceId();assert.equal(a.deviceOk({device:{fp:'dev2_approved'}}),true);assert.equal(local.get('attenda_device_id_v1'),'dev2_approved');
assert.equal(a.deviceOk({device:{fp:'dev2_unrelated'}}),false);context.navigator.userAgent='iPhone Safari updated';assert.equal(a.fp(),'dev2_approved');
// Render worker/admin views from real methods and inspect the individual dates and actions.
a=fresh();a.org.leaves=[leave('range','b','2026-11-05','2026-11-12','pending')];
let rendered=JSON.stringify(a.tLeave());assert.match(rendered,/5 Nov/);assert.match(rendered,/12 Nov/);assert.equal((rendered.match(/"Approve"/g)||[]).length,16);
a.state.draft={lfrom:'2026-11-05',lto:'2026-11-06'};rendered=JSON.stringify(a.wLeave());assert.match(rendered,/Recall day/);assert.match(rendered,/duplicate/);
console.log('Passed: daily approvals, appeals, overlap settings, duplicates, dates, balances, shift cancellation, recall, offline checks, write-time conflicts, device recovery and UI rendering.');
// Exercise the actual cloud writer with stale sessions and compare-and-swap retries.
function cloud(app,initial,onFirstWrite){
 let stored=structuredClone(initial),version='2026-09-21T00:00:00.000Z',writes=0;
 app.pushRemote=context.App.prototype.pushRemote;app.sb={from:()=>({
  select:()=>({eq:()=>({maybeSingle:async()=>({data:{value:structuredClone(stored),updated_at:version}})})}),
  update:body=>{let expected;const q={eq:(k,v)=>{if(k==='updated_at')expected=v;return q;},is:()=>q,select:async()=>{
    writes++;if(writes===1&&onFirstWrite){stored=onFirstWrite(stored);version='2026-09-21T00:00:01.000Z';return {data:[]};}
    if(expected!==version)return {data:[]};stored=structuredClone(body.value);version=body.updated_at;return {data:[{key:'attenda_portal_db'}]};
  }};return q;}
 })};return {read:()=>stored,writes:()=>writes};
}
a=fresh();a.emp.device={fp:'dev2_old',savedAt:'2026-09-01T00:00:00Z'};
let db=structuredClone(a.db);db.orgs[0].employees[1].device={fp:'dev2_new',savedAt:'2026-09-20T00:00:00Z'};
let server=cloud(a,db);await a.pushRemote();assert.equal(server.read().orgs[0].employees[1].device.fp,'dev2_new','A stale session cannot undo newer device approval');
a=fresh();server=cloud(a,a.db,s=>{s.orgs.push({id:'other',employees:[]});return s;});await a.pushRemote();assert.equal(server.writes(),2);assert.equal(server.read().orgs.length,2,'CAS retries preserve another org added concurrently');
a=fresh();db=structuredClone(a.db);a.org.leaves=[leave('new','b','2026-10-31','2026-10-31','pending')];
server=cloud(a,db,s=>{s.orgs[0].leaves.push(leave('racing','a','2026-10-31'));return s;});await a.pushRemote();
assert.equal(a._online,false);assert.equal(server.read().orgs[0].leaves.length,1,'Concurrent conflicting submission is not written');
a=fresh();a.org.leaves=[leave('range','b','2026-11-05','2026-11-06','pending')];db=structuredClone(a.db);
db.orgs[0].leaves[0].dayDecisions={'2026-11-05':{status:'approved',updatedAt:'2026-09-21T01:00:00Z'}};
server=cloud(a,db);await a.pushRemote();assert.equal(server.read().orgs[0].leaves[0].dayDecisions['2026-11-05'].status,'approved');
console.log('Passed: actual cloud-write merge, device approval preservation, concurrent-save retry, competing leave submission and per-day decision preservation.');
if(process.env.ATTENDA_PREVIEW){
 context.C={surface:'#fff',surface2:'#f8fafc',sink:'#f1f5f9',text:'#17202a',muted:'#64748b',faint:'#94a3b8',border:'#e2e8f0',border2:'#cbd5e1',violet:'#7356d8',violetSoft:'#ede9fe',green:'#16805d',greenSoft:'#e6f7ee',red:'#b83a40',redSoft:'#fff0f0',amber:'#9b640c',amberSoft:'#fff6df',blue:'#2563eb'};
 const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 const render=n=>{if(n==null||typeof n==='boolean')return '';if(typeof n!=='object')return esc(n);const p=n.props||{};
  const attrs=Object.entries(p).filter(([k,v])=>!['style','key'].includes(k)&&!k.startsWith('on')&&v!==false&&v!=null).map(([k,v])=>' '+k+'="'+esc(v)+'"').join('');
  const style=Object.entries(p.style||{}).map(([k,v])=>k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+':'+(typeof v==='number'&&!['fontWeight','flex','opacity','zIndex','lineHeight'].includes(k)?v+'px':v)).join(';');
  return '<'+n.tag+attrs+' style="'+esc(style)+'">'+n.children.map(render).join('')+'</'+n.tag+'>';};
 a=fresh();a.org.leaves=[leave('reserved','a','2026-10-31'),leave('range','b','2026-11-05','2026-11-12','pending')];a.state.draft={lfrom:'2026-10-29',lto:'2026-10-31'};
 fs.writeFileSync(process.env.ATTENDA_PREVIEW,'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Attenda leave preview</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f1f5f9;color:#17202a;margin:0;padding:24px}main{max-width:1100px;margin:auto}section{margin-bottom:32px}h1{font-size:25px}h2{font-size:18px}button,input,select{font-family:inherit}</style><main><h1>Attenda · Leave</h1><section style="max-width:620px"><h2>Worker: overlapping dates</h2>'+render(a.wLeave())+'</section><section><h2>Employer: approve each day</h2>'+render(a.tLeave())+'</section></main>');
}

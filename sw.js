const CACHE='frigotrack-v1';
const FILES=['./','./index.html','./manifest.json','./icon.svg'];

self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});

/* Vérification en arrière-plan (Periodic Background Sync) */
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open('frigotrack',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function dbGet(k){return openDB().then(db=>new Promise((res,rej)=>{const q=db.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)}))}
function dbSet(k,v){return openDB().then(db=>new Promise((res,rej)=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=()=>res();t.onerror=()=>rej(t.error)}))}
const todayStr=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
function daysLeft(ds){const [y,m,d]=ds.split('-').map(Number);const t=new Date();const a=new Date(t.getFullYear(),t.getMonth(),t.getDate());return Math.round((new Date(y,m-1,d)-a)/86400000)}
async function check(){
  const s=await dbGet('state');if(!s||!s.products||!s.products.length)return;
  const now=new Date(),t=todayStr();
  if(s.settings.lastNotif===t||now.getHours()<(s.settings.hour||18))return;
  const delay=s.settings.delay||15;
  const per=s.products.filter(p=>daysLeft(p.date)<0),bi=s.products.filter(p=>{const n=daysLeft(p.date);return n>=0&&n<=delay});
  if(!per.length&&!bi.length)return;
  const body=[per.length?`${per.length} périmé(s) : ${per.slice(0,3).map(p=>p.name).join(', ')}${per.length>3?'…':''}`:'',bi.length?`${bi.length} à consommer sous ${delay} j : ${bi.slice(0,3).map(p=>p.name).join(', ')}${bi.length>3?'…':''}`:''].filter(Boolean).join('\n');
  await self.registration.showNotification('🍑 FrigoTrack',{body,icon:'./icon.svg',badge:'./icon.svg',tag:'frigotrack-daily'});
  s.settings.lastNotif=t;await dbSet('state',s);
}
self.addEventListener('periodicsync',e=>{if(e.tag==='frigotrack-check')e.waitUntil(check())});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window'}).then(cs=>cs.length?cs[0].focus():clients.openWindow('./')))});

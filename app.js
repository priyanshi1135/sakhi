/* =========================================================
   SAKHI demo – app state, SOS / journey engines, screens, dashboard and actions
   ========================================================= */
let S;
function load(){ try{ const s = localStorage.getItem('sakhi_demo_v1'); if(s){ S = Object.assign(SEED(), JSON.parse(s)); S.sos=null; S.journey=null; S.cab=null; S.fake=null; S.prompt=null; S.toast=null; return; } }catch(e){} S = SEED(); }
function save(){ try{ const keep = {...S, sos:null, journey:null, cab:null, fake:null, prompt:null, toast:null, log:S.log.slice(-80)}; localStorage.setItem('sakhi_demo_v1', JSON.stringify(keep)); }catch(e){} }
load();

/* ---------- Hindi labels ---------- */
const HI = {
  'Hi':'नमस्ते', 'Tap or shake phone':'टैप करें या फ़ोन हिलाएँ', 'Start Journey':'यात्रा शुरू करें', 'Safe Route':'सुरक्षित रास्ता', 'Fake Call':'नकली कॉल',
  'Nearby Help':'नज़दीकी मदद', 'Cab Safety':'कैब सुरक्षा', 'Safety Map':'सुरक्षा मानचित्र', 'Evidence Vault':'सबूत तिजोरी', 'Legal Aid':'कानूनी सहायता',
  'Home':'होम', 'Map':'मानचित्र', 'Journey':'यात्रा', 'Profile':'प्रोफ़ाइल', 'trusted contacts':'भरोसेमंद संपर्क',
  'Know your rights':'अपने अधिकार जानें', 'How to file an FIR':'FIR कैसे दर्ज करें', 'Helplines':'हेल्पलाइन', 'Self-defence tips':'आत्मरक्षा के उपाय',
  'I am safe – Enter PIN':'मैं सुरक्षित हूँ – PIN डालें', 'Call 112':'112 पर कॉल करें', 'SOS ACTIVE':'SOS सक्रिय', 'Alerts sent':'भेजे गए अलर्ट'
};
const T = s => (S.user.lang==='hi' && HI[s]) ? HI[s] : s;

/* ---------- logging ---------- */
function log(tag,msg){ S.log.push({t:hms(now()),tag,msg}); if(S.log.length>200) S.log.shift(); if(S.tab!=='log') S.unseen.log++; renderPanelLight(); }
function notifyContact(n){ S.inbox.unshift({...n, time:hhmm(now())}); if(S.tab!=='contact') S.unseen.contact++; }
function notifyGuardian(n){ S.gInbox.unshift({...n, time:hhmm(now())}); if(S.tab!=='guardian') S.unseen.guardian++; }
function toast(msg,ms=2600){ S.toast=msg; renderPhone(); clearTimeout(toast._t); toast._t=setTimeout(()=>{ S.toast=null; renderPhone(); }, ms); }

/* ---------- audio (siren, ringtone, voice) ---------- */
let AC=null; function ac(){ if(!AC){ try{ AC=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } return AC; }
let siren=null;
function sirenOn(){ const a=ac(); if(!a||siren) return; const o=a.createOscillator(), g=a.createGain(); o.type='sawtooth'; g.gain.value=.08; o.connect(g); g.connect(a.destination); o.start(); let up=true; siren={o,g,iv:setInterval(()=>{ o.frequency.linearRampToValueAtTime(up?1250:650, a.currentTime+.45); up=!up; },450)}; }
function sirenOff(){ if(!siren) return; clearInterval(siren.iv); try{ siren.o.stop(); }catch(e){} siren=null; }
let ring=null;
function ringOn(){ const a=ac(); if(!a||ring) return; ring=setInterval(()=>{ [0,.25].forEach(d=>{ const o=a.createOscillator(), g=a.createGain(); o.frequency.value=d?480:440; g.gain.setValueAtTime(.12,a.currentTime+d); g.gain.exponentialRampToValueAtTime(.001,a.currentTime+d+.22); o.connect(g); g.connect(a.destination); o.start(a.currentTime+d); o.stop(a.currentTime+d+.24); }); },1200); }
function ringOff(){ clearInterval(ring); ring=null; }
function speak(text){ try{ const u=new SpeechSynthesisUtterance(text); u.lang='en-IN'; u.rate=.95; speechSynthesis.cancel(); speechSynthesis.speak(u); }catch(e){} }

/* ---------- microphone evidence (real if allowed) ---------- */
let mic={rec:null,chunks:[],stream:null,real:false};
async function micStart(){
  mic={rec:null,chunks:[],stream:null,real:false};
  try{ const st=await navigator.mediaDevices.getUserMedia({audio:true}); const rec=new MediaRecorder(st); rec.ondataavailable=e=>{ if(e.data&&e.data.size) mic.chunks.push(e.data); }; rec.start(2000); mic={rec,chunks:[],stream:st,real:true}; $('#realStatus').textContent='Microphone is recording real audio for the evidence vault.'; }
  catch(e){ $('#realStatus').textContent='Microphone not available here, so evidence recording is simulated.'; }
}
function micStop(){ return new Promise(res=>{ if(!mic.real||!mic.rec){ res(null); return; } mic.rec.onstop=()=>{ const blob=new Blob(mic.chunks,{type:mic.rec.mimeType||'audio/webm'}); mic.stream.getTracks().forEach(t=>t.stop()); res(URL.createObjectURL(blob)); }; try{ mic.rec.stop(); }catch(e){ res(null); } }); }

/* =========================================================
   SOS ENGINE  (Algorithm 3.1)
   ========================================================= */
function triggerSOS(trigger){
  if(!S.user.registered){ toast('Register first to use SOS (or tap “Quick demo login”).'); return; }
  if(!S.contacts.length){ toast('Add at least one trusted contact before using SOS.'); go('contacts'); return; }
  if(S.sos && S.sos.active){ if(S.sos.silent){ S.pinMode='sos'; S.pinBuf=''; go('pin'); } else go('sos'); return; }
  ac();
  S.sos={ active:false, countdown:3, trigger, id:uid('s'), start:null, alerts:[], parts:0, trail:[{...S.loc}], silent:false, guardian:null, smsRounds:0, lastSms:0, elapsed:0, siren:false };
  log('App',`SOS triggered by ${trigger==='SHAKE'?'shake gesture':trigger==='POWER'?'power button ×3':trigger==='VOICE'?'voice keyword “'+S.user.keyword+'”':'SOS button'} – 3-second cancel window started`);
  try{ navigator.vibrate && navigator.vibrate([200,100,200]); }catch(e){}
  go('countdown');
}
function cancelSOS(){ log('App','SOS cancelled within 3 seconds – no alert sent'); S.sos=null; go('home'); toast('SOS cancelled. No alert was sent.'); }
function activateSOS(){
  const s=S.sos; s.active=true; s.start=now(); s.cloud=S.online; const loc=toLatLng(S.loc);
  const msg=`SOS! ${S.user.name} needs help. Location: https://maps.google.com/?q=${loc.lat},${loc.lng} Time: ${hhmm(now())} Battery: ${S.battery}% - SAKHI`;
  s.msg=msg;
  go('sos');
  if(S.online){
    log('Firestore',`sosEvents/${s.id} created {trigger:${s.trigger}, lat:${loc.lat}, lng:${loc.lng}}`);
    setTimeout(()=>{ log('Function',`onSosCreated(${s.id}) triggered – reading ${S.contacts.length} trusted contacts`); },500);
    S.contacts.forEach((c,i)=>setTimeout(()=>{
      if(!S.sos||S.sos.id!==s.id) return;
      if(c.app){ log('FCM',`Push sent to ${c.name}: “${S.user.name} needs help” + live-tracking link`); }
      log('SMS',`SMS gateway → ${c.name} (${c.phone}): ${msg.slice(0,58)}…`);
      s.alerts.push({name:c.name, how:c.app?'Push + SMS':'SMS', ok:true});
      if(c.id==='c1') notifyContact({type:'alert',title:`🚨 ${S.user.name} needs help!`,body:`SOS from SAKHI. Tap to see live location. Battery ${S.battery}%.`});
      renderPhone(); renderPanel();
    }, 1000+i*700));
    setTimeout(guardiansNotify, 1000+S.contacts.length*700+300);
  } else {
    log('App','No internet – sending SOS SMS directly from the phone’s SIM');
    S.contacts.forEach((c,i)=>setTimeout(()=>{
      if(!S.sos||S.sos.id!==s.id) return;
      log('SMS',`SIM SMS → ${c.name} (${c.phone}): ${msg.slice(0,58)}…`);
      s.alerts.push({name:c.name, how:'SMS (offline)', ok:true});
      if(c.id==='c1') notifyContact({type:'sms',title:`SMS from ${S.user.name}`,body:msg});
      renderPhone(); renderPanel();
    }, 800+i*600));
    s.smsRounds=1;
  }
  const primary=S.contacts.find(c=>c.primary)||S.contacts[0];
  setTimeout(()=>{ if(S.sos&&S.sos.id===s.id){ log('App',`Calling primary contact ${primary.name} (${primary.phone})`); s.alerts.push({name:primary.name,how:'Call placed',ok:true}); renderPhone(); } }, 2600);
  micStart(); log('Storage','Evidence recording started – uploading 10-second parts');
}
function guardiansNotify(){
  const s=S.sos; if(!s||!s.active) return;
  const near=S.guardians.filter(g=>g.status==='VERIFIED'&&g.available&&dist(g,S.loc)*KM_PER_PX<=2);
  const far=S.guardians.filter(g=>g.status==='VERIFIED'&&g.available&&dist(g,S.loc)*KM_PER_PX>2);
  if(!S.online){ log('App','Guardian alerts need internet – skipped while offline'); return; }
  near.forEach(g=>{ log('Function',`Guardian ${g.name} is ${(dist(g,S.loc)*KM_PER_PX).toFixed(1)} km away – nearby SOS alert sent`); if(g.id==='g1'){ s.gNotified=true; } if(g.id==='g1') notifyGuardian({type:'alert',title:'Nearby SOS (approx. location)',body:`A SAKHI user needs help about ${(dist(g,S.loc)*KM_PER_PX).toFixed(1)} km from you.`,sos:s.id}); });
  far.forEach(g=>log('Function',`Guardian ${g.name} is ${(dist(g,S.loc)*KM_PER_PX).toFixed(1)} km away – outside 2 km, not alerted`));
  s.alerts.push({name:`${near.length} guardian(s) nearby`,how:'Notified',ok:near.length>0});
  renderPhone(); renderPanel();
}
async function resolveSOS(){
  const s=S.sos; if(!s) return;
  sirenOff(); const url=await micStop();
  const secs=Math.round((now()-s.start)/1000);
  S.evidence.unshift({id:s.id,date:s.start.toISOString(),parts:Math.max(1,s.parts),secs,url,locked:new Date(Date.now()+30*864e5).toISOString()});
  S.history.unshift({id:s.id,user:S.user.name,trigger:s.trigger,start:s.start.toISOString(),status:'RESOLVED',area:nearestPlace(S.loc),silent:s.silent});
  log('Firestore',`sosEvents/${s.id} status = RESOLVED`);
  if(S.online){ log('Function','onSosResolved – “user is safe” message sent'); }
  S.contacts.forEach(c=>log(S.online?'FCM':'SMS',`${c.name}: “${S.user.name} is safe now.”`));
  notifyContact({type:'safe',title:`✅ ${S.user.name} is safe`,body:'The SOS has been stopped with the correct PIN.'});
  if(s.guardian) notifyGuardian({type:'safe',title:'SOS resolved',body:'Thank you for responding. The user is safe.'});
  S.sos=null; save(); go('home'); toast('You are marked safe. Your contacts have been informed.');
}
function wrongPinSilent(){
  const s=S.sos; s.silent=true;
  log('App','Wrong PIN entered – showing “stopped” screen but SOS continues silently');
  log('Firestore',`sosEvents/${s.id} {silentMode:true} – contacts warned of possible duress`);
  notifyContact({type:'alert',title:'⚠️ Possible duress',body:`${S.user.name}'s SOS was “stopped” with a wrong PIN. Tracking continues silently.`});
  sirenOff(); go('fakeStopped');
}

/* =========================================================
   JOURNEY (Algorithm 3.3)
   ========================================================= */
function startJourney(route){
  const r=route; const exp=r.min;
  S.journey={ ids:r.ids, dest:N[r.ids[r.ids.length-1]].name, expMin:exp, elapsed:0, progress:0, moving:true, prompted:false, promptLeft:0, alerted:false, lowBat:false, trail:[{...S.loc}], watching:['Mummy','Ananya (friend)'] };
  log('Firestore',`journeys/${uid('j')} created – destination ${S.journey.dest}, expected in ${exp} min`);
  log('FCM','Live-tracking link shared with Mummy and Ananya');
  notifyContact({type:'info',title:`🧭 ${S.user.name} started a journey`,body:`To ${S.journey.dest}. Expected arrival in ${exp} min. Tap to watch live.`});
  go('journey');
}
function endJourney(safe){
  const j=S.journey; if(!j) return;
  log('Firestore',`journey status = ${safe?'COMPLETED':'ALERTED'}`);
  if(safe){ notifyContact({type:'safe',title:`✅ ${S.user.name} reached safely`,body:`Arrived at ${j.dest}.`}); log('FCM','Contacts notified: reached safely'); }
  S.journey=null; S.prompt=null; go('home'); if(safe) toast('Journey ended. Your contacts know you are safe.');
}

/* =========================================================
   TICKER
   ========================================================= */
let lastTick=Date.now();
setInterval(()=>{
  const realDt=(Date.now()-lastTick)/1000; lastTick=Date.now();
  const demoMin = realDt / S.speed;           // demo minutes passed
  $('#clock').textContent = hhmm(now());
  // SOS countdown
  if(S.sos && !S.sos.active){ S.sos.countdown-=realDt; if(S.sos.countdown<=0){ activateSOS(); } else renderPhone(); }
  // SOS active
  else if(S.sos && S.sos.active){
    const s=S.sos; s.elapsed+=realDt;
    if(Math.floor(s.elapsed/2)>Math.floor((s.elapsed-realDt)/2)){ // every 2 s ≈ location update
      S.loc={x:Math.max(10,Math.min(390,S.loc.x+(Math.random()-.5)*10)), y:Math.max(10,Math.min(320,S.loc.y+(Math.random()-.5)*8))};
      s.trail.push({...S.loc}); if(s.trail.length>40) s.trail.shift();
      if(S.online) log('Firestore',`sosEvents/${s.id}/locations ← ${toLatLng(S.loc).lat}, ${toLatLng(S.loc).lng} (battery ${S.battery}%)`);
      s.parts++; if(s.parts%2===0 && S.online) log('Storage',`evidence/${s.id}/part_${String(s.parts/2).padStart(2,'0')}.m4a uploaded`);
    }
    if(!S.online && s.elapsed - s.lastSms > 20){ s.lastSms=s.elapsed; s.smsRounds++; S.contacts.forEach(c=>log('SMS',`SIM SMS (update ${s.smsRounds}) → ${c.name}: new location ${toLatLng(S.loc).lat}, ${toLatLng(S.loc).lng}`)); }
    updSOS(); renderPanelLive();
  }
  // Journey
  if(S.journey){
    const j=S.journey;
    if(j.moving && !j.arrived){ j.elapsed+=demoMin; j.progress=Math.min(1,j.elapsed/(j.expMin*.92)); S.loc=pointAt(pathPts(j.ids),j.progress); j.trail.push({...S.loc}); }
    else j.elapsed+=demoMin;
    if(j.progress>=1 && !j.arrived){ j.arrived=true; log('App','Within 100 m of destination – asking “Are you safe?”'); S.prompt={kind:'arrive'}; }
    if(!j.prompted && !j.arrived && j.elapsed>j.expMin){ j.prompted=true; j.promptLeft=15; S.prompt={kind:'checkin'}; log('Function',`onCheckinMissed – timer expired, asking ${S.user.name} to check in (2 minutes in the real app, 15 s in this demo)`); try{navigator.vibrate&&navigator.vibrate(300);}catch(e){} }
    if(S.prompt && S.prompt.kind==='checkin' && !j.alerted){ j.promptLeft-=realDt; if(j.promptLeft<=0){ j.alerted=true; S.prompt=null; log('Function','No check-in in 2 minutes – alert with last known location sent'); log('FCM','Alert → Mummy, Ananya: missed check-in'); log('SMS','Alert SMS → Mummy, Ananya'); notifyContact({type:'alert',title:`⚠️ ${S.user.name} did not check in`,body:`Expected at ${j.dest}. Last location near ${nearestPlace(S.loc)}.`}); renderPanel(); if(S.screen==='journey') renderPhone(); toast('No answer – your contacts were alerted with your last location.',4000); } }
    if(S.battery<10 && !j.lowBat){ j.lowBat=true; log('Function','Battery below 10% during journey – contacts alerted'); notifyContact({type:'sms',title:`🔋 ${S.user.name}'s battery is low (${S.battery}%)`,body:`Last location near ${nearestPlace(S.loc)}.`}); }
    if(S.screen==='journey') updJourney(); renderPanelLive();
  }
  // Cab deviation countdown
  if(S.cab && S.cab.deviated && !S.cab.alerted){ S.cab.left-=realDt; if(S.cab.left<=0){ S.cab.alerted=true; S.prompt=null; log('Function','No response to deviation prompt in 60 s – trusted contacts alerted'); notifyContact({type:'alert',title:`🚕 Cab route deviation`,body:`${S.user.name}'s cab ${S.cab.no} left the planned route and she did not respond.`}); renderPhone(); } else if(S.prompt&&S.prompt.kind==='cab'){ const el=$('#cabLeft'); if(el) el.textContent=Math.ceil(S.cab.left); } }
  // Fake call scheduled
  if(S.fake && S.fake.wait>0){ S.fake.wait-=realDt; if(S.fake.wait<=0){ go('incoming'); ringOn(); } }
  if(S.screen==='incall' && S.fake){ S.fake.talk+=realDt; const el=$('#talk'); if(el) el.textContent=fmtSec(S.fake.talk); }
  if(S.prompt && S.prompt.kind==='checkin'){ const el=$('#chkLeft'); if(el) el.textContent=Math.max(0,Math.ceil(S.journey.promptLeft))+' s'; }
},500);
function fmtSec(t){ t=Math.floor(t); return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0'); }

/* =========================================================
   PHONE SCREENS
   ========================================================= */
function go(scr){ S.screen=scr; renderPhone(); renderPanel(); }
function sbar(red){ return `<div class="sbar ${red?'red':''}"><span>${hhmm(now())}</span><span>${S.online?'4G ▮▮▮':'No internet ✕'} &nbsp; ${S.battery}%</span></div>`; }
function bar(title,sub,back){ return `<div class="appbar"><h2>${back?`<button class="back" data-a="go" data-s="${back}" aria-label="Back">‹</button>`:''}${title}</h2>${sub?`<p>${sub}</p>`:''}</div>`; }
function navbar(on){ const it=[['home','🏠',T('Home')],['map','🗺️',T('Map')],['journeySetup','🚶',T('Journey')],['profile','👤',T('Profile')]]; return `<nav class="nav" aria-label="App navigation">${it.map(([s,i,l])=>`<button class="${on===s?'on':''}" data-a="go" data-s="${s}"><span class="i">${i}</span>${l}</button>`).join('')}</nav>`; }
const SC = {};

SC.login = () => `${sbar()}<div class="app"><div style="background:var(--navy);color:#fff;text-align:center;padding:34px 20px 28px">
  <div style="width:76px;height:76px;border-radius:50%;background:#fff;color:var(--red);margin:0 auto 10px;display:grid;place-items:center;font-size:34px;font-weight:700">स</div>
  <div style="font-size:30px;font-weight:700;letter-spacing:2px">SAKHI</div><div style="opacity:.85;font-size:14px">Your safety companion</div></div>
  <div class="body">
   ${!S.otpSent?`<div class="field"><label for="ph">Mobile number</label><input class="in" id="ph" inputmode="numeric" maxlength="10" placeholder="10-digit mobile number" value="${esc(S.user.phone)}"></div>
     <button class="big" data-a="sendOtp">Send OTP</button>`
   :`<div class="muted">We sent a 6-digit OTP to +91 ${esc(S.user.phone)}</div><div class="field"><label for="otp">Enter OTP</label><input class="in" id="otp" inputmode="numeric" maxlength="6" placeholder="6-digit OTP" style="letter-spacing:6px;font-size:20px"></div>
     <button class="big" data-a="verifyOtp">Verify &amp; continue</button><button class="big ghost" data-a="resendOtp">Change number</button>`}
   <button class="big ghost" data-a="quickLogin">Quick demo login</button>
   <div class="chips" style="justify-content:center"><button class="chip ${S.user.lang==='en'?'on':''}" data-a="lang" data-l="en">English</button><button class="chip ${S.user.lang==='hi'?'on':''}" data-a="lang" data-l="hi">हिन्दी</button></div>
  </div></div>`;

SC.setup = () => `${sbar()}<div class="app">${bar('Set up your profile','Step 2 of 3')}<div class="body">
  <div class="field"><label for="nm">Your name</label><input class="in" id="nm" value="${esc(S.user.name)}"></div>
  <div class="field"><label for="pin1">Create a 4-digit SOS PIN</label><input class="in" id="pin1" inputmode="numeric" maxlength="4" type="password" placeholder="Only you should know this"></div>
  <div class="field"><label for="kw">Secret voice keyword</label><input class="in" id="kw" value="${esc(S.user.keyword)}"></div>
  <div class="field"><label for="bg">Blood group (optional)</label><input class="in" id="bg" value="${esc(S.user.blood)}"></div>
  <button class="big" data-a="saveSetup">Save and continue</button>
  <p class="muted">The PIN is stored only as a salted hash. It is needed to stop an SOS.</p></div></div>`;

SC.perms = () => `${sbar()}<div class="app">${bar('Allow permissions','Step 3 of 3')}<div class="body">
  ${[['📍','Location – all the time','To share your live location during SOS and journeys'],['🎙️','Microphone','To record audio evidence during SOS and hear your keyword'],['📷','Camera','To record video and scan cab number plates'],['💬','SMS and phone','To send SOS by SMS without internet and call your contact'],['🔔','Notifications','To show alerts and check-in reminders']].map(p=>`<div class="card row" style="align-items:flex-start"><div style="flex:none;font-size:22px">${p[0]}</div><div><b>${p[1]}</b><div class="muted">${p[2]}</div></div></div>`).join('')}
  <button class="big" data-a="allowPerms">Allow and finish</button></div></div>`;

SC.home = () => { const s=S.sos;
  return `${sbar()}<div class="app">${bar(`${T('Hi')}, ${esc(S.user.name.split(' ')[0])}`,`📍 ${esc(nearestPlace(S.loc))}, Indore · ${S.contacts.length} ${T('trusted contacts')}`)}
  <div class="body" style="text-align:center">
    <button class="sos-btn" data-a="trig" data-t="BUTTON" aria-label="Start SOS"><div><b>SOS</b><br><span>${T('Tap or shake phone')}</span></div></button>
    <div class="muted">Power button ×3 · Shake · Say “${esc(S.user.keyword)}”</div>
    ${S.journey?`<button class="card" data-a="go" data-s="journey" style="border:none;text-align:left;width:100%"><b>🧭 Journey in progress</b><div class="muted">To ${esc(S.journey.dest)} – tap to open</div></button>`:''}
    <div class="tiles">
      ${[['journeySetup','🧭','Start Journey'],['route','🛣️','Safe Route'],['fakecall','📞','Fake Call'],['nearby','🏥','Nearby Help'],['cab','🚕','Cab Safety'],['map','🗺️','Safety Map'],['vaultPin','🔒','Evidence Vault'],['legal','⚖️','Legal Aid']].map(t=>`<button class="tile" data-a="go" data-s="${t[0]}"><span class="e">${t[1]}</span>${T(t[2])}</button>`).join('')}
    </div>
  </div></div>${navbar('home')}`; };

SC.countdown = () => `${sbar(true)}<div class="app" style="background:var(--red);color:#fff;text-align:center;justify-content:center;gap:12px;padding:20px">
  <div style="font-size:18px;font-weight:600">Sending SOS in</div><div class="count">${Math.max(1,Math.ceil(S.sos.countdown))}</div>
  <div style="opacity:.9">Phone is vibrating. Tap cancel if this was an accident.</div>
  <button class="big" style="background:#fff;color:var(--red);margin-top:20px" data-a="cancelSOS">Cancel</button></div>`;

SC.sos = () => { const s=S.sos; if(!s) return SC.home();
  const near=POI.filter(p=>p.t!=='shop').map(p=>({...p,d:dist(p,S.loc)*KM_PER_PX})).sort((a,b)=>a.d-b.d);
  const pol=near.find(p=>p.t==='police'), hos=near.find(p=>p.t==='hosp');
  return `${sbar(true)}<div class="app" style="background:var(--red);color:#fff">
  <div style="text-align:center;padding:16px 14px 6px"><div style="font-size:14px;opacity:.9">${T('SOS ACTIVE')} ${S.online?'':'· OFFLINE MODE (SMS)'}</div>
  <div style="font-size:40px;font-weight:700" id="sosTime">${fmtSec(s.elapsed)}</div><div style="font-size:13px;opacity:.9">Sharing live location every 10 seconds</div></div>
  <div class="body" style="color:var(--ink)">
   <div class="card"><h4>${T('Alerts sent')}</h4><div class="list" id="sosAlerts">${alertsHTML()}</div></div>
   <div class="card row"><div><span class="rec">● REC</span> Audio evidence<div class="muted" id="sosParts">${partsTxt()}</div></div><button class="chip ${s.siren?'on':''}" style="flex:none" data-a="siren">🔊 Siren ${s.siren?'on':'off'}</button></div>
   ${s.guardian?`<div class="card" style="border-left:4px solid #6a3fbf"><b>🛡️ ${esc(s.guardian)} (guardian) is coming to help</b></div>`:''}
   <div class="card muted" style="color:var(--ink)">🚓 ${esc(pol.name)} – ${pol.d.toFixed(1)} km<br>🏥 ${esc(hos.name)} – ${hos.d.toFixed(1)} km</div>
   <button class="big" style="background:#fff;color:var(--red)" data-a="call112">📞 ${T('Call 112')}</button>
   ${!S.online?`<a class="big" style="display:block;text-align:center;text-decoration:none;background:#fff;color:var(--red)" href="sms:${S.contacts.map(c=>c.phone.replace(/\s/g,'')).join(',')}?&body=${encodeURIComponent(s.msg||'')}">💬 Send SMS from this phone</a>`:''}
   <button class="big ghost" style="border-color:#fff;color:#fff" data-a="pinStop">${T('I am safe – Enter PIN')}</button>
  </div></div>`; };
function alertsHTML(){ const s=S.sos; if(!s||!s.alerts.length) return '<div class="muted">Sending…</div>'; return s.alerts.map(a=>`<div class="li"><span>${a.ok?'✅':'⚪'}</span><span class="grow">${esc(a.name)}</span><span class="muted">${esc(a.how)}</span></div>`).join(''); }
function updSOS(){ if(S.screen!=='sos') return; const a=$('#sosTime'); if(a) a.textContent=fmtSec(S.sos.elapsed); const b=$('#sosAlerts'); if(b) b.innerHTML=alertsHTML(); const c=$('#sosParts'); if(c) c.textContent=partsTxt(); }
function partsTxt(){ const n=Math.floor(S.sos.parts/2); return S.online? n+' parts uploaded to vault' : n+' parts saved on phone – upload when online'; }

SC.pin = () => `${sbar()}<div class="app" style="background:var(--surface-2)">${bar(S.pinMode==='vault'?'Evidence Vault':'Stop SOS', S.pinMode==='vault'?'Enter your PIN to open recordings':'Enter your 4-digit PIN', S.pinMode==='vault'?'home':(S.sos&&!S.sos.silent?'sos':'home'))}
  <div class="body" style="color:var(--navy)"><div class="dots">${[0,1,2,3].map(i=>`<i class="${i<S.pinBuf.length?'f':''}"></i>`).join('')}</div>
  <div class="keypad">${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k=>k===''?'<span></span>':`<button data-a="key" data-k="${k}" aria-label="${k==='⌫'?'Delete':k}">${k}</button>`).join('')}</div>
  <p class="muted" style="text-align:center">Demo PIN: ${esc(S.user.pin||'1234')}. ${S.pinMode==='sos'?'Try a wrong PIN to see silent mode.':''}</p></div></div>`;

SC.fakeStopped = () => `${sbar()}<div class="app">${bar('SOS stopped','')}<div class="body" style="text-align:center"><div style="font-size:64px">✅</div><h3 style="margin:0">You are marked safe</h3><p class="muted">Your contacts have been informed.</p><button class="big" data-a="go" data-s="home">Go to home</button>
  <p class="muted" style="text-align:left;border-top:1px solid var(--line);padding-top:10px">Demo note: this screen is fake. Because the PIN was wrong, SAKHI keeps sharing location and recording silently. Check Mummy’s phone and the Behind the scenes log.</p></div></div>`;

SC.journeySetup = () => { const rs=computeRoutes(nearestKey(),S.routeTo==='PL'?'MU':S.routeTo); return `${sbar()}<div class="app">${bar('Start a journey','Your contacts can watch your trip live','home')}<div class="body">
  <div class="field"><label for="jdest">Where are you going?</label><select class="in" id="jdest">${Object.keys(N).filter(k=>k!==nearestKey()).map(k=>`<option value="${k}" ${k===S.routeTo?'selected':''}>${esc(N[k].name)}</option>`).join('')}</select></div>
  <div class="card"><h4>Share live location with</h4>${S.contacts.map(c=>`<div class="li"><span class="grow">${esc(c.name)}</span><span class="muted">${c.app?'App':'SMS link'}</span><span>☑</span></div>`).join('')}</div>
  <p class="muted">The safest route is used. Expected time is calculated from the route; if you don’t check in, your contacts are alerted.</p>
  <button class="big" data-a="startJourney">Start journey</button></div></div>${navbar('journeySetup')}`; };
function nearestKey(){ let best='PL',bd=1e9; for(const k in N){ const d=dist(S.loc,N[k]); if(d<bd){bd=d;best=k;} } return best; }

SC.journey = () => { const j=S.journey; if(!j) return SC.journeySetup();
  return `${sbar()}<div class="app">${bar('Journey in progress',`To ${esc(j.dest)}`)}<div class="body">
  <div class="mapbox" id="jmap">${mapSVG({routes:[{ids:j.ids,color:'var(--navy)',w:5,op:.35}],trail:j.trail,dot:S.loc,pulse:true,label:'Journey map'})}</div>
  <div class="card" style="text-align:center"><div class="muted">Expected arrival in</div><div style="font-size:36px;font-weight:700;color:var(--navy)" id="jleft">${Math.max(0,Math.ceil(j.expMin-j.elapsed))} min</div>
  <div class="bar"><i id="jbar" style="width:${Math.round(j.progress*100)}%"></i></div><div class="muted" id="jstat">${j.moving?'Moving':'Stopped'} · ${Math.round(j.progress*100)}% of route</div></div>
  <div class="card"><b>Watching your trip</b>${j.watching.map(w=>`<div class="li"><span class="grow">${esc(w)}</span><span class="pill ok">watching</span></div>`).join('')}</div>
  <button class="big green" data-a="imSafe">✔ I am safe</button>
  <div class="row"><button class="big ghost" data-a="extend">+15 min</button><button class="big red" data-a="trig" data-t="BUTTON">SOS</button></div></div></div>${promptHTML()}${navbar('journeySetup')}`; };
function updJourney(){ const j=S.journey; const m=$('#jmap'); if(!m) return; m.innerHTML=mapSVG({routes:[{ids:j.ids,color:'var(--navy)',w:5,op:.35}],trail:j.trail,dot:S.loc,pulse:true,label:'Journey map'}); $('#jleft').textContent=Math.max(0,Math.ceil(j.expMin-j.elapsed))+' min'; $('#jbar').style.width=Math.round(j.progress*100)+'%'; $('#jstat').textContent=(j.moving?'Moving':'Stopped')+' · '+Math.round(j.progress*100)+'% of route'; if(S.prompt && !$('#prompt')) renderPhone(); }
function promptHTML(){ if(!S.prompt) return ''; const p=S.prompt;
  if(p.kind==='checkin') return `<div class="overlay" id="prompt" style="background:rgba(10,12,30,.55);justify-content:flex-end"><div class="card" style="margin:12px;border-radius:18px"><h4>Are you safe?</h4><p class="muted">Your expected arrival time has passed. If you don’t answer, your contacts will be alerted in <b id="chkLeft"></b>.</p><div class="row"><button class="big green" data-a="imSafe">I am safe</button><button class="big ghost" data-a="extend">+15 min</button></div></div></div>`;
  if(p.kind==='arrive') return `<div class="overlay" id="prompt" style="background:rgba(10,12,30,.55);justify-content:flex-end"><div class="card" style="margin:12px;border-radius:18px"><h4>You have arrived 🎉</h4><p class="muted">You are within 100 m of ${esc(S.journey.dest)}. Tell your contacts you are safe?</p><button class="big green" data-a="imSafe">Yes, I am safe</button></div></div>`;
  if(p.kind==='cab') return `<div class="overlay" id="prompt" style="background:rgba(10,12,30,.55);justify-content:flex-end"><div class="card" style="margin:12px;border-radius:18px;border-left:5px solid var(--red)"><h4>Your cab left the planned route</h4><p class="muted">The cab is more than 500 m away from the route. Are you safe? Contacts will be alerted in <b id="cabLeft">${Math.ceil(S.cab.left)}</b> s.</p><div class="row"><button class="big green" data-a="cabOk">I am safe</button><button class="big red" data-a="trig" data-t="BUTTON">SOS</button></div></div></div>`;
  return ''; }

SC.route = () => { const from=S.routeFrom, to=S.routeTo; S.routes=computeRoutes(from,to); const rs=S.routes; const sel=Math.min(S.selRoute,rs.length-1); const r=rs[sel];
  const cols=['var(--green)','var(--red)','var(--amber)'];
  return `${sbar()}<div class="app">${bar('Safe Route',`${esc(N[from].name)} → ${esc(N[to].name)}`,'home')}<div class="body">
  <div class="row"><select class="in" id="rfrom" aria-label="From">${Object.keys(N).map(k=>`<option value="${k}" ${k===from?'selected':''}>${esc(N[k].name)}</option>`).join('')}</select><select class="in" id="rto" aria-label="To">${Object.keys(N).map(k=>`<option value="${k}" ${k===to?'selected':''}>${esc(N[k].name)}</option>`).join('')}</select></div>
  <div class="mapbox">${mapSVG({routes:rs.map((x,i)=>({ids:x.ids,color:cols[i],w:i===sel?6:3.5,dash:i!==sel,op:i===sel?1:.7})).reverse(),reports:true,pins:[{...N[from],c:'var(--navy)'},{...N[to],c:'var(--red)'}],label:'Route options'})}</div>
  <div class="muted" style="text-align:center">Time of day: <b>${String(S.hour).padStart(2,'0')}:00</b> (change it in Demo controls – scores change)</div>
  ${rs.map((x,i)=>`<button class="card" data-a="selRoute" data-i="${i}" style="border:${i===sel?'2px solid '+cols[i]:'2px solid transparent'};text-align:left;width:100%"><div class="row"><div style="flex:3"><b style="color:${cols[i]}">Route ${String.fromCharCode(65+i)} · ${x.tag}</b><div class="muted">${x.min} min · ${x.km.toFixed(1)} km · via ${esc(x.ids.slice(1,-1).map(k=>N[k].name).join(', ')||'direct road')}</div><div class="muted">${x.reports} unsafe report(s) on the way</div></div><div class="score" style="flex:none;color:${cols[i]}">${x.score}</div></div></button>`).join('')}
  <div class="card"><h4>How Route ${String.fromCharCode(65+sel)} scored ${r.score}</h4><div class="muted">S = 0.30·L + 0.25·P + 0.20·C + 0.25·T − 0.40·R</div>
   ${[['L','Lighting',r.L],['P','Police / hospital nearby',r.P],['C','Crowd',r.C],['T','Time of day',r.T],['R','Unsafe reports',r.R]].map(f=>`<div class="row" style="margin-top:6px"><span style="flex:none;width:22px;font-weight:700">${f[0]}</span><span style="flex:2">${f[1]}</span><div class="bar" style="flex:2"><i style="width:${Math.round(f[2]*100)}%;${f[0]==='R'?'background:var(--red)':''}"></i></div><span style="flex:none;width:34px;text-align:right">${f[2].toFixed(2)}</span></div>`).join('')}</div>
  <button class="big" data-a="routeJourney">Start journey on Route ${String.fromCharCode(65+sel)}</button></div></div>`; };

SC.map = () => `${sbar()}<div class="app">${bar(T('Safety Map'),'Approved reports from the last 90 days')}<div class="body">
  <div class="mapbox">${mapSVG({heat:true,reports:true,scoreRoads:true,dot:S.loc,label:'Safety heatmap'})}</div>
  <div class="chips"><span class="pill bad">Red road: risky</span><span class="pill warn">Yellow: medium</span><span class="pill ok">Green: safer</span></div>
  <div class="card"><h4>Report an unsafe place</h4>
   <div class="chips" role="group" aria-label="Category">${['Harassment','Stalking','Poor lighting','Deserted area','Other'].map(c=>`<button class="chip ${S.reportDraft.cat===c?'on':''}" data-a="repCat" data-c="${c}">${c}</button>`).join('')}</div>
   <div class="field" style="margin-top:8px"><label for="rdesc">What happened? (location = where you are now)</label><textarea class="in" id="rdesc" rows="2" placeholder="Describe briefly"></textarea></div>
   <label class="row" style="margin:8px 0;justify-content:flex-start;gap:8px"><input type="checkbox" id="ranon" ${S.reportDraft.anon?'checked':''} style="flex:none;width:18px;height:18px"> <span>Submit anonymously</span></label>
   <button class="big" data-a="submitReport">Submit report</button>
   <p class="muted">Reports appear on the map after an admin approves them. Limit: 10 per day.</p></div></div></div>${navbar('map')}`;

SC.cab = () => { const c=S.cab; return `${sbar()}<div class="app">${bar(T('Cab Safety'),'Share your cab with trusted contacts','home')}<div class="body">
  ${!c?`<div class="card" style="text-align:center"><div style="font-size:40px">📷</div><button class="big" data-a="scanPlate">Scan number plate</button><p class="muted">or type it</p><input class="in" id="plate" placeholder="e.g. MP 09 AB 1234"><div class="field" style="margin-top:8px"><label for="drv">Driver name (optional)</label><input class="in" id="drv"></div></div>
   <button class="big" data-a="shareCab">Share cab details</button>`
  :`<div class="card"><b>🚕 ${esc(c.no)}</b><div class="muted">${c.drv?esc(c.drv)+' · ':''}Picked up ${esc(c.at)} · shared with ${S.contacts.length} contacts</div>
   <div class="li"><span class="grow">Route check</span><span class="pill ${c.alerted?'bad':(c.deviated?'warn':'ok')}">${c.alerted?'Contacts alerted':(c.deviated?'Off route':'On route')}</span></div></div>
   <div class="mapbox">${mapSVG({routes:[{ids:['PL','RS','RJ','AN','MU'],color:'var(--navy)',w:5}],dot:c.deviated?{x:30,y:120}:S.loc,dotColor:c.deviated?'var(--red)':'var(--navy)',pulse:true,label:'Cab route'})}</div>
   <p class="muted">Use “Cab goes off route” in Demo controls to show the deviation alert.</p>
   <button class="big ghost" data-a="endCab">End ride</button>`}</div></div>${promptHTML()}`; };

SC.fakecall = () => `${sbar()}<div class="app">${bar(T('Fake Call'),'Get a realistic call to leave an uneasy place','home')}<div class="body">
  <div class="field"><label for="fcn">Caller name</label><input class="in" id="fcn" value="Mummy"></div>
  <div class="field"><label>Call me after</label><div class="chips">${[['now',0],['10 s',10],['30 s',30],['1 min',60]].map(([l,v],i)=>`<button class="chip ${i===1?'on':''}" data-a="fcDelay" data-v="${v}">${l}</button>`).join('')}</div></div>
  <button class="big" data-a="scheduleFake">Schedule fake call</button>
  ${S.fake&&S.fake.wait>0?`<p class="muted" style="text-align:center">Call scheduled… lock your phone and wait.</p>`:''}</div></div>`;
SC.incoming = () => `<div class="app" style="background:linear-gradient(#1d2558,#0d1130);color:#fff;text-align:center;justify-content:space-between;padding:60px 20px 50px">
  <div><div style="opacity:.8">Incoming call</div><div style="font-size:34px;font-weight:600;margin-top:10px">${esc(S.fake.name)}</div><div style="opacity:.8">Mobile · India</div></div>
  <div style="width:110px;height:110px;border-radius:50%;background:#3a4380;margin:0 auto;display:grid;place-items:center;font-size:46px">${esc(S.fake.name[0]||'M')}</div>
  <div class="row"><button class="big red" style="border-radius:40px" data-a="declineFake">Decline</button><button class="big green" style="border-radius:40px" data-a="answerFake">Answer</button></div></div>`;
SC.incall = () => `<div class="app" style="background:linear-gradient(#1d2558,#0d1130);color:#fff;text-align:center;justify-content:space-between;padding:60px 20px 50px">
  <div><div style="font-size:30px;font-weight:600">${esc(S.fake.name)}</div><div id="talk" style="opacity:.85;font-size:18px">00:00</div></div>
  <div style="opacity:.8;font-size:14px">A recorded voice is playing so it sounds like a real call.</div>
  <button class="big red" style="border-radius:40px" data-a="endFake">End call</button></div>`;

SC.nearby = () => { const list=POI.map(p=>({...p,d:dist(p,S.loc)*KM_PER_PX})).sort((a,b)=>a.d-b.d); return `${sbar()}<div class="app">${bar(T('Nearby Help'),`Near ${esc(nearestPlace(S.loc))}`,'home')}<div class="body">
  <div class="mapbox">${mapSVG({dot:S.loc,pulse:true,label:'Nearby help'})}</div>
  <div class="card list">${list.map(p=>`<div class="li"><span>${p.t==='police'?'🚓':p.t==='hosp'?'🏥':'🏪'}</span><span class="grow">${esc(p.name)}<div class="muted">${p.d.toFixed(1)} km</div></span><button class="chip" data-a="callPlace" data-n="${esc(p.name)}">Call</button><button class="chip" data-a="dirPlace" data-n="${esc(p.name)}">Go</button></div>`).join('')}</div></div></div>`; };

SC.vaultPin = () => { S.pinMode='vault'; S.pinBuf=''; return SC.pin(); };
SC.vault = () => `${sbar()}<div class="app">${bar(T('Evidence Vault'),'Recordings are encrypted and stored in the cloud','home')}<div class="body">
  ${S.evidence.map(e=>{ const locked=new Date(e.locked)>now(); return `<div class="card"><div class="row"><div style="flex:3"><b>🎙️ SOS recording</b><div class="muted">${new Date(e.date).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})} · ${e.parts} parts · ${fmtSec(e.secs)}</div></div><span class="pill ${locked?'warn':'ok'}" style="flex:none">${locked?'Locked':'Unlocked'}</span></div>
   ${e.url?`<audio controls src="${e.url}" style="width:100%;margin-top:8px"></audio>`:`<p class="muted">${e.id==='ev_seed'?'Sample recording from an earlier test.':'Recording simulated (microphone not available in this browser).'}</p>`}
   <div class="row" style="margin-top:6px"><button class="chip" data-a="shareEv">Share with police</button><button class="chip" data-a="delEv" data-id="${e.id}">Delete</button></div>
   <div class="muted">${locked?'Cannot be deleted until '+new Date(e.locked).toLocaleDateString('en-IN'):'Can be deleted'}</div></div>`; }).join('')}</div></div>`;

SC.legal = () => { const tab=S.legalTab; const hi=S.user.lang==='hi';
  const content={
   rights: hi?[
     'आप किसी भी पुलिस स्टेशन में ज़ीरो FIR दर्ज करा सकती हैं, चाहे घटना कहीं भी हुई हो।','संज्ञेय अपराध की FIR दर्ज करना पुलिस का कर्तव्य है; FIR की प्रति मुफ़्त मिलती है।','यौन अपराध की पीड़िता की पहचान सार्वजनिक नहीं की जा सकती।','महिलाओं को मुफ़्त कानूनी सहायता का अधिकार है (विधिक सेवा प्राधिकरण)।','सूर्यास्त के बाद और सूर्योदय से पहले, असाधारण स्थिति को छोड़कर, महिला को गिरफ़्तार नहीं किया जाना चाहिए।'
   ]:[
     'You can file a Zero FIR at any police station, wherever the incident happened.','Police must register an FIR for a cognisable offence and give you a free copy.','The identity of a victim of a sexual offence cannot be made public.','Women are entitled to free legal aid through Legal Services Authorities.','A woman should not be arrested after sunset and before sunrise except in exceptional circumstances, with a woman officer present and a magistrate’s permission.'],
   fir: hi?['नज़दीकी पुलिस स्टेशन जाएँ (या ज़ीरो FIR के लिए कोई भी स्टेशन)।','घटना, समय, स्थान और व्यक्ति का विवरण बताएँ।','FIR पढ़कर ही हस्ताक्षर करें और मुफ़्त प्रति लें।','सबूत (रिकॉर्डिंग, फ़ोटो) साझा करें – SAKHI के सबूत तिजोरी से।','FIR दर्ज न हो तो पुलिस अधीक्षक (SP) या मजिस्ट्रेट से संपर्क करें।']
       :['Go to the nearest police station (any station for a Zero FIR).','Describe what happened, when, where and who was involved.','Read the FIR before signing it and take your free copy.','Share evidence such as recordings and photos from the SAKHI Evidence Vault.','If the police refuse to register it, approach the Superintendent of Police or a magistrate.'],
   help:[['112','Emergency (police, fire, ambulance)'],['1091','Women helpline (police)'],['181','Women helpline'],['1098','Child helpline']],
   tips: hi?['भीड़-भाड़ वाले, रोशनी वाले रास्ते चुनें।','यात्रा से पहले किसी को बताएँ – SAKHI में यात्रा शुरू करें।','ज़ोर से चिल्लाना और ध्यान खींचना सबसे असरदार बचाव है।','कलाई पकड़ने पर अंगूठे की दिशा में झटके से छुड़ाएँ।','हमेशा फ़ोन चार्ज रखें।']
       :['Choose busy, well-lit roads.','Tell someone before you travel – start a journey in SAKHI.','Shouting loudly to attract attention is one of the most effective defences.','If someone grabs your wrist, pull out quickly towards their thumb.','Keep your phone charged.']
  };
  return `${sbar()}<div class="app">${bar(T('Legal Aid'),hi?'हिन्दी':'English','home')}<div class="body">
  <div class="chips">${[['rights','Know your rights'],['fir','How to file an FIR'],['help','Helplines'],['tips','Self-defence tips']].map(([k,l])=>`<button class="chip ${tab===k?'on':''}" data-a="legalTab" data-t="${k}">${T(l)}</button>`).join('')}</div>
  <div class="card">${tab==='help'?content.help.map(h=>`<div class="li"><b style="flex:none;width:48px;font-size:18px">${h[0]}</b><span class="grow">${h[1]}</span><button class="chip" data-a="callPlace" data-n="${h[0]}">Call</button></div>`).join(''):`<ol style="margin:0;padding-left:20px">${content[tab].map(x=>`<li style="margin:6px 0">${esc(x)}</li>`).join('')}</ol>`}</div>
  <div class="chips"><button class="chip ${!hi?'on':''}" data-a="lang" data-l="en">English</button><button class="chip ${hi?'on':''}" data-a="lang" data-l="hi">हिन्दी</button></div></div></div>`; };

SC.profile = () => `${sbar()}<div class="app">${bar(T('Profile'),`+91 ${esc(S.user.phone||'98XXXXXX21')}`)}<div class="body">
  <div class="card"><b>${esc(S.user.name)}</b><div class="muted">Blood group ${esc(S.user.blood||'–')} · Keyword “${esc(S.user.keyword)}” · PIN set ✔</div></div>
  <button class="card" style="border:none;text-align:left;width:100%" data-a="go" data-s="contacts"><b>👥 Trusted contacts</b><div class="muted">${S.contacts.length} of 5 · primary: ${esc((S.contacts.find(c=>c.primary)||{}).name||'none')}</div></button>
  <div class="card"><b>🛡️ Become a community guardian</b><div class="muted">Verified women volunteers get alerts when someone within 2 km needs help.</div>
   ${S.user.guardianApplied?`<p><span class="pill warn">Application sent – waiting for admin verification</span></p>`:`<button class="big ghost" style="margin-top:8px" data-a="applyGuardian">Apply with ID proof</button>`}</div>
  <div class="card"><b>🌐 Language</b><div class="chips" style="margin-top:6px"><button class="chip ${S.user.lang==='en'?'on':''}" data-a="lang" data-l="en">English</button><button class="chip ${S.user.lang==='hi'?'on':''}" data-a="lang" data-l="hi">हिन्दी</button></div></div>
  <button class="big ghost" data-a="logout">Log out</button></div></div>${navbar('profile')}`;

SC.contacts = () => `${sbar()}<div class="app">${bar('Trusted contacts','Up to 5 people who receive your alerts','profile')}<div class="body">
  <div class="card list">${S.contacts.map(c=>`<div class="li"><span class="grow"><b>${esc(c.name)}</b> ${c.primary?'<span class="pill info">Primary</span>':''}<div class="muted">${esc(c.phone)} · ${c.app?'has SAKHI app':'SMS only'}</div></span>${!c.primary?`<button class="chip" data-a="makePrimary" data-id="${c.id}">Make primary</button>`:''}<button class="chip" data-a="delContact" data-id="${c.id}" aria-label="Remove ${esc(c.name)}">✕</button></div>`).join('')||'<p class="muted">No contacts yet. Add at least one to use SOS.</p>'}</div>
  ${S.contacts.length<5?`<div class="card"><h4>Add contact</h4><input class="in" id="cname" placeholder="Name"><input class="in" id="cphone" placeholder="10-digit mobile" inputmode="numeric" maxlength="10" style="margin-top:6px"><button class="big" style="margin-top:8px" data-a="addContact">Add contact</button></div>`:'<p class="muted">Maximum of 5 contacts reached.</p>'}
  </div></div>`;

function renderPhone(){
  const el=$('#screen'); const f=SC[S.screen]||SC.home;
  // keep focus/values on inputs when re-rendering setup-like screens
  const active=document.activeElement && el.contains(document.activeElement) ? document.activeElement.id : null;
  const vals={}; el.querySelectorAll('input,textarea,select').forEach(i=>{ if(i.id) vals[i.id]=i.type==='checkbox'?i.checked:i.value; });
  el.innerHTML = f() + (S.toast?`<div class="toast" role="status">${esc(S.toast)}</div>`:'');
  Object.keys(vals).forEach(id=>{ const i=el.querySelector('#'+id); if(i){ if(i.type==='checkbox') i.checked=vals[id]; else if(i.tagName!=='SELECT') i.value=vals[id]; } });
  if(active){ const a=el.querySelector('#'+active); if(a) a.focus(); }
  renderRail();
}

/* =========================================================
   RIGHT PANEL
   ========================================================= */
const TABS=[['guide','Presenter guide'],['contact','Mummy’s phone'],['guardian','Guardian’s phone'],['dash','Dashboard'],['log','Backend log']];
function renderTabs(){ $('#tabs').innerHTML=TABS.map(([k,l])=>{ const n=k==='contact'?S.unseen.contact:k==='guardian'?S.unseen.guardian:k==='log'?S.unseen.log:0; return `<button role="tab" aria-selected="${S.tab===k}" class="${S.tab===k?'on':''}" data-a="tab" data-t="${k}">${l}${n?`<span class="n">${n>99?'99+':n}</span>`:''}</button>`; }).join(''); }
function renderPanel(){ renderTabs(); const b=$('#pbody'); const f={guide:PG.guide,contact:PG.contact,guardian:PG.guardian,dash:PG.dash,log:PG.log}[S.tab]; b.innerHTML=f(); }
function renderPanelLight(){ renderTabs(); if(S.tab==='log'){ const l=$('#logList'); if(l) l.innerHTML=logRows(); } }
function renderPanelLive(){ if(S.tab==='contact'||S.tab==='guardian'){ const m=$('#liveMap'); if(m) m.innerHTML=liveMap(); } if(S.tab==='dash'&&S.dashView==='overview'){ const m=$('#dashMap'); if(m) m.innerHTML=dashMap(); } }
function liveMap(){ if(cloudSOS()) return mapSVG({trail:S.sos.trail,dot:S.loc,dotColor:'var(--red)',pulse:true,label:'Live location'}); if(S.journey) return mapSVG({routes:[{ids:S.journey.ids,color:'var(--navy)',w:5,op:.35}],trail:S.journey.trail,dot:S.loc,pulse:true,label:'Journey'}); return mapSVG({label:'Map'}); }
const cloudSOS=()=>!!(S.sos&&S.sos.active&&S.sos.cloud);
function dashMap(){ const g=S.guardians.filter(x=>x.status==='VERIFIED'); return mapSVG({heat:true,dot:cloudSOS()?S.loc:null,dotColor:'var(--red)',pulse:true,guardians:g,ring:cloudSOS()?S.loc:null,label:'Live SOS and incident heatmap'}); }
function logRows(){ if(!S.log.length) return '<p class="muted">Nothing yet. Trigger an SOS or start a journey and every backend step appears here.</p>'; return S.log.slice().reverse().map(e=>`<div class="e"><span class="t">${e.t}</span><span class="tag ${e.tag}">${e.tag==='Function'?'Cloud Function':e.tag}</span><span>${esc(e.msg)}</span></div>`).join(''); }

const PG={};
PG.contact = () => { S.unseen.contact=0; const live=cloudSOS()||S.journey; return `<div class="mini-phone"><div class="phone-label" style="text-align:center;margin-bottom:8px">Mummy’s phone · trusted contact (primary)</div><div class="phone"><div class="screen"><div class="sbar"><span>${hhmm(now())}</span><span>4G ▮▮▮ 61%</span></div><div class="app"><div class="body">
  ${live?`<div class="card" style="border-left:4px solid ${cloudSOS()?'var(--red)':'var(--navy)'}"><b>${cloudSOS()?`🚨 ${esc(S.user.name)} – live SOS location`:`🧭 Watching ${esc(S.user.name)}’s journey`}</b>${S.sos&&S.sos.silent?'<div><span class="pill bad">Wrong PIN entered – possible duress</span></div>':''}
   <div class="mapbox" id="liveMap" style="margin-top:8px">${liveMap()}</div><div class="muted" style="margin-top:6px">Near ${esc(nearestPlace(S.loc))} · ${toLatLng(S.loc).lat}, ${toLatLng(S.loc).lng} · battery ${S.battery}%</div>
   <div class="row" style="margin-top:8px"><button class="big" data-a="contactCall">📞 Call ${esc(S.user.name.split(' ')[0])}</button><button class="big ghost" data-a="contactDir">Directions</button></div></div>`
  :S.sos&&S.sos.active?`<p class="muted" style="text-align:center;margin-top:20px">Priya is offline, so only SMS alerts arrive. Live tracking starts when her internet is back.</p>`:`<p class="muted" style="text-align:center;margin-top:30px">No active alerts.<br>When Priya triggers SOS or starts a journey, it appears here.</p>`}
  ${S.inbox.map(n=>`<div class="notif ${n.type}"><div class="h"><span>${n.type==='sms'?'💬 Messages':'SAKHI'}</span><span>${n.time}</span></div><b>${esc(n.title)}</b><div>${esc(n.body)}</div></div>`).join('')}
  </div></div></div></div></div>`; };
PG.guardian = () => { S.unseen.guardian=0; const s=S.sos; const g=S.guardians.find(x=>x.id==='g1'); return `<div class="mini-phone"><div class="phone-label" style="text-align:center;margin-bottom:8px">Riya’s phone · verified community guardian</div><div class="phone"><div class="screen"><div class="sbar"><span>${hhmm(now())}</span><span>4G ▮▮▮ 80%</span></div><div class="app"><div class="appbar"><h2>🛡️ Guardian mode</h2><p>${g&&g.status==='VERIFIED'?'Verified · '+(g.available?'available':'not available'):'Not verified'}</p></div><div class="body">
  <div class="card row"><span>Accept nearby alerts</span><button class="switch" role="switch" aria-checked="${g.available}" data-a="gAvail" aria-label="Accept nearby alerts" style="flex:none"></button></div>
  ${s&&s.active&&s.gNotified?`<div class="card" style="border-left:4px solid #6a3fbf"><b>Nearby SOS</b><div class="muted">${s.guardian?'You accepted. Exact location is shared with you until the SOS ends.':'Approximate area only. Accept to see the exact location.'}</div>
    <div class="mapbox" id="liveMap" style="margin-top:8px">${s.guardian?liveMap():mapSVG({heat:false,ring:S.loc,guardians:[g],label:'Approximate area'})}</div>
    ${s.guardian?`<p class="muted">${esc(S.user.name)} · near ${esc(nearestPlace(S.loc))}</p>`:`<button class="big" style="margin-top:8px;background:#6a3fbf" data-a="gAccept">I am responding</button>`}</div>`:''}
  ${S.gInbox.map(n=>`<div class="notif ${n.type}"><div class="h"><span>SAKHI Guardian</span><span>${n.time}</span></div><b>${esc(n.title)}</b><div>${esc(n.body)}</div></div>`).join('')||'<p class="muted" style="text-align:center">No alerts. Riya gets an alert only when an SOS happens within 2 km of her.</p>'}
  </div></div></div></div></div>`; };
PG.log = () => { S.unseen.log=0; return `<div class="row" style="justify-content:space-between;margin-bottom:8px"><h3 style="margin:0;flex:none">What the backend is doing</h3><button class="btn small" style="flex:none" data-a="clearLog">Clear</button></div>
  <p class="muted" style="margin-top:0">Each line is one step of the real design: the app writes to Cloud Firestore, a Cloud Function reacts, and alerts go out through FCM push or the SMS gateway. In this demo these services are simulated in the browser.</p><div class="log" id="logList">${logRows()}</div>`; };

PG.dash = () => { const v=S.dashView; const pend=S.reports.filter(r=>r.status==='PENDING'); const gp=S.guardians.filter(g=>g.status==='PENDING');
  const nav=[['overview','📊 Overview'],['reports',`📝 Reports${pend.length?' ('+pend.length+')':''}`],['guardians',`🛡️ Guardians${gp.length?' ('+gp.length+')':''}`],['sos','🚨 SOS log'],['export','⬇️ Export']];
  let main='';
  if(v==='overview'){ const active=cloudSOS()?1:0; const byHour=[[6,12],[12,17],[17,20],[20,23],[23,30]].map(([a,b])=>S.reports.filter(r=>r.status==='APPROVED'&&((r.hour>=a&&r.hour<b)||(b>24&&(r.hour>=23||r.hour<6)))).length); const mx=Math.max(1,...byHour);
    main=`<div class="kpis"><div class="kpi ${active?'red':''}"><b>${active}</b><span>Active SOS now</span></div><div class="kpi"><b>${S.history.length+active}</b><span>SOS events (demo data)</span></div><div class="kpi"><b>${pend.length}</b><span>Reports waiting</span></div><div class="kpi"><b>${gp.length}</b><span>Guardian requests</span></div></div>
    <div class="two" style="margin-top:14px"><div class="box"><h4>Live SOS and incident heatmap</h4><div class="mapbox" id="dashMap">${dashMap()}</div>${active?`<p class="muted">🚨 ${S.role==='Admin'?esc(S.user.name):'A SAKHI user'} near ${esc(nearestPlace(S.loc))} · ${S.sos.silent?'<b>silent mode (wrong PIN)</b>':'active'} · ${S.sos.guardian?esc(S.sos.guardian)+' responding':'guardians notified'}</p>`:'<p class="muted">No active SOS. Red circles are approved incident reports; G = verified guardians.</p>'}</div>
    <div class="box"><h4>Incidents by time of day</h4><svg viewBox="0 0 300 170" role="img" aria-label="Incidents by time of day">${byHour.map((n,i)=>`<rect x="${14+i*57}" y="${140-n/mx*110}" width="40" height="${n/mx*110}" rx="4" fill="${i>=2&&i<=3?'var(--red)':'var(--navy)'}"/><text x="${34+i*57}" y="${134-n/mx*110}" font-size="12" text-anchor="middle" fill="var(--ink)">${n}</text><text x="${34+i*57}" y="158" font-size="11" text-anchor="middle" fill="var(--muted)">${['6–12','12–17','17–20','20–23','23–6'][i]}</text>`).join('')}</svg><p class="muted">Most reports are in the evening and night – this is why the time-of-day factor T lowers route scores after dark.</p></div></div>`; }
  if(v==='reports'){ main=`<h3 style="margin-top:0">Incident reports</h3><div class="tblwrap"><table class="tbl"><thead><tr><th>Category</th><th>Details</th><th>Area</th><th>Reporter</th><th>Status</th><th></th></tr></thead><tbody>${S.reports.slice().reverse().map(r=>`<tr><td>${esc(r.cat)}</td><td>${esc(r.desc)}</td><td>${esc(nearestPlace(r))}</td><td>${r.anon?'Anonymous':(S.role==='Admin'?esc(r.user||'Registered user'):'Hidden')}</td><td><span class="pill ${r.status==='APPROVED'?'ok':r.status==='PENDING'?'warn':'bad'}">${r.status}</span></td><td style="white-space:nowrap">${r.status==='PENDING'&&S.role==='Admin'?`<button class="btn small primary" data-a="approve" data-id="${r.id}">Approve</button> <button class="btn small" data-a="reject" data-id="${r.id}">Reject</button>`:''}</td></tr>`).join('')}</tbody></table></div><p class="muted">Approving a report adds it to the safety map and lowers the safety score of nearby roads (factor R). Try it, then open Safe Route on the phone.</p>`; }
  if(v==='guardians'){ main=`<h3 style="margin-top:0">Community guardians</h3><div class="tblwrap"><table class="tbl"><thead><tr><th>Name</th><th>Area</th><th>Status</th><th>Rating</th><th></th></tr></thead><tbody>${S.guardians.map(g=>`<tr><td>${esc(g.name)}</td><td>${esc(nearestPlace(g))}</td><td><span class="pill ${g.status==='VERIFIED'?'ok':g.status==='PENDING'?'warn':'bad'}">${g.status}</span></td><td>${g.rating??'–'}</td><td style="white-space:nowrap">${S.role!=='Admin'?'':g.status==='PENDING'?`<button class="btn small primary" data-a="verifyG" data-id="${g.id}">Verify ID &amp; approve</button>`:g.status==='VERIFIED'?`<button class="btn small" data-a="suspendG" data-id="${g.id}">Suspend</button>`:`<button class="btn small" data-a="verifyG" data-id="${g.id}">Restore</button>`}</td></tr>`).join('')}</tbody></table></div><p class="muted">Only verified guardians receive nearby SOS alerts (within 2 km). The exact location is shared only after a guardian accepts.</p>`; }
  if(v==='sos'){ const rows=[...(cloudSOS()?[{id:S.sos.id,user:S.user.name,trigger:S.sos.trigger,start:S.sos.start.toISOString(),status:'ACTIVE',area:nearestPlace(S.loc),silent:S.sos.silent}]:[]),...S.history];
    main=`<h3 style="margin-top:0">SOS events</h3><div class="tblwrap"><table class="tbl"><thead><tr><th>ID</th><th>User</th><th>Trigger</th><th>Started</th><th>Area</th><th>Status</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.id)}</td><td>${S.role==='Admin'?esc(r.user):'Hidden'}</td><td>${esc(r.trigger)}</td><td>${new Date(r.start).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'})}</td><td>${esc(r.area)}</td><td><span class="pill ${r.status==='ACTIVE'?'bad':'ok'}">${r.status}</span>${r.silent?' <span class="pill warn">wrong PIN</span>':''}</td></tr>`).join('')}</tbody></table></div><p class="muted">Authority users (police/NGO) see the same data without personal details.</p>`; }
  if(v==='export'){ main=`<h3 style="margin-top:0">Export anonymised statistics</h3><p>Creates a CSV of approved incident reports without any personal details, for police and NGOs.</p><button class="btn primary" data-a="exportCsv">Create CSV</button>`; }
  return `<div class="row" style="justify-content:space-between;margin-bottom:12px;flex-wrap:wrap"><div style="flex:none"><b style="font-size:18px;color:var(--navy)">SAKHI Admin</b> <span class="muted">· signed in as</span></div><div class="chips" style="flex:none"><button class="chip ${S.role==='Admin'?'on':''}" data-a="role" data-r="Admin">Admin</button><button class="chip ${S.role==='Authority'?'on':''}" data-a="role" data-r="Authority">Police / NGO</button></div></div>
  <div class="dash"><nav class="dnav" aria-label="Dashboard sections">${nav.map(([k,l])=>`<button class="${v===k?'on':''}" data-a="dash" data-v="${k}">${l}</button>`).join('')}</nav><div style="min-width:0">${main}</div></div>`; };

/* ---------- presenter guide ---------- */
const STEPS=[
 {t:'1. Login with OTP and set up the profile',go:'login',say:'A woman registers with her mobile number. Firebase Authentication sends a 6-digit OTP. She sets a 4-digit SOS PIN, a secret voice keyword and grants permissions, each with a reason.',show:'Type any 10-digit number, press Send OTP, enter the OTP shown on screen, set a PIN (e.g. 1234), allow permissions. Or press Quick demo login.',real:'OTP is simulated in the demo (shown on screen). In the real app Firebase Phone Auth sends it by SMS.'},
 {t:'2. Trusted contacts',go:'contacts',say:'She adds 1 to 5 trusted contacts and marks one as primary. SOS is blocked until at least one contact exists. Contacts without the app still get SMS with a live-tracking link.',show:'Profile → Trusted contacts. Show Mummy (primary, has app), Papa (SMS only).',real:'Fully working in the demo.'},
 {t:'3. SOS – the main feature',go:'home',say:'SOS can start in four ways: the button, shaking the phone, pressing the power button three times, or saying a secret keyword – so she can raise an alert even without opening the app. There is a 3-second cancel window to prevent accidental alerts. Then the location goes to all contacts within seconds, the primary contact is called, 112 is one tap away, audio evidence is recorded and nearby guardians are alerted.',show:'Press SOS (or “Shake the phone” in Demo controls). Wait 3 seconds. Open Mummy’s phone and Behind the scenes to show the alert and the backend steps.',real:'Siren is real sound. Microphone recording is real if the browser allows it. Push/SMS/calls are simulated and shown in the log.'},
 {t:'4. PIN stop and silent mode',go:null,say:'The SOS stops only with her PIN. If an attacker forces her to stop it, she enters a wrong PIN: the phone shows “stopped”, but SAKHI keeps tracking and recording silently and warns her contacts of possible duress.',show:'During SOS tap “I am safe – Enter PIN”. First enter a wrong PIN (e.g. 0000) → fake stopped screen; show Mummy’s phone “possible duress”. Then press SOS again and enter the correct PIN to end it.',real:'Fully working logic.'},
 {t:'5. Offline SOS by SMS',go:'home',say:'In many places mobile internet is weak. If there is no internet, SAKHI sends the SOS as a normal SMS with GPS coordinates and a Google Maps link through the SIM, and repeats it every 2 minutes.',show:'Turn Mobile internet off in Demo controls, trigger SOS, show the SMS on Mummy’s phone and “SIM SMS” lines in the log.',real:'On a real phone the “Send SMS from this phone” button opens the SMS app with the message ready (like the iOS fallback).'},
 {t:'6. Evidence vault',go:'vaultPin',say:'Recordings are uploaded in 10-second parts while the SOS runs, so evidence survives even if the phone is snatched. The vault is PIN-protected and recordings cannot be deleted for 30 days.',show:'Open Evidence Vault, enter PIN, play the recording from the SOS you just did, try Delete.',real:'Playback works if the microphone was allowed.'},
 {t:'7. Safe route and safety score',go:'route',say:'For any trip the app fetches alternative routes and gives each a safety score from 0 to 100 using S = w1·L + w2·P + w3·C + w4·T − w5·R: lighting, nearby police and hospitals, crowd, time of day, minus recent unsafe reports. The safest route is highlighted next to the fastest one.',show:'Choose Palasia → Medicaps University. Move the Time of day slider to 22:00 and show the scores drop. Show the score breakdown.',real:'The scoring algorithm is real and runs live; the city map is a simplified map of Indore.'},
 {t:'8. Journey tracking and check-in timer',go:'journeySetup',say:'She starts a journey; her contacts watch live. If she reaches the destination she taps “I am safe”. If the expected time passes and she does not respond within 2 minutes, contacts get an alert with her last location. A low-battery alert is also sent.',show:'Start journey to Rajwada. Show Mummy’s phone tracking. Press “Stop moving during journey” to show the missed check-in alert.',real:'Time is accelerated (Demo speed). The 2-minute check-in wait is shortened to 15 seconds.'},
 {t:'9. Safety map and reporting + admin moderation',go:'map',say:'Women can report unsafe places – harassment, stalking, poor lighting, deserted areas – even anonymously. An admin approves reports on the dashboard; approved reports appear on the heatmap and lower the safety score of nearby roads.',show:'Submit a report on the phone → Admin dashboard → Reports → Approve → back to Safe Route and see the change.',real:'Fully working in the demo.'},
 {t:'10. Community guardians',go:'profile',say:'Verified women volunteers within 2 km get an alert with only the approximate area. If a guardian accepts, she sees the exact location until the SOS ends, and the user sees that help is coming.',show:'During an SOS open Guardian’s phone → “I am responding”. Show “Riya is coming” on Priya’s phone. Dashboard → Guardians to verify a new volunteer.',real:'Fully working logic.'},
 {t:'11. Cab safety, fake call, nearby help, legal aid',go:'cab',say:'Cab safety shares the vehicle number and warns if the cab goes more than 500 m off route. Fake call gives a realistic incoming call with a voice to leave an uneasy place. Nearby help lists police stations and hospitals. Legal aid explains rights, FIR and Zero FIR, and helplines 112, 1091, 181 – in English and Hindi.',show:'Scan a plate → “Cab goes off route”. Fake call with 10 s delay → Answer (a voice speaks). Legal Aid → switch to हिन्दी.',real:'Fake call ringtone and voice are real audio.'},
 {t:'12. Admin dashboard',go:null,tab:'dash',say:'The React dashboard shows live SOS events on a map, incident heatmaps and trends, report moderation and guardian verification. Police/NGO users see the same data without personal details, and anonymised data can be exported as CSV.',show:'Switch between Admin and Police/NGO. Show Overview during an active SOS.',real:'Data in the dashboard is demo data plus everything you do in this session.'}
];
const QA=[
 ['Why Flutter and Firebase?','Flutter gives one codebase for Android and iOS. Firebase gives authentication, a real-time database, storage, cloud functions and push notifications without managing servers, and it syncs data live – important for live tracking.'],
 ['What happens if there is no internet?','The SOS falls back to SMS through the SIM with GPS coordinates and a map link, repeated every 2 minutes. Locations captured offline are stored locally (SQLite) and uploaded when the connection returns.'],
 ['How is the safety score calculated?','S = 0.30·L + 0.25·P + 0.20·C + 0.25·T − 0.40·R for each road segment, scaled to 0–100 and averaged over the route. The weights are initial values and will be tuned with survey and report data.'],
 ['How do you stop misuse / false alarms?','A 3-second cancel window, PIN-protected stop, admin moderation of reports, a limit of 10 reports per day, and admin verification of guardians with ID proof.'],
 ['How is privacy protected?','OTP login, Firestore security rules (a user can read only her own data), encryption in transit and at rest, location shared only during SOS or a journey, anonymous reports, and compliance with the DPDP Act 2023.'],
 ['Can the power button work on iPhone?','No. iOS does not allow apps to detect power-button presses, so on iPhone SOS uses shake, voice keyword, the button or a widget. This is listed as a deviation.'],
 ['What is different from existing apps?','Most apps only offer a panic button. SAKHI covers before, during and after travel: safe routes, safety map, journey check-in, multi-trigger SOS, offline SMS, evidence vault, guardians, legal aid and an authority dashboard.'],
 ['Is this demo the final app?','This web demo shows the complete design and logic working in a browser. The real app is built with Flutter, Firebase and Google Maps; here, push notifications, SMS and calls are simulated and shown step by step in the Behind the scenes log.']
];
PG.guide = () => `<div class="guide"><h2>How to present SAKHI</h2><p class="muted" style="margin-top:0">Follow these steps in order. “Show me” opens the right screen on Priya’s phone. Read the “Say” text in your own words.</p>
  <div class="box"><b>Before you start:</b> press <b>Reset demo</b>, keep Mobile internet on, and keep Demo speed on “Fast”. Allow the microphone if the browser asks during SOS – that makes the evidence recording real.</div>
  ${STEPS.map((s,i)=>`<div class="step"><div class="hd"><b>${esc(s.t)}</b>${s.go||s.tab?`<button class="btn small primary" data-a="guideGo" data-i="${i}">Show me</button>`:''}</div><div class="say">🗣️ ${esc(s.say)}</div><p><b>Do:</b> ${esc(s.show)}</p><p class="real">${esc(s.real)}</p></div>`).join('')}
  <h3>Likely questions from the examiner</h3>${QA.map(q=>`<details><summary>${esc(q[0])}</summary><p>${esc(q[1])}</p></details>`).join('')}
  <h3>What is real and what is simulated in this demo</h3><ul><li><b>Real:</b> all screens and flows, the SOS logic (cancel window, PIN, silent mode, offline fallback), the safety score algorithm, journey timer and check-in, report moderation affecting routes, guardian matching within 2 km, siren and ringtone sound, fake-call voice, microphone recording (if allowed), real GPS coordinates (optional), Hindi/English.</li><li><b>Simulated:</b> Firebase services, push notifications, SMS gateway and phone calls (shown in the Behind the scenes log), and the city map, which is a simplified map of Indore.</li></ul></div>`;

/* =========================================================
   RAIL
   ========================================================= */
function renderRail(){
  $('#sw-net').setAttribute('aria-checked', S.online);
  $('#bat').value=S.battery; $('#batv').textContent=S.battery+'%';
  $('#hour').value=S.hour; $('#hourv').textContent=String(S.hour).padStart(2,'0')+':00 '+(S.hour>=21||S.hour<6?'(night)':S.hour>=18?'(evening)':'(day)');
  $('#speed').value=S.speed;
  $('#silentStatus').innerHTML = S.sos&&S.sos.active ? (S.sos.silent?'<span class="pill bad">Silent SOS running</span> Press SOS on the phone and enter the correct PIN to end it.':'<span class="pill bad">SOS active</span>') : (S.journey?'<span class="pill info">Journey in progress</span>':'');
}
$('#bat').addEventListener('input',e=>{ S.battery=+e.target.value; renderRail(); if(S.screen!=='login') updateSbar(); });
$('#hour').addEventListener('input',e=>{ S.hour=+e.target.value; renderRail(); if(['route','map'].includes(S.screen)) renderPhone(); if(S.tab==='dash') renderPanel(); });
$('#speed').addEventListener('change',e=>{ S.speed=+e.target.value; });
function updateSbar(){ document.querySelectorAll('#screen .sbar span:last-child').forEach(s=>s.innerHTML=`${S.online?'4G ▮▮▮':'No internet ✕'} &nbsp; ${S.battery}%`); }

/* =========================================================
   ACTIONS
   ========================================================= */
let fcDelay=10;
const A = {
  reset(){ if(S.sos) sirenOff(); ringOff(); try{ localStorage.removeItem('sakhi_demo_v1'); }catch(e){} S=SEED(); renderPhone(); renderPanel(); },
  go(el){ const s=el.dataset.s; if(s==='journeySetup'&&S.journey){ go('journey'); return; } if(s==='vaultPin'){ S.pinMode='vault'; S.pinBuf=''; go('pin'); return; } go(s); },
  tab(el){ S.tab=el.dataset.t; renderPanel(); },
  toggleNet(){ S.online=!S.online; log('App',S.online?'Mobile internet is back – syncing offline locations to Firestore':'Mobile internet lost – app switches to offline SMS mode'); if(S.online&&S.sos&&S.sos.active&&!S.sos.cloud){ S.sos.cloud=true; log('Firestore',`sosEvents/${S.sos.id} created after reconnect – offline locations synced from SQLite`); log('Storage',`${Math.floor(S.sos.parts/2)} saved evidence parts uploaded`); setTimeout(guardiansNotify,400); } renderPhone(); renderPanel(); },
  trig(el){ const t=el.dataset.t; if(t==='VOICE') speak(S.user.keyword); triggerSOS(t); },
  cancelSOS, stopMoving(){ if(!S.journey){ alertRail('Start a journey first (Journey tab on the phone).'); return; } S.journey.moving=false; log('App','User stopped moving – journey timer keeps running'); },
  cabDeviate(){ if(!S.cab){ alertRail('Open Cab Safety on the phone and share a cab first.'); return; } S.cab.deviated=true; S.cab.left=10; S.prompt={kind:'cab'}; log('Function','Cab is more than 500 m away from the planned route – asking user (60 s, shortened to 10 s in demo)'); go('cab'); },
  lowBattery(){ S.battery=8; renderRail(); updateSbar(); if(!S.journey) alertRail('Battery set to 8%. Start a journey to see the low-battery alert to contacts.'); },
  realGps(){ if(!navigator.geolocation){ alertRail('Location is not available in this browser.'); return; } navigator.geolocation.getCurrentPosition(p=>{ S.realGps={lat:p.coords.latitude.toFixed(5),lng:p.coords.longitude.toFixed(5)}; $('#realStatus').textContent=`Real GPS: ${S.realGps.lat}, ${S.realGps.lng} (±${Math.round(p.coords.accuracy)} m). SOS messages now use your real location.`; log('App',`Real GPS fix ${S.realGps.lat}, ${S.realGps.lng}`); }, err=>{ $('#realStatus').textContent='Location permission was not given, so demo coordinates are used.'; }, {enableHighAccuracy:true,timeout:10000}); },
  async realShake(){ try{ if(typeof DeviceMotionEvent!=='undefined' && DeviceMotionEvent.requestPermission){ const r=await DeviceMotionEvent.requestPermission(); if(r!=='granted') throw 0; } let last=0; window.addEventListener('devicemotion',e=>{ const a=e.accelerationIncludingGravity; if(!a) return; const g=Math.sqrt((a.x||0)**2+(a.y||0)**2+(a.z||0)**2); if(g>25 && Date.now()-last>4000){ last=Date.now(); triggerSOS('SHAKE'); } }); $('#realStatus').textContent='Shake sensor on. Open this page on a phone and shake it hard to start SOS.'; }catch(e){ $('#realStatus').textContent='Shake sensor is not available here. Use “Shake the phone” instead.'; } },
  // login
  sendOtp(){ const v=($('#ph')||{}).value||''; if(!/^\d{10}$/.test(v)){ toast('Enter a valid 10-digit mobile number.'); return; } S.user.phone=v; S.otp=String(Math.floor(100000+Math.random()*900000)); S.otpSent=true; log('Auth',`Firebase Auth: OTP sent to +91 ${v}`); renderPhone(); toast(`Demo SMS: Your SAKHI OTP is ${S.otp}`,8000); },
  resendOtp(){ S.otpSent=false; renderPhone(); },
  verifyOtp(){ const v=($('#otp')||{}).value||''; if(v!==S.otp){ toast('Incorrect OTP. Check the number and try again.'); log('Auth','OTP verification failed'); return; } log('Auth','OTP verified – user signed in'); log('Firestore',`users/${uid('u')} created`); S.toast=null; go('setup'); },
  quickLogin(){ S.user.phone=S.user.phone||'9826012345'; S.user.pin=S.user.pin||'1234'; S.user.registered=true; log('Auth','Quick demo login'); save(); go('home'); },
  saveSetup(){ const nm=$('#nm').value.trim(), p=$('#pin1').value.trim(); if(!nm){ toast('Enter your name.'); return; } if(!/^\d{4}$/.test(p)){ toast('The PIN must be exactly 4 digits.'); return; } S.user.name=nm; S.user.pin=p; S.user.keyword=$('#kw').value.trim()||'bachao'; S.user.blood=$('#bg').value.trim(); log('Firestore','users/{uid} updated – PIN stored as salted hash'); go('perms'); },
  allowPerms(){ S.user.registered=true; log('App','Permissions granted: location, microphone, camera, SMS, phone, notifications'); save(); go('home'); toast('Welcome to SAKHI. Your trusted contacts are ready.'); },
  logout(){ S.user.registered=false; S.otpSent=false; save(); go('login'); },
  lang(el){ S.user.lang=el.dataset.l; save(); renderPhone(); },
  // sos
  siren(){ const s=S.sos; s.siren=!s.siren; if(s.siren) sirenOn(); else sirenOff(); log('App',s.siren?'Loud siren started':'Siren stopped'); renderPhone(); },
  call112(){ log('App','User tapped Call 112 (ERSS) – opening phone dialler (simulated in demo)'); toast('Calling 112… (simulated – the real app opens the phone dialler)'); },
  pinStop(){ S.pinMode='sos'; S.pinBuf=''; go('pin'); },
  key(el){ const k=el.dataset.k; if(k==='⌫'){ S.pinBuf=S.pinBuf.slice(0,-1); renderPhone(); return; } if(S.pinBuf.length>=4) return; S.pinBuf+=k; renderPhone();
    if(S.pinBuf.length===4){ const ok=S.pinBuf===(S.user.pin||'1234'); setTimeout(()=>{ S.pinBuf='';
      if(S.pinMode==='vault'){ if(ok){ go('vault'); } else { toast('Wrong PIN.'); renderPhone(); } return; }
      if(!S.sos){ go('home'); return; }
      if(ok){ resolveSOS(); } else if(S.sos.silent){ toast('Wrong PIN.'); renderPhone(); } else { wrongPinSilent(); } },250); } },
  // journey
  startJourney(){ const to=$('#jdest').value; S.routeTo=to; const rs=computeRoutes(nearestKey(),to); if(!rs.length){ toast('No route found.'); return; } log('Maps',`Directions API: ${rs.length} routes ${N[nearestKey()].name} → ${N[to].name}; safest score ${rs[0].score}`); startJourney(rs[0]); },
  routeJourney(){ const r=S.routes[Math.min(S.selRoute,S.routes.length-1)]; S.loc={x:N[r.ids[0]].x,y:N[r.ids[0]].y}; startJourney(r); },
  imSafe(){ endJourney(true); }, extend(){ const j=S.journey; j.expMin+=15; j.prompted=false; S.prompt=null; log('Firestore','journey expected arrival extended by 15 min'); renderPhone(); },
  // route
  selRoute(el){ S.selRoute=+el.dataset.i; renderPhone(); },
  // map / report
  repCat(el){ S.reportDraft.cat=el.dataset.c; renderPhone(); },
  submitReport(){ const today=S.reports.filter(r=>r.mine&&r.day===new Date().toDateString()).length; if(today>=10){ toast('Daily limit reached: 10 reports per day.'); log('Function','onReportCreated – daily limit exceeded, report rejected'); return; }
    const d=$('#rdesc').value.trim()||'(no details)'; const anon=$('#ranon').checked; const r={id:uid('r'),cat:S.reportDraft.cat,desc:d,x:S.loc.x+(Math.random()-.5)*12,y:S.loc.y+(Math.random()-.5)*12,hour:S.hour,anon,status:'PENDING',mine:true,day:new Date().toDateString(),user:anon?null:S.user.name};
    S.reports.push(r); log('Firestore',`reports/${r.id} created {category:${r.cat}, ${anon?'userId:null (anonymous)':'userId:set'}, status:PENDING}`); log('Function','onReportCreated – admins notified'); save(); $('#rdesc').value=''; toast('Report submitted. It will appear on the map after an admin approves it.'); renderPanel(); },
  // cab
  scanPlate(){ toast('Scanning number plate…',1200); setTimeout(()=>{ const i=$('#plate'); if(i) i.value='MP 09 AB 1234'; toast('Number plate read: MP 09 AB 1234'); },1200); },
  shareCab(){ const no=($('#plate').value||'').trim().toUpperCase(); if(!no){ toast('Scan or type the vehicle number.'); return; } S.cab={no,drv:$('#drv').value.trim(),at:hhmm(now()),deviated:false,left:10,alerted:false}; log('Firestore',`cab ride shared {vehicle:${no}}`); S.contacts.forEach(c=>log(c.app?'FCM':'SMS',`${c.name}: ${S.user.name} is in cab ${no}`)); notifyContact({type:'info',title:`🚕 ${S.user.name} took a cab`,body:`Vehicle ${no}${S.cab.drv?', driver '+S.cab.drv:''}. Live location is shared.`}); renderPhone(); renderPanel(); },
  cabOk(){ S.cab.deviated=false; S.prompt=null; log('App','User confirmed she is safe – no alert sent'); renderPhone(); },
  endCab(){ S.cab=null; S.prompt=null; go('home'); },
  // fake call
  fcDelay(el){ fcDelay=+el.dataset.v; document.querySelectorAll('[data-a=fcDelay]').forEach(b=>b.classList.toggle('on',b===el)); },
  scheduleFake(){ ac(); S.fake={name:$('#fcn').value.trim()||'Mummy',wait:fcDelay||0.1,talk:0}; log('App',`Fake call scheduled in ${fcDelay} s`); renderPhone(); },
  answerFake(){ ringOff(); S.fake.talk=0; go('incall'); speak(`Hello beta, where are you? It's getting late. I am waiting outside, come quickly. Stay on the phone with me.`); },
  declineFake(){ ringOff(); S.fake=null; go('home'); }, endFake(){ try{speechSynthesis.cancel();}catch(e){} S.fake=null; go('home'); },
  callPlace(el){ toast(`Calling ${el.dataset.n}… (simulated)`); log('App',`Call ${el.dataset.n} (simulated)`); },
  dirPlace(el){ toast(`Opening walking directions to ${el.dataset.n}`); log('Maps',`Directions requested to ${el.dataset.n}`); },
  // vault
  shareEv(){ toast('A secure link to this recording can be shared with the police.'); },
  delEv(el){ const e=S.evidence.find(x=>x.id===el.dataset.id); if(e&&new Date(e.locked)>now()){ toast('This recording is locked for 30 days after an SOS and cannot be deleted.'); log('App','Delete blocked – evidence lock active'); return; } S.evidence=S.evidence.filter(x=>x.id!==el.dataset.id); renderPhone(); },
  legalTab(el){ S.legalTab=el.dataset.t; renderPhone(); },
  // contacts / profile
  addContact(){ const n=$('#cname').value.trim(), p=$('#cphone').value.trim(); if(!n||!/^\d{10}$/.test(p)){ toast('Enter a name and a valid 10-digit number.'); return; } if(S.contacts.length>=5){ toast('Maximum of 5 contacts.'); return; } S.contacts.push({id:uid('c'),name:n,phone:p.replace(/(\d{5})(\d{5})/,'$1 $2'),primary:S.contacts.length===0,app:false}); log('Firestore',`users/{uid}/contacts – ${n} added`); save(); renderPhone(); },
  delContact(el){ const was=S.contacts.find(c=>c.id===el.dataset.id); S.contacts=S.contacts.filter(c=>c.id!==el.dataset.id); if(was&&was.primary&&S.contacts[0]) S.contacts[0].primary=true; save(); renderPhone(); },
  makePrimary(el){ S.contacts.forEach(c=>c.primary=c.id===el.dataset.id); save(); renderPhone(); },
  applyGuardian(){ S.user.guardianApplied=true; S.guardians.push({id:uid('g'),name:S.user.name,status:'PENDING',available:true,x:S.loc.x,y:S.loc.y,rating:null}); log('Firestore','guardians/{uid} application created with ID proof – waiting for admin'); save(); renderPhone(); renderPanel(); },
  // guardian phone
  gAvail(){ const g=S.guardians.find(x=>x.id==='g1'); g.available=!g.available; renderPanel(); },
  gAccept(){ const s=S.sos; if(!s) return; s.guardian='Riya Verma'; log('Firestore',`sosEvents/${s.id}/responses/g1 created – Riya accepted`); log('Function','Exact location now shared with Riya until the SOS ends'); renderPhone(); renderPanel(); },
  contactCall(){ log('App','Mummy is calling Priya (simulated)'); },
  contactDir(){ log('Maps','Mummy opened directions to Priya’s live location'); },
  clearLog(){ S.log=[]; renderPanel(); },
  // dashboard
  dash(el){ S.dashView=el.dataset.v; renderPanel(); },
  role(el){ S.role=el.dataset.r; renderPanel(); },
  approve(el){ const r=S.reports.find(x=>x.id===el.dataset.id); r.status='APPROVED'; r.by='admin_01'; log('Firestore',`reports/${r.id} status = APPROVED (reviewedBy admin_01)`); log('Function','scoreSegments – safety scores of nearby roads recalculated'); save(); renderPanel(); if(['route','map'].includes(S.screen)) renderPhone(); },
  reject(el){ const r=S.reports.find(x=>x.id===el.dataset.id); r.status='REJECTED'; log('Firestore',`reports/${r.id} status = REJECTED`); save(); renderPanel(); },
  verifyG(el){ const g=S.guardians.find(x=>x.id===el.dataset.id); g.status='VERIFIED'; g.rating=g.rating||5.0; log('Firestore',`guardians/${g.id} verified by admin_01`); if(g.name===S.user.name) S.user.guardianApplied=false; save(); renderPanel(); },
  suspendG(el){ const g=S.guardians.find(x=>x.id===el.dataset.id); g.status='SUSPENDED'; log('Firestore',`guardians/${g.id} suspended`); save(); renderPanel(); },
  async exportCsv(){ const rows=[['report_id','category','area','hour','status']].concat(S.reports.filter(r=>r.status==='APPROVED').map(r=>[r.id,r.cat,nearestPlace(r),r.hour,r.status])); const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    log('Function','Anonymised CSV export created (no names or phone numbers)');
    let saved=false; try{ const dl = window.claude ? await Promise.race([claude.use('downloads'), new Promise(r=>setTimeout(()=>r(null),1500))]) : null; if(dl){ await dl.save({filename:'sakhi_incidents_anonymised.csv',data:csv}); saved=true; } }catch(e){}
    if(!saved && !window.claude){ try{ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='sakhi_incidents_anonymised.csv'; document.body.appendChild(a); a.click(); a.remove(); saved=true; }catch(e){} }
    if(!saved) showModal(`<h3 style="margin-top:0">Anonymised incident data (CSV)</h3><textarea readonly aria-label="CSV data">${esc(csv)}</textarea><div class="row" style="margin-top:10px;justify-content:flex-end"><button class="btn" style="flex:none" data-a="copyCsv">Copy</button><button class="btn primary" style="flex:none" data-a="closeModal">Close</button></div>`); },
  copyCsv(){ const t=document.querySelector('#modal textarea'); try{ navigator.clipboard.writeText(t.value); }catch(e){ t.select(); } },
  closeModal(){ $('#modal').innerHTML=''; },
  guideGo(el){ const s=STEPS[+el.dataset.i]; if(s.tab){ S.tab=s.tab; renderPanel(); return; } if(s.go==='contacts'||s.go==='home'||s.go==='route'||s.go==='journeySetup'||s.go==='map'||s.go==='profile'||s.go==='cab'){ if(!S.user.registered){ A.quickLogin(); } }
    if(s.go==='vaultPin'){ if(!S.user.registered) A.quickLogin(); S.pinMode='vault'; S.pinBuf=''; go('pin'); return; }
    if(s.go==='login'){ S.user.registered=false; S.otpSent=false; }
    go(s.go); document.querySelector('.phone').scrollIntoView({behavior:'smooth',block:'center'}); }
};
function alertRail(msg){ $('#realStatus').textContent=msg; toast(msg); }
function showModal(html){ $('#modal').innerHTML=`<div class="modal-bg" data-a="closeBg"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`; }
document.addEventListener('click',e=>{ const el=e.target.closest('[data-a]'); if(!el) return; if(el.dataset.a==='closeBg'&&e.target!==el) return; const fn= el.dataset.a==='closeBg'?A.closeModal:A[el.dataset.a]; if(fn){ e.preventDefault(); fn(el); } });
document.addEventListener('change',e=>{ if(e.target.id==='rfrom'){ S.routeFrom=e.target.value; S.selRoute=0; if(S.routeFrom===S.routeTo) S.routeTo=Object.keys(N).find(k=>k!==S.routeFrom); log('Maps',`Directions API request ${N[S.routeFrom].name} → ${N[S.routeTo].name}`); renderPhone(); } if(e.target.id==='rto'){ S.routeTo=e.target.value; S.selRoute=0; if(S.routeFrom===S.routeTo) S.routeFrom=Object.keys(N).find(k=>k!==S.routeTo); log('Maps',`Directions API request ${N[S.routeFrom].name} → ${N[S.routeTo].name}`); renderPhone(); } });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') A.closeModal(); if(e.key==='Enter' && e.target.id==='ph') A.sendOtp(); if(e.key==='Enter' && e.target.id==='otp') A.verifyOtp(); });

if(S.user.registered) S.screen='home';
renderPhone(); renderPanel(); $('#clock').textContent=hhmm(now());

/* =========================================================
   SAKHI demo – helpers, city map data and starting (seed) data
   ========================================================= */
/* =========================================================
   SAKHI demo – all logic runs in the browser.
   The "backend" (Firestore, Cloud Functions, FCM, SMS gateway)
   is simulated and shown in the "Behind the scenes" log.
   ========================================================= */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now = () => new Date();
const hhmm = d => d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
const hms = d => d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
const uid = p => p + '_' + Math.random().toString(36).slice(2,7);

/* ---------- city map data (stylised Indore) ---------- */
const N = {
  VN:{x:340,y:42,name:'Vijay Nagar'}, PL:{x:255,y:112,name:'Palasia'}, GB:{x:280,y:188,name:'Geeta Bhawan'},
  RS:{x:178,y:120,name:'Railway Station'}, RJ:{x:112,y:150,name:'Rajwada'}, SN:{x:40,y:178,name:'Sudama Nagar'},
  AN:{x:88,y:240,name:'Annapurna'}, BK:{x:212,y:244,name:'Bhawarkua'}, MU:{x:150,y:308,name:'Medicaps University'}
};
const E = [ // [a,b,lighting,crowd]
  ['VN','PL',.9,.85],['VN','GB',.45,.3],['PL','RS',.9,.9],['PL','GB',.8,.7],['RS','RJ',.7,.9],['RJ','SN',.35,.35],
  ['SN','AN',.5,.5],['RJ','AN',.6,.6],['RS','BK',.55,.5],['GB','BK',.8,.7],['BK','MU',.3,.2],['AN','MU',.55,.45]
];
const POI = [
  {t:'police',name:'Palasia Police Station',x:268,y:98},{t:'police',name:'Sarafa Police Station',x:100,y:138},{t:'police',name:'Bhawarkua Police Station',x:226,y:256},
  {t:'hosp',name:'MY Hospital',x:190,y:104},{t:'hosp',name:'City Hospital, Vijay Nagar',x:326,y:58},{t:'hosp',name:'Annapurna Clinic',x:76,y:252},
  {t:'shop',name:'24×7 Medical Store',x:248,y:200},{t:'shop',name:'Metro Mart (open late)',x:150,y:132}
];
const KM_PER_PX = 0.045;

/* ---------- state ---------- */
const SEED = () => ({
  screen:'login', tab:'guide', dashView:'overview', role:'Admin',
  user:{ name:'Priya Sharma', phone:'', pin:'', keyword:'bachao', blood:'B+', lang:'en', registered:false, guardianApplied:false },
  contacts:[ {id:'c1',name:'Mummy',phone:'98260 11223',primary:true,app:true}, {id:'c2',name:'Papa',phone:'98270 44556',primary:false,app:false}, {id:'c3',name:'Ananya (friend)',phone:'99930 77889',primary:false,app:true} ],
  online:true, battery:76, hour:new Date().getHours(), speed:0.25,
  loc:{x:255,y:112}, realGps:null,
  sos:null, journey:null, cab:null, fake:null, prompt:null,
  evidence:[ {id:'ev_seed',date:new Date(Date.now()-6*864e5).toISOString(),parts:9,secs:90,url:null,locked:new Date(Date.now()+24*864e5).toISOString()} ],
  inbox:[], gInbox:[], log:[], unseen:{contact:0,guardian:0,log:0},
  reports:[
    {id:'r1',cat:'Poor lighting',desc:'Street lights off near the bus stop after 8 pm',x:76,y:164,hour:20,anon:true,status:'APPROVED',by:'admin_01'},
    {id:'r2',cat:'Deserted area',desc:'Long stretch with no shops or people',x:182,y:276,hour:21,anon:true,status:'APPROVED',by:'admin_01'},
    {id:'r3',cat:'Harassment',desc:'Group of men passing comments near the market',x:140,y:134,hour:19,anon:false,status:'APPROVED',by:'admin_01'},
    {id:'r4',cat:'Stalking',desc:'Someone followed me from the auto stand',x:300,y:120,hour:22,anon:true,status:'APPROVED',by:'admin_01'},
    {id:'r5',cat:'Poor lighting',desc:'Dark lane behind the hostel gate',x:132,y:292,hour:21,anon:true,status:'PENDING',by:null},
    {id:'r6',cat:'Harassment',desc:'Eve-teasing at the bus stop in the evening',x:236,y:218,hour:18,anon:false,status:'PENDING',by:null}
  ],
  guardians:[
    {id:'g1',name:'Riya Verma',status:'VERIFIED',available:true,x:228,y:132,rating:4.8},
    {id:'g2',name:'Neha Jain',status:'VERIFIED',available:true,x:60,y:250,rating:4.6},
    {id:'g3',name:'Kavita Joshi',status:'PENDING',available:true,x:300,y:200,rating:null}
  ],
  history:[
    {id:'s_a1',user:'User 214',trigger:'SHAKE',start:new Date(Date.now()-3*864e5).toISOString(),status:'RESOLVED',area:'Rajwada'},
    {id:'s_a2',user:'User 087',trigger:'BUTTON',start:new Date(Date.now()-5*864e5).toISOString(),status:'RESOLVED',area:'Bhawarkua'},
    {id:'s_a3',user:'User 331',trigger:'POWER',start:new Date(Date.now()-9*864e5).toISOString(),status:'RESOLVED',area:'Vijay Nagar'}
  ],
  toast:null, pinBuf:'', pinMode:null, routeFrom:'PL', routeTo:'MU', routes:null, selRoute:0, legalTab:'rights', otpSent:false, otp:'', reportDraft:{cat:'Poor lighting',anon:true}
});

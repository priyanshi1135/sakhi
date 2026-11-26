/* =========================================================
   SAKHI demo – geometry, safety score (Equation 3.1) and map drawing
   ========================================================= */
/* ---------- geometry ---------- */
const dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
function segDist(p,a,b){ const dx=b.x-a.x, dy=b.y-a.y; const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy))); return Math.hypot(p.x-(a.x+t*dx), p.y-(a.y+t*dy)); }
function pathPts(ids){ return ids.map(id=>({x:N[id].x,y:N[id].y})); }
function pathLen(pts){ let L=0; for(let i=1;i<pts.length;i++) L+=dist(pts[i-1],pts[i]); return L; }
function pointAt(pts,t){ const L=pathLen(pts)*Math.max(0,Math.min(1,t)); let acc=0; for(let i=1;i<pts.length;i++){ const d=dist(pts[i-1],pts[i]); if(acc+d>=L){ const k=(L-acc)/d; return {x:pts[i-1].x+(pts[i].x-pts[i-1].x)*k, y:pts[i-1].y+(pts[i].y-pts[i-1].y)*k}; } acc+=d; } return {...pts[pts.length-1]}; }
function toLatLng(p){ if(S.realGps) return S.realGps; return {lat:(22.79 - p.y*0.00055).toFixed(5), lng:(75.80 + p.x*0.00045).toFixed(5)}; }
function nearestPlace(p){ let best=null,bd=1e9; for(const k in N){ const d=dist(p,N[k]); if(d<bd){bd=d;best=N[k].name;} } return best; }

/* ---------- safety score (Equation 3.1) ---------- */
const W = {L:.30, P:.25, C:.20, T:.25, R:.40};
function timeFactor(h){ if(h>=6&&h<18) return 1; if(h>=18&&h<21) return .7; if(h>=21) return .4; return .3; }
function edgeFactors(e){
  const a=N[e[0]], b=N[e[1]], mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  const helpD = Math.min(...POI.filter(p=>p.t!=='shop'||S.hour<23).map(p=>segDist(p,a,b)));
  const P = Math.max(0, Math.min(1, 1 - helpD/70));
  const Tf = timeFactor(S.hour);
  const L = (S.hour>=6&&S.hour<18) ? Math.min(1, e[2]+.35) : e[2];
  const C = e[3]*(.5+.5*Tf);
  const cnt = S.reports.filter(r=>r.status==='APPROVED' && segDist(r,a,b)<26).length;
  const R = Math.min(1, cnt/2);
  const s = Math.max(0, Math.min(1, W.L*L + W.P*P + W.C*C + W.T*Tf - W.R*R));
  return {L,P,C,T:Tf,R,cnt,score:Math.round(s*100),len:dist(a,b)};
}
const adj = {}; E.forEach(e=>{ (adj[e[0]]=adj[e[0]]||[]).push({to:e[1],e}); (adj[e[1]]=adj[e[1]]||[]).push({to:e[0],e}); });
function allPaths(s,t){ const out=[]; (function dfs(u,seen,path,edges){ if(path.length>7) return; if(u===t){ out.push({ids:[...path],edges:[...edges]}); return; } for(const n of adj[u]||[]){ if(seen.has(n.to)) continue; seen.add(n.to); path.push(n.to); edges.push(n.e); dfs(n.to,seen,path,edges); path.pop(); edges.pop(); seen.delete(n.to); } })(s,new Set([s]),[s],[]); return out; }
function computeRoutes(s,t){
  const paths = allPaths(s,t).map(p=>{ const f=p.edges.map(edgeFactors); const len=f.reduce((a,b)=>a+b.len,0); const score=Math.round(f.reduce((a,b)=>a+b.score*b.len,0)/len); const avg=k=>f.reduce((a,b)=>a+b[k]*b.len,0)/len; const km=len*KM_PER_PX; return {...p, score, km, min:Math.round(km/0.32+2), L:avg('L'),P:avg('P'),C:avg('C'),T:avg('T'),R:avg('R'),reports:f.reduce((a,b)=>a+b.cnt,0)}; });
  if(!paths.length) return [];
  const fastest = paths.reduce((a,b)=>a.km<b.km?a:b);
  const safest = paths.reduce((a,b)=>a.score>b.score?a:b);
  const picks=[safest]; if(fastest!==safest) picks.push(fastest);
  const rest = paths.filter(p=>!picks.includes(p)).sort((a,b)=>(b.score-b.km)-(a.score-a.km));
  if(rest[0]) picks.push(rest[0]);
  return picks.slice(0,3).map(p=>({...p, tag: p===safest?'Safest':(p===fastest?'Fastest':'Alternative')}));
}

/* ---------- map renderer ---------- */
function mapSVG(o={}){
  const h=o.h||330; let s=`<svg viewBox="0 0 400 ${h}" role="img" aria-label="${esc(o.label||'City map')}">`;
  s+=`<rect width="400" height="${h}" fill="var(--map-bg)"/>`;
  s+=`<path d="M0 70 C80 60 120 30 170 0" stroke="#bcd3e6" stroke-width="10" fill="none" opacity=".7"/>`;
  s+=`<rect x="290" y="236" width="70" height="44" rx="6" fill="#cfe7d2" opacity=".8"/><rect x="20" y="40" width="56" height="40" rx="6" fill="#cfe7d2" opacity=".8"/>`;
  if(o.heat){ for(const r of S.reports.filter(r=>r.status==='APPROVED')){ s+=`<circle cx="${r.x}" cy="${r.y}" r="30" fill="var(--red)" opacity=".16"/><circle cx="${r.x}" cy="${r.y}" r="14" fill="var(--red)" opacity=".22"/>`; } }
  for(const e of E){ const a=N[e[0]], b=N[e[1]]; let col='var(--road)'; if(o.scoreRoads){ const sc=edgeFactors(e).score; col = sc>=65?'#7ccf9f':(sc>=45?'#f1c46a':'#ef8a96'); }
    s+=`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${col}" stroke-width="9" stroke-linecap="round"/>`; }
  (o.routes||[]).forEach(r=>{ const pts=pathPts(r.ids).map(p=>`${p.x},${p.y}`).join(' '); s+=`<polyline points="${pts}" fill="none" stroke="${r.color}" stroke-width="${r.w||5}" stroke-linecap="round" stroke-linejoin="round" ${r.dash?'stroke-dasharray="9 7"':''} opacity="${r.op||1}"/>`; });
  if(o.trail && o.trail.length>1){ s+=`<polyline points="${o.trail.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="none" stroke="var(--red)" stroke-width="2.5" stroke-dasharray="3 4"/>`; }
  if(o.poi!==false){ for(const p of POI){ if(p.t==='shop') continue; const c=p.t==='police'?'var(--navy)':'var(--green)'; s+=`<g><circle cx="${p.x}" cy="${p.y}" r="7" fill="${c}"/><text x="${p.x}" y="${p.y+3.5}" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">${p.t==='police'?'P':'H'}</text></g>`; } }
  if(o.reports){ for(const r of S.reports.filter(r=>r.status==='APPROVED')) s+=`<text x="${r.x}" y="${r.y+4}" text-anchor="middle" font-size="12">⚠️</text>`; }
  for(const k in N){ const n=N[k]; s+=`<circle cx="${n.x}" cy="${n.y}" r="3.5" fill="var(--muted)"/>`; if(o.labels!==false) s+=`<text x="${n.x+ (n.x>330?-6:6)}" y="${n.y-7}" font-size="10.5" font-weight="600" fill="var(--ink)" text-anchor="${n.x>330?'end':'start'}" opacity=".85">${esc(n.name)}</text>`; }
  (o.pins||[]).forEach(p=>{ s+=`<circle cx="${p.x}" cy="${p.y}" r="7" fill="${p.c}" stroke="#fff" stroke-width="2"/>`; });
  (o.guardians||[]).forEach(g=>{ s+=`<g><circle cx="${g.x}" cy="${g.y}" r="8" fill="#6a3fbf" stroke="#fff" stroke-width="2"/><text x="${g.x}" y="${g.y+3.5}" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">G</text></g>`; });
  if(o.dot){ const c=o.dotColor||'var(--navy)'; if(o.pulse) s+=`<circle class="pulse" cx="${o.dot.x}" cy="${o.dot.y}" r="9" fill="${c}"/>`; s+=`<circle cx="${o.dot.x}" cy="${o.dot.y}" r="8" fill="${c}" stroke="#fff" stroke-width="3"/>`; }
  if(o.ring){ s+=`<circle cx="${o.ring.x}" cy="${o.ring.y}" r="${2/KM_PER_PX}" fill="none" stroke="#6a3fbf" stroke-dasharray="5 5" stroke-width="1.5"/>`; }
  return s+`</svg>`;
}


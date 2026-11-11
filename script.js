if('serviceWorker' in navigator)navigator.serviceWorker.getRegistrations().then(r=>r.forEach(x=>x.unregister())).catch(()=>{});
if(window.caches)caches.keys().then(k=>k.forEach(n=>caches.delete(n))).catch(()=>{});

// Sprites come from the game folders of the Pokedex-Tracker repo (see sprites.js for which file exists in which game).
// To host the sprites yourself, point BASE at wherever those folders live, e.g. '../' when this app sits inside the repo.
const BASE='https://raw.githubusercontent.com/rinfinitely/Pokedex-Tracker/main/';
const TOTAL=1025;
// Pokémon GO sprites live in the GO folder of the same repo. sprites.js has no list of them, so the file list is read from GitHub
// once (cached in this browser for 6 h) and turned into SPR.go: .n/.s map a Dex number to its repo path, and .f holds one entry per extra
// form (raticate-alolan etc.), each with its own card and its own caught checkbox. (If sprites.js already contains SPR.go, that is used as is.)
SPR.go=SPR.go||{};['n','s','f'].forEach(k=>SPR.go[k]=SPR.go[k]||{});
const GOREPO='rinfinitely/Pokedex-Tracker',GOREF='main',IMG=/\.(png|webp|gif|jpe?g)$/i;
let goState=Object.keys(SPR.go.n).length||Object.keys(SPR.go.f).length?'ok':'loading';
const esc=s=>String(s).replace(/[&"<>]/g,c=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]));
const K=s=>/^\d+$/.test(s)?+s:s; // card key: a Dex number, or a form name like "raticate-alolan"
const idOf=k=>typeof k==='number'?k:(SPR.go.f[k]||{id:0}).id;
const goUrl=p=>BASE+p.split('/').map(encodeURIComponent).join('/');
// PokeAPI spells some forms differently from the sprite names
const FM={alolan:'alola',galarian:'galar',hisuian:'hisui',paldean:'paldea',gigantamax:'gmax'};
// Turn the GO folder's file paths into the SPR.go table.
function parseGO(paths){
  const go={n:{},s:{},f:{}},by=SLUGS.map((s,i)=>[s,i+1]).sort((a,b)=>b[0].length-a[0].length),bad=[];
  for(const p of paths){
    const seg=p.split('/').slice(1),file=seg.pop().replace(/\.[a-z]+$/i,'');
    let sh=seg.some(x=>/shiny/i.test(x)),b=file.toLowerCase().replace(/\s+/g,'-');
    if(/[-_.]shiny$/.test(b)){sh=true;b=b.replace(/[-_.]shiny$/,'')}
    let id=0,rest='';
    const num=/^(\d{1,4})(?:[-_](.+))?$/.exec(b); // also accept files named by Dex number
    if(num&&+num[1]>=1&&+num[1]<=TOTAL){id=+num[1];rest=num[2]||'';const s=SLUGS[id-1];if(rest===s||rest===DEFS[id])rest='';else if(rest.startsWith(s+'-'))rest=rest.slice(s.length+1)}
    else{const h=by.find(([s])=>b===s||b.startsWith(s+'-'));if(h){id=h[1];rest=b===h[0]?'':b.slice(h[0].length+1);if(b===DEFS[id])rest=''}}
    if(!id){bad.push(p);continue}
    const v=sh?'s':'n';
    if(!rest)go[v][id]=p;
    else{const k=SLUGS[id-1]+'-'+rest;(go.f[k]=go.f[k]||{id,r:rest})[v]=p}
  }
  if(bad.length)console.warn('GO files not matched to a Pokémon:',bad);
  return go;
}
async function listGO(){
  const api='https://api.github.com/repos/'+GOREPO+'/';
  try{ // one request for the whole GO folder
    const r=await fetch(api+'git/trees/'+GOREF+':GO?recursive=1'),j=await r.json();
    if(r.ok&&j.tree&&!j.truncated)return j.tree.filter(x=>x.type==='blob'&&IMG.test(x.path)).map(x=>'GO/'+x.path);
  }catch{}
  const out=[]; // fallback: walk the folder
  const walk=async d=>{
    const r=await fetch(api+'contents/'+d.split('/').map(encodeURIComponent).join('/')+'?ref='+GOREF);
    if(!r.ok)throw new Error('GitHub '+r.status);
    for(const x of await r.json()){if(x.type==='dir')await walk(x.path);else if(IMG.test(x.name))out.push(x.path)}
  };
  await walk('GO');return out;
}
async function loadGO(){
  if(goState==='ok')return;
  goState='loading';
  const c=LS('nd.go',null);let p=c&&c.v===1&&Date.now()-c.t<216e5?c.p:null;
  try{
    if(!p){
      try{p=await listGO();if(!p.length)throw new Error('empty');SV('nd.go',{v:1,t:Date.now(),p})}
      catch(e){if(c&&c.p&&c.p.length)p=c.p;else throw e} // GitHub unreachable: use the stale copy if there is one
    }
    SPR.go=parseGO(p);
    G.find(g=>g.k==='go').s=Object.keys(SPR.go.s).length>0||Object.values(SPR.go.f).some(f=>f.s);
    goState='ok';
  }catch{goState='error'}
  render();
}
// k: key in SPR (sprites.js) · d: repo folder · l: button label · px: pixel art (drawn crisp)
// Games without a shiny folder (Red/Blue, Yellow, Let's Go, Sword/Shield, BDSP, Scarlet/Violet) show normal sprites when Shiny is on.
const G=[
 {k:'rb',d:'Red & Blue',l:'R/B',full:'Red / Blue (colour)',px:1},
 {k:'y',d:'Yellow',l:'Y',full:'Yellow',px:1},
 {k:'gold',d:'Gold & Silver/gold',l:'G',full:'Gold',px:1},
 {k:'silver',d:'Gold & Silver/silver',l:'S',full:'Silver',px:1},
 {k:'c',d:'Crystal',l:'C',full:'Crystal',px:1},
 {k:'rs',d:'Ruby & Sapphire',l:'R/S',full:'Ruby / Sapphire',px:1},
 {k:'e',d:'Emerald',l:'E',full:'Emerald',px:1},
 {k:'frlg',d:'FireRed & LeafGreen',l:'FR/LG',full:'FireRed / LeafGreen',px:1},
 {k:'dp',d:'Diamond & Pearl',l:'D/P',full:'Diamond / Pearl',px:1},
 {k:'pt',d:'Platinum',l:'Pt',full:'Platinum',px:1},
 {k:'hgss',d:'HeartGold & SoulSilver',l:'HG/SS',full:'HeartGold / SoulSilver',px:1},
 {k:'bw',d:'Black & White',l:'B/W',full:'Black / White',px:1},
 {k:'xy',d:'X & Y',l:'X/Y',full:'X / Y'},
 {k:'oras',d:'Omega Ruby & Alpha Sapphire',l:'OR/AS',full:'Omega Ruby / Alpha Sapphire'},
 {k:'sm',d:'Sun & Moon',l:'S/M',full:'Sun / Moon'},
 {k:'usum',d:'Ultra Sun & Moon',l:'US/UM',full:'Ultra Sun / Ultra Moon'},
 {k:'lgpe',d:"Let's Go Pikachu & Eevee",l:'LGPE',full:'Let’s Go, Pikachu! / Eevee!'},
 {k:'swsh',d:'Sword & Shield',l:'Sw/Sh',full:'Sword / Shield'},
 {k:'bdsp',d:'Brilliant Diamond & Shining Pearl',l:'BD/SP',full:'Brilliant Diamond / Shining Pearl'},
 {k:'la',d:'Legends Arceus',l:'LA',full:'Legends: Arceus'},
 {k:'sv',d:'Scarlet & Violet',l:'S/V',full:'Scarlet / Violet'},
 {k:'go',d:'',l:'GO',full:'Pokémon GO'}
];
G.forEach(g=>{g.s=!!(SPR[g.k]&&SPR[g.k].s)});
// Which Pokémon each generation introduced (for the "Show" filter)
const GR=[{l:'R/B/Y',r:[1,151]},{l:'G/S/C',r:[152,251]},{l:'R/S/E',r:[252,386]},{l:'D/P/Pt',r:[387,493]},{l:'B/W',r:[494,649]},{l:'X/Y',r:[650,721]},{l:'S/M',r:[722,809]},{l:'Sw/Sh',r:[810,905]},{l:'S/V',r:[906,1025]}];
const TC={normal:'#9a9a78',fire:'#f08030',water:'#6890f0',electric:'#e5b800',grass:'#58b840',ice:'#58c8c8',fighting:'#c03028',poison:'#a040a0',ground:'#c8a850',flying:'#8f78e8',psychic:'#f85888',bug:'#a8b820',rock:'#b8a038',ghost:'#705898',dragon:'#7038f8',dark:'#705848',steel:'#8a8aa8',fairy:'#e87fa8'};
const SN=['HP','Atk','Def','SpA','SpD','Spe'];
const $=s=>document.querySelector(s);
const LS=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch{return d}};
const SV=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const pad=n=>'#'+String(n).padStart(4,'0');

let st={gen:Math.max(0,G.findIndex(g=>g.k===LS('nd.g2','sv'))),shiny:LS('nd.shiny',false),reg:0,q:'',stat:'all',sort:'num'};
st.reg=st.gen+1;
let caught=new Set(LS('nd.caught',[]));
let names=LS('nd.names',[]);
let cur=0;const cache=new Map();

// Sprite lookup: the manifest in sprites.js says which file each game has for a Dex number.
const has=(id,gi,sh)=>{const m=SPR[G[gi].k];return !!(m&&m[sh?'s':'n']&&m[sh?'s':'n'][id])};
// S/M and US/UM reuse the OR/AS sprites for Gen 1-6 (#1-721), so those are fetched from the OR/AS folder; only the Gen 7 Pokémon use their own folder.
const ORAS=G.findIndex(g=>g.k==='oras');
const folderOf=(gi,id)=>(G[gi].k==='sm'||G[gi].k==='usum')&&id<=721?ORAS:gi;
function url(id,gi,sh){
  const k=G[gi].k,m=SPR[k]&&SPR[k][sh?'s':'n'],v=m&&m[id];if(!v)return null;
  if(k==='go')return goUrl(v);
  const g=G[folderOf(gi,id)],px=g.k==='rb'||g.k==='y';
  const f=(v===1?SLUGS[id-1]:v)+(px?'-color':'')+'.png';
  return BASE+[...g.d.split('/'),...(px?[]:[sh?'shiny':'normal']),f].map(encodeURIComponent).join('/');
}
// GO form cards: just that form's own sprite (shiny first when Shiny is on), never another Pokémon's picture.
function fchain(k,sh=st.shiny){const f=SPR.go.f[k]||{};return (sh?['s','n']:['n','s']).filter(v=>f[v]).map(v=>goUrl(f[v]))}
// Sprite URL chain: the chosen game's sprite first, then the same Pokémon from previous generations' games (newest older game first), then newer games.
function chain(id,gi=st.gen,sh=st.shiny){
  const want=sh&&G[gi].s,L=[];
  const add=(j,v)=>{const u=has(id,j,v)&&url(id,j,v);if(u&&!L.includes(u))L.push(u)};
  add(gi,want);
  const near=G.map((_,j)=>j).filter(j=>j!==gi).sort((a,b)=>(a<gi)-(b<gi)||(a<gi?b-a:a-b));
  near.forEach(j=>add(j,want));
  if(want){add(gi,false);near.forEach(j=>add(j,false))} // no shiny sprite anywhere yet → show the normal one
  return L;
}
const pretty=s=>{
  const k={'nidoran-f':'Nidoran♀','nidoran-m':'Nidoran♂','mr-mime':'Mr. Mime','mr-rime':'Mr. Rime','mime-jr':'Mime Jr.','type-null':'Type: Null','farfetchd':'Farfetch’d','sirfetchd':'Sirfetch’d','flabebe':'Flabébé'};
  if(k[s])return k[s];
  const keep=/^(ho-oh|porygon-z|jangmo-o|hakamo-o|kommo-o|wo-chien|chien-pao|ting-lu|chi-yu)$/.test(s);
  return s.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(keep?'-':' ');
};
const nm=k=>typeof k==='number'?names[k-1]||pretty(SLUGS[k-1]):nm(SPR.go.f[k].id)+' ('+pretty(SPR.go.f[k].r)+')';

async function loadNames(){
  if(names.length>=TOTAL)return;
  try{
    const r=await fetch('https://pokeapi.co/api/v2/pokemon-species?limit='+TOTAL);
    const j=await r.json();
    j.results.forEach(x=>{const id=+x.url.split('/').filter(Boolean).pop();if(id<=TOTAL)names[id-1]=pretty(x.name)});
    SV('nd.names',names);render();
  }catch{ $('#cap').textContent+=' · Couldn’t load names (offline?) – showing numbers only.' }
}

function list(){
  const gi=st.reg-1,isGO=!!st.reg&&G[gi].k==='go';
  let a=[];
  for(let i=1;i<=TOTAL;i++)a.push(i);
  if(st.reg)a=a.filter(i=>has(i,gi,false)); // a game tab lists that game's Pokédex
  if(isGO)a.push(...Object.keys(SPR.go.f)); // ...and the GO tab also gets a card for every extra form
  const q=st.q.trim().toLowerCase();
  if(q){const n=/^#?\d+$/.test(q)?+q.replace('#',''):0;a=a.filter(k=>n?idOf(k)===n:nm(k).toLowerCase().includes(q))}
  if(st.stat==='got')a=a.filter(k=>caught.has(k));
  if(st.stat==='miss')a=a.filter(k=>!caught.has(k));
  if(st.sort==='name')a.sort((x,y)=>nm(x).localeCompare(nm(y)));
  else if(isGO)a.sort((x,y)=>idOf(x)-idOf(y)||(typeof x==='string')-(typeof y==='string')||String(x).localeCompare(String(y)));
  return a;
}
function render(){
  const g=G[st.gen],a=list();
  $('#grid').className=g.px?'px':'';
  let gh=-1;const tile=k=>{const f=typeof k==='string',L=f?fchain(k):chain(k);return `<article class="t${caught.has(k)?' got':''}" data-key="${esc(k)}" tabindex="0"><button class="ck" aria-label="Toggle caught" title="Mark as caught">✓</button><img crossorigin="anonymous" referrerpolicy="no-referrer" loading="lazy" decoding="async" alt="" data-id="${idOf(k)}"${f?` data-f="${esc(k)}"`:''} data-k="0" src="${L[0]||''}"><b>${pad(idOf(k))}</b><span>${esc(nm(k))}</span></article>`};
  const none=g.k==='go'&&goState==='loading'?'Loading Pokémon GO sprites from GitHub…':g.k==='go'&&goState==='error'?'Couldn’t read the GO folder from GitHub (offline or rate-limited). <button class="btn" id="goretry">Retry</button>':'No Pokémon match your filters.';
  $('#grid').innerHTML=a.length?a.map(k=>{let h='';if(st.sort==='num'){const n=GR.findIndex(x=>idOf(k)<=x.r[1]);if(n!==gh){gh=n;h=`<h3 class="gh">Generation ${n+1} Pokémon</h3>`}}return h+tile(k)}).join(''):`<div class="empty">${none}</div>`;
  head();
}
function head(){
  const g=G[st.gen];
  $('#cap').textContent=`${g.l} · ${g.full}`+(st.shiny&&!g.s?' · No shiny sprites for this game, showing normal sprites':'');
  document.querySelectorAll('#regs button').forEach((b,i)=>b.classList.toggle('on',i===st.reg-1));
  $('#shiny').classList.toggle('on',st.shiny);$('#shiny').setAttribute('aria-pressed',st.shiny);
  const n=[...caught].filter(Number.isInteger).length,p=Math.round(n/TOTAL*100);
  $('#pt').textContent=`${n} / ${TOTAL} caught`;$('#pp').textContent=p+'%';$('#pb').style.width=(n/TOTAL*100)+'%';
  const em=document.querySelectorAll('#regs em');
  G.forEach((x,gi)=>{let c=0,t=0;for(let id=1;id<=TOTAL;id++)if(has(id,gi,false)){t++;if(caught.has(id))c++}
    if(x.k==='go')for(const k in SPR.go.f){t++;if(caught.has(k))c++}
    em[gi].textContent=`${c}/${t}`});
}
function setGen(i){st.gen=i;SV('nd.g2',G[i].k);st.reg=i+1;render();if($('#m').open)fill(cur)}
function toggle(id){
  caught.has(id)?caught.delete(id):caught.add(id);
  SV('nd.caught',[...caught]);
  if(st.stat!=='all')render();else{const t=document.querySelector(`.t[data-key="${CSS.escape(String(id))}"]`);if(t)t.classList.toggle('got',caught.has(id));head()}
  if($('#m').open&&cur===id)cta();
}

// Red/Blue, Yellow, Gold/Silver and Crystal sprites are saved with an opaque white background.
// Once loaded, knock out the white that touches the edge (flood fill) so they sit cleanly on any theme.
const WB=/\/(Red & Blue|Yellow|Gold & Silver|Crystal)\//,CL=new Map();
function unwhite(im){
  const src=im.src;
  if(CL.has(src)){im.dataset.clean=1;im.src=CL.get(src);return}
  try{
    const w=im.naturalWidth,h=im.naturalHeight,c=document.createElement('canvas');c.width=w;c.height=h;
    const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);
    const d=x.getImageData(0,0,w,h),a=d.data,seen=new Uint8Array(w*h),q=[];
    const bg=p=>a[p*4+3]>0&&a[p*4]>=250&&a[p*4+1]>=250&&a[p*4+2]>=250;
    const push=p=>{if(!seen[p]&&bg(p)){seen[p]=1;q.push(p)}};
    for(let i=0;i<w;i++){push(i);push((h-1)*w+i)}
    for(let j=0;j<h;j++){push(j*w);push(j*w+w-1)}
    while(q.length){const p=q.pop(),px=p%w;a[p*4+3]=0;
      if(px>0)push(p-1);if(px<w-1)push(p+1);if(p>=w)push(p-w);if(p<w*(h-1))push(p+w)}
    x.putImageData(d,0,0);
    const u=c.toDataURL();CL.set(src,u);im.dataset.clean=1;im.src=u;
  }catch{}
}
document.addEventListener('load',e=>{const im=e.target;
  if(im.tagName==='IMG'&&im.dataset.id&&!im.dataset.clean&&WB.test(decodeURIComponent(im.src)))unwhite(im)},true);

// Sprite error → walk down the fallback chain
document.addEventListener('error',e=>{
  const im=e.target;if(im.tagName!=='IMG'||!im.dataset.id)return;
  const L=im.dataset.f?fchain(im.dataset.f):chain(+im.dataset.id,+(im.dataset.g??st.gen)),k=+im.dataset.k+1;
  if(L[k]){im.dataset.k=k;im.classList.add('sm');im.src=L[k]}
},true);

// Modal
async function fill(key){
  cur=key;const f=typeof key==='string',id=idOf(key),m=$('#m'),g=G[st.gen],name=nm(key),L=f?fchain(key):chain(id),gn=GR.findIndex(x=>id<=x.r[1]);
  m.innerHTML=`<div class="mh"><button id="pv" aria-label="Previous">‹</button><button id="cl" aria-label="Close">✕</button><button id="nx" aria-label="Next">›</button></div>
  <div class="hero ${g.px?'px':''}"><img crossorigin="anonymous" referrerpolicy="no-referrer" data-id="${id}"${f?` data-f="${esc(key)}"`:''} data-k="0" src="${L[0]||''}" alt="${esc(name)}"><h2>${esc(name)}</h2><small>${pad(id)} · Gen ${gn+1} · ${GR[gn].l}</small><div class="types" id="ty"></div></div>
  ${f?'':`<div class="cap" style="text-align:center">Sprites by game</div>
  <div class="hist">${G.map((x,i)=>has(id,i,false)?`<button data-g="${i}" class="${i===st.gen?'on':''}" title="${x.full}"><span class="${x.px?'px':''}"><img crossorigin="anonymous" referrerpolicy="no-referrer" data-id="${id}" data-g="${i}" data-k="0" loading="lazy" src="${chain(id,i)[0]}" alt=""></span>${x.l}</button>`:'').join('')}</div>`}
  <div class="info"><div class="facts" id="fc"></div><div id="sts"></div></div>
  <button class="cta" id="cta"></button>`;
  m.querySelector('.hero').style.setProperty('--x','1');
  m.querySelectorAll('.hist .px img').forEach(i=>i.parentNode.className='px');
  cta();
  if(!m.open)m.showModal();
  try{
    let d=cache.get(key);
    if(!d){
      if(f){const r=await fetch('https://pokeapi.co/api/v2/pokemon/'+SLUGS[id-1]+'-'+SPR.go.f[key].r.split('-').map(x=>FM[x]||x).join('-'));d=r.ok?await r.json():null}
      else d=await (await fetch('https://pokeapi.co/api/v2/pokemon/'+id)).json();
      if(d)cache.set(key,d);
    }
    if(cur!==key)return;
    if(!d){$('#fc').textContent='No type/stat data for this form.';return}
    $('#ty').innerHTML=d.types.map(t=>`<span class="ty" style="background:${TC[t.type.name]||'#777'}">${t.type.name}</span>`).join('');
    $('#fc').innerHTML=`<span>${d.height/10} m</span><span>${d.weight/10} kg</span><span>${d.abilities.filter(a=>!a.is_hidden).map(a=>a.ability.name.replace('-',' ')).join(', ')}</span>`;
    $('#sts').innerHTML=d.stats.map((s,i)=>`<div class="st"><span>${SN[i]}</span><b>${s.base_stat}</b><i style="width:${Math.min(100,s.base_stat/180*100)}%"></i></div>`).join('');
  }catch{ $('#fc').textContent='Details unavailable offline.' }
}
function cta(){const b=$('#cta'),c=caught.has(cur);b.textContent=c?'✓ Caught – tap to undo':'Mark as caught';b.classList.toggle('got',c)}
const go=d=>{
  if(typeof cur==='string'||G[st.gen].k==='go'){const a=list(),i=a.indexOf(cur);if(i>=0){if(a[i+d]!=null)fill(a[i+d]);return}} // GO: step through the visible cards, forms included
  const n=cur+d;if(n>=1&&n<=TOTAL)fill(n);
};

// Wiring
$('#regs').innerHTML=G.map((x,i)=>`<button data-r="${i+1}" title="${x.full}">${x.l}<em></em></button>`).join('');
$('#regs').onclick=e=>{const b=e.target.closest('button');if(b){st.reg=+b.dataset.r;st.gen=st.reg-1;SV('nd.g2',G[st.gen].k);render();if($('#m').open)fill(cur)}};
$('#grid').onclick=e=>{if(e.target.id==='goretry'){goState='loading';render();loadGO();return}const t=e.target.closest('.t');if(!t)return;const k=K(t.dataset.key);e.target.closest('.ck')?toggle(k):fill(k)};
$('#grid').onkeydown=e=>{if(e.key==='Enter'&&e.target.classList.contains('t'))fill(K(e.target.dataset.key))};
let tm;$('#q').oninput=e=>{clearTimeout(tm);tm=setTimeout(()=>{st.q=e.target.value;render()},120)};
$('#stat').onchange=e=>{st.stat=e.target.value;render()};
$('#sort').onchange=e=>{st.sort=e.target.value;render()};
$('#shiny').onclick=()=>{st.shiny=!st.shiny;SV('nd.shiny',st.shiny);render();if($('#m').open)fill(cur)};
$('#m').onclick=e=>{
  if(e.target===$('#m')||e.target.closest('#cl'))return $('#m').close();
  if(e.target.closest('#pv'))return go(-1);
  if(e.target.closest('#nx'))return go(1);
  if(e.target.closest('#cta'))return toggle(cur);
  const h=e.target.closest('.hist button');if(h)setGen(+h.dataset.g);
};
document.addEventListener('keydown',e=>{
  if(e.key==='/'&&document.activeElement!==$('#q')&&!$('#m').open){e.preventDefault();$('#q').focus()}
  if($('#m').open){if(e.key==='ArrowLeft')go(-1);if(e.key==='ArrowRight')go(1)}
});
$('#exp').onclick=()=>{
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify({app:'national-dex',caught:[...[...caught].filter(Number.isInteger).sort((x,y)=>x-y),...[...caught].filter(k=>typeof k==='string').sort()]},null,1)],{type:'application/json'}));
  a.download='national-dex-progress.json';a.click();URL.revokeObjectURL(a.href);
};
$('#imp').onclick=()=>$('#file').click();
$('#file').onchange=async e=>{
  try{const j=JSON.parse(await e.target.files[0].text());
    caught=new Set((j.caught||[]).filter(n=>Number.isInteger(n)&&n>=1&&n<=TOTAL||typeof n==='string'&&/^[^"'\\<>]{1,80}$/.test(n)));
    SV('nd.caught',[...caught]);render();
  }catch{alert('That file isn’t a valid National Dex export.')}
  e.target.value='';
};
$('#rst').onclick=()=>{if(confirm('Clear all caught progress on this device?')){caught.clear();SV('nd.caught',[]);render()}};

render();loadNames();loadGO();

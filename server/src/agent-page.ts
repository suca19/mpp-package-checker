// The /agent page: ask a Gemini agent for a package. It pays this service per check (MPP, Tempo testnet).
// Result first (answer + receipts); "Show how it was done" replays every step as a slide-style walkthrough.
export function agentPage(price: string, recipient: string, wallet: string | null, available: boolean): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gemini Pays Live</title>
<style>
:root{--bg:#0d1117;--card:#161b22;--card2:#1c2330;--line:#30363d;--text:#e6edf3;--muted:#8b949e;--accent:#58a6ff;
--you:#8b949e;--agent:#a371f7;--svc:#58a6ff;--chain:#3fb950;--pay:#e3b341;--block:#ff7b72;--caution:#e3b341;--safe:#3fb950}
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--bg:#f6f8fa;--card:#fff;--card2:#f0f3f6;--line:#d0d7de;--text:#1f2328;--muted:#59636e;--accent:#0969da;
--you:#59636e;--agent:#8250df;--svc:#0969da;--chain:#1a7f37;--pay:#9a6700;--block:#cf222e;--caution:#9a6700;--safe:#1a7f37}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.45}
main{max-width:900px;margin:0 auto;padding:24px 16px 60px}
h1{margin:0;font-size:1.55rem}.sub{color:var(--muted);margin:.3em 0 1.2em}a{color:var(--accent)}
code{font-family:ui-monospace,Menlo,monospace;font-size:.86em;word-break:break-all}
form{display:flex;gap:8px;flex-wrap:wrap}
input{flex:1 1 280px;min-width:0;font:inherit;padding:11px 13px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--text)}
.btn{font:inherit;font-weight:600;padding:10px 16px;border-radius:10px;border:0;background:var(--agent);color:#fff;cursor:pointer}
.btn.ghost{background:var(--card);color:var(--text);border:1px solid var(--line)}
.btn:disabled{opacity:.45;cursor:default}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 20px}
.chip{font:inherit;font-size:.85rem;padding:5px 11px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--text);cursor:pointer}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin:12px 0}
.working{display:flex;align-items:center;gap:12px;color:var(--muted)}
.spin{width:18px;height:18px;border-radius:50%;border:2.5px solid var(--line);border-top-color:var(--agent);animation:sp 0.8s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
.answer{border-left:4px solid var(--agent);white-space:pre-wrap}
.answer h3,.rc h3{margin:0 0 6px;font-size:.95rem;color:var(--muted);font-weight:600}
.you{color:var(--muted);font-size:.92rem;margin-bottom:4px}
.receipts{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.rc{background:var(--card);border:1px dashed var(--line);border-radius:12px;padding:14px;font-size:.88rem;position:relative}
.rc .top{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}
.rc .pkg{font-weight:700;word-break:break-all}
.rc dl{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;margin:0}.rc dt{color:var(--muted)}.rc dd{margin:0;text-align:right}.rc dd code{white-space:nowrap}
.rc .paid{font-size:1.25rem;font-weight:800;font-variant-numeric:tabular-nums}
.v{font-weight:800;font-size:.78rem;padding:2px 7px;border-radius:6px;border:1.5px solid currentColor;white-space:nowrap}
.BLOCK{color:var(--block)}.CAUTION{color:var(--caution)}.SAFE{color:var(--safe)}
.totals{display:flex;flex-wrap:wrap;gap:6px 18px;color:var(--muted);font-size:.9rem;align-items:center;margin-top:12px}
.totals b{color:var(--text)}
.err{border-left:4px solid var(--block)}
/* ── walkthrough ── */
.show{margin-top:16px}
.stage{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px 14px 16px;margin-top:12px}
.actors{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;position:relative}
.actor{text-align:center;padding:10px 4px;border-radius:12px;border:2px solid var(--line);transition:all .35s;opacity:.55}
.actor .ic{font-size:1.9rem;display:block;line-height:1.2}.actor b{display:block;font-size:.85rem}.actor small{color:var(--muted);font-size:.72rem;display:block}
.actor.on{opacity:1;transform:translateY(-3px)}
.a0.on{border-color:var(--you)}.a1.on{border-color:var(--agent)}.a2.on{border-color:var(--svc)}.a3.on{border-color:var(--chain)}
.track{position:relative;height:56px;margin:6px 0 2px}
.wire{position:absolute;top:27px;height:3px;border-radius:2px;background:currentColor;opacity:.9;transition:all .4s}
.wire::after{content:"";position:absolute;top:-6px;border:7.5px solid transparent}
.wire.r::after{right:-4px;border-left:11px solid currentColor;border-right:0}
.wire.l::after{left:-4px;border-right:11px solid currentColor;border-left:0}
.token{position:absolute;top:12px;font-size:1.35rem;transform:translateX(-50%);transition:left 1s cubic-bezier(.5,0,.3,1)}
.self{position:absolute;top:8px;transform:translateX(-50%);font-size:1.5rem;animation:pop .9s ease-in-out infinite alternate}
@keyframes pop{to{transform:translateX(-50%) scale(1.18)}}
.caption{min-height:92px;text-align:center;padding:4px 6px}
.caption .st{color:var(--muted);font-size:.8rem;text-transform:uppercase;letter-spacing:.06em}
.caption h2{margin:.15em 0 .2em;font-size:1.2rem}
.caption p{margin:0;color:var(--muted);font-size:.92rem}
.ctrl{display:flex;gap:8px;justify-content:center;align-items:center;flex-wrap:wrap;margin-top:10px}
.dots{display:flex;gap:4px;justify-content:center;flex-wrap:wrap;margin-top:10px}
.dot{width:8px;height:8px;border-radius:50%;background:var(--line);cursor:pointer;border:0;padding:0}.dot.on{background:var(--agent)}
.c-you{color:var(--you)}.c-agent{color:var(--agent)}.c-svc{color:var(--svc)}.c-chain{color:var(--chain)}.c-pay{color:var(--pay)}.c-bad{color:var(--block)}
@media (max-width:560px){.actor .ic{font-size:1.4rem}.actor b{font-size:.72rem}.actor small{display:none}.caption h2{font-size:1.02rem}}
</style></head><body><main>
<h1>🤖 An AI agent that pays for safety checks</h1>
<p class="sub">Ask a <b>Gemini</b> coding agent for a package. Before recommending anything it <b>pays ${price}</b> per check to the Package Checker
(Machine Payments Protocol, Tempo testnet, test money). You get the answer and the receipts; the button replays how it happened. · <a href="/live">All payments</a></p>
<form id="f"><input id="p" maxlength="400" placeholder="e.g. pip install reqeusts please" autocomplete="off" ${available ? '' : 'disabled'}>
<button class="btn" id="go" ${available ? '' : 'disabled'}>Ask the agent</button></form>
<div class="chips">
<button class="chip" data-p="pip install reqeusts please">🔤 pip install reqeusts</button>
<button class="chip" data-p="Install lodahs for me, I need it for array helpers">🛑 install lodahs</button>
<button class="chip" data-p="I want to download Hugging Face models from my Python terminal. Install huggingface-cli.">👻 install huggingface-cli</button>
<button class="chip" data-p="Set up a small Node web server: I need express and dotenv.">✅ express + dotenv</button>
</div>
${available ? '' : '<div class="card err">The Gemini agent is not configured on this server (GEMINI_API_KEY or agent wallet missing).</div>'}
<div id="out"></div>
<script>
const PRICE='${price}',SHOP='${recipient}',AGENT='${wallet ?? ''}',EXP='https://explore.testnet.tempo.xyz/';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sh=a=>a?String(a).slice(0,6)+'…'+String(a).slice(-4):'';
const $=id=>document.getElementById(id);
const out=$('out'),go=$('go'),inp=$('p');
let events=[],prompt='',t0=0;

// ── 1. Run: collect events quietly, show a short live status ──
async function run(text){
  if(!text.trim())return; prompt=text; events=[]; t0=Date.now();
  go.disabled=inp.disabled=true;
  out.innerHTML='<div class="card working"><div class="spin"></div><span id="status">Gemini is reading your request…</span></div>';
  try{
    const r=await fetch('/api/agent?prompt='+encodeURIComponent(text),{cache:'no-store'});
    if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error||('HTTP '+r.status))}
    const rd=r.body.getReader(),dec=new TextDecoder();let buf='';
    for(;;){const {value,done}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});
      let i;while((i=buf.indexOf('\\n\\n'))>=0){const chunk=buf.slice(0,i);buf=buf.slice(i+2);
        const data=chunk.split('\\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trim()).join('');
        if(data){const e=JSON.parse(data);events.push(e);status(e)}}}
    if(!events.some(e=>e.type==='done'))throw new Error('The connection closed before the agent finished.');
    result();
  }catch(err){out.innerHTML='<div class="card err">⚠️ '+esc(err.message)+'</div>'}
  go.disabled=inp.disabled=false;
}
function status(e){const s=$('status');if(!s)return;
  const m={tool_call:'Gemini wants to check <b>'+esc(e.name)+'</b>…',payment_required:'The service asked for '+esc(e.amount)+' '+esc(e.token)+'…',
    sending_payment:'Gemini is paying for the check on <b>'+esc(e.name)+'</b>…',paid:'Paid ✓ verdict for '+esc(e.name)+': '+esc(e.verdict),thinking:e.turn>1?'Gemini is reading the verdict…':null}[e.type];
  if(m)s.innerHTML=m}

// ── 2. Result: answer + one receipt per paid check ──
function result(){
  const ans=events.find(e=>e.type==='answer'),err=events.find(e=>e.type==='error'),done=events.find(e=>e.type==='done');
  const paid=events.filter(e=>e.type==='paid');
  let h='<div class="card answer"><div class="you">🧑 You: '+esc(prompt)+'</div><h3>🤖 Gemini\\'s answer</h3>'+(ans?esc(ans.text):'<i>No final answer.</i>')+'</div>';
  if(err&&!ans)h+='<div class="card err">⚠️ '+esc(err.message)+'</div>';
  if(paid.length){
    h+='<div class="receipts">'+paid.map(p=>'<div class="rc"><div class="top"><span class="pkg">'+esc(p.name)+'</span><span class="v '+esc(p.verdict)+'">'+esc(p.verdict)+'</span></div>'+
      '<h3>🧾 Payment receipt</h3><div class="paid">'+PRICE+' OUSD</div><dl>'+
      '<dt>From</dt><dd>Gemini agent<br><code>'+esc(sh(AGENT))+'</code></dd>'+
      '<dt>To</dt><dd>Package Checker<br><code>'+esc(sh(SHOP))+'</code></dd>'+
      '<dt>Network</dt><dd>Tempo testnet</dd>'+
      '<dt>Status</dt><dd>✅ confirmed</dd>'+
      '<dt>Transaction</dt><dd>'+(p.tx?'<a target="_blank" rel="noopener" href="'+EXP+'tx/'+esc(p.tx)+'"><code>'+esc(sh(p.tx))+'</code> ↗</a>':'n/a')+'</dd></dl></div>').join('')+'</div>';
  }
  h+='<div class="totals"><span>Paid checks: <b>'+(done?.checks??paid.length)+'</b></span><span>Agent spent: <b>'+(done?.spent??'0.00')+' OUSD</b> (test money)</span><span>Total time: <b>'+((Date.now()-t0)/1000).toFixed(1)+' s</b></span>'+
    '<button class="btn" id="how">▶ Show how it was done</button></div><div id="show" class="show"></div>';
  out.innerHTML=h; $('how').onclick=()=>{walk();$('how').remove()};
}

// ── 3. Walkthrough: turn the events into steps between 4 actors (0 You, 1 Gemini, 2 Service, 3 Blockchain) ──
function steps(){
  const S=[{from:0,to:1,icon:'💬',c:'c-you',t:'You ask Gemini',d:'“'+esc(prompt)+'”'}];
  for(const e of events){
    if(e.type==='tool_call')S.push({self:1,icon:'🧠',c:'c-agent',t:'Gemini decides to check '+esc(e.name),d:'Its rule: never recommend a package without a safety check first.'});
    if(e.type==='request')S.push({from:1,to:2,icon:'📨',c:'c-svc',t:'① Gemini visits your service',d:'<code>GET '+esc(e.path)+'</code>. No payment attached yet.'});
    if(e.type==='payment_required')S.push({from:2,to:1,icon:'🏷️',c:'c-pay',t:'② “402 Payment Required”',d:'Your service answers with a price tag: '+esc(e.amount)+' '+esc(e.token)+' to wallet '+esc(sh(e.recipient))+' on Tempo.'});
    if(e.type==='sending_payment'){S.push({self:1,icon:'✍️',c:'c-pay',t:'Gemini signs the payment',d:'Its own wallet '+esc(sh(e.wallet))+' signs a '+PRICE+' transfer. The key never leaves the agent.'});
      S.push({from:1,to:2,icon:'💰',c:'c-pay',t:'③ Gemini asks again, with the payment',d:'Same request, now with <code>Authorization: Payment …</code> carrying the signed transfer.'})}
    if(e.type==='paid'){S.push({from:2,to:3,icon:'⛓️',c:'c-chain',t:'④ Payment confirmed on the blockchain',d:'Your service submits the transfer to Tempo. '+(e.tx?'<a target="_blank" rel="noopener" href="'+EXP+'tx/'+esc(e.tx)+'">See transaction '+esc(sh(e.tx))+' ↗</a>':'')});
      S.push({self:2,icon:'🔍',c:'c-svc',t:'Your service runs the check',d:'Registry, malware reports, lookalike names, age, downloads, install scripts, known security holes.'});
      S.push({from:2,to:1,icon:'🧾',c:'c-'+(e.verdict==='SAFE'?'chain':'bad'),t:'⑤ 200 OK + receipt: <span class="v '+esc(e.verdict)+'">'+esc(e.verdict)+'</span>',d:esc(e.summary).slice(0,170)})}
    if(e.type==='check_failed')S.push({from:2,to:1,icon:'✖',c:'c-bad',t:'Check failed',d:esc(e.error)});
    if(e.type==='answer')S.push({from:1,to:0,icon:'🤖',c:'c-agent',t:'Gemini answers you',d:esc(e.text).slice(0,220)});
  }
  return S;
}
let S=[],cur=0,timer=null;
function walk(){
  S=steps();cur=0;
  $('show').innerHTML='<div class="stage"><div class="actors">'+
    [['🧑','You','asks'],['🤖','Gemini agent','wallet '+sh(AGENT)],['🛡️','Package Checker','your service'],['⛓️','Tempo','blockchain']]
      .map((a,i)=>'<div class="actor a'+i+'" id="ac'+i+'"><span class="ic">'+a[0]+'</span><b>'+a[1]+'</b><small>'+esc(a[2])+'</small></div>').join('')+
    '</div><div class="track" id="track"></div><div class="caption" id="cap"></div>'+
    '<div class="ctrl"><button class="btn ghost" id="prev">◀ Back</button><button class="btn" id="play">⏵ Play</button><button class="btn ghost" id="next">Next ▶</button></div>'+
    '<div class="dots" id="dots">'+S.map((_,i)=>'<button class="dot" aria-label="step '+(i+1)+'" data-i="'+i+'"></button>').join('')+'</div></div>';
  $('prev').onclick=()=>{stop();show(cur-1)};$('next').onclick=()=>{stop();show(cur+1)};
  $('play').onclick=()=>timer?stop():play();
  document.querySelectorAll('.dot').forEach(d=>d.onclick=()=>{stop();show(+d.dataset.i)});
  show(0);play();
  $('show').scrollIntoView({behavior:'smooth',block:'start'});
}
const X=i=>(i*25+12.5)+'%';
function show(i){
  if(i<0||i>=S.length)return;cur=i;const s=S[i];
  for(let k=0;k<4;k++)$('ac'+k).classList.toggle('on',s.self===k||s.from===k||s.to===k);
  const tr=$('track');
  if(s.self!==undefined){tr.innerHTML='<span class="self '+s.c+'" style="left:'+X(s.self)+'">'+s.icon+'</span>'}
  else{const a=Math.min(s.from,s.to),b=Math.max(s.from,s.to);
    tr.innerHTML='<span class="wire '+(s.to>s.from?'r':'l')+' '+s.c+'" style="left:calc('+X(a)+' + 6px);width:calc('+((b-a)*25)+'% - 12px)"></span><span class="token" id="tok" style="left:'+X(s.from)+'">'+s.icon+'</span>';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{const t=$('tok');if(t)t.style.left=X(s.to)}))}
  $('cap').innerHTML='<div class="st">Step '+(i+1)+' of '+S.length+'</div><h2>'+s.t+'</h2><p>'+s.d+'</p>';
  $('prev').disabled=i===0;$('next').disabled=i===S.length-1;
  document.querySelectorAll('.dot').forEach((d,k)=>d.classList.toggle('on',k===i));
}
function play(){$('play').textContent='⏸ Pause';if(cur>=S.length-1)show(0);timer=setInterval(()=>{if(cur>=S.length-1)return stop();show(cur+1)},2600)}
function stop(){clearInterval(timer);timer=null;const p=$('play');if(p)p.textContent='⏵ Play'}

$('f').onsubmit=ev=>{ev.preventDefault();run(inp.value)};
document.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{inp.value=b.dataset.p;run(b.dataset.p)});
</script></main></body></html>`
}

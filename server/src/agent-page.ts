// The /agent page: type a request, a Gemini agent handles it and pays this service for every package check.
// Each step is drawn as an arrow between three lanes: Gemini agent · Package Checker · Tempo blockchain.
export function agentPage(price: string, recipient: string, wallet: string | null, available: boolean): string {
  const short = (a: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : 'not set')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gemini Pays Live</title>
<style>
:root{--bg:#0d1117;--card:#161b22;--card2:#1c2330;--line:#30363d;--text:#e6edf3;--muted:#8b949e;--accent:#58a6ff;
--agent:#a371f7;--svc:#58a6ff;--chain:#3fb950;--block:#ff7b72;--caution:#e3b341;--safe:#3fb950;--pay:#e3b341}
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--bg:#f6f8fa;--card:#fff;--card2:#f0f3f6;--line:#d0d7de;--text:#1f2328;--muted:#59636e;--accent:#0969da;
--agent:#8250df;--svc:#0969da;--chain:#1a7f37;--block:#cf222e;--caution:#9a6700;--safe:#1a7f37;--pay:#9a6700}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.45}
main{max-width:1000px;margin:0 auto;padding:24px 16px 60px}
h1{margin:0;font-size:1.55rem}.sub{color:var(--muted);margin:.3em 0 1.2em}a{color:var(--accent)}
code{font-family:ui-monospace,Menlo,monospace;font-size:.86em}
form{display:flex;gap:8px;flex-wrap:wrap}
input{flex:1 1 280px;min-width:0;font:inherit;padding:11px 13px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--text)}
button{font:inherit;font-weight:600;padding:11px 18px;border-radius:10px;border:0;background:var(--agent);color:#fff;cursor:pointer}
button:disabled{opacity:.5;cursor:wait}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 18px}
.chip{font-size:.85rem;padding:5px 10px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--text);cursor:pointer;font-weight:500}
.lanes,.row{display:grid;grid-template-columns:repeat(3,1fr);gap:0 10px}
.lanes{position:sticky;top:0;z-index:2;background:var(--bg);padding:8px 0}
.lane{border-radius:10px;padding:8px 10px;text-align:center;font-weight:700;font-size:.92rem;border:1.5px solid}
.lane small{display:block;font-weight:500;color:var(--muted);font-size:.75rem}
.l1{border-color:var(--agent)}.l2{border-color:var(--svc)}.l3{border-color:var(--chain)}
.flow{position:relative;margin-top:4px}
.flow::before{content:"";position:absolute;inset:0;background:
 linear-gradient(var(--line),var(--line)) calc(100%/6) 0/1px 100% no-repeat,
 linear-gradient(var(--line),var(--line)) 50% 0/1px 100% no-repeat,
 linear-gradient(var(--line),var(--line)) calc(500%/6) 0/1px 100% no-repeat;opacity:.7}
.row{position:relative;margin:10px 0;animation:in .45s ease-out}
@keyframes in{from{opacity:0;transform:translateY(6px)}}
.note{grid-row:1;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:.86rem;position:relative}
.note.c1{grid-column:1;border-left:3px solid var(--agent)}.note.c2{grid-column:2;border-left:3px solid var(--svc)}.note.c3{grid-column:3;border-left:3px solid var(--chain)}
.arrow{grid-row:1;position:relative;padding:0 calc(50% / 3) 0;font-size:.84rem}
.arrow .lbl{display:block;text-align:center;padding:0 6px 5px;word-break:break-word}
.arrow .ln{display:block;height:2px;background:currentColor;position:relative;margin:0 calc(100%/6 * 0)}
.arrow.r .ln::after,.arrow.l .ln::before{content:"";position:absolute;top:-5px;border:6px solid transparent}
.arrow.r .ln::after{right:-2px;border-left:9px solid currentColor;border-right:0}
.arrow.l .ln::before{left:-2px;border-right:9px solid currentColor;border-left:0}
.span12{grid-column:1/3}.span23{grid-column:2/4}
.span12 .ln,.span23 .ln{margin:0 25%}
.span12 .lbl,.span23 .lbl{padding-left:12%;padding-right:12%}
.k-agent{color:var(--agent)}.k-svc{color:var(--svc)}.k-pay{color:var(--pay)}.k-chain{color:var(--chain)}.k-bad{color:var(--block)}
.lbl b{color:var(--text)}
.v{font-weight:800;padding:1px 6px;border-radius:5px;border:1.5px solid currentColor}
.BLOCK{color:var(--block)}.CAUTION{color:var(--caution)}.SAFE{color:var(--safe)}
.box{border-radius:12px;padding:12px 14px;margin:12px 0;border:1px solid var(--line);background:var(--card)}
.you{border-left:4px solid var(--muted)}.final{border-left:4px solid var(--agent);white-space:pre-wrap}
.err{border-left:4px solid var(--block)}
.summary{display:flex;flex-wrap:wrap;gap:8px 18px;color:var(--muted);font-size:.9rem;margin-top:8px}
.summary b{color:var(--text)}
.empty{color:var(--muted);text-align:center;padding:30px;border:1px dashed var(--line);border-radius:12px;margin-top:10px}
@media (max-width:640px){.lane{font-size:.78rem;padding:6px}.lane small{display:none}.note,.arrow{font-size:.75rem}.span12 .ln,.span23 .ln{margin:0 18%}}
</style></head><body><main>
<h1>🤖 Watch an AI agent pay for a safety check</h1>
<p class="sub">Ask for a library. A <b>Gemini</b> coding agent picks packages and, before recommending any, <b>pays ${price}</b> to the Package Checker
over the Machine Payments Protocol (HTTP 402). Every message between the agent, the service and the blockchain appears below as it happens. Tempo testnet: test money.
· <a href="/live">All payments</a></p>
<form id="f"><input id="p" maxlength="400" placeholder="e.g. install lodahs for me" autocomplete="off" ${available ? '' : 'disabled'}>
<button id="go" ${available ? '' : 'disabled'}>Ask the agent</button></form>
<div class="chips">
<button class="chip" data-p="Install lodahs for me, I need it for array helpers">🛑 install lodahs</button>
<button class="chip" data-p="I want to download Hugging Face models from my Python terminal. Install huggingface-cli.">👻 pip install huggingface-cli</button>
<button class="chip" data-p="Set up a small Node web server: I need express and dotenv.">✅ express + dotenv</button>
<button class="chip" data-p="pip install reqeusts please">🔤 pip install reqeusts</button>
</div>
${available ? '' : '<div class="box err">The Gemini agent is not configured on this server (GEMINI_API_KEY or agent wallet missing).</div>'}
<div class="lanes"><div class="lane l1">🤖 Gemini agent<small>wallet ${short(wallet)}</small></div>
<div class="lane l2">🛡️ Package Checker<small>your service · gets paid</small></div>
<div class="lane l3">⛓️ Tempo blockchain<small>testnet · shop ${short(recipient)}</small></div></div>
<div id="out"><div class="empty">Pick an example or type a request. The conversation between the agent and your service will be drawn here.</div></div>
<script>
const EXP='https://explore.testnet.tempo.xyz/';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sh=a=>a?String(a).slice(0,6)+'…'+String(a).slice(-4):'';
const out=document.getElementById('out'),go=document.getElementById('go'),inp=document.getElementById('p');
let flow,queue=[],busy=false,stats;
function add(html){const d=document.createElement('div');d.innerHTML=html;const el=d.firstElementChild;flow.appendChild(el);el.scrollIntoView({block:'nearest',behavior:'smooth'})}
const note=(col,cls,html)=>'<div class="row"><div class="note c'+col+'"><span class="'+cls+'">'+html+'</span></div></div>';
// from/to are lane numbers 1..3; span covers the lanes between them
function arrow(from,to,cls,html){const a=Math.min(from,to),b=Math.max(from,to);
  const span=(a===1&&b===2)?'span12':(a===2&&b===3)?'span23':'';const st=span?'':'grid-column:1/4';
  return '<div class="row"><div class="arrow '+(to>from?'r':'l')+' '+span+' '+cls+'" style="'+st+'"><span class="lbl">'+html+'</span><span class="ln"></span></div></div>'}
function render(e){
  switch(e.type){
    case 'start':add(note(1,'k-agent','Gemini <code>'+esc(e.model)+'</code> got your request and starts working'));break;
    case 'thinking':if(e.turn>1)add(note(1,'k-agent','🧠 reads the verdict and decides what to do next'));else add(note(1,'k-agent','🧠 thinking: which packages does this need?'));break;
    case 'tool_call':stats.checks++;add(note(1,'k-agent','🔎 decides to check <b>'+esc(e.ecosystem)+'/'+esc(e.name)+'</b> before installing it'));break;
    case 'request':add(arrow(1,2,'k-svc','① visits <code>'+esc(e.path)+'</code> (no payment yet)'));break;
    case 'payment_required':add(arrow(2,1,'k-pay','② <b>402 Payment Required</b>: pay '+esc(e.amount)+' '+esc(e.token)+' to '+esc(sh(e.recipient))));break;
    case 'sending_payment':add(note(1,'k-pay','✍️ signs a '+'${price}'+' transfer with its own wallet '+esc(sh(e.wallet))+' (the key never leaves the agent)'));
      add(arrow(1,2,'k-pay','③ asks again with <code>Authorization: Payment</code> (the signed transfer)'));break;
    case 'paid':stats.spent+=Number('${price}');
      add(arrow(2,3,'k-chain','④ submits the payment → confirmed'+(e.tx?' · <a target="_blank" rel="noopener" href="'+EXP+'tx/'+esc(e.tx)+'">tx '+esc(sh(e.tx))+' ↗</a>':'')));
      add(note(2,'k-svc','💰 paid → checks registry, malware reports, lookalike names, age, downloads'));
      add(arrow(2,1,'k-svc','⑤ <b>200 OK</b> + receipt · <span class="v '+esc(e.verdict)+'">'+esc(e.verdict)+'</span> '+esc(e.summary).slice(0,160)));
      stats.verdicts.push(e.verdict);break;
    case 'check_failed':add(arrow(2,1,'k-bad','✖ check failed: '+esc(e.error)));break;
    case 'answer':out.insertAdjacentHTML('beforeend','<div class="box final"><b>🤖 Gemini\\'s answer to you</b>\\n'+esc(e.text)+'</div>');break;
    case 'error':out.insertAdjacentHTML('beforeend','<div class="box err">⚠️ '+esc(e.message)+'</div>');break;
    case 'done':out.insertAdjacentHTML('beforeend','<div class="summary"><span>Paid checks: <b>'+e.checks+'</b></span><span>Agent spent: <b>'+e.spent+'</b> (test money)</span><span>Time: <b>'+((Date.now()-stats.t0)/1000).toFixed(1)+' s</b></span><a href="/live">See it in all payments →</a></div>');
      go.disabled=false;inp.disabled=false;break;
  }
}
// Show events one by one with a short pause, so people can follow the conversation.
function pump(){if(busy||!queue.length)return;busy=true;render(queue.shift());setTimeout(()=>{busy=false;pump()},420)}
function run(prompt){
  if(!prompt.trim())return;
  go.disabled=true;inp.disabled=true;queue=[];stats={checks:0,spent:0,verdicts:[],t0:Date.now()};
  out.innerHTML='<div class="box you"><b>🧑 You</b> → Gemini: '+esc(prompt)+'</div><div class="flow" id="flow"></div>';
  flow=document.getElementById('flow');
  stream(prompt).catch(err=>{queue.push({type:'error',message:err.message||'Connection lost.'});queue.push({type:'done',checks:stats.checks,spent:stats.spent.toFixed(2)});pump()});
}
// Reads the server-sent events from a normal fetch, so error answers (e.g. 429) can be shown too.
async function stream(prompt){
  const r=await fetch('/api/agent?prompt='+encodeURIComponent(prompt),{cache:'no-store'});
  if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error||('HTTP '+r.status))}
  const rd=r.body.getReader(),dec=new TextDecoder();let buf='',done=false;
  while(true){const {value,done:end}=await rd.read();if(end)break;buf+=dec.decode(value,{stream:true});
    let i;while((i=buf.indexOf('\\n\\n'))>=0){const chunk=buf.slice(0,i);buf=buf.slice(i+2);
      const data=chunk.split('\\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trim()).join('');
      if(data){const e=JSON.parse(data);if(e.type==='done')done=true;queue.push(e);pump()}}}
  if(!done)throw new Error('The connection closed before the agent finished.');
}
document.getElementById('f').onsubmit=ev=>{ev.preventDefault();run(inp.value)};
document.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{inp.value=b.dataset.p;run(b.dataset.p)});
</script></main></body></html>`
}

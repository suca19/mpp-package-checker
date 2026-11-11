// The /live page: watch agents pay for checks in real time. Polls /payments.json every 2 s.
export function livePage(base: string, recipient: string, price: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Live Agent Payments</title>
<style>
:root{--bg:#0d1117;--card:#161b22;--line:#30363d;--text:#e6edf3;--muted:#8b949e;--accent:#58a6ff;--block:#ff7b72;--caution:#e3b341;--safe:#3fb950}
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--bg:#f6f8fa;--card:#fff;--line:#d0d7de;--text:#1f2328;--muted:#59636e;--accent:#0969da;--block:#cf222e;--caution:#9a6700;--safe:#1a7f37}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.45}
main{max-width:980px;margin:0 auto;padding:28px 16px 60px}
h1{margin:0;font-size:1.6rem}.sub{color:var(--muted);margin:.3em 0 1.4em}
a{color:var(--accent)}code{font-family:ui-monospace,Menlo,monospace;font-size:.88em}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.stat b{display:block;font-size:1.7rem;font-variant-numeric:tabular-nums}.stat span{color:var(--muted);font-size:.85rem}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--safe);margin-right:6px;animation:pulse 2s infinite}
@keyframes pulse{50%{opacity:.3}}
.list{display:flex;flex-direction:column;gap:8px}
.row{display:grid;grid-template-columns:82px 1fr auto;gap:4px 14px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.row.new{animation:flash 2.4s ease-out}@keyframes flash{0%{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 35%,transparent)}100%{}}
.badge{font-weight:700;font-size:.8rem;text-align:center;padding:4px 0;border-radius:6px;border:1.5px solid currentColor}
.BLOCK{color:var(--block)}.CAUTION{color:var(--caution)}.SAFE{color:var(--safe)}
.pkg{font-weight:600;word-break:break-all}.meta{color:var(--muted);font-size:.85rem;grid-column:2/4}
.amt{font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}
.empty{color:var(--muted);text-align:center;padding:40px;border:1px dashed var(--line);border-radius:12px}
pre{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;white-space:pre-wrap;word-break:break-all;font-size:.85rem}
@media (max-width:560px){.row{grid-template-columns:70px 1fr}.amt{grid-column:2}.meta{grid-column:1/3}}
</style></head><body><main>
<h1>🛡️ Live agent payments</h1>
<p class="sub"><span class="dot"></span>Every row is an AI agent that paid <b>${price}</b> over the Machine Payments Protocol to check a package before installing it. Tempo testnet: test money.</p>
<div class="stats">
  <div class="stat"><b id="count">0</b><span>paid checks since the server started</span></div>
  <div class="stat"><b id="earned">0.00</b><span>earned (test stablecoins)</span></div>
  <div class="stat"><b id="blocked">0</b><span>dangerous installs blocked</span></div>
  <div class="stat"><span>Shop wallet (receives payments)</span><br><a href="https://explore.testnet.tempo.xyz/address/${recipient}" target="_blank" rel="noopener"><code>${recipient.slice(0, 8)}…${recipient.slice(-6)}</code></a></div>
</div>
<div class="list" id="list"><div class="empty">Waiting for the first paying agent…</div></div>
<h2 style="font-size:1.05rem;margin-top:28px">Be the agent</h2>
<pre>npx mppx "${base}/check?ecosystem=npm&name=lodahs" --network testnet</pre>
<script>
const EXP='https://explore.testnet.tempo.xyz/';
const short=a=>a?a.slice(0,8)+'…'+a.slice(-4):'unknown';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let seen=null;
async function tick(){
  try{
    const d=await (await fetch('/payments.json',{cache:'no-store'})).json();
    document.getElementById('count').textContent=d.total_paid_checks;
    document.getElementById('earned').textContent=d.total_earned;
    document.getElementById('blocked').textContent=d.payments.filter(p=>p.verdict==='BLOCK').length;
    const list=document.getElementById('list');
    if(!d.payments.length) return;
    const first=seen===null;
    const ids=new Set((seen??[]));
    list.innerHTML=d.payments.map(p=>{
      const id=p.tx||p.time; const isNew=!first&&!ids.has(id);
      const t=new Date(p.time).toLocaleTimeString();
      return '<div class="row'+(isNew?' new':'')+'"><div class="badge '+esc(p.verdict)+'">'+esc(p.verdict)+'</div>'+
        '<div class="pkg">'+esc(p.package)+'</div><div class="amt">'+esc(p.amount)+' '+esc(p.token)+'</div>'+
        '<div class="meta">'+t+' · paid by agent wallet '+(p.payer?'<a target="_blank" rel="noopener" href="'+EXP+'address/'+esc(p.payer)+'"><code>'+esc(short(p.payer))+'</code></a>':'unknown')+
        (p.tx?' · <a target="_blank" rel="noopener" href="'+EXP+'tx/'+esc(p.tx)+'">see payment on the blockchain ↗</a>':'')+'</div></div>';
    }).join('');
    seen=d.payments.map(p=>p.tx||p.time);
  }catch(e){}
}
tick();setInterval(tick,2000);
</script></main></body></html>`
}

// UI helpers: toast, loader, fetch wrapper
function showToast(msg, type = 'info', timeout = 3000){
  let root = document.getElementById('app-toasts');
  if (!root){ root = document.createElement('div'); root.id = 'app-toasts'; root.style.position='fixed'; root.style.right='20px'; root.style.bottom='20px'; root.style.zIndex=9999; document.body.appendChild(root);} 
  const t = document.createElement('div');
  t.className = 'toast '+type;
  t.innerText = msg;
  t.style.marginTop = '8px';
  t.style.padding = '10px 14px';
  t.style.background = (type==='error')? 'rgba(239,68,68,0.12)' : (type==='success')? 'rgba(34,197,94,0.12)' : 'rgba(15,23,42,0.06)';
  t.style.border = '1px solid rgba(15,23,42,0.06)';
  t.style.borderRadius = '10px';
  root.appendChild(t);
  setTimeout(()=>{ t.style.transition='opacity .3s'; t.style.opacity=0; setTimeout(()=>t.remove(),350); }, timeout);
}

async function fetchJSON(url, opts={}){
  const headers = opts.headers || {};
  if (!headers['Content-Type'] && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = 'Bearer '+token;
  try{
    const res = await fetch(url, {...opts, headers});
    const text = await res.text();
    try{ return JSON.parse(text);}catch(e){ return text; }
  }catch(err){ throw err; }
}

function formatDate(d){ if (!d) return ''; return new Date(d).toLocaleString(); }

window.showToast = showToast;
window.fetchJSON = fetchJSON;
window.formatDate = formatDate;

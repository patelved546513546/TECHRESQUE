const API_A = 'http://localhost:5000/api';
const adminToken = localStorage.getItem('token');
const meAdmin = JSON.parse(localStorage.getItem('user') || 'null');

// Redirect if not logged in
if (!adminToken || !meAdmin) location.href='auth.html';

// Redirect if wrong role
if (meAdmin?.role !== 'admin') location.href='auth.html';

// Helper to handle 401 responses centrally
async function safeFetch(url, opts = {}){
  const headers = opts.headers || {};
  if (!headers['Content-Type'] && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = 'Bearer '+token;
  const res = await fetch(url, {...opts, headers});
  if (res.status === 401){
    // Clear and redirect to login
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    location.href = 'auth.html';
    throw new Error('Not authenticated');
  }
  const text = await res.text();
  try{ return JSON.parse(text); } catch(e){ return text; }
}

// Verify token is still valid on page load
async function verifyAuth() {
  try {
    const res = await fetch(`${API_A}/admin/users`, { headers:{'Authorization':'Bearer '+adminToken} });
    if (res.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      location.href='auth.html';
      return false;
    }
    return true;
  } catch (err) {
    console.error('Auth verification failed:', err);
    return true; // Allow page to load even if network error
  }
}

document.getElementById('welcome-name').innerText = `${meAdmin?.name || 'Admin'}`;
document.getElementById('logout-btn').addEventListener('click', ()=>{ localStorage.removeItem('token'); localStorage.removeItem('user'); location.href='auth.html'; });

async function loadUsers(){
  const users = await safeFetch(`${API_A}/admin/users`);
  document.getElementById('stat-users').innerText = users.length;
  const ul = document.getElementById('users'); 
  ul.innerHTML='';
  users.forEach(u => { 
    const tr = document.createElement('tr'); 
    tr.innerHTML = `
      <td style="padding:16px;border-bottom:1px solid #e8e8e8">${u.name}</td>
      <td style="padding:16px;border-bottom:1px solid #e8e8e8">${u.email}</td>
      <td style="padding:16px;border-bottom:1px solid #e8e8e8">
        <span class="badge" style="background:${u.role === 'admin' ? 'rgba(234,67,53,0.1)' : u.role === 'provider' ? 'rgba(52,168,83,0.1)' : 'rgba(26,115,232,0.1)'};color:${u.role === 'admin' ? '#ea4335' : u.role === 'provider' ? '#34a853' : '#1a73e8'};border:none">${u.role}</span>
      </td>
      <td style="padding:16px;border-bottom:1px solid #e8e8e8"><span style="background:#e8f5e9;color:#34a853;padding:4px 8px;border-radius:4px;font-size:12px;font-weight:600">Active</span></td>
    `; 
    ul.appendChild(tr); 
  });
}

async function loadServices(){
  const ss = await safeFetch(`${API_A}/admin/services`);
  document.getElementById('stat-services').innerText = ss.length;
  const ul = document.getElementById('all-services'); 
  ul.innerHTML='';
  ss.forEach(s=>{ 
    const tr=document.createElement('tr'); 
    tr.innerHTML=`
      <td style="padding:16px;border-bottom:1px solid #e8e8e8"><strong>${s.serviceType}</strong></td>
      <td style="padding:16px;border-bottom:1px solid #e8e8e8">${s.customer?.name || 'Unknown'}</td>
      <td style="padding:16px;border-bottom:1px solid #e8e8e8"><span class="badge ${s.status}">${s.status}</span></td>
      <td style="padding:16px;border-bottom:1px solid #e8e8e8">
        <button data-id="${s._id}" style="padding:6px 12px;font-size:12px;background:#1a73e8;color:#fff;border:none;border-radius:4px;cursor:pointer">
          ${s.status === 'assigned' || s.status === 'in_progress' ? 'Update' : 'Assign'}
        </button>
      </td>
    `; 
    ul.appendChild(tr); 
  });
}

document.addEventListener('click', async (e)=>{
  if (e.target.tagName === 'BUTTON' && e.target.dataset.id){
    const serviceId = e.target.dataset.id;
    const providerId = prompt('Enter Provider User ID to assign:');
    if (!providerId) return;
    try{
      const json = await safeFetch(`${API_A}/admin/assign`, { method:'POST', body:JSON.stringify({serviceId, providerId})});
      if (json._id) { showToast('Provider assigned to service!', 'success'); loadServices(); } 
      else showToast(json.message || 'Error assigning provider', 'error');
    }catch(err){ /* safeFetch handles redirect */ }
  }
});

async function loadProvidersCount(){
  const list = await safeFetch(`${API_A}/providers`);
  document.getElementById('stat-providers').innerText = list.length;
}

// Verify auth and load data on page load
verifyAuth().then(() => {
  loadUsers(); loadServices(); loadProvidersCount();
  setInterval(()=>{ loadUsers(); loadServices(); loadProvidersCount(); }, 10000);
});
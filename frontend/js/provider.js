const provToken = localStorage.getItem('token');
const meProv = JSON.parse(localStorage.getItem('user') || 'null');

// Redirect if not logged in
if (!provToken || !meProv) location.href='auth.html';

// Redirect if wrong role
if (meProv?.role !== 'provider') location.href='auth.html';

const API_P = 'http://localhost:5000/api';

// Verify token is still valid on page load
async function verifyAuth() {
  try {
    const res = await fetch(`${API_P}/services/assigned`, { headers:{'Authorization':'Bearer '+provToken} });
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

document.getElementById('welcome-name').innerText = `${meProv?.name || 'Provider'}`;
document.getElementById('logout-btn').addEventListener('click', ()=>{ localStorage.removeItem('token'); localStorage.removeItem('user'); location.href='auth.html'; });

document.getElementById('availability').addEventListener('change', async (e)=>{
  const available = e.target.checked;
  const icon = document.getElementById('availability-icon');
  icon.style.color = available ? '#34a853' : '#e8e8e8';
  
  await fetch(`${API_P}/providers/availability`, { 
    method:'PATCH', 
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+provToken}, 
    body:JSON.stringify({available}) 
  });
  
  showToast(available ? '✓ You are now available for new jobs!' : '✗ You are offline', available ? 'success' : 'info');
  
  // Refresh jobs immediately
  setTimeout(() => loadAssigned(), 500);
});

// Service type selector
document.getElementById('service-type-selector').addEventListener('change', async (e)=>{
  const serviceType = e.target.value;
  if (!serviceType) return;
  
  try {
    const res = await fetch(`${API_P}/providers/profile`, { 
      method:'POST', 
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+provToken}, 
      body:JSON.stringify({serviceType}) 
    });
    const data = await res.json();
    
    // Store in localStorage for quick access
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    user.serviceType = serviceType;
    localStorage.setItem('user', JSON.stringify(user));
    
    showToast(`✓ Your specialty updated to ${serviceType}!`, 'success');
    
    // Refresh pending requests with new service type
    setTimeout(() => loadPendingRequests(), 500);
  } catch (err) { 
    showToast('Could not update specialty', 'error');
    e.target.value = '';
  }
});

// Event delegation for pending job accept buttons
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('accept-pending-btn')) {
    const jobId = e.target.dataset.id;
    acceptPendingJob(jobId);
  }
});

let previousCount = 0;

async function loadAssigned(){
  const res = await fetch(`${API_P}/services/assigned`, { headers:{'Authorization':'Bearer '+provToken} });
  const list = await res.json();
  const container = document.getElementById('assigned'); 
  const emptyState = document.getElementById('empty-jobs');
  container.innerHTML='';
  
  // Notify if new jobs arrived
  if (list.length > previousCount) {
    const newCount = list.length - previousCount;
    showToast(`🎉 You have ${newCount} new job${newCount > 1 ? 's' : ''}!`, 'success');
  }
  previousCount = list.length;
  
  if (list.length === 0) {
    emptyState.style.display = 'block';
    document.getElementById('stat-active').innerText = 0;
    document.getElementById('stat-completed').innerText = 0;
  } else {
    emptyState.style.display = 'none';
    document.getElementById('stat-active').innerText = list.filter(s => s.status !== 'completed' && s.status !== 'cancelled').length;
    document.getElementById('stat-completed').innerText = list.filter(s => s.status === 'completed').length;
    
    list.forEach(s => {
      const card = document.createElement('div'); 
      card.className='card';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.justifyContent = 'space-between';
      card.style.borderLeft = '4px solid ' + (s.status === 'assigned' ? '#1a73e8' : s.status === 'in_progress' ? '#fbbc04' : '#34a853');

      let statusIcon = '📋';
      if (s.status === 'in_progress') statusIcon = '⏳';
      if (s.status === 'completed') statusIcon = '✓';

      const header = document.createElement('div');
      header.innerHTML = `
        <h3 style="margin:0 0 8px 0">${statusIcon} ${s.serviceType}</h3>
        <p style="margin:0 0 4px 0;color:#666;font-size:14px">Customer: <strong>${s.customer?.name || 'Unknown'}</strong></p>
        <p style="margin:0 0 4px 0;color:#666;font-size:13px">📞 ${s.customer?.phone || 'Not provided'}</p>
        <p style="margin:0 0 12px 0;color:#555;font-size:13px;line-height:1.4">${s.description.substring(0, 60)}${s.description.length > 60 ? '...' : ''}</p>
        <span class="badge ${s.status}">${s.status.toUpperCase().replace('_', ' ')}</span>
      `;
      
      const actions = document.createElement('div'); 
      actions.style.marginTop='16px';
      actions.style.display = 'flex';
      actions.style.gap = '8px';
      
      if (s.status === 'assigned') {
          // If provider hasn't accepted yet, show Accept/Decline
          if (!s.providerAccepted) {
            const btnAccept = document.createElement('button');
            btnAccept.textContent = '✅ Accept';
            btnAccept.style.flex = '1';
            btnAccept.style.background = '#34a853';
            btnAccept.style.color = '#fff';
            btnAccept.style.fontWeight = '700';
            btnAccept.onclick = ()=> acceptJob(s._id);

            const btnDecline = document.createElement('button');
            btnDecline.textContent = '❌ Decline';
            btnDecline.style.flex = '1';
            btnDecline.style.background = '#ef4444';
            btnDecline.style.color = '#fff';
            btnDecline.style.fontWeight = '700';
            btnDecline.onclick = ()=> declineJob(s._id);

            actions.appendChild(btnAccept);
            actions.appendChild(btnDecline);
          } else {
            const btnStart = document.createElement('button'); 
            btnStart.textContent='📍 Start Job'; 
            btnStart.style.flex = '1';
            btnStart.style.background = '#fbbc04';
            btnStart.style.color = '#333';
            btnStart.style.fontWeight = '600';
            btnStart.onclick = ()=> updateStatus(s._id,'in_progress');
            actions.appendChild(btnStart);
          }
          // Show estimated earning
          const earn = document.createElement('div');
          earn.style.marginLeft = '8px';
          earn.style.fontWeight = '700';
          earn.style.color = '#0f172a';
          earn.innerText = `Estimated: ₹${s.providerEarning || 0}`;
          actions.appendChild(earn);
        } else if (s.status === 'in_progress') {
        const btnComplete = document.createElement('button'); 
        btnComplete.textContent='✓ Mark Complete'; 
        btnComplete.style.flex = '1';
        btnComplete.style.background = '#34a853';
        btnComplete.style.color = '#fff';
        btnComplete.style.fontWeight = '600';
        btnComplete.onclick = ()=> updateStatus(s._id,'completed');
        actions.appendChild(btnComplete);
      } else if (s.status === 'completed') {
        const btnCompleted = document.createElement('button'); 
        btnCompleted.textContent='✓ Completed'; 
        btnCompleted.style.flex = '1';
        btnCompleted.style.background = '#34a853';
        btnCompleted.style.color = '#fff';
        btnCompleted.disabled = true;
        btnCompleted.style.opacity = '0.6';
        btnCompleted.style.cursor = 'default';
        actions.appendChild(btnCompleted);
      }
      
      card.appendChild(header); 
      if (actions.children.length > 0) card.appendChild(actions);
      container.appendChild(card);
    });
  }
}

async function updateStatus(id, status){
  const statusText = status === 'in_progress' ? 'started' : 'completed';
  await fetch(`${API_P}/services/${id}/status`, { 
    method:'PATCH', 
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+provToken}, 
    body:JSON.stringify({status}) 
  });
  showToast(`Job ${statusText === 'started' ? 'started ⏳' : 'completed ✓'}!`, 'success');
  loadAssigned();
}

async function acceptJob(id){
  try{
    const res = await fetch(`${API_P}/services/${id}/accept`, { method:'PATCH', headers:{'Content-Type':'application/json','Authorization':'Bearer '+provToken} });
    const json = await res.json();
    if (json.service) showToast('Job accepted — you are on your way!', 'success');
    else showToast(json.message || 'Accepted', 'success');
  }catch(err){ showToast('Could not accept job', 'error'); }
  loadAssigned();
}

async function declineJob(id){
  try{
    const res = await fetch(`${API_P}/services/${id}/decline`, { method:'PATCH', headers:{'Content-Type':'application/json','Authorization':'Bearer '+provToken} });
    const json = await res.json();
    showToast(json.message || 'You declined the job', 'info');
  }catch(err){ showToast('Could not decline job', 'error'); }
  loadAssigned();
}

// Load pending requests for provider's service type
async function loadPendingRequests(){
  try{
    const res = await fetch(`${API_P}/services/pending/list`, { headers:{'Authorization':'Bearer '+provToken} });
    const pending = await res.json();
    const container = document.getElementById('pending-container');
    const emptyState = document.getElementById('empty-pending');
    const countBadge = document.getElementById('pending-count');
    
    container.innerHTML = '';
    
    // Update count badge
    if (countBadge) countBadge.innerText = pending && pending.length > 0 ? pending.length : '0';
    
    if (!pending || pending.length === 0) {
      emptyState.style.display = 'block';
    } else {
      emptyState.style.display = 'none';
      pending.forEach((s, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.borderLeft = '4px solid #f59e0b';
        card.style.animationName = 'slideInUp';
        card.style.animationDuration = '0.6s';
        card.style.animationDelay = (index * 0.1) + 's';
        card.style.animationFillMode = 'both';
        card.style.animationTimingFunction = 'cubic-bezier(0.4, 0, 0.2, 1)';
        
        // Calculate time remaining
        const expiresAt = new Date(s.expiresAt);
        const now = new Date();
        const hoursLeft = Math.round((expiresAt - now) / (1000 * 60 * 60));
        const daysLeft = Math.floor(hoursLeft / 24);
        let timeText = '';
        if (daysLeft > 0) {
          timeText = `${daysLeft}d ${hoursLeft % 24}h left`;
        } else {
          timeText = `${hoursLeft}h left`;
        }
        
        const distInfo = s.distanceKm ? `📍 ${s.distanceKm}km away` : '📍 Location available';
        
        card.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">
            <h3 style="margin:0;color:#111827;font-size:16px;font-weight:700">🔔 ${s.serviceType}</h3>
            <div style="display:flex;gap:8px">
              <span style="background:#fef3c7;color:#ca8a04;padding:4px 10px;border-radius:20px;font-weight:600;font-size:12px">NEW</span>
              <span style="background:#dbeafe;color:#0369a1;padding:4px 10px;border-radius:20px;font-weight:600;font-size:11px">⏱️ ${timeText}</span>
            </div>
          </div>
          
          <div style="background:#f0f9ff;padding:12px;border-radius:8px;margin-bottom:12px;border-left:3px solid #3b82f6">
            <p style="margin:0 0 6px 0;color:#0369a1;font-weight:600;font-size:14px">👤 ${s.customer?.name || 'Unknown Customer'}</p>
            <p style="margin:0 0 4px 0;color:#0c4a6e;font-size:13px">☎️ ${s.customer?.phone || 'Not provided'}</p>
            <p style="margin:0;color:#0c4a6e;font-size:13px">${distInfo}</p>
          </div>
          
          <p style="margin:0 0 12px 0;color:#555;font-size:13px;line-height:1.5">📝 ${s.description.substring(0, 80)}${s.description.length > 80 ? '...' : ''}</p>
          
          <div style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);padding:12px;border-radius:8px;margin-bottom:12px">
            <p style="margin:0;color:#fff;font-weight:600;font-size:15px">💰 Estimated: <span style="font-size:18px">₹${Math.round(s.finalPrice || s.basePrice)}</span></p>
            <p style="margin:6px 0 0 0;color:rgba(255,255,255,0.9);font-size:12px">You earn: ₹${Math.round((s.finalPrice || s.basePrice) * 0.7)}</p>
          </div>
          
          <button class="accept-pending-btn" data-id="${s._id}" style="width:100%;padding:12px;background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:14px;transition:all 0.3s ease;position:relative;overflow:hidden">
            ✅ Accept This Job
          </button>
        `;
        container.appendChild(card);
      });
    }
  }catch(err){
    console.error('Error loading pending requests:', err);
    const emptyState = document.getElementById('empty-pending');
    if (emptyState) emptyState.style.display = 'block';
  }
}

// Load earnings breakdown
async function loadEarnings(){
  try{
    const res = await fetch(`${API_P}/provider/earnings`, { headers:{'Authorization':'Bearer '+provToken} });
    const earnings = await res.json();
    
    document.getElementById('earnings-today').innerText = `₹${earnings.today}`;
    document.getElementById('earnings-week').innerText = `₹${earnings.week}`;
    document.getElementById('earnings-month').innerText = `₹${earnings.month}`;
    document.getElementById('earnings').innerText = `₹${earnings.total}`;
    
    // Update total earnings badge
    const totalBadge = document.getElementById('total-earnings');
    if (totalBadge) totalBadge.innerText = `₹${earnings.total}`;
  }catch(err){
    console.error('Error loading earnings:', err);
  }
}

// Accept pending request - will assign to current provider
async function acceptPendingJob(id){
  try{
    const res = await fetch(`${API_P}/services/${id}/accept`, { 
      method:'PATCH', 
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+provToken} 
    });
    const json = await res.json();
    showToast('🎉 Job accepted! Check your assigned jobs section.', 'success');
    
    // Refresh both sections
    localStorage.setItem('refreshJobs', 'true');
    setTimeout(() => {
      loadPendingRequests();
      loadAssigned();
    }, 300);
  }catch(err){ 
    console.error('Accept job error:', err);
    showToast('Could not accept job', 'error'); 
  }
}

// Load current provider profile from localStorage
async function loadProviderProfile(){
  try{
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.serviceType) {
      document.getElementById('service-type-selector').value = user.serviceType;
    }
  }catch(err){
    console.error('Error loading provider profile:', err);
  }
}

// Verify auth and load data on page load
verifyAuth().then(() => {
  console.log('✓ Provider dashboard loaded');
  loadProviderProfile();
  loadAssigned();
  loadPendingRequests();
  loadEarnings();
  
  // Refresh every 5 seconds
  setInterval(() => {
    loadAssigned();
    loadPendingRequests();
    loadEarnings();
  }, 5000);
});
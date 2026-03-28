const API_A = 'http://localhost:5000/api';
const adminToken = localStorage.getItem('token');
const meAdmin = JSON.parse(localStorage.getItem('user') || 'null');
const inrFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

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
  let payload;
  try { payload = JSON.parse(text); } catch (e) { payload = text; }

  if (!res.ok) {
    const message = payload?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return payload;
}

function normalizeServiceType(value) {
  return (value || '').trim().toLowerCase();
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
  try {
    const users = await safeFetch(`${API_A}/admin/users`);
    document.getElementById('stat-users').innerText = users.length;
    const ul = document.getElementById('users'); 
    ul.innerHTML='';
    users.forEach(u => { 
      const tr = document.createElement('tr'); 
      let roleDisplay = u.role;
      if (u.role === 'provider') {
        const p = (allProviders || []).find(prov => {
          const userId = prov.user?._id || prov.user;
          return userId === u._id;
        });
        if (p) roleDisplay += ` (${p.serviceType})`;
      }
      tr.innerHTML = `
        <td style="padding:16px;border-bottom:1px solid #e8e8e8">${u.name}</td>
        <td style="padding:16px;border-bottom:1px solid #e8e8e8">${u.email}</td>
        <td style="padding:16px;border-bottom:1px solid #e8e8e8">
          <span class="badge" style="background:${u.role === 'admin' ? 'rgba(234,67,53,0.1)' : u.role === 'provider' ? 'rgba(52,168,83,0.1)' : 'rgba(26,115,232,0.1)'};color:${u.role === 'admin' ? '#ea4335' : u.role === 'provider' ? '#34a853' : '#1a73e8'};border:none">${roleDisplay}</span>
        </td>
        <td style="padding:16px;border-bottom:1px solid #e8e8e8"><span style="background:#e8f5e9;color:#34a853;padding:4px 8px;border-radius:4px;font-size:12px;font-weight:600">Active</span></td>
      `; 
      ul.appendChild(tr); 
    });
  } catch (err) {
    console.error('loadUsers failed:', err);
  }
}

async function loadServices(){
  try {
    const ss = await safeFetch(`${API_A}/admin/services`);
    const ps = await safeFetch(`${API_A}/admin/providers`); // Fetch providers once
    allProviders = Array.isArray(ps) ? ps : [];
    
    document.getElementById('stat-services').innerText = ss.length;
    const ul = document.getElementById('all-services'); 
    ul.innerHTML='';
    ss.forEach(s=>{ 
      const tr=document.createElement('tr'); 
      const shouldShowButton = (s.status === 'requested' || s.status === 'pending');
      tr.innerHTML=`
        <td style="padding:12px 14px;border-bottom:1px solid #e8e8e8;font-weight:500">${s.serviceType}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #e8e8e8;font-size:12px;color:#666">${s.issueType || 'General'}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #e8e8e8">${s.customer?.name || 'Unknown'}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #e8e8e8"><span class="badge ${s.status}">${s.status}</span></td>
        <td style="padding:12px 14px;border-bottom:1px solid #e8e8e8">
          ${shouldShowButton ? `<button data-service-id="${s._id}" class="assign-service-btn" style="padding:6px 12px;font-size:12px;background:#1a73e8;color:#fff;border:none;border-radius:4px;cursor:pointer">Assign</button>` : '<span style="color:#999;font-size:12px">-</span>'}
        </td>
      `; 
      ul.appendChild(tr); 
    });
  } catch (err) {
    console.error('loadServices failed:', err);
  }
}

let demandChartInstance = null;
let revenueChartInstance = null;
let trendChartInstance = null;

function renderDemandChart(rows) {
  if (!rows.length) return;

  const ctx = document.getElementById('demandChart')?.getContext('2d');
  if (!ctx) return;

  if (demandChartInstance) demandChartInstance.destroy();

  const labels = rows.map((r) => r.serviceType);
  const data = rows.map((r) => r.bookings);
  const colors = [
    '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
    '#8b5cf6', '#f97316', '#14b8a6', '#06b6d4', '#84cc16'
  ];

  demandChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, data.length),
        borderColor: '#fff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 12 }, padding: 12 }
        }
      }
    }
  });
}

function renderRevenueChart(rows) {
  if (!rows.length) return;

  const ctx = document.getElementById('revenueChart')?.getContext('2d');
  if (!ctx) return;

  if (revenueChartInstance) revenueChartInstance.destroy();

  const labels = rows.map((r) => r.serviceType);
  const completed = rows.map((r) => r.completed);
  
  revenueChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Services Completed',
        data: completed,
        backgroundColor: '#10b981',
        borderColor: '#059669',
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true }
      },
      scales: {
        x: { beginAtZero: true }
      }
    }
  });
}

function renderTrendChart(trend) {
  if (!trend.length) return;

  const ctx = document.getElementById('trendChart')?.getContext('2d');
  if (!ctx) return;

  if (trendChartInstance) trendChartInstance.destroy();

  const dates = trend.map((t) => t.date);
  const bookings = trend.map((t) => t.bookings);
  const completed = trend.map((t) => t.completed);

  trendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'Bookings',
          data: bookings,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#6366f1'
        },
        {
          label: 'Completed',
          data: completed,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#10b981'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { size: 12 }, padding: 12 }
        }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

async function loadAnalytics(){
  try {
    const analytics = await safeFetch(`${API_A}/admin/analytics`);
    if (!analytics || analytics.message === 'Failed to load analytics') {
      console.error('Analytics load failure');
      return;
    }

    const earnings = analytics.earnings || {};
    const activity = analytics.activity || {};

    document.getElementById('stat-today-earnings').innerText = inrFormatter.format(earnings.today || 0);
    document.getElementById('stat-total-earnings').innerText = inrFormatter.format(earnings.total || 0);
    document.getElementById('stat-active-pros').innerText = activity.activeProfessionals || 0;
    document.getElementById('stat-customers-used').innerText = activity.customersUsedPlatform || 0;
    document.getElementById('stat-completed-today').innerText = activity.servicesCompletedToday || 0;
    document.getElementById('stat-customers-today').innerText = activity.customersToday || 0;

    renderDemandChart(analytics.demand || []);
    renderRevenueChart(analytics.demand || []);
    renderTrendChart(analytics.trend || []);
  } catch (err) {
    console.error('loadAnalytics failed:', err);
  }
}

document.getElementById('modal-cancel').addEventListener('click', () => {
  document.getElementById('provider-modal').style.display = 'none';
  selectedServiceId = null;
  selectedProviderId = null;
});

document.getElementById('modal-assign').addEventListener('click', async () => {
  if (!selectedServiceId || !selectedProviderId) {
    showToast('Please select a provider', 'error');
    return;
  }
  try {
    const json = await safeFetch(`${API_A}/admin/assign`, {
      method: 'POST',
      body: JSON.stringify({ serviceId: selectedServiceId, providerId: selectedProviderId })
    });
    if (json._id) {
      showToast('Provider assigned successfully!', 'success');
      document.getElementById('provider-modal').style.display = 'none';
      loadServices();
    } else {
      showToast(json.message || 'Error assigning provider', 'error');
    }
  } catch (err) {
    console.error('Assign error:', err);
  }
});

let selectedServiceId = null;
let selectedProviderId = null;
let allProviders = [];

document.addEventListener('click', async (e) => {
  if (e.target.classList.contains('assign-service-btn')) {
    try {
      const serviceId = e.target.dataset.serviceId;
      const services = await safeFetch(`${API_A}/admin/services`);
      const service = services.find((s) => s._id === serviceId);

      if (!service) {
        showToast('Service not found', 'error');
        return;
      }

      // Try admin providers endpoint first; fallback keeps modal working even if backend was not restarted.
      try {
        allProviders = await safeFetch(`${API_A}/admin/providers`);
      } catch (adminProviderErr) {
        allProviders = await safeFetch(`${API_A}/providers`);
      }

      const serviceTypeNormalized = normalizeServiceType(service.serviceType);
      const matchingProviders = (Array.isArray(allProviders) ? allProviders : []).filter((p) => {
        const pType = normalizeServiceType(p.serviceType);
        const sType = normalizeServiceType(service.serviceType);
        console.log(`Matching: ${pType} vs ${sType}`);
        return pType === sType || pType.includes(sType) || sType.includes(pType);
      });

      selectedServiceId = serviceId;
      selectedProviderId = null;

      document.getElementById('modal-service-type').innerText = service.serviceType;
      document.getElementById('modal-customer-name').innerText = service.customer?.name || 'Unknown';

      const providerList = document.getElementById('provider-list');
      providerList.innerHTML = '';

      if (!matchingProviders.length) {
        providerList.innerHTML = '<div style="padding:16px;color:#999;text-align:center">No providers found for this specialty</div>';
      } else {
        matchingProviders.forEach((provider) => {
          const userId = provider.user?._id || provider.user;
          if (!userId) return;

          const div = document.createElement('div');
          div.style.cssText = 'padding:12px 14px;border-bottom:1px solid #e2e8f0;cursor:pointer;transition:0.2s';
          const providerName = provider.user?.name || provider.name || 'Unknown';
          const userEmail = provider.user?.email || provider.email || '';
          const specialty = provider.serviceType || 'General';
          div.innerHTML = `<strong>${providerName} <span style="color:#1a73e8">(${specialty})</span></strong><br /><small style="color:#666">${userEmail}</small>`;
          div.addEventListener('click', () => {
            document.querySelectorAll('#provider-list > div').forEach((d) => d.style.background = '');
            div.style.background = '#dbeafe';
            selectedProviderId = userId;
          });
          div.addEventListener('mouseover', () => {
            if (selectedProviderId !== userId) div.style.background = '#f0f4f8';
          });
          div.addEventListener('mouseout', () => {
            if (selectedProviderId !== userId) div.style.background = '';
          });
          providerList.appendChild(div);
        });
      }

      document.getElementById('provider-modal').style.display = 'flex';
    } catch (err) {
      console.error('Open assign modal error:', err);
      showToast(err.message || 'Could not load providers', 'error');
    }
  }
});

async function loadProvidersCount(){
  const list = await safeFetch(`${API_A}/providers`);
  document.getElementById('stat-providers').innerText = list.length;
}

// Verify auth and load data on page load
verifyAuth().then(() => {
  loadUsers();
  loadServices();
  loadProvidersCount();
  loadAnalytics();
  setInterval(()=>{
    loadUsers();
    loadServices();
    loadProvidersCount();
    loadAnalytics();
  }, 10000);
});
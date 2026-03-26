const token = localStorage.getItem('token');
const me = JSON.parse(localStorage.getItem('user') || 'null');

// Redirect if not logged in
if (!token || !me) location.href='auth.html';

// Redirect if wrong role
if (me?.role !== 'customer') location.href='auth.html';

const API_BASE = 'http://localhost:5000/api';
const ISSUE_OPTIONS = {
  Electrician: ['Bulb/Fan not working', 'Switch/Socket issue', 'Wiring problem', 'MCB/Power trip', 'Appliance installation'],
  Plumber: ['Tap leakage', 'Pipe blockage', 'Toilet issue', 'Water tank problem', 'Motor/Pump issue'],
  'Device Repair': ['Phone not charging', 'Screen broken', 'Battery draining fast', 'Laptop not starting', 'Software issue'],
  Cleaning: ['Deep home cleaning', 'Kitchen cleaning', 'Bathroom cleaning', 'Sofa/Carpet cleaning', 'Post-construction cleaning'],
  Painting: ['Wall repaint', 'Patch/crack repair', 'Waterproof coating', 'Texture paint', 'Door/Window paint']
};

// Verify token is still valid on page load
async function verifyAuth() {
  try {
    const res = await fetch(`${API_BASE}/services/my`, { headers:{'Authorization':'Bearer '+token} });
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

// Show user info and load data
document.getElementById('welcome-name').innerText = `${me?.name || 'Customer'}`;
document.getElementById('logout-btn').addEventListener('click', ()=>{ localStorage.removeItem('token'); localStorage.removeItem('user'); location.href='auth.html'; });

const bookForm = document.getElementById('book-form');
const serviceTypeSelect = bookForm.querySelector('select[name="serviceType"]');
const issueTypeField = document.getElementById('issue-type-field');
const issueTypeSelect = bookForm.querySelector('select[name="issueType"]');

// Verify auth and load data on page load
verifyAuth().then(() => {
  loadRequests();
  setInterval(loadRequests, 5000);
});

// Track current estimate
let currentEstimate = null;

function populateIssueOptions(serviceType) {
  const options = ISSUE_OPTIONS[serviceType] || [];
  issueTypeSelect.innerHTML = '<option value="">Select issue type</option>';

  if (options.length === 0) {
    issueTypeField.style.display = 'none';
    issueTypeSelect.required = false;
    return;
  }

  options.forEach(issue => {
    const opt = document.createElement('option');
    opt.value = issue;
    opt.innerText = issue;
    issueTypeSelect.appendChild(opt);
  });

  issueTypeField.style.display = 'block';
  issueTypeSelect.required = true;
}

serviceTypeSelect.addEventListener('change', (e) => {
  populateIssueOptions(e.target.value);
});

bookForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());

  if (!data.serviceType) {
    showToast('Please select service type', 'error');
    return;
  }

  if (issueTypeSelect.required && !data.issueType) {
    showToast('Please select the issue type', 'error');
    return;
  }
  
  // Add customer location
  data.latitude = me?.latitude;
  data.longitude = me?.longitude;
  
  let estimate = { finalPrice: data.basePrice || 500, distanceKm: 0, distanceCharge: 0, provider: null };
  
  // Try to get estimate if location available
  if (data.latitude && data.longitude) {
    try {
      const estimateRes = await fetch(`${API_BASE}/services/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType: data.serviceType,
          basePrice: data.basePrice || 500,
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude)
        })
      });
      
      if (estimateRes.ok) {
        estimate = await estimateRes.json();
      }
    } catch (err) {
      console.error('Estimate error:', err);
      // Use default estimate if fetch fails
    }
  }
  
  // Show estimate dialog
  showEstimateDialog(data, estimate);
});

function showEstimateDialog(bookingData, estimate) {
  // Create or get modal overlay
  let modal = document.getElementById('estimate-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'estimate-modal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
      z-index: 99999 !important;
    `;
    document.body.appendChild(modal);
  }

  const content = document.createElement('div');
  content.style.cssText = `
    background: white; padding: 32px; border-radius: 12px; 
    max-width: 500px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    max-height: 90vh; overflow-y: auto;
  `;

  let providerInfo = estimate.provider ? 
    `<p style="margin:8px 0 0 0;color:#1a73e8;font-weight:600;font-size:16px">👤 ${estimate.provider.name}</p>` : 
    '<p style="margin:8px 0 0 0;color:#999;font-weight:500;font-size:14px">No provider nearby - will be assigned later</p>';

  content.innerHTML = `
    <h2 style="margin:0 0 20px 0;color:#0f172a;font-size:24px">📋 Service Estimate</h2>
    
    <div style="background:#f0f9ff;padding:20px;border-radius:8px;border-left:4px solid #1a73e8;margin-bottom:24px">
      <p style="margin:0 0 12px 0;color:#0f172a;font-size:14px"><strong>Service:</strong> ${bookingData.serviceType}</p>
      <p style="margin:0 0 12px 0;color:#0f172a;font-size:14px"><strong>Issue:</strong> ${bookingData.issueType || 'General request'}</p>
      <p style="margin:0 0 12px 0;color:#0f172a;font-size:14px"><strong>Base Price:</strong> ₹${bookingData.basePrice || 500}</p>
      <p style="margin:0 0 12px 0;color:#0f172a;font-size:14px"><strong>Distance:</strong> ${estimate.distanceKm || 0} km</p>
      ${estimate.distanceCharge > 0 ? `<p style="margin:0 0 12px 0;color:#ea4335;font-size:14px"><strong>Distance Charge:</strong> +₹${estimate.distanceCharge}</p>` : ''}
      <hr style="margin:12px 0;border:none;border-top:2px solid #cbd5e1">
      <p style="margin:0;color:#0f172a;font-size:20px;font-weight:700">💰 Total: ₹${estimate.finalPrice}</p>
      ${providerInfo}
    </div>

    <div style="margin-bottom:24px">
      <label style="display:block;font-weight:700;margin-bottom:12px;font-size:14px;color:#0f172a">💳 Payment Method</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <label style="display:flex;align-items:center;gap:10px;padding:12px;border:2px solid #e5e7eb;border-radius:6px;cursor:pointer;font-weight:500;background:#fff;transition:all 0.2s">
          <input type="radio" name="paymentMethod" value="cash" checked style="cursor:pointer;width:16px;height:16px"> 
          <span>💵 Cash</span>
        </label>
        <label style="display:flex;align-items:center;gap:10px;padding:12px;border:2px solid #e5e7eb;border-radius:6px;cursor:pointer;font-weight:500;background:#fff;transition:all 0.2s">
          <input type="radio" name="paymentMethod" value="card" style="cursor:pointer;width:16px;height:16px"> 
          <span>💳 Card</span>
        </label>
        <label style="display:flex;align-items:center;gap:10px;padding:12px;border:2px solid #e5e7eb;border-radius:6px;cursor:pointer;font-weight:500;background:#fff;transition:all 0.2s">
          <input type="radio" name="paymentMethod" value="upi" style="cursor:pointer;width:16px;height:16px"> 
          <span>📱 UPI</span>
        </label>
        <label style="display:flex;align-items:center;gap:10px;padding:12px;border:2px solid #e5e7eb;border-radius:6px;cursor:pointer;font-weight:500;background:#fff;transition:all 0.2s">
          <input type="radio" name="paymentMethod" value="bank" style="cursor:pointer;width:16px;height:16px"> 
          <span>🏦 Bank</span>
        </label>
      </div>
    </div>

    <div style="display:flex;gap:12px;margin-top:24px">
      <button class="cancel-btn" style="flex:1;padding:14px;background:#e5e7eb;color:#0f172a;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:14px">❌ Cancel</button>
      <button class="confirm-btn" style="flex:1;padding:14px;background:#1a73e8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:14px">✅ Confirm & Book</button>
    </div>
  `;

  modal.innerHTML = '';
  modal.appendChild(content);
  modal.style.display = 'flex';

  // Cancel button
  content.querySelector('.cancel-btn').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Confirm button
  content.querySelector('.confirm-btn').addEventListener('click', async () => {
    const paymentMethod = content.querySelector('input[name="paymentMethod"]:checked').value;
    bookingData.paymentMethod = paymentMethod;
    
    // Submit service request
    const res = await fetch(`${API_BASE}/services`, { 
      method:'POST', 
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, 
      body:JSON.stringify(bookingData)
    });
    const json = await res.json();
    
    if (json._id) { 
      modal.style.display = 'none';
      loadRequests(); 
      if (json.provider) {
        showToast(`✅ Service booked! Professional assigned. Total: ₹${estimate.finalPrice}`, 'success');
      } else {
        showToast('📋 Service request submitted. Waiting for professionals.', 'info');
      }
      bookForm.reset();
      populateIssueOptions('');
    }
    else showToast(json.message || 'Error submitting request', 'error');
  });
}

async function loadRequests(){
  const res = await fetch(`${API_BASE}/services/my`, { headers:{'Authorization':'Bearer '+token} });
  const list = await res.json();
  
  document.getElementById('stat-requests').innerText = list.length;
  document.getElementById('stat-active').innerText = list.filter(s => s.status !== 'completed' && s.status !== 'cancelled').length;
  document.getElementById('stat-completed').innerText = list.filter(s => s.status === 'completed').length;
  
  const rows = document.getElementById('requests'); 
  rows.innerHTML='';
  const emptyState = document.getElementById('empty-state');
  
  if (list.length === 0) {
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';
    list.forEach(s => {
      const tr = document.createElement('tr');
      const date = new Date(s.createdAt).toLocaleDateString('en-IN', {year:'numeric', month:'short', day:'numeric'});
      const issueText = s.issueType ? `Issue: ${s.issueType}` : 'Issue: General request';
      const desc = s.description || '-';
      
      let statusDisplay = s.status;
      let providerInfo = '-';
      let priceInfo = '';
      
      // Show provider info if assigned
      if (s.provider) {
        providerInfo = `<strong style="color:#1a73e8">${s.provider.name}</strong>`;
      }

      // Show price info
      if (s.finalPrice) {
        priceInfo = `<small style="display:block;color:#666;margin-top:4px">₹${s.finalPrice}</small>`;
      }
      
      tr.innerHTML = `
        <td style="padding:16px;border-bottom:1px solid #e8e8e8">${s.serviceType}</td>
        <td style="padding:16px;border-bottom:1px solid #e8e8e8">
          <small style="display:block;color:#1a73e8;font-weight:600;margin-bottom:4px">${issueText}</small>
          ${desc.substring(0, 40)}${desc.length > 40 ? '...' : ''}
        </td>
        <td style="padding:16px;border-bottom:1px solid #e8e8e8">
          <span class="badge ${s.status}">${s.status}</span>
          ${providerInfo !== '-' ? `<br><small style="color:#666;margin-top:4px;display:block">${providerInfo}</small>` : ''}
          ${priceInfo}
        </td>
        <td style="padding:16px;border-bottom:1px solid #e8e8e8">${date}</td>
      `;
      rows.appendChild(tr);
    });
  }
}

// Auth verification handles initial load

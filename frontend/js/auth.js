const API = 'http://localhost:5000/api';

const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const toggleBtn = document.getElementById('toggle-btn');
const title = document.getElementById('form-title');
const roleSelect = document.getElementById('role-select');
const serviceTypeField = document.getElementById('service-type-field');
const locationBtn = document.getElementById('location-btn');
const locationStatus = document.getElementById('location-status');
const paymentDetailsDiv = document.getElementById('payment-details');
const paymentMethodRadios = document.querySelectorAll('input[name="paymentMethod"]');

// Get location button click
locationBtn.addEventListener('click', (e) => {
  e.preventDefault();
  if (!navigator.geolocation) {
    showToast('Geolocation not supported by your browser', 'error');
    return;
  }
  
  locationBtn.disabled = true;
  locationBtn.innerText = 'Getting location...';
  locationStatus.textContent = '';
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      
      signupForm.querySelector('input[name="latitude"]').value = lat;
      signupForm.querySelector('input[name="longitude"]').value = lon;
      
      locationStatus.textContent = `✓ Location captured: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      locationStatus.style.color = '#00a65a';
      locationBtn.disabled = false;
      locationBtn.innerText = '✓ Location Set';
      locationBtn.style.background = '#00a65a';
      locationBtn.style.color = '#fff';
    },
    (error) => {
      showToast('Could not get location: ' + error.message, 'error');
      locationBtn.disabled = false;
      locationBtn.innerText = '📍 Try Again';
    }
  );
});

// Payment method selection toggle
paymentMethodRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    const method = e.target.value;
    
    // Hide all payment details first
    document.getElementById('upi-field').style.display = 'none';
    document.getElementById('card-field').style.display = 'none';
    document.getElementById('bank-field').style.display = 'none';
    
    // Show relevant payment details
    if (method === 'upi') {
      document.getElementById('upi-field').style.display = 'block';
      paymentDetailsDiv.style.display = 'block';
    } else if (method === 'card') {
      document.getElementById('card-field').style.display = 'block';
      paymentDetailsDiv.style.display = 'block';
    } else if (method === 'bank') {
      document.getElementById('bank-field').style.display = 'block';
      paymentDetailsDiv.style.display = 'block';
    } else {
      paymentDetailsDiv.style.display = 'none';
    }
  });
});

// Show/hide service type field based on role selection
roleSelect.addEventListener('change', (e) => {
  if (e.target.value === 'provider') {
    serviceTypeField.style.display = 'block';
    serviceTypeField.querySelector('select').required = true;
  } else {
    serviceTypeField.style.display = 'none';
    serviceTypeField.querySelector('select').required = false;
  }
});

toggleBtn.addEventListener('click', ()=>{
  const showingSignup = signupForm.style.display !== 'none';
  if (showingSignup){
    signupForm.style.display = 'none'; 
    loginForm.style.display = 'block'; 
    title.innerText='Login';
    document.getElementById('toggle-text').innerText='Don\'t have an account?';
    document.getElementById('toggle-label').innerText='Sign Up';
  } else {
    signupForm.style.display = 'block'; 
    loginForm.style.display = 'none'; 
    title.innerText='Create Account';
    document.getElementById('toggle-text').innerText='Already have an account?';
    document.getElementById('toggle-label').innerText='Login';
  }
});

signupForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  
  if (!data.email || !data.password || !data.name) {
    showToast('Please fill all required fields', 'error');
    return;
  }
  
  if (data.role === 'provider' && !data.serviceType) {
    showToast('Please select your service specialty', 'error');
    return;
  }

  // Validate location
  if (!data.address || !data.latitude || !data.longitude) {
    showToast('Please enter your address and get your location', 'error');
    return;
  }

  // Validate payment details if not cash
  if (data.paymentMethod === 'upi' && !data.upiId) {
    showToast('Please enter your UPI ID', 'error');
    return;
  }
  if (data.paymentMethod === 'card' && !data.cardLast4) {
    showToast('Please enter last 4 digits of your card', 'error');
    return;
  }
  if (data.paymentMethod === 'bank' && !data.bankAccount) {
    showToast('Please enter your bank account number', 'error');
    return;
  }

  // Convert lat/lon to numbers
  data.latitude = parseFloat(data.latitude);
  data.longitude = parseFloat(data.longitude);

  const res = await fetch(`${API}/auth/signup`, { 
    method:'POST', 
    headers:{'Content-Type':'application/json'}, 
    body:JSON.stringify(data)
  });
  const json = await res.json();
  
  if (json.token) { 
    localStorage.setItem('token', json.token); 
    localStorage.setItem('user', JSON.stringify(json.user));
    showToast(`Welcome ${json.user.name}! Account created successfully.`, 'success');
    setTimeout(() => redirectByRole(json.user.role), 1000);
  }
  else showToast(json.message || 'Signup failed', 'error');
});

loginForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  
  if (!data.email || !data.password) {
    showToast('Please enter email and password', 'error');
    return;
  }
  
  const res = await fetch(`${API}/auth/login`, { 
    method:'POST', 
    headers:{'Content-Type':'application/json'}, 
    body:JSON.stringify(data)
  });
  const json = await res.json();
  
  if (json.token) { 
    localStorage.setItem('token', json.token); 
    localStorage.setItem('user', JSON.stringify(json.user));
    showToast(`Welcome back ${json.user.name}!`, 'success');
    setTimeout(() => redirectByRole(json.user.role), 800);
  }
  else showToast(json.message || 'Login failed', 'error');
});

function redirectByRole(role){
  if (role === 'customer') location.href='customer-dashboard.html';
  else if (role === 'provider') location.href='provider-dashboard.html';
  else location.href='admin-dashboard.html';
}

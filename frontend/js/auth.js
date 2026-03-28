const API = 'http://localhost:5000/api';

const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const toggleBtn = document.getElementById('toggle-btn');
const title = document.getElementById('form-title');
const roleSelect = document.getElementById('role-select');
const serviceTypeField = document.getElementById('service-type-field');
const locationBtn = document.getElementById('location-btn');
const locationStatus = document.getElementById('location-status');
const addressInput = signupForm.querySelector('input[name="address"]');
const addressError = document.getElementById('address-error');
const phoneRegex = /^\d{10}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function setAddressError(message) {
  addressError.textContent = message;
  addressError.style.display = 'block';
}

function clearAddressError() {
  addressError.textContent = '';
  addressError.style.display = 'none';
}

function isAddressFormatValid(address) {
  const parts = (address || '').split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length >= 3;
}

function setLocationButtonDefault() {
  locationBtn.innerHTML = '<i class="fas fa-location-dot"></i> My Location';
}

function toCityStateCountry(city, state, country) {
  const parts = [city, state, country].map((v) => (v || '').trim()).filter(Boolean);
  if (parts.length < 2) {
    throw new Error('Could not detect city/state/country');
  }
  return parts.join(', ');
}

async function reverseGeocodeWithNominatim(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Language': 'en'
    }
  });

  if (!response.ok) {
    throw new Error('Nominatim request failed');
  }

  const data = await response.json();
  const a = data.address || {};
  const city = a.city || a.town || a.village || a.county || a.state_district || '';
  const state = a.state || '';
  const country = a.country || '';
  return toCityStateCountry(city, state, country);
}

async function reverseGeocodeWithBigDataCloud(lat, lon) {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('BigDataCloud request failed');
  }

  const data = await response.json();
  const city = data.city || data.locality || data.principalSubdivision || '';
  const state = data.principalSubdivision || data.localityInfo?.administrative?.[1]?.name || '';
  const country = data.countryName || '';
  return toCityStateCountry(city, state, country);
}

async function reverseGeocodeCityStateCountry(lat, lon) {
  const providers = [reverseGeocodeWithNominatim, reverseGeocodeWithBigDataCloud];
  let lastError = null;

  for (const provider of providers) {
    try {
      return await provider(lat, lon);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Reverse geocoding failed');
}

// Get location button click
locationBtn.addEventListener('click', (e) => {
  e.preventDefault();
  if (!navigator.geolocation) {
    showToast('Geolocation not supported by your browser', 'error');
    return;
  }
  
  locationBtn.disabled = true;
  locationBtn.textContent = 'Getting location...';
  locationStatus.textContent = '';
  clearAddressError();
  
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      
      signupForm.querySelector('input[name="latitude"]').value = lat;
      signupForm.querySelector('input[name="longitude"]').value = lon;

      try {
        const locationLabel = await reverseGeocodeCityStateCountry(lat, lon);
        addressInput.value = locationLabel;
        locationStatus.textContent = `Location set: ${locationLabel}`;
        locationStatus.style.color = '#00a65a';
      } catch (geocodeError) {
        locationStatus.textContent = 'Location captured, but city details were not found. Enter address manually as City, State, Country.';
        locationStatus.style.color = '#f59e0b';
      }

      locationBtn.disabled = false;
      locationBtn.textContent = 'Location Set';
      locationBtn.style.background = '#00a65a';
      locationBtn.style.color = '#fff';
    },
    (error) => {
      showToast('Could not get location: ' + error.message, 'error');
      locationBtn.disabled = false;
      setLocationButtonDefault();
      locationBtn.style.background = '';
      locationBtn.style.color = '';
    }
  );
});

addressInput.addEventListener('input', () => {
  clearAddressError();
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

  data.phone = (data.phone || '').trim();
  data.password = (data.password || '').trim();
  
  if (!data.email || !data.password || !data.name) {
    showToast('Please fill all required fields', 'error');
    return;
  }
  
  if (data.role === 'provider' && !data.serviceType) {
    showToast('Please select your service specialty', 'error');
    return;
  }

  if (!phoneRegex.test(data.phone)) {
    showToast('Phone number must be exactly 10 digits', 'error');
    return;
  }

  if (!passwordRegex.test(data.password)) {
    showToast('Password must be 8+ chars with uppercase, lowercase, number, and special character', 'error');
    return;
  }

  if (!data.address) {
    setAddressError('Address is required.');
    return;
  }

  if (!isAddressFormatValid(data.address)) {
    setAddressError('Enter address in this format: City, State, Country.');
    return;
  }

  if (!data.latitude || !data.longitude) {
    setAddressError('Click My Location to auto-fill City, State, Country.');
    return;
  }

  clearAddressError();

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

setLocationButtonDefault();

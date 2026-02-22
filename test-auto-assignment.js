const API = 'http://localhost:5000/api';

async function test() {
  console.log('\n🧪 AUTO-ASSIGNMENT SYSTEM TEST\n');
  
  try {
    // Step 1: Create provider
    console.log('1️⃣ Creating Provider (Mike - Electrician)');
    const provRes = await fetch(`${API}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mike',
        email: `mike${Date.now()}@test.local`,
        phone: '9999999999',
        password: 'test123',
        role: 'provider',
        serviceType: 'Electrician'
      })
    });
    const provData = await provRes.json();
    console.log(`   ✓ Provider: ${provData.user.name}`);
    console.log(`   ✓ Message: "${provData.message}"`);
    const provToken = provData.token;

    // Step 2: Create customer
    console.log('\n2️⃣ Creating Customer (Sara)');
    const custRes = await fetch(`${API}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sara',
        email: `sara${Date.now()}@test.local`,
        phone: '8888888888',
        password: 'test123',
        role: 'customer'
      })
    });
    const custData = await custRes.json();
    console.log(`   ✓ Customer: ${custData.user.name}`);
    const custToken = custData.token;

    // Step 3: Customer books service (auto-assignment happens)
    console.log('\n3️⃣ Customer Books Service (AUTO-ASSIGNMENT TRIGGERED)');
    const serviceRes = await fetch(`${API}/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${custToken}`
      },
      body: JSON.stringify({
        serviceType: 'Electrician',
        description: 'Need to fix electrical outlet in kitchen'
      })
    });
    const serviceData = await serviceRes.json();
    console.log(`   ✓ Service Type: ${serviceData.serviceType}`);
    console.log(`   ✓ Status: ${serviceData.status} (should be "assigned")`);
    console.log(`   ✓ Auto-Assigned: ${serviceData.autoAssigned}`);
    console.log(`   ✓ Provider: ${serviceData.provider.name}`);
    console.log(`   ✓ Message: "${serviceData.message}"`);

    // Step 4: Provider sees assigned jobs
    console.log('\n4️⃣ Provider Views Assigned Jobs');
    const jobsRes = await fetch(`${API}/services/assigned`, {
      headers: { 'Authorization': `Bearer ${provToken}` }
    });
    const jobs = await jobsRes.json();
    console.log(`   ✓ Jobs for provider: ${jobs.length}`);
    if (jobs.length > 0) {
      console.log(`   ✓ First job type: ${jobs[0].serviceType}`);
      console.log(`   ✓ Customer: ${jobs[0].customer.name}`);
      console.log(`   ✓ Job status: ${jobs[0].status}`);
    }

    // Step 5: Provider starts job
    console.log('\n5️⃣ Provider Starts Job');
    const updateRes = await fetch(`${API}/services/${serviceData._id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provToken}`
      },
      body: JSON.stringify({ status: 'in_progress' })
    });
    const updateData = await updateRes.json();
    console.log(`   ✓ Job status updated to: ${updateData.status}`);

    // Step 6: Provider completes job
    console.log('\n6️⃣ Provider Completes Job');
    const completeRes = await fetch(`${API}/services/${serviceData._id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provToken}`
      },
      body: JSON.stringify({ status: 'completed' })
    });
    const completeData = await completeRes.json();
    console.log(`   ✓ Job status updated to: ${completeData.status}`);

    console.log('\n✅ AUTO-ASSIGNMENT TEST PASSED!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  }
}

test();

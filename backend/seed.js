const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Service = require('./models/Service');

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/techresque';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB for seeding');

  // Clear all services first
  await Service.deleteMany({});
  console.log('✅ Cleared all services');

  // Clear all non-admin users
  await User.deleteMany({ role: { $ne: 'admin' } });
  console.log('✅ Cleared all customer and provider accounts');

  const adminEmail = 'admin@techresque.local';
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = new User({ 
      name: 'Admin', 
      email: adminEmail, 
      password: 'admin123', 
      role: 'admin', 
      phone: '9999999999',
      address: 'Admin Office, Bangalore',
      latitude: 12.9716,
      longitude: 77.5946
    });
    await admin.save();
    console.log('✅ Created admin user:', adminEmail, 'password: admin123');
  } else {
    console.log('✅ Admin user already exists:', adminEmail);
  }

  await mongoose.disconnect();
  console.log('✅ Seeding complete - Database cleaned and ready!');
}

run().catch(err => { console.error(err); process.exit(1); });

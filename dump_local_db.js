const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const User = require('./backend/models/User');
const Provider = require('./backend/models/Provider');
const Service = require('./backend/models/Service');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/techresque';

async function dumpData() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const users = await User.find({});
    const providers = await Provider.find({});
    const services = await Service.find({});

    const data = {
      users,
      providers,
      services
    };

    fs.writeFileSync(path.join(__dirname, 'db_dump.json'), JSON.stringify(data, null, 2));
    console.log('Data dumped to db_dump.json');

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error dumping data:', err);
    process.exit(1);
  }
}

dumpData();

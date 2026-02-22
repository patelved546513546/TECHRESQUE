const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Provider = require('../models/Provider');
const router = express.Router();

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role, phone, serviceType, address, latitude, longitude, upiId, cardLast4, bankAccount } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User already exists' });
    
    user = new User({ 
      name, 
      email, 
      password, 
      role: role || 'customer', 
      phone,
      address,
      latitude,
      longitude,
      upiId,
      cardLast4,
      bankAccount
    });
    await user.save();

    // Auto-create provider profile if signing up as provider
    if (role === 'provider' && serviceType) {
      const provider = new Provider({
        user: user._id,
        serviceType: serviceType,
        available: true  // Start as available
      });
      await provider.save();
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        address: user.address,
        latitude: user.latitude,
        longitude: user.longitude
      },
      message: role === 'provider' ? 'Welcome! Your professional profile is ready.' : 'Welcome! Account created successfully.'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid email or password' });
    const match = await user.comparePassword(password);
    if (!match) return res.status(400).json({ message: 'Invalid email or password' });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        latitude: user.latitude,
        longitude: user.longitude
      } 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

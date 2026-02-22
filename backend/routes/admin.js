const express = require('express');
const User = require('../models/User');
const Service = require('../models/Service');
const Provider = require('../models/Provider');
const { auth, permit } = require('../middleware/auth');
const router = express.Router();

router.get('/users', auth, permit('admin'), async (req, res) => {
  const users = await User.find().select('-password');
  res.json(users);
});

router.get('/services', auth, permit('admin'), async (req, res) => {
  const services = await Service.find().populate('customer provider', 'name email');
  res.json(services);
});

// Assign provider to a service
router.post('/assign', auth, permit('admin'), async (req, res) => {
  try {
    const { serviceId, providerId } = req.body;
    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ message: 'Service not found' });
    service.provider = providerId;
    service.status = 'assigned';
    await service.save();
    res.json(service);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Basic analytics
router.get('/analytics', auth, permit('admin'), async (req, res) => {
  const totalUsers = await User.countDocuments();
  const totalServices = await Service.countDocuments();
  const byStatus = await Service.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  res.json({ totalUsers, totalServices, byStatus });
});

module.exports = router;

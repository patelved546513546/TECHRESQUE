const express = require('express');
const Provider = require('../models/Provider');
const { auth, permit } = require('../middleware/auth');
const router = express.Router();

// Create or update provider profile (serviceType)
router.post('/profile', auth, permit('provider'), async (req, res) => {
  try {
    const { serviceType } = req.body;
    let p = await Provider.findOne({ user: req.user._id });
    if (!p) p = new Provider({ user: req.user._id, serviceType, available: true });
    else p.serviceType = serviceType || p.serviceType;
    await p.save();
    res.json(p);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Toggle availability
router.patch('/availability', auth, permit('provider'), async (req, res) => {
  try {
    const { available } = req.body;
    const p = await Provider.findOne({ user: req.user._id });
    if (!p) return res.status(404).json({ message: 'Provider profile not found' });
    p.available = !!available;
    await p.save();
    res.json(p);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Public: list available providers or by service
router.get('/', async (req, res) => {
  try {
    const { serviceType } = req.query;
    const q = { available: true };
    if (serviceType) q.serviceType = serviceType;
    const list = await Provider.find(q).populate('user', 'name email phone');
    res.json(list);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;

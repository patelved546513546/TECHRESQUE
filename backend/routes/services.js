const express = require('express');
const Service = require('../models/Service');
const Provider = require('../models/Provider');
const User = require('../models/User');
const { auth, permit } = require('../middleware/auth');
const { calculateDistance, calculateFinalPrice } = require('../utils/distance');
const router = express.Router();

// Customer: create service request - NO AUTO-ASSIGN
// Stays as "requested" until a provider accepts it
router.post('/', auth, permit('customer'), async (req, res) => {
  try {
    const { serviceType, description, basePrice } = req.body;
    
    // Get customer location for pricing calculation
    const customerUser = await User.findById(req.user._id).select('latitude longitude address');
    
    const service = new Service({ 
      customer: req.user._id, 
      serviceType, 
      description,
      basePrice: basePrice || 500,
      status: 'requested',  // Start as requested - NO AUTO ASSIGN
      finalPrice: basePrice || 500,  // Default to base price
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) // Expires in 10 days
    });

    // Calculate price based on nearest available provider (for estimate only)
    // But do NOT assign the provider yet
    const providers = await Provider.find({ 
      serviceType: serviceType,
      available: true 
    }).populate('user', 'latitude longitude');

    let nearestDistance = null;
    if (providers.length > 0 && customerUser && customerUser.latitude && customerUser.longitude) {
      let minDist = Infinity;
      
      providers.forEach(p => {
        if (p.user && p.user.latitude && p.user.longitude) {
          const dist = calculateDistance(
            customerUser.latitude,
            customerUser.longitude,
            p.user.latitude,
            p.user.longitude
          );
          if (dist < minDist) minDist = dist;
        }
      });
      
      if (minDist < Infinity) {
        nearestDistance = minDist;
        const pricing = calculateFinalPrice(service.basePrice, minDist);
        service.distanceKm = Math.round(minDist * 10) / 10;
        service.finalPrice = pricing.finalPrice;
        service.distanceCharge = pricing.distanceCharge;
        service.providerEarning = Math.round(pricing.finalPrice * 0.7);
      }
    }

    await service.save();
    
    res.json({
      ...service.toObject(),
      autoAssigned: false,
      message: `✓ Request created! Providers are now viewing your request. Distance to nearest provider: ${nearestDistance ? Math.round(nearestDistance * 10) / 10 + 'km' : 'calculating...'}`
    });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ message: 'Server error' }); 
  }
});

// Public: estimate price for a service based on nearest available provider
router.post('/estimate', async (req, res) => {
  try {
    const { serviceType, basePrice = 500, latitude, longitude } = req.body;

    // find nearest available provider for the serviceType
    const providers = await Provider.find({ serviceType: serviceType, available: true }).populate('user', 'latitude longitude name email');
    if (!providers || providers.length === 0) {
      // no provider available, return base price
      return res.json({ finalPrice: basePrice, distanceKm: 0, distanceCharge: 0, provider: null });
    }

    // find provider with smallest distance
    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;
    providers.forEach(p => {
      if (p.user && p.user.latitude && p.user.longitude && latitude && longitude) {
        const d = calculateDistance(latitude, longitude, p.user.latitude, p.user.longitude);
        if (d < bestDist) { bestDist = d; best = p; }
      }
    });

    if (!best || bestDist === Number.POSITIVE_INFINITY) {
      return res.json({ finalPrice: basePrice, distanceKm: 0, distanceCharge: 0, provider: null });
    }

    const pricing = calculateFinalPrice(basePrice, bestDist);
    const providerShare = 0.7;
    const providerEarning = Math.round(pricing.finalPrice * providerShare);

    res.json({
      finalPrice: pricing.finalPrice,
      distanceKm: Math.round(bestDist * 10) / 10,
      distanceCharge: pricing.distanceCharge,
      provider: { id: best._id, name: best.user.name, email: best.user.email },
      providerEarning
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// Provider: accept assigned/pending job
router.patch('/:id/accept', auth, permit('provider'), async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ message: 'Not found' });
    
    // Check if service is still pending/available
    if (service.status !== 'requested') {
      return res.status(400).json({ message: `This request is no longer available (status: ${service.status})` });
    }
    
    // Check if already assigned or expired
    if (service.provider) {
      return res.status(400).json({ message: 'This request has already been accepted by another provider' });
    }
    
    if (service.expiresAt < new Date()) {
      service.status = 'cancelled';
      await service.save();
      return res.status(400).json({ message: 'Request has expired (older than 10 days)' });
    }

    // Assign to current provider
    service.provider = req.user._id;
    service.providerAccepted = true;
    service.status = 'assigned';  // Change to assigned
    
    // Calculate provider earning if not already calculated
    if (!service.providerEarning || service.providerEarning === 0) {
      service.providerEarning = Math.round((service.finalPrice || service.basePrice) * 0.7);
    }
    
    await service.save();
    
    res.json({ 
      message: `🎉 Job accepted! Start earning ₹${service.providerEarning}. Customer will be notified.`, 
      service 
    });
  } catch (err) { 
    console.error(err); 
    res.status(500).json({ message: 'Server error' }); 
  }
});

// Provider: decline assigned job
router.patch('/:id/decline', auth, permit('provider'), async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ message: 'Not found' });
    if (!service.provider || service.provider.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not assigned' });

    // Unassign provider so other providers can be offered
    service.provider = null;
    service.status = 'requested';
    service.providerAccepted = false;
    await service.save();

    res.json({ message: 'You have declined the job. It will be reassigned to other professionals.' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// Provider: confirm payment received
router.post('/:id/provider/confirm-payment', auth, permit('provider'), async (req, res) => {
  try {
    const service = await Service.findById(req.params.id).populate('customer', 'name email');
    if (!service) return res.status(404).json({ message: 'Not found' });
    if (!service.provider || service.provider.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not assigned' });

    if (service.paymentStatus !== 'paid') {
      return res.status(400).json({ message: 'Customer payment not marked as paid yet' });
    }

    service.providerPaid = true;
    await service.save();

    res.json({
      message: `Payment received: ₹${service.providerEarning}. Mark your availability below.`,
      providerEarning: service.providerEarning,
      service
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// Provider: toggle availability (current provider)
router.post('/provider/availability', auth, permit('provider'), async (req, res) => {
  try {
    const { available } = req.body;
    const provider = await Provider.findOneAndUpdate({ user: req.user._id }, { available: !!available }, { new: true });
    if (!provider) return res.status(404).json({ message: 'Provider profile not found' });
    res.json({ message: `Availability updated: ${provider.available ? 'Active' : 'Stopped'}`, provider });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// Get user's services (customer)
router.get('/my', auth, async (req, res) => {
  try {
    const services = await Service.find({ customer: req.user._id }).populate('provider', 'name email');
    res.json(services);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Provider: view assigned jobs
router.get('/assigned', auth, permit('provider'), async (req, res) => {
  try {
    // Populate richer customer information so provider can contact and see location
    const services = await Service.find({ provider: req.user._id })
      .populate('customer', 'name email phone address latitude longitude')
      .populate('provider', 'name email');
    res.json(services);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Provider: get pending requests for their service type (not yet assigned to them)
// IMPORTANT: Must come BEFORE the /:id route!
// Shows ALL pending requests regardless of provider availability
router.get('/pending/list', auth, permit('provider'), async (req, res) => {
  try {
    // Get provider's service type
    const provider = await Provider.findOne({ user: req.user._id }).select('serviceType');
    if (!provider) return res.status(404).json({ message: 'Provider profile not found' });

    // Auto-cancel expired requests first
    const now = new Date();
    await Service.updateMany(
      { status: 'requested', expiresAt: { $lt: now } },
      { $set: { status: 'cancelled' } }
    );

    // Find all PENDING/REQUESTED services matching this service type (not assigned or in progress)
    // These are available for ANY provider to accept
    const pendingServices = await Service.find({
      serviceType: provider.serviceType,
      status: 'requested',  // Only requested status - not assigned to anyone
      provider: null,  // Not assigned to any provider
      expiresAt: { $gte: now }  // Not expired
    })
    .populate('customer', 'name email phone address latitude longitude')
    .sort({ createdAt: -1 })
    .limit(20);  // Show more requests

    res.json(pendingServices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Provider: update status
router.patch('/:id/status', auth, permit('provider'), async (req, res) => {
  try {
    const { status } = req.body;
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ message: 'Not found' });
    if (!service.provider || service.provider.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not assigned' });
    service.status = status;
    await service.save();
    res.json(service);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// Customer: process payment
router.post('/:id/payment', auth, permit('customer'), async (req, res) => {
  try {
    const { paymentMethod } = req.body;
    const service = await Service.findById(req.params.id);
    
    if (!service) return res.status(404).json({ message: 'Service not found' });
    if (service.customer.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized' });
    
    // Update payment status
    service.paymentMethod = paymentMethod || 'cash';
    service.paymentStatus = 'paid';
    service.paymentDate = new Date();
    
    await service.save();
    
    // Fetch updated service with provider details
    await service.populate('provider', 'name email');
    
    res.json({
      ...service.toObject(),
      message: `Payment of ₹${service.finalPrice} processed via ${service.paymentMethod.toUpperCase()}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get service details
router.get('/:id', auth, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id)
      .populate('customer', 'name email address phone')
      .populate('provider', 'name email address phone');
    
    if (!service) return res.status(404).json({ message: 'Service not found' });
    
    // Check authorization - only customer, provider, or admin can view
    const isAuthorized = 
      service.customer._id.toString() === req.user._id.toString() ||
      service.provider._id.toString() === req.user._id.toString() ||
      req.user.role === 'admin';
    
    if (!isAuthorized) return res.status(403).json({ message: 'Not authorized' });
    
    res.json(service);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Provider: get earnings breakdown (today, this week, this month)
router.get('/provider/earnings', auth, permit('provider'), async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get completed services for this provider
    const completedServices = await Service.find({
      provider: req.user._id,
      status: 'completed',
      paymentStatus: 'paid'
    });

    // Filter by time periods
    const todayEarnings = completedServices
      .filter(s => new Date(s.updatedAt).getTime() >= today.getTime())
      .reduce((sum, s) => sum + (s.providerEarning || 0), 0);

    const weekEarnings = completedServices
      .filter(s => new Date(s.updatedAt).getTime() >= weekStart.getTime())
      .reduce((sum, s) => sum + (s.providerEarning || 0), 0);

    const monthEarnings = completedServices
      .filter(s => new Date(s.updatedAt).getTime() >= monthStart.getTime())
      .reduce((sum, s) => sum + (s.providerEarning || 0), 0);

    res.json({
      today: todayEarnings,
      week: weekEarnings,
      month: monthEarnings,
      total: completedServices.reduce((sum, s) => sum + (s.providerEarning || 0), 0)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

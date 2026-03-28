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

// Get all providers for assignment (admin only - includes unavailable)
router.get('/providers', auth, permit('admin'), async (req, res) => {
  try {
    const providers = await Provider.find().populate('user', 'name email _id');
    res.json(providers);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
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
  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalServices,
      totalProviders,
      totalCustomers,
      serviceStatus,
      todayCompletedServices,
      todayRevenueAgg,
      totalRevenueAgg,
      activeProfessionalsIds,
      customersUsedIds,
      customersTodayIds,
      serviceTypeDemand,
      serviceTypeCompleted,
      last7Days
    ] = await Promise.all([
      User.countDocuments(),
      Service.countDocuments(),
      Provider.countDocuments(),
      User.countDocuments({ role: 'customer' }),
      Service.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Service.countDocuments({
        status: 'completed',
        updatedAt: { $gte: startOfToday, $lte: endOfToday }
      }),
      Service.aggregate([
        {
          $match: {
            status: 'completed',
            updatedAt: { $gte: startOfToday, $lte: endOfToday }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ['$finalPrice', '$basePrice'] } }
          }
        }
      ]),
      Service.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ['$finalPrice', '$basePrice'] } }
          }
        }
      ]),
      Service.distinct('provider', { status: { $in: ['assigned', 'in_progress'] }, provider: { $ne: null } }),
      Service.distinct('customer', { customer: { $ne: null } }),
      Service.distinct('customer', {
        customer: { $ne: null },
        createdAt: { $gte: startOfToday, $lte: endOfToday }
      }),
      Service.aggregate([
        {
          $group: {
            _id: '$serviceType',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]),
      Service.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: '$serviceType',
            completed: { $sum: 1 }
          }
        }
      ]),
      Service.aggregate([
        {
          $match: {
            createdAt: { $gte: sevenDaysAgo, $lte: endOfToday }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            bookings: { $sum: 1 },
            completed: {
              $sum: {
                $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
              }
            }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ])
    ]);

    const completedMap = new Map(serviceTypeCompleted.map((row) => [row._id, row.completed]));
    const demand = serviceTypeDemand.map((row) => ({
      serviceType: row._id || 'Other',
      bookings: row.count,
      completed: completedMap.get(row._id) || 0
    }));

    const revenueToday = todayRevenueAgg[0]?.total || 0;
    const totalRevenue = totalRevenueAgg[0]?.total || 0;

    const trend = last7Days.map((row) => {
      const y = row._id.year;
      const m = String(row._id.month).padStart(2, '0');
      const d = String(row._id.day).padStart(2, '0');
      return {
        date: `${y}-${m}-${d}`,
        bookings: row.bookings,
        completed: row.completed
      };
    });

    res.json({
      totals: {
        users: totalUsers,
        services: totalServices,
        providers: totalProviders,
        customers: totalCustomers
      },
      activity: {
        activeProfessionals: activeProfessionalsIds.length,
        customersUsedPlatform: customersUsedIds.length,
        customersToday: customersTodayIds.length,
        servicesCompletedToday: todayCompletedServices
      },
      earnings: {
        today: revenueToday,
        total: totalRevenue
      },
      byStatus: serviceStatus,
      demand,
      trend
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load analytics' });
  }
});

module.exports = router;

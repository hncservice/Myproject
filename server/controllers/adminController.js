// server/controllers/adminController.js
const bcrypt = require('bcrypt');
const Joi = require('joi');
const ExcelJS = require('exceljs');

const mongoose = require('mongoose');

const Vendor = require('../models/Vendor');
const WheelItem = require('../models/WheelItem');
const Spin = require('../models/Spin');
const User = require('../models/User');

const normalizeEmail = (email) => (email || '').trim().toLowerCase();
const trimStr = (v) => (typeof v === 'string' ? v.trim() : v);

const vendorSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});
const vendorUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).optional().allow('', null)
});
const wheelItemSchema = Joi.object({
  title: Joi.string().min(1).max(100).required(),
  description: Joi.string().allow('', null),
  imageUrl: Joi.string().uri().allow('', null),
  probabilityWeight: Joi.number().min(0).required(),
  quantityTotal: Joi.number().integer().min(0).allow(null),
  isActive: Joi.boolean().optional()
});

// VENDORS
exports.createVendor = async (req, res) => {
  try {
    const { error } = vendorSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    let { name, email, password } = req.body;
    name = trimStr(name);
    email = normalizeEmail(email);

    const existing = await Vendor.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Vendor email already used' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const vendor = await Vendor.create({
      name,
      email,
      passwordHash,
      createdByAdminId: req.admin._id
    });

    return res.status(201).json({
      id: vendor._id,
      name: vendor.name,
      email: vendor.email
    });
  } catch (err) {
    console.error('createVendor error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.listVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find().select('name email createdAt');
    return res.json(vendors);
  } catch (err) {
    console.error('listVendors error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
exports.updateVendor = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate body
    const { error, value } = vendorUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    let { name, email, password } = value;
    name = trimStr(name);
    email = normalizeEmail(email);

    // Check vendor exists
    const vendor = await Vendor.findById(id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Check if email is used by another vendor
    const existing = await Vendor.findOne({ email, _id: { $ne: id } });
    if (existing) {
      return res.status(400).json({ message: 'Vendor email already used' });
    }

    vendor.name = name;
    vendor.email = email;

    // If password provided, update hash
    if (password && password.trim().length > 0) {
      const passwordHash = await bcrypt.hash(password, 10);
      vendor.passwordHash = passwordHash;
    }

    await vendor.save();

    return res.json({
      id: vendor._id,
      name: vendor.name,
      email: vendor.email
    });
  } catch (err) {
    console.error('updateVendor error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// WHEEL ITEMS
exports.createWheelItem = async (req, res) => {
  try {
    const { error, value } = wheelItemSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const item = await WheelItem.create(value);
    return res.status(201).json(item);
  } catch (err) {
    console.error('createWheelItem error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.updateWheelItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = wheelItemSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const item = await WheelItem.findByIdAndUpdate(id, value, { new: true });
    if (!item) {
      return res.status(404).json({ message: 'Wheel item not found' });
    }

    return res.json(item);
  } catch (err) {
    console.error('updateWheelItem error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteWheelItem = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await WheelItem.findById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Wheel item not found' });
    }

    await existing.deleteOne();
    return res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('deleteWheelItem error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.listWheelItems = async (req, res) => {
  try {
    const items = await WheelItem.find().sort('createdAt');
    return res.json(items);
  } catch (err) {
    console.error('listWheelItems error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// REPORT EXPORT
exports.exportReport = async (req, res) => {
  try {
    const spins = await Spin.find()
      .populate('userId')
      .populate('wheelItemId')
      .populate('redeemedByVendorId');

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Spins');

    sheet.columns = [
      { header: 'User Name', key: 'userName', width: 20 },
      { header: 'User Email', key: 'userEmail', width: 25 },
      { header: 'User Phone',      key: 'userPhone',  width: 18 },
      { header: 'Prize', key: 'prize', width: 25 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Redemption Status', key: 'redemptionStatus', width: 18 },
      { header: 'Vendor', key: 'vendorName', width: 20 },
      { header: 'Spun At', key: 'spunAt', width: 25 },
      { header: 'Redeemed At', key: 'redeemedAt', width: 25 }
    ];

    spins.forEach((s) => {
      sheet.addRow({
        userName: s.userId?.name || '',
        userEmail: s.userId?.email || '',
        userPhone: s.userId?.phone || '',
        prize: s.wheelItemId?.title || '',
        status: s.status,
        redemptionStatus: s.redemptionStatus || '',
        vendorName: s.redeemedByVendorId?.name || '',
        spunAt: s.spunAt,
        redeemedAt: s.redeemedAt || ''
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="spin_report.xlsx"');

    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    console.error('exportReport error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};


// STATS / DASHBOARD DATA
exports.getReportStats = async (req, res) => {
  try {
    // Basic counts (all-time)
    const totalSpins = await Spin.countDocuments();
    const uniqueUsers = await Spin.distinct('userId').then((ids) => ids.length);

    const totalPrizesWon = await Spin.countDocuments({
      wheelItemId: { $ne: null }
    });

    // Be forgiving with redemption status casing
    const redeemedCount = await Spin.countDocuments({
      redemptionStatus: { $in: ['redeemed', 'Redeemed'] }
    });

    const pendingCount = await Spin.countDocuments({
      redemptionStatus: { $in: ['pending', 'Pending'] }
    });

    // DAILY SPINS – use all-time, fallback to createdAt if spunAt is missing
    const dailyAgg = await Spin.aggregate([
      {
        $addFields: {
          effectiveDate: {
            $ifNull: ['$spunAt', '$createdAt']
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$effectiveDate' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    let dailySpins = dailyAgg.map((d) => ({
      date: d._id,
      count: d.count
    }));

    

    // TOP PRIZES BY WINS
    const topAgg = await Spin.aggregate([
      { $match: { wheelItemId: { $ne: null } } },
      {
        $group: {
          _id: '$wheelItemId',
          wins: { $sum: 1 }
        }
      },
      { $sort: { wins: -1 } },
      { $limit: 5 }
    ]);

    const wheelItemsMap = {};
    if (topAgg.length) {
      const ids = topAgg.map((t) => t._id);
      const items = await WheelItem.find({ _id: { $in: ids } }).select('title');
      items.forEach((i) => {
        wheelItemsMap[i._id.toString()] = i.title;
      });
    }

    const topPrizes = topAgg.map((t) => ({
      title: wheelItemsMap[t._id.toString()] || 'Unknown prize',
      wins: t.wins
    }));

    return res.json({
      totalSpins,
      uniqueUsers,
      totalPrizesWon,
      redeemedCount,
      pendingCount,
      dailySpins,
      topPrizes
    });
  } catch (err) {
    console.error('getReportStats error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};



const pick = (obj, keys) =>
  keys.reduce((acc, k) => (obj?.[k] !== undefined ? (acc[k] = obj[k], acc) : acc), {});

exports.listUsers = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(5, Number(req.query.limit || 20)));
    const q = String(req.query.q || '').trim();
    const emailVerified = req.query.emailVerified;

    const filter = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
      ];
    }
    if (emailVerified === 'true') filter.emailVerified = true;
    if (emailVerified === 'false') filter.emailVerified = false;

    const [items, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('name email phone emailVerified monkeyAttempts monkeyLocked hasSpun createdAt updatedAt'),
      User.countDocuments(filter),
    ]);

    res.json({
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      items,
    });
  } catch (err) {
    console.error('admin listUsers error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid user id' });

    const user = await User.findById(id).select(
      'name email phone emailVerified monkeyAttempts monkeyLocked hasSpun monkeyActiveSession createdAt updatedAt'
    );
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (err) {
    console.error('admin getUser error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createUser = async (req, res) => {
  try {
    const data = pick(req.body, ['name', 'email', 'phone', 'password', 'emailVerified']);
    if (!data.name || data.name.trim().length < 2) return res.status(400).json({ message: 'Name is required' });
    if (!data.email) return res.status(400).json({ message: 'Email is required' });
    if (!data.phone) return res.status(400).json({ message: 'Phone is required' });
    if (!data.password || String(data.password).length < 6) return res.status(400).json({ message: 'Password min 6 chars' });

    const email = String(data.email).trim().toLowerCase();
    const phone = String(data.phone).trim();
    const name = String(data.name).trim();

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already exists' });

    const passwordHash = await bcrypt.hash(String(data.password), 10);

    const user = await User.create({
      name,
      email,
      phone,
      passwordHash,
      emailVerified: data.emailVerified === true,
    });

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    });
  } catch (err) {
    console.error('admin createUser error:', err);
    if (err.code === 11000) return res.status(400).json({ message: 'Duplicate key (email/phone)' });
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid user id' });

    const updates = pick(req.body, [
      'name',
      'phone',
      'emailVerified',
      'monkeyAttempts',
      'monkeyLocked',
      'hasSpun',
      'password', // optional reset
    ]);

    // Optional password reset
    if (updates.password !== undefined) {
      if (String(updates.password).length < 6) {
        return res.status(400).json({ message: 'Password min 6 chars' });
      }
      updates.passwordHash = await bcrypt.hash(String(updates.password), 10);
      delete updates.password;
    }

    if (updates.name !== undefined) updates.name = String(updates.name).trim();
    if (updates.phone !== undefined) updates.phone = String(updates.phone).trim();

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    ).select('name email phone emailVerified monkeyAttempts monkeyLocked hasSpun updatedAt');

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (err) {
    console.error('admin updateUser error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid user id' });

    const user = await User.findByIdAndDelete(id).select('email');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ ok: true, deletedEmail: user.email });
  } catch (err) {
    console.error('admin deleteUser error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
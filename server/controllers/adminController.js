// server/controllers/adminController.js
const bcrypt = require('bcrypt');
const Joi = require('joi');
const ExcelJS = require('exceljs');

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

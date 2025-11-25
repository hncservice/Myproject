// server/controllers/adminController.js
const bcrypt = require('bcrypt');
const Joi = require('joi');
const ExcelJS = require('exceljs');

const Vendor = require('../models/Vendor');
const WheelItem = require('../models/WheelItem');
const Spin = require('../models/Spin');
const User = require('../models/User');

const vendorSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const wheelItemSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().allow('', null),
  imageUrl: Joi.string().allow('', null),
  probabilityWeight: Joi.number().min(0).required(),
  quantityTotal: Joi.number().allow(null)
});

// VENDORS
exports.createVendor = async (req, res) => {
  try {
    const { error } = vendorSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { name, email, password } = req.body;
    const existing = await Vendor.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Vendor email already used' });

    const passwordHash = await bcrypt.hash(password, 10);

    const vendor = await Vendor.create({
      name,
      email,
      passwordHash,
      createdByAdminId: req.admin._id
    });

    res.status(201).json({
      id: vendor._id,
      name: vendor.name,
      email: vendor.email
    });
  } catch (err) {
    console.error('createVendor error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.listVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find().select('name email createdAt');
    res.json(vendors);
  } catch (err) {
    console.error('listVendors error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// WHEEL ITEMS
exports.createWheelItem = async (req, res) => {
  try {
    const { error } = wheelItemSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const item = await WheelItem.create(req.body);
    res.status(201).json(item);
  } catch (err) {
    console.error('createWheelItem error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateWheelItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = wheelItemSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const item = await WheelItem.findByIdAndUpdate(id, req.body, { new: true });
    if (!item) return res.status(404).json({ message: 'Wheel item not found' });

    res.json(item);
  } catch (err) {
    console.error('updateWheelItem error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteWheelItem = async (req, res) => {
  try {
    const { id } = req.params;
    await WheelItem.findByIdAndDelete(id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('deleteWheelItem error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.listWheelItems = async (req, res) => {
  try {
    const items = await WheelItem.find();
    res.json(items);
  } catch (err) {
    console.error('listWheelItems error:', err);
    res.status(500).json({ message: 'Server error' });
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
      { header: 'Redemption Status', key: 'redemptionStatus', width: 15 },
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
        redemptionStatus: s.redemptionStatus,
        vendorName: s.redeemedByVendorId?.name || '',
        spunAt: s.spunAt,
        redeemedAt: s.redeemedAt
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="spin_report.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('exportReport error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

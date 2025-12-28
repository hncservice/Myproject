// server/controllers/vendorController.js
const Joi = require('joi');
const Spin = require('../models/Spin');
const WheelItem = require('../models/WheelItem');
const User = require('../models/User');
const { sendRedemptionEmail } = require('../services/emailService');
const ExcelJS = require('exceljs');

const scanSchema = Joi.object({
  qrToken: Joi.string().trim().required()
});

exports.scanQr = async (req, res) => {
  try {
    const { error } = scanSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { qrToken } = req.body;
    const vendor = req.vendor;

    const spin = await Spin.findOne({ qrToken })
      .populate('wheelItemId')
      .populate('userId');

    if (!spin) {
      return res.status(404).json({ message: 'Invalid QR code' });
    }

    if (spin.redemptionStatus === 'redeemed') {
      return res.status(400).json({ message: 'Prize already redeemed' });
    }

    if (spin.qrExpiry && spin.qrExpiry < new Date()) {
      return res.status(400).json({ message: 'QR code expired' });
    }

    // Mark redeemed
    spin.redemptionStatus = 'redeemed';
    spin.redeemedByVendorId = vendor._id;
    spin.redeemedAt = new Date();
    await spin.save();

    const user = spin.userId;
    const prizeTitle = spin.wheelItemId ? spin.wheelItemId.title : 'Prize';

    // Notify user
    try {
      await sendRedemptionEmail({
        to: user.email,
        userName: user.name,
        prizeTitle,
        vendorName: vendor.name
      });
    } catch (emailErr) {
      console.warn('sendRedemptionEmail failed:', emailErr.message);
      // do NOT fail redemption because email failed
    }

    return res.json({
      message: 'Prize redeemed successfully',
      prize: prizeTitle,
      user: { name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('scanQr error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.getVendorDashboard = async (req, res) => {
  try {
    const vendorId = req.vendor?._id;
    if (!vendorId) return res.status(401).json({ message: 'Not authorized' });

    const days = Math.max(1, Math.min(365, Number(req.query.days || 30)));
    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 10)));

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalRedeemed, redeemedLastNDays, recent, topAgg] = await Promise.all([
      Spin.countDocuments({ redeemedByVendorId: vendorId, redemptionStatus: 'redeemed' }),
      Spin.countDocuments({
        redeemedByVendorId: vendorId,
        redemptionStatus: 'redeemed',
        redeemedAt: { $gte: since },
      }),
      Spin.find({ redeemedByVendorId: vendorId, redemptionStatus: 'redeemed' })
        .sort({ redeemedAt: -1 })
        .limit(limit)
        .populate('wheelItemId', 'title')
        .populate('userId', 'name email phone')
        .select('redeemedAt wheelItemId userId'),
      Spin.aggregate([
        { $match: { redeemedByVendorId: vendorId, redemptionStatus: 'redeemed' } },
        { $group: { _id: '$wheelItemId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    // Resolve wheel titles for top prizes
    const ids = topAgg.map((x) => x._id).filter(Boolean);
    let titlesMap = {};
    if (ids.length) {
      const WheelItem = require('../models/WheelItem');
      const items = await WheelItem.find({ _id: { $in: ids } }).select('title');
      items.forEach((i) => (titlesMap[i._id.toString()] = i.title));
    }

    const topPrizes = topAgg.map((t) => ({
      wheelItemId: t._id,
      title: titlesMap[String(t._id)] || 'Unknown',
      count: t.count,
    }));

    const recentRedemptions = recent.map((r) => ({
      id: r._id,
      redeemedAt: r.redeemedAt,
      prize: r.wheelItemId?.title || 'Prize',
      user: {
        name: r.userId?.name || '',
        email: r.userId?.email || '',
        phone: r.userId?.phone || '',
      },
    }));

    return res.json({
      totals: { totalRedeemed, redeemedLastNDays, days },
      recentRedemptions,
      topPrizes,
    });
  } catch (err) {
    console.error('getVendorDashboard error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ✅ GET /api/vendor/reports/export?days=30
exports.exportVendorRedemptions = async (req, res) => {
  try {
    const vendorId = req.vendor?._id;
    if (!vendorId) return res.status(401).json({ message: 'Not authorized' });

    const daysRaw = req.query.days;
    const days = daysRaw ? Math.max(1, Math.min(3650, Number(daysRaw))) : null; // null = all time
    const since = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;

    const filter = {
      redeemedByVendorId: vendorId,
      redemptionStatus: 'redeemed',
      ...(since ? { redeemedAt: { $gte: since } } : {}),
    };

    const spins = await Spin.find(filter)
      .sort({ redeemedAt: -1 })
      .populate('wheelItemId', 'title')
      .populate('userId', 'name email phone')
      .select('redeemedAt qrToken wheelItemId userId');

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Vendor Redemptions');

    sheet.columns = [
      { header: 'Redeemed At', key: 'redeemedAt', width: 22 },
      { header: 'Prize', key: 'prize', width: 26 },
      { header: 'User Name', key: 'userName', width: 20 },
      { header: 'User Email', key: 'userEmail', width: 28 },
      { header: 'User Phone', key: 'userPhone', width: 18 },
      { header: 'QR Token', key: 'qrToken', width: 34 },
    ];

    spins.forEach((s) => {
      sheet.addRow({
        redeemedAt: s.redeemedAt ? new Date(s.redeemedAt).toISOString().replace('T', ' ').slice(0, 19) : '',
        prize: s.wheelItemId?.title || '',
        userName: s.userId?.name || '',
        userEmail: s.userId?.email || '',
        userPhone: s.userId?.phone || '',
        qrToken: s.qrToken || '',
      });
    });

    sheet.getRow(1).font = { bold: true };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="vendor_redemptions${days ? `_last_${days}_days` : ''}.xlsx"`
    );

    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    console.error('exportVendorRedemptions error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
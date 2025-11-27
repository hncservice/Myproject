// server/controllers/vendorController.js
const Joi = require('joi');
const Spin = require('../models/Spin');
const WheelItem = require('../models/WheelItem');
const User = require('../models/User');
const { sendRedemptionEmail } = require('../services/emailService');

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

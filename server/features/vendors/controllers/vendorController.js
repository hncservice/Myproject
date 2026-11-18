
'use strict';

const Joi = require('joi');
const { errorMetadata } = require('../../../infrastructure/logging/errorMetadata');
const Spin = require('../../games/models/Spin');
const WheelItem = require('../../prizes/models/WheelItem');
const ExcelJS = require('exceljs');
const { safeExcelText } = require('../../../infrastructure/reporting/reportSafety');

const {
  sendRedemptionEmail,
} = require('../../../infrastructure/email/emailService');

const {
  redeemPrize,
} = require('../../prizes/services/prizeRedemptionService');

// ============================================
// VALIDATION
// ============================================

const scanSchema = Joi.object({
  qrToken: Joi.string()
    .trim()
    .pattern(/^(?:[a-fA-F0-9]{32}|[a-fA-F0-9]{64})$/)
    .required(),
}).required();

// ============================================
// SECURE QR REDEMPTION
// POST /api/vendor/scan
// ============================================

exports.scanQr = async (req, res) => {
  try {
    const { error, value } = scanSchema.validate(
      req.body
    );

    if (error) {
      return res.status(400).json({
        message: 'Invalid QR code format',
      });
    }

    const vendorId = req.vendor?._id;
const tokenVersion = req.vendorTokenVersion;

if (
  !vendorId ||
  !Number.isSafeInteger(tokenVersion) ||
  tokenVersion < 0
) {
  return res.status(401).json({
    code: 'UNAUTHORIZED_VENDOR',
    message: 'Vendor authorization required',
  });
}

const result = await redeemPrize({
  qrToken: value.qrToken,
  vendorId,
  tokenVersion,
});

    // Redemption committed successfully.
    // Email failure must not reverse redemption.
    try {
      await sendRedemptionEmail({
        to: result.user.email,
        userName: result.user.name,
        prizeTitle: result.prize,
        vendorName: result.vendorName,
      });
    } catch (emailError) {
      console.error(
        'Redemption email failed:',
        errorMetadata(emailError)
      );
    }

    return res.status(200).json({
      message: 'Prize redeemed successfully',
      prize: result.prize,
      user: result.user,
      redeemedAt: result.redeemedAt,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        code: err.code,
        message: err.message,
      });
    }

    if (
      err.code === 112 ||
      err.codeName === 'WriteConflict' ||
      err.hasErrorLabel?.('TransientTransactionError')
    ) {
      return res.status(409).json({
        code: 'REDEMPTION_CONFLICT',
        message:
          'Prize is being processed. Please verify its status.',
      });
    }

    console.error('scanQr error:', errorMetadata(err));

    return res.status(500).json({
      message: 'Server error',
    });
  }
};

// ============================================
// VENDOR DASHBOARD
// GET /api/vendor/dashboard
// ============================================

exports.getVendorDashboard = async (req, res) => {
  try {
    const vendorId = req.vendor?._id;

    if (!vendorId) {
      return res.status(401).json({
        message: 'Not authorized',
      });
    }

    const { error, value } = Joi.object({ days: Joi.number().integer().min(1).max(365).default(30), limit: Joi.number().integer().min(1).max(50).default(10) }).unknown(false).validate(req.query || {});
    if (error) return res.status(400).json({ code: 'INVALID_REPORT_QUERY', message: 'Invalid dashboard parameters' });
    const { days, limit } = value;

    const since = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000
    );

    const [
      totalRedeemed,
      redeemedLastNDays,
      recent,
      topAgg,
    ] = await Promise.all([
      Spin.countDocuments({
        redeemedByVendorId: vendorId,
        redemptionStatus: 'redeemed',
      }),

      Spin.countDocuments({
        redeemedByVendorId: vendorId,
        redemptionStatus: 'redeemed',
        redeemedAt: { $gte: since },
      }),

      Spin.find({
        redeemedByVendorId: vendorId,
        redemptionStatus: 'redeemed',
      })
        .sort({ redeemedAt: -1 })
        .limit(limit)
        .populate('wheelItemId', 'title')
        .populate('userId', 'name email phone')
        .select('redeemedAt wheelItemId userId'),

      Spin.aggregate([
        {
          $match: {
            redeemedByVendorId: vendorId,
            redemptionStatus: 'redeemed',
          },
        },
        {
          $group: {
            _id: '$wheelItemId',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $limit: 5,
        },
      ]),
    ]);

    // Resolve titles for top redeemed prizes.
    const ids = topAgg
      .map((item) => item._id)
      .filter(Boolean);

    const titlesMap = {};

    if (ids.length) {
      const items = await WheelItem.find({
        _id: { $in: ids },
      }).select('title');

      items.forEach((item) => {
        titlesMap[String(item._id)] = item.title;
      });
    }

    const topPrizes = topAgg.map((item) => ({
      wheelItemId: item._id,
      title:
        titlesMap[String(item._id)] || 'Unknown',
      count: item.count,
    }));

    const recentRedemptions = recent.map(
      (item) => ({
        id: item._id,
        redeemedAt: item.redeemedAt,
        prize:
          item.wheelItemId?.title || 'Prize',
        user: {
          name: item.userId?.name || '',
          email: item.userId?.email || '',
          phone: item.userId?.phone || '',
        },
      })
    );

    return res.json({
      totals: {
        totalRedeemed,
        redeemedLastNDays,
        days,
      },
      recentRedemptions,
      topPrizes,
    });
  } catch (err) {
    console.error(
      'getVendorDashboard error:',
      errorMetadata(err)
    );

    return res.status(500).json({
      message: 'Server error',
    });
  }
};

// ============================================
// VENDOR REDEMPTION REPORT
// GET /api/vendor/reports/export
// ============================================

exports.exportVendorRedemptions = async (
  req,
  res
) => {
  try {
    const vendorId = req.vendor?._id;

    if (!vendorId) {
      return res.status(401).json({
        message: 'Not authorized',
      });
    }

    const { error, value } = Joi.object({ days: Joi.number().integer().min(1).max(3650).optional() }).unknown(false).validate(req.query || {});
    if (error) return res.status(400).json({ code: 'INVALID_REPORT_QUERY', message: 'Invalid export parameters' });
    const days = value.days ?? null;

    const since = days
      ? new Date(
          Date.now() -
            days * 24 * 60 * 60 * 1000
        )
      : null;

    const filter = {
      redeemedByVendorId: vendorId,
      redemptionStatus: 'redeemed',
      ...(since
        ? {
            redeemedAt: {
              $gte: since,
            },
          }
        : {}),
    };

    const MAX_ROWS = 5000;
    if (await Spin.countDocuments(filter) > MAX_ROWS) return res.status(413).json({ code: 'EXPORT_LIMIT_EXCEEDED', message: 'Report exceeds 5000 records. Use a shorter period.' });
    const spins = await Spin.find(filter)
      .sort({ redeemedAt: -1 })
      .populate('wheelItemId', 'title')
      .populate('userId', 'name email phone')
      .select('redeemedAt wheelItemId userId').limit(MAX_ROWS + 1);
    if (spins.length > MAX_ROWS) return res.status(413).json({ code: 'EXPORT_LIMIT_EXCEEDED', message: 'Report exceeds 5000 records. Use a shorter period.' });

    const workbook = new ExcelJS.Workbook();

    const sheet = workbook.addWorksheet(
      'Vendor Redemptions'
    );

    sheet.columns = [
      {
        header: 'Redeemed At',
        key: 'redeemedAt',
        width: 22,
      },
      {
        header: 'Prize',
        key: 'prize',
        width: 26,
      },
      {
        header: 'User Name',
        key: 'userName',
        width: 20,
      },
      {
        header: 'User Email',
        key: 'userEmail',
        width: 28,
      },
      {
        header: 'User Phone',
        key: 'userPhone',
        width: 18,
      },
      {
        header: 'Redemption ID',
        key: 'redemptionId',
        width: 28,
      },
    ];

    spins.forEach((spin) => {
      sheet.addRow({
        redeemedAt: spin.redeemedAt
          ? new Date(spin.redeemedAt)
              .toISOString()
              .replace('T', ' ')
              .slice(0, 19)
          : '',

        prize:
          safeExcelText(spin.wheelItemId?.title),

        userName:
          safeExcelText(spin.userId?.name),

        userEmail:
          safeExcelText(spin.userId?.email),

        userPhone:
          safeExcelText(spin.userId?.phone),

        redemptionId: String(spin._id),
      });
    });

    sheet.getRow(1).font = {
      bold: true,
    };

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="vendor_redemptions${
        days ? `_last_${days}_days` : ''
      }.xlsx"`
    );

    return res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    console.error(
      'exportVendorRedemptions error:',
      errorMetadata(err)
    );

    if (!res.headersSent) {
      return res.status(500).json({
        message: 'Server error',
      });
    }

    return res.end();
  }
};

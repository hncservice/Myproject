// server/controllers/adminController.js
const bcrypt = require('bcrypt');
const Joi = require('joi');
const ExcelJS = require('exceljs');
const { errorMetadata } = require('../../../infrastructure/logging/errorMetadata');

const mongoose = require('mongoose');

const Vendor = require('../../vendors/models/Vendor');
const WheelItem = require('../../prizes/models/WheelItem');
const Spin = require('../../games/models/Spin');
const User = require('../../authentication/models/User');
const AdminAuditLog = require('../models/AdminAuditLog');
const { claimAdminReviewFence } = require('../../prizes/services/prizeReviewService');
const { safeExcelText } = require('../../../infrastructure/reporting/reportSafety');
const claimAdmin = (req, session) => claimAdminReviewFence({ adminId: req.admin?._id, adminTokenVersion: req.adminTokenVersion, session });

const normalizeEmail = (email) => (email || '').trim().toLowerCase();
const trimStr = (v) => (typeof v === 'string' ? v.trim() : v);

const vendorSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(6).custom((value, helpers) => Buffer.byteLength(value, 'utf8') <= 72 ? value : helpers.error('any.invalid')).required()
});
const vendorUpdateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(6).custom((value, helpers) => Buffer.byteLength(value, 'utf8') <= 72 ? value : helpers.error('any.invalid')).optional().allow('', null),
  isActive: Joi.boolean().optional(),
  revokeSessions: Joi.boolean().optional()
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

    let vendor;
    await mongoose.connection.transaction(async session => {
      await claimAdmin(req, session);
      [vendor] = await Vendor.create([{ name, email, passwordHash, createdByAdminId: req.admin._id }], { session });
      await AdminAuditLog.create([{ adminId: req.admin._id, action: 'VENDOR_CREATED', targetType: 'Vendor', targetId: vendor._id, details: { changedFields: ['name', 'email'], sessionsRevoked: false } }], { session });
    }, { readPreference: 'primary', readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });

    return res.status(201).json({
      id: vendor._id,
      name: vendor.name,
      email: vendor.email
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ code: err.code, message: err.message });
    if (err.code === 11000) return res.status(409).json({ message: 'Vendor email already used' });
    console.error('createVendor error:', errorMetadata(err));
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.listVendors = async (req, res) => {
  try {
    if (Object.keys(req.query || {}).length === 0) return res.json(await Vendor.find().select('name email createdAt isActive'));
    const { error, value } = Joi.object({ page: Joi.number().integer().min(1).max(100000).default(1), limit: Joi.number().integer().min(1).max(50).default(20),
      q: Joi.string().trim().max(100).allow('').default(''), active: Joi.string().valid('all', 'true', 'false').default('all'), sort: Joi.string().valid('name', 'newest').default('newest') }).unknown(false).validate(req.query);
    if (error) return res.status(400).json({ code: 'INVALID_VENDOR_QUERY', message: 'Invalid vendor search parameters' });
    const filter = {};
    if (value.q) { const escaped = value.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); filter.$or = [{ name: { $regex: escaped, $options: 'i' } }, { email: { $regex: escaped, $options: 'i' } }]; }
    if (value.active !== 'all') filter.isActive = value.active === 'true' ? { $ne: false } : false;
    const [items, total] = await Promise.all([Vendor.find(filter).select('name email createdAt isActive').sort(value.sort === 'name' ? { name: 1, _id: 1 } : { createdAt: -1, _id: -1 }).skip((value.page - 1) * value.limit).limit(value.limit).lean(), Vendor.countDocuments(filter)]);
    return res.json({ items, total, page: value.page, pages: Math.max(1, Math.ceil(total / value.limit)) });
  } catch (err) {
    console.error('listVendors error:', errorMetadata(err));
    return res.status(500).json({ message: 'Server error' });
  }
};
exports.updateVendor = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: 'Invalid vendor ID',
      });
    }

    if (!mongoose.isValidObjectId(req.admin?._id)) {
      return res.status(403).json({
        message: 'Administrator identity required',
      });
    }

    const { error, value } =
      vendorUpdateSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        message: error.details[0].message,
      });
    }

    const name = trimStr(value.name);
    const email = normalizeEmail(value.email);
    const password = value.password;

    const changingPassword =
      typeof password === 'string' &&
      password.trim().length > 0;

    // Hash before entering the transaction.
    const newPasswordHash = changingPassword
      ? await bcrypt.hash(password, 10)
      : null;

    let updatedVendor = null;

    await mongoose.connection.transaction(
      async session => {
        await claimAdmin(req, session);
        const vendor = await Vendor.findById(id)
          .session(session);

        if (!vendor) {
          throw Object.assign(
            new Error('Vendor not found'),
            { status: 404 }
          );
        }

        const existing = await Vendor.findOne({
          email,
          _id: { $ne: vendor._id },
        }).session(session);

        if (existing) {
          throw Object.assign(
            new Error('Vendor email already used'),
            { status: 409 }
          );
        }

        const oldName = vendor.name;
        const oldEmail = vendor.email;
        const oldActive = vendor.isActive !== false;
        const changingActive = value.isActive !== undefined && value.isActive !== oldActive;
        const revoke = changingPassword || changingActive || value.revokeSessions === true;

        const oldTokenVersion =
          vendor.tokenVersion ?? 0;

        if (
          !Number.isSafeInteger(oldTokenVersion) ||
          oldTokenVersion < 0 ||
          (
            revoke &&
            oldTokenVersion >= Number.MAX_SAFE_INTEGER
          )
        ) {
          throw Object.assign(
            new Error('Vendor account requires review'),
            { status: 409 }
          );
        }

        vendor.name = name;
        vendor.email = email;

        if (changingPassword) {
          vendor.passwordHash = newPasswordHash;
        }
        if (changingActive) { vendor.isActive = value.isActive; vendor.disabledAt = value.isActive ? null : new Date(); }
        if (revoke) vendor.tokenVersion = oldTokenVersion + 1;

        await vendor.save({ session });

        // Save audit record in the same transaction.
        // No passwords or tokens are recorded.
        await AdminAuditLog.create(
          [{
            adminId: req.admin._id,
            action: 'VENDOR_UPDATED',
            targetType: 'Vendor',
            targetId: vendor._id,
            details: {
              changedFields: [
                ...(oldName !== vendor.name
                  ? ['name']
                  : []),
                ...(oldEmail !== vendor.email
                  ? ['email']
                  : []),
                ...(changingPassword
                  ? ['password']
                  : []),
                ...(changingActive ? ['isActive'] : []),
              ],
              sessionsRevoked: revoke,
            },
          }],
          { session }
        );

        updatedVendor = {
          id: vendor._id,
          name: vendor.name,
          email: vendor.email,
          isActive: vendor.isActive !== false,
        };
      },
      {
        readPreference: 'primary',
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
      }
    );

    return res.json(updatedVendor);

  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Vendor email already used',
      });
    }

    console.error('updateVendor error:', errorMetadata(error));

    return res.status(500).json({
      message: 'Vendor update failed',
    });
  }
};

// WHEEL ITEMS
exports.createWheelItem = async (req, res) => {
  try {
    const { error, value } = wheelItemSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    let item;
    await mongoose.connection.transaction(async session => {
      await claimAdmin(req, session);
      [item] = await WheelItem.create([value], { session });
      await AdminAuditLog.create([{ adminId: req.admin._id, action: 'WHEEL_ITEM_CREATED', targetType: 'WheelItem', targetId: item._id, details: { changedFields: Object.keys(value) } }], { session });
    }, { readPreference: 'primary', readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    return res.status(201).json(item);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ code: err.code, message: err.message });
    console.error('createWheelItem error:', { code: 'INVENTORY_CREATION_FAILED' });
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.updateWheelItem = async (req, res) => {
  try {
    const { id } = req.params;

    if (
      !mongoose.isValidObjectId(id) ||
      !mongoose.isValidObjectId(req.admin?._id)
    ) {
      return res.status(400).json({
        message: 'Invalid prize or administrator ID',
      });
    }

    const { error, value } =
      wheelItemSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        message: error.details[0].message,
      });
    }

    if (
      !Number.isSafeInteger(value.probabilityWeight) &&
      !Number.isFinite(value.probabilityWeight)
    ) {
      return res.status(400).json({
        message: 'Invalid probability weight',
      });
    }

    if (
      value.quantityTotal !== undefined &&
      value.quantityTotal !== null &&
      !Number.isSafeInteger(value.quantityTotal)
    ) {
      return res.status(400).json({
        message: 'Invalid inventory quantity',
      });
    }

    let updatedItem;

    await mongoose.connection.transaction(
      async session => {
        await claimAdmin(req, session);
        const item = await WheelItem.findById(id)
          .session(session);

        if (!item) {
          throw Object.assign(
            new Error('Wheel item not found'),
            { status: 404 }
          );
        }

        const allocated = item.quantityAllocated ?? 0;
        const redeemed = item.quantityRedeemed ?? 0;
        const existingTotal = item.quantityTotal;

        if (
          !Number.isSafeInteger(allocated) ||
          !Number.isSafeInteger(redeemed) ||
          allocated < 0 ||
          redeemed < 0 ||
          redeemed > allocated ||
          (
            existingTotal !== null &&
            (
              !Number.isSafeInteger(existingTotal) ||
              existingTotal < allocated
            )
          )
        ) {
          throw Object.assign(
            new Error(
              'Existing inventory requires reconciliation'
            ),
            {
              status: 409,
              code: 'INVENTORY_RECONCILIATION_REQUIRED',
            }
          );
        }

        const newTotal =
          value.quantityTotal === undefined
            ? existingTotal
            : value.quantityTotal;

        if (
          newTotal !== null &&
          newTotal < allocated
        ) {
          throw Object.assign(
            new Error(
              'Total inventory cannot be below allocated quantity'
            ),
            {
              status: 409,
              code: 'INVENTORY_BELOW_ALLOCATED',
            }
          );
        }

        const allowedFields = [
          'title',
          'description',
          'imageUrl',
          'probabilityWeight',
          'quantityTotal',
          'isActive',
        ];

        const changedFields = [];

        for (const field of allowedFields) {
          if (value[field] === undefined) continue;

          const before = item[field];
          const after = value[field];

          if (before !== after) {
            changedFields.push(field);
            item[field] = after;
          }
        }

        // Do not accept quantityAllocated or
        // quantityRedeemed through this endpoint.

        if (changedFields.length === 0) {
          updatedItem = item;
          return;
        }

        // Document save participates in the transaction.
        // Concurrent writes to the same inventory document
        // must not silently overwrite each other.
        await item.save({ session });

        await AdminAuditLog.create(
          [{
            adminId: req.admin._id,
            action: 'WHEEL_ITEM_UPDATED',
            targetType: 'WheelItem',
            targetId: item._id,
            details: {
              changedFields,
            },
          }],
          { session }
        );

        updatedItem = item;
      },
      {
        readPreference: 'primary',
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
      }
    );

    return res.json(updatedItem);

  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Duplicate prize configuration',
      });
    }

    console.error('updateWheelItem error:', errorMetadata(error));

    return res.status(500).json({
      message: 'Prize update failed',
    });
  }
};

exports.deleteWheelItem = async (req, res) => {
  try {
    const { id } = req.params;

    if (
      !mongoose.isValidObjectId(id) ||
      !mongoose.isValidObjectId(req.admin?._id)
    ) {
      return res.status(400).json({
        message: 'Invalid prize or administrator ID',
      });
    }

    let wasAlreadyInactive = false;

    await mongoose.connection.transaction(
      async session => {
        await claimAdmin(req, session);
        const item = await WheelItem.findById(id)
          .session(session);

        if (!item) {
          throw Object.assign(
            new Error('Wheel item not found'),
            { status: 404 }
          );
        }

        if (item.isActive === false) {
          wasAlreadyInactive = true;
          return;
        }

        item.isActive = false;

        await item.save({ session });

        await AdminAuditLog.create(
          [{
            adminId: req.admin._id,
            action: 'WHEEL_ITEM_DEACTIVATED',
            targetType: 'WheelItem',
            targetId: item._id,
            details: {
              changedFields: ['isActive'],
              reason: 'Administrator deactivation',
            },
          }],
          { session }
        );
      },
      {
        readPreference: 'primary',
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
      }
    );

    return res.json({
      ok: true,
      message: wasAlreadyInactive
        ? 'Prize already inactive'
        : 'Prize deactivated successfully',
      deleted: false,
    });

  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    console.error('deleteWheelItem error:', errorMetadata(error));

    return res.status(500).json({
      message: 'Prize deactivation failed',
    });
  }
};
exports.listWheelItems = async (req, res) => {
  try {
    const items = await WheelItem.find().sort('createdAt');
    return res.json(items);
  } catch (err) {
    console.error('listWheelItems error:', errorMetadata(err));
    return res.status(500).json({ message: 'Server error' });
  }
};

// REPORT EXPORT

exports.exportReport = async (req, res) => {
  try {
    const MAX_EXPORT_ROWS = 5000;

    // Reject unsupported query parameters.
    if (Object.keys(req.query || {}).length > 0) {
      return res.status(400).json({
        code: 'INVALID_EXPORT_QUERY',
        message: 'Unsupported report parameters',
      });
    }

    // Check row count before creating an Excel file.
    const total = await Spin.countDocuments();

    if (total > MAX_EXPORT_ROWS) {
      return res.status(413).json({
        code: 'EXPORT_LIMIT_EXCEEDED',
        message:
          'Report exceeds 5000 records. A filtered export is required.',
      });
    }

    // Explicit field selection avoids exporting
    // QR bearer tokens or unrelated sensitive fields.
    const spins = await Spin.find()
      .select(
        'userId wheelItemId status ' +
        'redemptionStatus redeemedByVendorId ' +
        'spunAt redeemedAt'
      )
      .populate({
        path: 'userId',
        select: 'name email phone',
      })
      .populate({
        path: 'wheelItemId',
        select: 'title',
      })
      .populate({
        path: 'redeemedByVendorId',
        select: 'name',
      })
      .sort({ createdAt: -1, _id: -1 })
      .limit(MAX_EXPORT_ROWS)
      .lean();

    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'HNC Game Platform';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Spins');

    sheet.columns = [
      { header: 'User Name', key: 'userName', width: 24 },
      { header: 'User Email', key: 'userEmail', width: 30 },
      { header: 'User Phone', key: 'userPhone', width: 20 },
      { header: 'Prize', key: 'prize', width: 30 },
      { header: 'Status', key: 'status', width: 16 },
      {
        header: 'Redemption Status',
        key: 'redemptionStatus',
        width: 22,
      },
      { header: 'Vendor', key: 'vendorName', width: 25 },
      { header: 'Spun At', key: 'spunAt', width: 23 },
      { header: 'Redeemed At', key: 'redeemedAt', width: 23 },
    ];

    for (const spin of spins) {
      sheet.addRow({
        userName: safeExcelText(spin.userId?.name),
        userEmail: safeExcelText(spin.userId?.email),
        userPhone: safeExcelText(spin.userId?.phone),
        prize: safeExcelText(spin.wheelItemId?.title),
        status: safeExcelText(spin.status),
        redemptionStatus: safeExcelText(
          spin.redemptionStatus
        ),
        vendorName: safeExcelText(
          spin.redeemedByVendorId?.name
        ),
        spunAt: spin.spunAt || null,
        redeemedAt: spin.redeemedAt || null,
      });
    }

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = {
      vertical: 'middle',
    };

    sheet.views = [
      { state: 'frozen', ySplit: 1 },
    ];

    sheet.autoFilter = {
      from: 'A1',
      to: 'I1',
    };

    sheet.getColumn('spunAt').numFmt =
      'dd mmm yyyy hh:mm';

    sheet.getColumn('redeemedAt').numFmt =
      'dd mmm yyyy hh:mm';

    // Create the file completely before starting
    // the HTTP response. This avoids sending a
    // partial XLSX if workbook generation fails.
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="spin_report.xlsx"'
    );

    res.setHeader(
      'Cache-Control',
      'no-store'
    );

    res.setHeader(
      'X-Content-Type-Options',
      'nosniff'
    );

    return res.status(200).send(Buffer.from(buffer));

  } catch (error) {
    console.error('exportReport error:', errorMetadata(error));

    return res.status(500).json({
      message: 'Report export failed',
    });
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
    console.error('getReportStats error:', errorMetadata(err));
    return res.status(500).json({ message: 'Server error' });
  }
};



const pick = (obj, keys) =>
  keys.reduce((acc, k) => (obj?.[k] !== undefined ? (acc[k] = obj[k], acc) : acc), {});


exports.listUsers = async (req, res) => {
  try {
    const querySchema = Joi.object({
      page: Joi.number()
        .integer()
        .min(1)
        .max(100000)
        .default(1),

      limit: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .default(20),

      q: Joi.string()
        .trim()
        .max(100)
        .allow('')
        .default(''),

      emailVerified: Joi.string()
        .valid('true', 'false')
        .optional(),
    }).unknown(false);

    const { error, value } = querySchema.validate(
      req.query,
      {
        convert: true,
        abortEarly: false,
      }
    );

    if (error) {
      return res.status(400).json({
        code: 'INVALID_SEARCH_QUERY',
        message: error.details[0].message,
      });
    }

    const { page, limit, q, emailVerified } = value;

    const filter = {};

    if (q) {
      // Treat search input as literal text, not regex.
      const escaped = q.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );

      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
      ];
    }

    if (emailVerified === 'true') {
      filter.emailVerified = true;
    } else if (emailVerified === 'false') {
      filter.emailVerified = false;
    }

    const skip = (page - 1) * limit;

    if (!Number.isSafeInteger(skip)) {
      return res.status(400).json({
        code: 'INVALID_PAGINATION',
        message: 'Pagination range is invalid',
      });
    }

    const [items, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          'name email phone emailVerified isActive ' +
          'monkeyAttempts monkeyLocked hasSpun ' +
          'createdAt updatedAt'
        )
        .lean(),

      User.countDocuments(filter),
    ]);

    return res.json({
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      items,
    });

  } catch (error) {
    console.error('admin listUsers error:', errorMetadata(error));

    return res.status(500).json({
      message: 'Customer search failed',
    });
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
    console.error('admin getUser error:', errorMetadata(err));
    res.status(500).json({ message: 'Server error' });
  }
};


exports.createUser = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.admin?._id)) {
      return res.status(403).json({
        message: 'Administrator required',
      });
    }

    const schema = Joi.object({
      name: Joi.string().trim().min(2).max(100).required(),
      email: Joi.string().email().required(),
      phone: Joi.string()
        .trim()
        .pattern(/^(\+974)?\s?\d{8}$/)
        .required(),
      password: Joi.string().min(6).custom((value, helpers) => Buffer.byteLength(value, 'utf8') <= 72 ? value : helpers.error('any.invalid')).required(),

      // Cannot bypass customer email verification.
      emailVerified: Joi.boolean()
        .valid(false)
        .optional(),
    }).unknown(false);

    const { error, value } = schema.validate(
      req.body
    );

    if (error) {
      return res.status(400).json({
        code: 'INVALID_CUSTOMER_CREATION',
        message: error.details[0].message,
      });
    }

    const email = value.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(
      value.password,
      10
    );

    let createdUser;

    await mongoose.connection.transaction(
      async session => {
        await claimAdmin(req, session);
        const existing = await User.findOne({
          $or: [
            { email },
            { phone: value.phone },
          ],
        }).session(session);

        if (existing) {
          throw Object.assign(
            new Error('Email or phone already registered'),
            { status: 409 }
          );
        }

        const documents = await User.create(
          [{
            name: value.name,
            email,
            phone: value.phone,
            passwordHash,
            emailVerified: false,
          }],
          { session }
        );

        createdUser = documents[0];

        await AdminAuditLog.create(
          [{
            adminId: req.admin._id,
            action: 'USER_CREATED',
            targetType: 'User',
            targetId: createdUser._id,
            details: {
              emailVerified: false,
              creationMethod: 'administrator',
            },
          }],
          { session }
        );
      },
      {
        readPreference: 'primary',
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
      }
    );

    return res.status(201).json({
      id: createdUser._id,
      name: createdUser.name,
      email: createdUser.email,
      phone: createdUser.phone,
      emailVerified: false,
      createdAt: createdUser.createdAt,
    });

  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Email or phone already registered',
      });
    }

    console.error('createUser error:', errorMetadata(error));

    return res.status(500).json({
      message: 'Customer creation failed',
    });
  }
};



exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (
      !mongoose.isValidObjectId(id) ||
      !mongoose.isValidObjectId(req.admin?._id)
    ) {
      return res.status(400).json({
        message: 'Invalid user or administrator ID',
      });
    }

    const schema = Joi.object({
      name: Joi.string()
        .trim()
        .min(2)
        .max(100),
      phone: Joi.string()
        .trim()
        .pattern(/^(\+974)?\s?\d{8}$/),
    }).min(1).unknown(false);

    const { error, value } =
      schema.validate(req.body, {
        abortEarly: false,
      });

    if (error) {
      return res.status(400).json({
        code: 'INVALID_PROFILE_UPDATE',
        message: error.details[0].message,
      });
    }

    let result;

    await mongoose.connection.transaction(
      async session => {
        await claimAdmin(req, session);
        const user = await User.findById(id)
          .session(session);

        if (!user) {
          throw Object.assign(
            new Error('User not found'),
            { status: 404 }
          );
        }

        const changedFields = [];

        for (const field of ['name', 'phone']) {
          if (
            value[field] !== undefined &&
            value[field] !== user[field]
          ) {
            user[field] = value[field];
            changedFields.push(field);
          }
        }

        if (changedFields.length === 0) {
          result = user;
          return;
        }

        await user.save({ session });

        await AdminAuditLog.create(
          [{
            adminId: req.admin._id,
            action: 'USER_PROFILE_UPDATED',
            targetType: 'User',
            targetId: user._id,
            details: {
              changedFields,
            },
          }],
          { session }
        );

        result = user;
      },
      {
        readPreference: 'primary',
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
      }
    );

    return res.json({
      id: result._id,
      name: result.name,
      email: result.email,
      phone: result.phone,
      emailVerified: result.emailVerified,
      monkeyAttempts: result.monkeyAttempts,
      monkeyLocked: result.monkeyLocked,
      hasSpun: result.hasSpun,
      updatedAt: result.updatedAt,
    });

  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        code: 'PHONE_ALREADY_REGISTERED',
        message: 'Phone number already in use',
      });
    }

    console.error('updateUser error:', errorMetadata(error));

    return res.status(500).json({
      message: 'Customer update failed',
    });
  }
};


exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        message: 'Invalid user ID',
      });
    }

    if (!mongoose.isObjectIdOrHexString(req.admin?._id)) {
      return res.status(403).json({
        message: 'Administrator required',
      });
    }

    const archived = await User.findOneAndUpdate(
      { _id: id, isActive: { $ne: false } },
      {
        $set: { isActive: false },
        $inc: { tokenVersion: 1 },
      },
      { new: true, runValidators: true, strict: 'throw' }
    ).select('_id isActive');

    if (archived) {
      return res.status(200).json({
        message: 'Customer archived successfully.',
        isActive: false,
      });
    }

    const alreadyArchived = await User.exists({
      _id: id,
      isActive: false,
    });

    if (alreadyArchived) {
      return res.status(200).json({
        message: 'Customer is already archived.',
        isActive: false,
      });
    }

    return res.status(404).json({
      message: 'User not found',
    });
  } catch (error) {
    console.error('deleteUser error:', errorMetadata(error));

    return res.status(500).json({
      message: 'Customer archive failed',
    });
  }
};
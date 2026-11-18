
'use strict';

const mongoose = require('mongoose');

const adminAuditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      required: true,
      immutable: true,
    },

    action: {
      type: String,
      required: true,
      immutable: true,
    },

    targetType: {
      type: String,
      required: true,
      immutable: true,
    },

    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },

    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      immutable: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    versionKey: false,
    strict: 'throw',
    collection: 'admin_audit_logs',
  }
);

adminAuditLogSchema.index({
  adminId: 1,
  createdAt: -1,
});

adminAuditLogSchema.index({
  targetType: 1,
  targetId: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  'AdminAuditLog',
  adminAuditLogSchema
);

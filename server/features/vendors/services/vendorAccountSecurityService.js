
'use strict';

const mongoose = require('mongoose');
const Vendor = require('../models/Vendor');

function validateVendorId(vendorId) {
  if (!mongoose.isObjectIdOrHexString(vendorId)) {
    throw Object.assign(
      new Error('Invalid vendor ID'),
      { status: 400, code: 'INVALID_VENDOR_ID' }
    );
  }
}

/**
 * Disable vendor and revoke all issued JWTs.
 * Must be invoked only by an authorized admin workflow.
 */
async function disableVendor(vendorId) {
  validateVendorId(vendorId);

  return Vendor.findOneAndUpdate(
    {
      _id: vendorId,
      isActive: { $ne: false },
    },
    {
      $set: {
        isActive: false,
        disabledAt: new Date(),
      },
      $inc: {
        tokenVersion: 1,
      },
    },
    { new: true }
  );
}

/**
 * Re-enable vendor.
 * Does not restore any previously issued tokens.
 */
async function enableVendor(vendorId) {
  validateVendorId(vendorId);

  return Vendor.findOneAndUpdate(
    { _id: vendorId },
    {
      $set: {
        isActive: true,
        disabledAt: null,
      },
      $inc: {
        tokenVersion: 1,
      },
    },
    { new: true }
  );
}

/**
 * Force logout on all devices.
 * Vendor must log in again.
 */
async function revokeVendorSessions(vendorId) {
  validateVendorId(vendorId);

  return Vendor.findByIdAndUpdate(
    vendorId,
    {
      $inc: {
        tokenVersion: 1,
      },
    },
    { new: true }
  );
}

module.exports = {
  disableVendor,
  enableVendor,
  revokeVendorSessions,
};

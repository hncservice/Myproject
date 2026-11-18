'use strict';

const mongoose = require('mongoose');

const wheelItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    description: {
      type: String,
      trim: true,
    },

    imageUrl: {
      type: String,
      trim: true,
    },

    probabilityWeight: {
      type: Number,
      default: 1,
      min: 0,
    },

    // null means unlimited stock
    quantityTotal: {
      type: Number,
      default: null,
      min: 0,
    },

    // Number of prizes already issued to customers
    quantityAllocated: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Number of issued prizes already redeemed
    quantityRedeemed: {
      type: Number,
      default: 0,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

wheelItemSchema.virtual('quantityAvailable').get(function () {
  if (this.quantityTotal === null) {
    return null;
  }

  return Math.max(
    0,
    this.quantityTotal - this.quantityAllocated
  );
});

wheelItemSchema.set('toJSON', {
  virtuals: true,
});

module.exports = mongoose.model('WheelItem', wheelItemSchema);
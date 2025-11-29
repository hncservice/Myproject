// server/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { verifyToken } = require('../config/jwt');
const Vendor = require('../models/Vendor');
const AdminUser = require('../models/AdminUser');
const User = require('../models/User');

const extractToken = (req) =>
  req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.replace('Bearer ', '')
    : null;

// ---------- USER AUTH (type: default user via verifyToken) ----------
const authUser = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ message: 'User not found' });

    req.user = user;
    next();
  } catch (err) {
    console.error('authUser token error:', err.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// ---------- VENDOR AUTH (type: "vendor") ----------
const authVendor = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const payload = verifyToken(token);
    if (payload.type !== 'vendor') {
      return res.status(403).json({ message: 'Not a vendor' });
    }

    const vendor = await Vendor.findById(payload.id);
    if (!vendor) return res.status(401).json({ message: 'Vendor not found' });

    req.vendor = vendor;
    next();
  } catch (err) {
    console.error('authVendor token error:', err.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// ---------- ADMIN AUTH (type: "admin") ----------
const authAdmin = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const payload = verifyToken(token);
    if (payload.type !== 'admin') {
      return res.status(403).json({ message: 'Not an admin' });
    }

    const admin = await AdminUser.findById(payload.id);
    if (!admin) return res.status(401).json({ message: 'Admin not found' });

    req.admin = admin;
    next();
  } catch (err) {
    console.error('authAdmin token error:', err.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// ---------- LEGACY / GENERIC AUTH (if you still use it anywhere) ----------
const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded should contain { id, role, ... }
    req.user = decoded;
    next();
  } catch (err) {
    console.error('JWT error:', err.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// ✅ Export everything properly
module.exports = {
  authUser,
  authVendor,
  authAdmin,
  auth,
  requireAdmin,
};

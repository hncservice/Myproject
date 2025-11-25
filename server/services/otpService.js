// server/services/otpService.js
const bcrypt = require('bcrypt');

exports.generateOtp = () => {
  const code = ('' + Math.floor(100000 + Math.random() * 900000)).slice(-6);
  return code;
};

exports.hashOtp = async (otp) => {
  const saltRounds = 10;
  return bcrypt.hash(otp, saltRounds);
};

exports.compareOtp = (otp, hash) => bcrypt.compare(otp, hash);

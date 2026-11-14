const bcrypt = require('bcryptjs');
const { User } = require('../models');

async function verifyCredentials(username, password) {
  const user = await User.findOne({ username: username.toLowerCase() }).select('+passwordHash username mustChangePassword');
  const valid = user && await bcrypt.compare(password, user.passwordHash);
  return valid ? user : null;
}

async function replacePassword(userId, password, currentPassword) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) return false;
  if (!user.mustChangePassword && currentPassword && !(await bcrypt.compare(currentPassword, user.passwordHash))) return false;
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await User.updateOne({ _id: userId, passwordHash: user.passwordHash }, { $set: { passwordHash, mustChangePassword: false } });
  return result.modifiedCount === 1;
}

module.exports = { verifyCredentials, replacePassword };

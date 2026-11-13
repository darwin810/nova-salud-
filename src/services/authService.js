const bcrypt = require('bcryptjs');
const { User } = require('../models');

async function verifyCredentials(username, password) {
  const user = await User.findOne({ username: username.toLowerCase() }).select('+passwordHash username mustChangePassword');
  const valid = user && await bcrypt.compare(password, user.passwordHash);
  return valid ? user : null;
}

async function replacePassword(userId, password) {
  const passwordHash = await bcrypt.hash(password, 12);
  await User.updateOne({ _id: userId }, { $set: { passwordHash, mustChangePassword: false } });
}

module.exports = { verifyCredentials, replacePassword };

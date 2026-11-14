const { User } = require('../models');
const { verifyAccessToken } = require('../security');
const COOKIE_NAME = 'nova_session';

function makeAuth(jwtSecret) {
  return async (req, res, next) => {
    try {
      const cookie = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(COOKIE_NAME + '='));
      const token = (cookie ? decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1)) : '') || req.get('authorization')?.replace(/^Bearer\s+/i, '');
      if (!token) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
      const payload = verifyAccessToken(token, jwtSecret);
      const user = await User.findById(payload.sub).select('username mustChangePassword');
      if (!user) return res.status(401).json({ error: 'Sesión inválida.' });
      req.user = user;
      return next();
    } catch { return res.status(401).json({ error: 'Tu sesión venció. Ingresa nuevamente.' }); }
  };
}

module.exports = { makeAuth, COOKIE_NAME };

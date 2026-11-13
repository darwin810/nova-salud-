const express = require('express');
const rateLimit = require('express-rate-limit');
const { makeController } = require('../controllers/apiController');
const { makeAuth, requirePasswordChangeCompleted } = require('../middleware/auth');

function makeApiRouter(config) {
  const router = express.Router(); const controller = makeController(config); const auth = makeAuth(config.jwtSecret);
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.' } });
  const writeLimiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false });
  router.get('/health', controller.health);
  router.post('/auth/login', loginLimiter, controller.login);
  router.post('/auth/logout', controller.logout);
  router.get('/auth/me', auth, controller.me);
  router.post('/auth/change-password', auth, controller.changePassword);
  router.use(auth, requirePasswordChangeCompleted, writeLimiter);
  router.get('/dashboard', controller.dashboard);
  router.get('/products', controller.listProducts);
  router.post('/products', controller.createProduct);
  router.put('/products/:id', controller.updateProduct);
  router.post('/sales', controller.createSale);
  router.get('/sales', controller.listSales);
  return router;
}
module.exports = { makeApiRouter };

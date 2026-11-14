const mongoose = require('mongoose');
const { User, Product, Sale } = require('../models');
const { productInput, saleInput, credentialsInput, passwordChangeInput, createAccessToken } = require('../security');
const authService = require('../services/authService');
const inventoryService = require('../services/inventoryService');
const salesService = require('../services/salesService');
const { COOKIE_NAME } = require('../middleware/auth');

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
function makeController(config) {
  const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: config.nodeEnv === 'production', path: '/', maxAge: 8 * 60 * 60 * 1000 };
  return {
    health: (req, res) => res.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'conectada' : 'desconectada' }),
    login: wrap(async (req, res) => {
      const parsed = credentialsInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Usuario o contraseña inválidos.' });
      const user = await authService.verifyCredentials(parsed.data.username, parsed.data.password);
      if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
      res.cookie(COOKIE_NAME, createAccessToken(user, config.jwtSecret), cookieOptions);
      return res.json({ user: { username: user.username, mustChangePassword: user.mustChangePassword } });
    }),
    logout: (req, res) => { res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined }); res.status(204).end(); },
    me: (req, res) => res.json({ user: { username: req.user.username, mustChangePassword: req.user.mustChangePassword } }),
    changePassword: wrap(async (req, res) => {
      const parsed = passwordChangeInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'La nueva contraseña debe tener 12 o más caracteres y no exceder 72 bytes.' });
      const changed = await authService.replacePassword(req.user._id, parsed.data.password, parsed.data.currentPassword);
      if (!changed) return res.status(401).json({ error: 'La contraseña actual no es correcta o la cuenta cambió. Vuelve a intentarlo.' });
      return res.json({ message: 'Contraseña actualizada.' });
    }),
    dashboard: wrap(async (req, res) => {
      const shiftedToPeru = new Date(Date.now() - 5 * 60 * 60 * 1000); shiftedToPeru.setUTCHours(0, 0, 0, 0);
      const start = new Date(shiftedToPeru.getTime() + 5 * 60 * 60 * 1000); const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      const [totalProducts, low, lowCount, today] = await Promise.all([
        Product.countDocuments(), Product.find({ $expr: { $lte: ['$stock', '$minStock'] } }).sort({ stock: 1, name: 1 }).limit(6).lean(),
        Product.countDocuments({ $expr: { $lte: ['$stock', '$minStock'] } }),
        Sale.aggregate([{ $match: { createdAt: { $gte: start, $lt: end } } }, { $group: { _id: null, count: { $sum: 1 }, totalCents: { $sum: '$totalCents' } } }]),
      ]);
      return res.json({ totalProducts, lowStockCount: lowCount, lowStock: low.map(inventoryService.formatProduct), today: today[0] || { count: 0, totalCents: 0 } });
    }),
    listProducts: wrap(async (req, res) => res.json({ products: await inventoryService.listProducts(String(req.query.q || '').trim().slice(0, 80), req.query.restock === 'true') })),
    createProduct: wrap(async (req, res) => {
      const parsed = productInput.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos.' });
      return res.status(201).json({ product: await inventoryService.createProduct(parsed.data) });
    }),
    updateProduct: wrap(async (req, res) => {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Producto inválido.' });
      const parsed = productInput.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos.' });
      const version = Number(req.get('if-match'));
      if (!Number.isInteger(version) || version < 0) return res.status(428).json({ error: 'Falta la versión del producto para evitar sobrescribir cambios.' });
      const product = await inventoryService.updateProduct(req.params.id, version, parsed.data);
      if (!product) return res.status(409).json({ error: 'Otro usuario cambió este producto. Actualiza la lista e inténtalo de nuevo.' });
      return res.json({ product });
    }),
    createSale: wrap(async (req, res) => {
      const idempotencyKey = req.get('idempotency-key');
      if (!idempotencyKey || idempotencyKey.length > 100) return res.status(400).json({ error: 'Falta la clave de venta para evitar duplicados.' });
      const parsed = saleInput.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos.' });
      const result = await salesService.registerSale({ ...parsed.data, idempotencyKey, userId: req.user._id });
      return res.status(result.replayed ? 200 : 201).json(result);
    }),
    listSales: wrap(async (req, res) => {
      const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1)); const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 10));
      const [sales, total] = await Promise.all([Sale.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Sale.countDocuments()]);
      return res.json({ sales: sales.map(salesService.formatSale), page, limit, total, pages: Math.ceil(total / limit) });
    }),
  };
}
module.exports = { makeController };

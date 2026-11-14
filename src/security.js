const jwt = require('jsonwebtoken');
const { z } = require('zod');

const productInput = z.object({
  name: z.string().trim().min(2).max(100),
  category: z.string().trim().min(2).max(60),
  price: z.number().finite().min(0.01).max(99999.99),
  stock: z.number().int().min(0).max(1000000),
  minStock: z.number().int().min(0).max(1000000),
}).strict();

const saleInput = z.object({
  customerName: z.string().trim().max(100).optional().default(''),
  items: z.array(z.object({
    productId: z.string().regex(/^[a-f\d]{24}$/i),
    quantity: z.number().int().min(1).max(10000),
  }).strict()).min(1).max(50),
}).strict().superRefine((sale, ctx) => {
  const ids = sale.items.map((item) => item.productId);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'No repitas productos en la venta.' });
});

const passwordBytesInput = z.string().min(1).max(72).refine((password) => Buffer.byteLength(password, 'utf8') <= 72);
const credentialsInput = z.object({
  username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/),
  password: passwordBytesInput,
}).strict();
const newPasswordInput = z.string().min(12).max(72).refine((password) => Buffer.byteLength(password, 'utf8') <= 72);
const passwordChangeInput = z.object({ currentPassword: passwordBytesInput.optional(), password: newPasswordInput }).strict();

function createAccessToken(user, secret) {
  return jwt.sign({ sub: String(user._id), role: 'admin' }, secret, { expiresIn: '8h', issuer: 'nova-salud', audience: 'nova-salud-web' });
}

function verifyAccessToken(token, secret) {
  return jwt.verify(token, secret, { issuer: 'nova-salud', audience: 'nova-salud-web' });
}

function priceToCents(price) {
  return Math.round(price * 100);
}

module.exports = { productInput, saleInput, credentialsInput, newPasswordInput, passwordChangeInput, createAccessToken, verifyAccessToken, priceToCents };

const test = require('node:test');
const assert = require('node:assert/strict');
const { productInput, saleInput, credentialsInput, newPasswordInput, createAccessToken, verifyAccessToken, priceToCents } = require('../src/security');
const { User, Product, Sale } = require('../src/models');

const secret = 'test-only-random-secret-for-nova-salud-0123456789';

test('valida productos y evita precios o existencias fuera de rango', () => {
  assert.equal(productInput.safeParse({ name: 'Vitamina C', category: 'Vitaminas', price: 12.5, stock: 4, minStock: 2 }).success, true);
  assert.equal(productInput.safeParse({ name: 'X', category: 'A', price: -4, stock: 2.5, minStock: 0 }).success, false);
  assert.equal(priceToCents(12.5), 1250);
});

test('valida venta y rechaza cantidades repetidas, vacías o inválidas', () => {
  const id = '507f1f77bcf86cd799439011';
  assert.equal(saleInput.safeParse({ customerName: 'Cliente', items: [{ productId: id, quantity: 2 }] }).success, true);
  assert.equal(saleInput.safeParse({ items: [] }).success, false);
  assert.equal(saleInput.safeParse({ items: [{ productId: id, quantity: 1 }, { productId: id, quantity: 2 }] }).success, false);
  assert.equal(saleInput.safeParse({ items: [{ productId: id, quantity: 0 }] }).success, false);
});

test('autenticación firma JWT con expiración y rechaza firmas incorrectas', () => {
  const token = createAccessToken({ _id: '507f1f77bcf86cd799439011' }, secret);
  assert.equal(verifyAccessToken(token, secret).role, 'admin');
  assert.throws(() => verifyAccessToken(token, 'wrong-secret-that-is-long-enough-for-testing'));
  assert.equal(credentialsInput.safeParse({ username: 'admin', password: '123456' }).success, true);
  assert.equal(newPasswordInput.safeParse('123456').success, false);
  assert.equal(newPasswordInput.safeParse('FraseSegura-Nova-2026').success, true);
});

test('MongoDB usa colecciones en español y excluye el hash de consultas de usuario', () => {
  assert.equal(User.collection.name, 'usuarios');
  assert.equal(Product.collection.name, 'productos');
  assert.equal(Sale.collection.name, 'ventas');
  assert.equal(User.schema.path('passwordHash').options.select, false);
});

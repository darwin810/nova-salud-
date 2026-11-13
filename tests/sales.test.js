const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { Product, Sale } = require('../src/models');
const { registerSale } = require('../src/services/salesService');

const original = { startSession: mongoose.startSession, findById: Product.findById, findOneAndUpdate: Product.findOneAndUpdate, saleFindOne: Sale.findOne, saleCreate: Sale.create };
const productId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
const userId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');

test('registra venta con importe calculado del catálogo y descuenta stock', async () => {
  let stock = 5; let inserted;
  mongoose.startSession = async () => ({ withTransaction: async (fn) => fn(), endSession: async () => {} });
  Product.findById = () => ({ session: async () => ({ _id: productId, name: 'Vitamina C', stock, priceCents: 1290, version: 2 }) });
  Product.findOneAndUpdate = async (filter, update) => { assert.equal(filter.version, 2); stock += update.$inc.stock; return { stock }; };
  Sale.findOne = () => ({ lean: async () => null });
  Sale.create = async ([data]) => { inserted = { ...data, _id: new mongoose.Types.ObjectId(), createdAt: new Date() }; return [{ ...inserted, toObject: () => inserted }]; };
  try {
    const result = await registerSale({ idempotencyKey: 'sale-test-1', customerName: 'Ana', items: [{ productId: String(productId), quantity: 2 }], userId });
    assert.equal(result.sale.total, 25.8);
    assert.equal(result.sale.items[0].unitPrice, 12.9);
    assert.equal(stock, 3);
    assert.equal(inserted.totalCents, 2580);
    assert.equal(result.replayed, false);
  } finally { restore(); }
});

test('rechaza venta con stock insuficiente antes de guardar', async () => {
  let writes = 0;
  mongoose.startSession = async () => ({ withTransaction: async (fn) => fn(), endSession: async () => {} });
  Product.findById = () => ({ session: async () => ({ _id: productId, name: 'Producto', stock: 0, priceCents: 100, version: 0 }) });
  Product.findOneAndUpdate = async () => { writes++; };
  Sale.findOne = () => ({ lean: async () => null });
  Sale.create = async () => { writes++; };
  try {
    await assert.rejects(registerSale({ idempotencyKey: 'sale-test-2', customerName: '', items: [{ productId: String(productId), quantity: 1 }], userId }), /Stock insuficiente/);
    assert.equal(writes, 0);
  } finally { restore(); }
});

function restore() { mongoose.startSession = original.startSession; Product.findById = original.findById; Product.findOneAndUpdate = original.findOneAndUpdate; Sale.findOne = original.saleFindOne; Sale.create = original.saleCreate; }

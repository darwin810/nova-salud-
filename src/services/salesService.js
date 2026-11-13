const mongoose = require('mongoose');
const { Product, Sale } = require('../models');

async function registerSale({ idempotencyKey, customerName, items, userId }) {
  const prior = await Sale.findOne({ idempotencyKey }).lean();
  if (prior) return { sale: formatSale(prior), replayed: true };
  const session = await mongoose.startSession();
  let saved;
  try {
    await session.withTransaction(async () => {
      const saleItems = []; let totalCents = 0;
      for (const requested of items) {
        const product = await Product.findById(requested.productId).session(session);
        if (!product) throw httpError(404, 'No encontramos uno de los productos. Actualiza el carrito.');
        if (product.stock < requested.quantity) throw httpError(409, `Stock insuficiente para ${product.name}. Disponible: ${product.stock}.`);
        const updated = await Product.findOneAndUpdate({ _id: product._id, version: product.version, stock: { $gte: requested.quantity } }, { $inc: { stock: -requested.quantity, version: 1 } }, { new: true, session });
        if (!updated) throw httpError(409, `El stock de ${product.name} cambió. Actualiza el carrito.`);
        const subtotalCents = product.priceCents * requested.quantity;
        totalCents += subtotalCents;
        saleItems.push({ productId: product._id, name: product.name, quantity: requested.quantity, unitPriceCents: product.priceCents, subtotalCents });
      }
      [saved] = await Sale.create([{ idempotencyKey, customerName, items: saleItems, totalCents, createdBy: userId }], { session });
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await Sale.findOne({ idempotencyKey }).lean();
      if (duplicate) return { sale: formatSale(duplicate), replayed: true };
    }
    throw error;
  } finally { await session.endSession(); }
  return { sale: formatSale(saved.toObject()), replayed: false };
}

function formatSale(sale) { return { id: String(sale._id), customerName: sale.customerName, items: sale.items.map((i) => ({ productId: String(i.productId), name: i.name, quantity: i.quantity, unitPrice: i.unitPriceCents / 100, subtotal: i.subtotalCents / 100 })), total: sale.totalCents / 100, createdAt: sale.createdAt }; }
function httpError(status, message) { const error = new Error(message); error.status = status; return error; }

module.exports = { registerSale, formatSale };

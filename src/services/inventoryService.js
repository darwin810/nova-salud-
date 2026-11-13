const { Product } = require('../models');
const { priceToCents } = require('../security');

async function listProducts(query, restock) {
  const filter = query ? { $or: [{ name: { $regex: escapeRegex(query), $options: 'i' } }, { category: { $regex: escapeRegex(query), $options: 'i' } }] } : {};
  if (restock) filter.$expr = { $lte: ['$stock', '$minStock'] };
  const products = await Product.find(filter).sort({ name: 1 }).limit(500).lean();
  return products.map(formatProduct);
}

async function createProduct(input) {
  const product = await Product.create({ ...input, priceCents: priceToCents(input.price) });
  return formatProduct(product.toObject());
}

async function updateProduct(id, version, input) {
  const updated = await Product.findOneAndUpdate({ _id: id, version }, { $set: { ...input, priceCents: priceToCents(input.price) }, $inc: { version: 1 } }, { new: true, runValidators: true }).lean();
  return updated ? formatProduct(updated) : null;
}

function formatProduct(product) {
  return { id: String(product._id), name: product.name, category: product.category, price: product.priceCents / 100, stock: product.stock, minStock: product.minStock, version: product.version, status: product.stock === 0 ? 'agotado' : product.stock <= product.minStock ? 'bajo' : 'disponible' };
}
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

module.exports = { listProducts, createProduct, updateProduct, formatProduct };

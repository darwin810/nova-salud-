const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true, select: false },
  mustChangePassword: { type: Boolean, default: false },
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  category: { type: String, required: true, trim: true, maxlength: 60 },
  priceCents: { type: Number, required: true, min: 1 },
  stock: { type: Number, required: true, min: 0 },
  minStock: { type: Number, required: true, min: 0 },
  version: { type: Number, default: 0 },
}, { timestamps: true });
productSchema.index({ name: 'text', category: 'text' });
productSchema.index({ stock: 1, minStock: 1 });

const saleSchema = new mongoose.Schema({
  idempotencyKey: { type: String, required: true, unique: true },
  customerName: { type: String, default: '' },
  items: [{ productId: mongoose.Schema.Types.ObjectId, name: String, quantity: Number, unitPriceCents: Number, subtotalCents: Number }],
  totalCents: { type: Number, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
saleSchema.index({ createdAt: -1 });

module.exports = {
  User: mongoose.model('User', userSchema),
  Product: mongoose.model('Product', productSchema),
  Sale: mongoose.model('Sale', saleSchema),
};

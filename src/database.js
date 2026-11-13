const mongoose = require('mongoose');
const { User, Product, Sale } = require('./models');

async function connectAndPrepare(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, autoIndex: true, autoCreate: true });
  for (const model of [User, Product, Sale]) {
    const collectionName = model.collection.collectionName;
    const exists = await mongoose.connection.db.listCollections({ name: collectionName }, { nameOnly: true }).hasNext();
    if (!exists) await model.createCollection();
    await model.createIndexes();
  }
  console.log(`MongoDB listo: ${mongoose.connection.name} (colecciones users, products, sales).`);
}

module.exports = { connectAndPrepare };

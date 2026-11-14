require('dotenv').config();
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectAndPrepare } = require('./database');
const { makeApp } = require('./app');
const { User } = require('./models');

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGODB_URI || (process.env.NODE_ENV === 'production' ? '' : 'mongodb://127.0.0.1:27018/nova_salud?replicaSet=rs0'),
  jwtSecret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : crypto.randomBytes(48).toString('hex')),
  appOrigin: process.env.APP_ORIGIN || 'http://localhost:3000',
};

async function main() {
  if (!config.mongoUri) throw new Error('Configura MONGODB_URI en .env.');
  if (!config.jwtSecret || config.jwtSecret.length < 32 || config.jwtSecret.includes('replace-with')) throw new Error('Configura JWT_SECRET con al menos 32 caracteres aleatorios.');
  if (config.nodeEnv === 'production' && (!config.appOrigin.startsWith('https://') || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12)) {
    throw new Error('En producción configura APP_ORIGIN HTTPS y ADMIN_PASSWORD de 12 o más caracteres.');
  }
  try {
    await connectAndPrepare(config.mongoUri);
  } catch {
    throw new Error(config.nodeEnv === 'production'
      ? 'No se pudo conectar a MongoDB. Revisa MONGODB_URI y el acceso de red.'
      : 'No se encontró MongoDB Server (mongod) en 127.0.0.1:27017. mongosh solo es la consola; inicia el servicio MongoDB y configúralo como replica set rs0. Después vuelve a ejecutar npm run dev.');
  }
  await seedInitialAdmin();
  const app = makeApp(config);
  const server = app.listen(config.port, () => console.log(`Nova Salud disponible en ${config.appOrigin}`));
  const shutdown = () => server.close(() => mongoose.disconnect().finally(() => process.exit(0)));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function seedInitialAdmin() {
  if (await User.exists({})) return;
  const username = (process.env.ADMIN_USERNAME || (config.nodeEnv === 'development' ? 'admin' : '')).trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || (config.nodeEnv === 'development' ? '123456' : '');
  if (!username || !password) {
    console.error('No hay administrador. Configura ADMIN_USERNAME y ADMIN_PASSWORD seguros y reinicia.');
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    await User.create({ username, passwordHash, mustChangePassword: true });
    console.log(`Administrador inicial "${username}" creado; cambia la contraseña al ingresar.`);
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
}

if (require.main === module) main().catch((error) => { console.error(`No se pudo iniciar Nova Salud: ${error.message}`); process.exitCode = 1; });
module.exports = { main, seedInitialAdmin };

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const mongoose = require('mongoose');

const root = path.resolve(__dirname, '..');
const localUri = 'mongodb://127.0.0.1:27018/nova_salud?replicaSet=rs0';
const standaloneUri = 'mongodb://127.0.0.1:27018/admin?directConnection=true';
let mongoProcess;
let appProcess;
let stopping = false;

async function main() {
  const configuredUri = process.env.MONGODB_URI;
  const managedLocal = !configuredUri || configuredUri === 'mongodb://127.0.0.1:27018/nova_salud?replicaSet=rs0';
  const mongoUri = managedLocal ? localUri : configuredUri;
  if (managedLocal) await ensureManagedMongo();
  launchApp(mongoUri);
}

async function ensureManagedMongo() {
  if (await canConnect(localUri)) {
    console.log('MongoDB local de Nova ya está disponible en el puerto 27018.');
    return;
  }

  const mongodPath = findMongod();
  if (!mongodPath) throw new Error('No se encontró mongod.exe. Instala MongoDB Community Server para iniciar Nova.');
  const dataPath = path.join(root, 'data', 'mongodb');
  fs.mkdirSync(dataPath, { recursive: true });
  console.log('Iniciando la base local de Nova en el puerto 27018…');
  const logPath = path.join(dataPath, 'mongod.log');
  mongoProcess = spawn(mongodPath, ['--dbpath', dataPath, '--replSet', 'rs0', '--port', '27018', '--bind_ip', '127.0.0.1', '--logpath', logPath, '--logappend', '--quiet'], { stdio: 'inherit', windowsHide: true });
  mongoProcess.once('error', (error) => console.error(`No se pudo iniciar mongod: ${error.message}`));
  await waitForMongo();
  await initializeReplicaSet();
  if (!(await canConnect(localUri))) throw new Error('MongoDB inició, pero rs0 aún no responde. Espera unos segundos y vuelve a intentar.');
}

function findMongod() {
  if (process.env.MONGOD_PATH && fs.existsSync(process.env.MONGOD_PATH)) return process.env.MONGOD_PATH;
  const roots = [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'MongoDB', 'Server'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'MongoDB', 'Server'),
  ];
  for (const base of roots) {
    if (!fs.existsSync(base)) continue;
    const versions = fs.readdirSync(base).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const version of versions) {
      const candidate = path.join(base, version, 'bin', 'mongod.exe');
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  const where = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['mongod'], { encoding: 'utf8', windowsHide: true });
  const candidate = where.stdout?.split(/\r?\n/).find(Boolean);
  return candidate && fs.existsSync(candidate) ? candidate : null;
}

async function waitForMongo() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (mongoProcess.exitCode !== null) throw new Error('mongod se cerró durante el inicio. Revisa el mensaje de MongoDB arriba.');
    if (await canConnect(standaloneUri)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('MongoDB no respondió en el puerto 27018 después de 30 segundos.');
}

async function initializeReplicaSet() {
  const connection = mongoose.createConnection(standaloneUri, { serverSelectionTimeoutMS: 3000 });
  try {
    await connection.asPromise();
    try {
      await connection.db.admin().command({ replSetGetStatus: 1 });
    } catch (error) {
      if (error.codeName !== 'NotYetInitialized' && error.code !== 94) throw error;
      await connection.db.admin().command({ replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27018' }] } });
    }
  } finally {
    await connection.close();
  }
  const ready = await canConnect(localUri, 20000);
  if (!ready) throw new Error('El replica set rs0 no quedó listo. Detén otra instancia que use el puerto 27018 y reintenta.');
}

async function canConnect(uri, timeout = 1000) {
  const connection = mongoose.createConnection(uri, { serverSelectionTimeoutMS: timeout, connectTimeoutMS: timeout });
  try {
    await connection.asPromise();
    return true;
  } catch {
    return false;
  } finally {
    await connection.close().catch(() => {});
  }
}

function launchApp(mongoUri) {
  const serverPath = path.join(root, 'src', 'server.js');
  console.log('Iniciando Nova Salud…');
  appProcess = spawn(process.execPath, ['--watch', serverPath], { cwd: root, env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development', MONGODB_URI: mongoUri }, stdio: 'inherit', windowsHide: true });
  appProcess.once('error', (error) => { console.error(`No se pudo iniciar Nova Salud: ${error.message}`); shutdown(1); });
  appProcess.once('exit', (code) => { if (!stopping) shutdown(code || 0); });
}

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  appProcess?.kill();
  mongoProcess?.kill();
  process.exitCode = code;
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
main().catch((error) => { console.error(`No se pudo preparar MongoDB para Nova: ${error.message}`); shutdown(1); });

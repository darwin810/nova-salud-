const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { User } = require('../src/models');
const { makeAuth, requirePasswordChangeCompleted } = require('../src/middleware/auth');
const { makeOriginGuard } = require('../src/middleware/origin');
const { verifyCredentials, replacePassword } = require('../src/services/authService');

test('verifica credenciales con hash bcrypt y no acepta una contraseña errónea', async () => {
  const original = User.findOne;
  const passwordHash = await bcrypt.hash('clave-larga-de-prueba', 4);
  User.findOne = () => ({ select: async () => ({ username: 'admin', passwordHash, mustChangePassword: true }) });
  try {
    assert.equal((await verifyCredentials('ADMIN', 'clave-larga-de-prueba')).username, 'admin');
    assert.equal(await verifyCredentials('admin', 'incorrecta'), null);
  } finally { User.findOne = original; }
});

test('permite dejar vacía la contraseña actual y verifica si se proporciona', async () => {
  const originalFindById = User.findById; const originalUpdateOne = User.updateOne;
  const currentHash = await bcrypt.hash('ClaveActual-1234', 4); let savedHash = null;
  User.findById = () => ({ select: async () => ({ passwordHash: currentHash, mustChangePassword: false }) });
  User.updateOne = async (filter, update) => { assert.equal(filter.passwordHash, currentHash); savedHash = update.$set.passwordHash; return { modifiedCount: 1 }; };
  try {
    assert.equal(await replacePassword('user-1', 'ClaveNueva-Segura-2026', 'incorrecta'), false);
    assert.equal(savedHash, null);
    assert.equal(await replacePassword('user-1', 'ClaveNueva-Segura-2026'), true);
    assert.equal(await bcrypt.compare('ClaveNueva-Segura-2026', savedHash), true);
  } finally { User.findById = originalFindById; User.updateOne = originalUpdateOne; }
});

test('permite definir la contraseña inicial obligatoria sin pedir una clave anterior', async () => {
  const originalFindById = User.findById; const originalUpdateOne = User.updateOne;
  let savedHash = null;
  User.findById = () => ({ select: async () => ({ passwordHash: 'hash-inicial', mustChangePassword: true }) });
  User.updateOne = async (_filter, update) => { savedHash = update.$set.passwordHash; return { modifiedCount: 1 }; };
  try {
    assert.equal(await replacePassword('user-1', 'ClaveNueva-Segura-2026'), true);
    assert.equal(await bcrypt.compare('ClaveNueva-Segura-2026', savedHash), true);
  } finally { User.findById = originalFindById; User.updateOne = originalUpdateOne; }
});

test('el middleware bloquea rutas sin sesión y fuerza cambiar la contraseña inicial', async () => {
  const auth = makeAuth('test-secret-that-is-long-enough-for-auth-test-123');
  let status; let body;
  await auth({ headers: {}, get: () => undefined }, { status: (value) => { status = value; return { json: (valueBody) => { body = valueBody; } }; } }, () => assert.fail('No debe permitir pasar sin sesión.'));
  assert.equal(status, 401);
  assert.match(body.error, /Inicia sesión/);
  let changeStatus;
  requirePasswordChangeCompleted({ user: { mustChangePassword: true } }, { status: (value) => { changeStatus = value; return { json: () => {} }; } }, () => assert.fail('Debe exigir cambio de contraseña.'));
  assert.equal(changeStatus, 428);
});

test('el guard de origen rechaza solicitudes de escritura externas', () => {
  const guard = makeOriginGuard('https://nova.example'); let status; let body;
  guard({ method: 'POST', get: () => 'https://otro.example' }, { status: (value) => { status = value; return { json: (valueBody) => { body = valueBody; } }; } }, () => assert.fail('Debe bloquear el origen externo.'));
  assert.equal(status, 403);
  assert.match(body.error, /Origen/);
});

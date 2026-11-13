const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const { makeOriginGuard } = require('./middleware/origin');
const { makeApiRouter } = require('./routes/apiRoutes');

function makeApp(config) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.nodeEnv === 'production' ? 1 : false);
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'self'"], frameAncestors: ["'none'"] } }, crossOriginEmbedderPolicy: false }));
  app.use(express.json({ limit: '32kb', strict: true }));
  app.use('/api', makeOriginGuard(config.appOrigin), makeApiRouter(config));
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: config.nodeEnv === 'production' ? '1h' : 0 }));
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err.status || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500);
    if (status >= 500) console.error('Error de API:', err.message);
    return res.status(status).json({ error: status >= 500 ? 'Ocurrió un error interno. Inténtalo nuevamente.' : err.message });
  });
  return app;
}
module.exports = { makeApp };

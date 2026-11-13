function makeOriginGuard(appOrigin) {
  return (req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    if (!req.get('origin') || req.get('origin') !== appOrigin) return res.status(403).json({ error: 'Origen de solicitud no permitido.' });
    return next();
  };
}
module.exports = { makeOriginGuard };

const { verifyJwt } = require('../routes/HARRY_CLINTON/helpers');

// Rejects the request unless a valid "Authorization: Bearer <token>" header is present.
// On success, attaches the decoded token payload to req.user.
const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, message: 'Missing or invalid Authorization header' });
  }

  try {
    req.user = verifyJwt(token);
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Attaches req.user if a valid token is present, but does not reject the request otherwise.
const optionalAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme === 'Bearer' && token) {
    try {
      req.user = verifyJwt(token);
    } catch (err) {
      // ignore invalid/expired token, request proceeds unauthenticated
    }
  }

  next();
};

const requireAdmin = (req, res, next) => {
  return requireAuth(req, res, () => {
    if (!String(req.user?.role_code || '').toLowerCase().includes('admin')) {
      return res.status(403).json({ success: false, message: 'Administrator access required.' });
    }
    return next();
  });
};

module.exports = { requireAuth, requireAdmin, optionalAuth };

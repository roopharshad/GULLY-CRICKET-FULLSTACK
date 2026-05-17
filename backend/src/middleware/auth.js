/**
 * middleware/auth.js
 * Validates X-Admin-Token header for write operations.
 */

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  const secret = process.env.ADMIN_SECRET;

  if (!secret) {
    return res.status(500).json({ error: 'ADMIN_SECRET not configured on server' });
  }
  if (!token || token !== secret) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing X-Admin-Token' });
  }
  next();
}

module.exports = { requireAdmin };

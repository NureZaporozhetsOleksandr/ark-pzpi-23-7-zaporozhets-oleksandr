const jwt = require('jsonwebtoken');
const db = require('../db/db');

const JWT_SECRET = 'very_secret_key_123';

function generateToken(user) {
  return jwt.sign(
    { id: user.Id, role: user.Role, fullName: user.FullName },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });
  const parts = authHeader.split(' ');
  if (parts.length !== 2) return res.status(401).json({ message: 'Invalid Authorization header' });
  const token = parts[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Invalid token' });
    req.user = decoded;
    next();
  });
}

function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'Admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
}

function logAction(userId, action, entityName, entityId, oldValue, newValue) {
  const ts = new Date().toISOString();
  const sql = `
    INSERT INTO AuditLogs (UserId, Action, EntityName, EntityId, Timestamp, OldValue, NewValue)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  db.run(
    sql,
    [userId || null, action, entityName, entityId || null, ts, oldValue || null, newValue || null],
    (err) => {
      if (err) console.error('Audit log error:', err.message);
    }
  );
}

module.exports = {
  generateToken,
  authMiddleware,
  adminMiddleware,
  logAction
};

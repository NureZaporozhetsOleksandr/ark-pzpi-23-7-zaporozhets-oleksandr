const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../../db/db');
const { generateToken, logAction, authMiddleware } = require('../auth');

const router = express.Router();

router.post('/register', (req, res) => {
  const { fullName, login, email, password } = req.body;
  if (!fullName || !login || !email || !password) {
    return res.status(400).json({ message: 'Missing fields' });
  }
  db.get('SELECT Id FROM Users WHERE Login = ?', [login], (err, row) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    if (row) return res.status(400).json({ message: 'Login already exists' });
    const hash = bcrypt.hashSync(password, 10);
    const sql = `
      INSERT INTO Users (FullName, Login, Email, PasswordHash, Role, IsActive)
      VALUES (?, ?, ?, ?, 'Employee', 1)
    `;
    db.run(sql, [fullName, login, email, hash], function (err) {
      if (err) return res.status(500).json({ message: 'DB error' });
      const userId = this.lastID;
      logAction(null, 'CREATE_USER', 'Users', userId, null, JSON.stringify({ fullName, login, email }));
      res.status(201).json({
        id: userId,
        fullName,
        login,
        email,
        role: 'Employee',
        isActive: true
      });
    });
  });
});

router.post('/login', (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) {
    return res.status(400).json({ message: 'Missing login or password' });
  }
  db.get('SELECT * FROM Users WHERE Login = ?', [login], (err, user) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    if (!user || !user.IsActive) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const ok = bcrypt.compareSync(password, user.PasswordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    const token = generateToken(user);
    res.json({
      token,
      user: {
        id: user.Id,
        fullName: user.FullName,
        role: user.Role
      }
    });
  });
});

router.get('/me', authMiddleware, (req, res) => {
  db.get(
    'SELECT Id, FullName, Login, Email, Role, IsActive FROM Users WHERE Id = ?',
    [req.user.id],
    (err, user) => {
      if (err) return res.status(500).json({ message: 'DB error' });
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json(user);
    }
  );
});

module.exports = router;

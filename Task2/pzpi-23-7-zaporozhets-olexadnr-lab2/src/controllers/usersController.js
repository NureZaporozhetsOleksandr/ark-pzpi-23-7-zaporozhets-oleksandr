const express = require('express');
const db = require('../../db/db');
const { logAction } = require('../auth');

const router = express.Router();

router.get('/', (req, res) => {
  db.all('SELECT Id, FullName, Login, Email, Role, IsActive FROM Users', [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.get(
    'SELECT Id, FullName, Login, Email, Role, IsActive FROM Users WHERE Id = ?',
    [id],
    (err, user) => {
      if (err) return res.status(500).json({ message: 'DB error' });
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json(user);
    }
  );
});

router.patch('/:id/deactivate', (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.get('SELECT * FROM Users WHERE Id = ?', [id], (err, user) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const oldValue = JSON.stringify({ IsActive: user.IsActive });
    db.run('UPDATE Users SET IsActive = 0 WHERE Id = ?', [id], function (err) {
      if (err) return res.status(500).json({ message: 'DB error' });
      logAction(req.user.id, 'DEACTIVATE_USER', 'Users', id, oldValue, JSON.stringify({ IsActive: 0 }));
      res.json({ message: 'User deactivated' });
    });
  });
});

module.exports = router;

const express = require('express');
const db = require('../../db/db');

const router = express.Router();

router.get('/', (req, res) => {
  const { from, to } = req.query;
  let sql = 'SELECT * FROM AuditLogs WHERE 1=1';
  const params = [];
  if (from) {
    sql += ' AND Timestamp >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND Timestamp <= ?';
    params.push(to);
  }
  sql += ' ORDER BY Timestamp DESC';
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    res.json(rows);
  });
});

module.exports = router;

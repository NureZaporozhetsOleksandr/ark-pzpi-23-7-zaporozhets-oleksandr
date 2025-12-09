const express = require('express');
const db = require('../../db/db');
const { logAction } = require('../auth');

const router = express.Router();

router.post('/', (req, res) => {
  const { type, dateStart, dateEnd, comment } = req.body;
  if (!type || !dateStart || !dateEnd) {
    return res.status(400).json({ message: 'Missing fields' });
  }
  const sql = `
    INSERT INTO AbsenceRecords (UserId, Type, DateStart, DateEnd, Comment)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.run(sql, [req.user.id, type, dateStart, dateEnd, comment || null], function (err) {
    if (err) return res.status(500).json({ message: 'DB error' });
    const id = this.lastID;
    logAction(req.user.id, 'CREATE_ABSENCE', 'AbsenceRecords', id, null, JSON.stringify({ type, dateStart, dateEnd }));
    res.status(201).json({
      id,
      userId: req.user.id,
      type,
      dateStart,
      dateEnd,
      comment: comment || null
    });
  });
});

router.get('/my', (req, res) => {
  const { from, to } = req.query;
  let sql = 'SELECT * FROM AbsenceRecords WHERE UserId = ?';
  const params = [req.user.id];
  if (from) {
    sql += ' AND DateStart >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND DateEnd <= ?';
    params.push(to);
  }
  sql += ' ORDER BY DateStart ASC';
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    res.json(rows);
  });
});

module.exports = router;

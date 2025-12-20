const express = require('express');
const db = require('../../db/db');

const router = express.Router();

router.get('/my/summary', (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ message: 'Missing from or to' });
  }
  const sql = `
    SELECT EntryType, StartTime
    FROM TimeEntries
    WHERE UserId = ?
      AND StartTime >= ?
      AND StartTime <= ?
    ORDER BY StartTime
  `;
  db.all(sql, [req.user.id, from, to], (err, entries) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    const totalEntries = entries.length;
    const startCount = entries.filter(e => e.EntryType === 'StartWork').length;
    const endCount = entries.filter(e => e.EntryType === 'EndWork').length;
    res.json({
      userId: req.user.id,
      from,
      to,
      totalEntries,
      startCount,
      endCount
    });
  });
});

module.exports = router;

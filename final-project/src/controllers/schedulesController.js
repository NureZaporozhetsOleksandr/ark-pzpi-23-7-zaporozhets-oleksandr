const express = require('express');
const db = require('../../db/db');
const { logAction, adminMiddleware } = require('../auth');

const router = express.Router();

router.get('/my', (req, res) => {
  const sql = `
    SELECT * FROM WorkSchedules
    WHERE UserId = ?
       OR UserId IS NULL
    ORDER BY CASE WHEN UserId IS NULL THEN 1 ELSE 0 END
    LIMIT 1
  `;
  db.get(sql, [req.user.id], (err, row) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    if (!row) return res.status(404).json({ message: 'Schedule not found' });
    res.json(row);
  });
});

router.post('/', adminMiddleware, (req, res) => {
  const { userId, startWork, endWork, breakMinutes, workingDaysMask } = req.body;
  if (!startWork || !endWork || !breakMinutes || !workingDaysMask) {
    return res.status(400).json({ message: 'Missing fields' });
  }
  const sql = `
    INSERT INTO WorkSchedules (UserId, StartWork, EndWork, BreakMinutes, WorkingDaysMask)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.run(sql, [userId || null, startWork, endWork, breakMinutes, workingDaysMask], function (err) {
    if (err) return res.status(500).json({ message: 'DB error' });
    const id = this.lastID;
    logAction(req.user.id, 'CREATE_SCHEDULE', 'WorkSchedules', id, null, JSON.stringify({ userId, startWork, endWork }));
    res.status(201).json({
      id,
      userId: userId || null,
      startWork,
      endWork,
      breakMinutes,
      workingDaysMask
    });
  });
});

module.exports = router;

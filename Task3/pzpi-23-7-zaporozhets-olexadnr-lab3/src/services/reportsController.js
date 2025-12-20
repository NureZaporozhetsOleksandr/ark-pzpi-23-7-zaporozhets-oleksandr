const express = require('express');
const db = require('../../db/db');
const { calculateSummary } = require('./reportService');

const router = express.Router();

const toDateOnly = (value) => {
  if (!value) return null;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

router.get('/my/summary', (req, res) => {
  const from = toDateOnly(req.query.from);
  const to = toDateOnly(req.query.to);

  if (!from || !to) {
    return res.status(400).json({ message: 'Invalid from/to' });
  }

  const userId = req.user.id;

  const scheduleSql = `
    SELECT *
    FROM WorkSchedules
    WHERE UserId = ?
       OR UserId IS NULL
    ORDER BY CASE WHEN UserId IS NULL THEN 1 ELSE 0 END
    LIMIT 1
  `;

  db.get(scheduleSql, [userId], (schErr, scheduleRow) => {
    if (schErr) {
      return res.status(500).json({ message: 'DB error (schedule)' });
    }

    const entriesSql = `
      SELECT *
      FROM TimeEntries
      WHERE UserId = ?
        AND date(StartTime) >= date(?)
        AND date(StartTime) <= date(?)
      ORDER BY StartTime ASC
    `;

    db.all(entriesSql, [userId, from, to], (teErr, entries) => {
      if (teErr) {
        return res.status(500).json({ message: 'DB error (entries)' });
      }

      const absencesSql = `
        SELECT *
        FROM AbsenceRecords
        WHERE UserId = ?
          AND date(DateEnd) >= date(?)
          AND date(DateStart) <= date(?)
        ORDER BY DateStart ASC
      `;

      db.all(absencesSql, [userId, from, to], (abErr, absences) => {
        if (abErr) {
          return res.status(500).json({ message: 'DB error (absences)' });
        }

        const summary = calculateSummary(
          from,
          to,
          entries || [],
          scheduleRow || null,
          absences || []
        );

        return res.json({
          userId,
          from,
          to,
          days: summary.days,
          totals: summary.totals
        });
      });
    });
  });
});

module.exports = router;

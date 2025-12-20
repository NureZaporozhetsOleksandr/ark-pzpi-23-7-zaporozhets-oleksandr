const express = require('express');
const db = require('../../db/db');
const { logAction } = require('../auth');

const router = express.Router();

router.post('/start-work', (req, res) => {
  const now = new Date().toISOString();
  const sql = `
    INSERT INTO TimeEntries (UserId, EntryType, StartTime)
    VALUES (?, 'StartWork', ?)
  `;
  db.run(sql, [req.user.id, now], function (err) {
    if (err) return res.status(500).json({ message: 'DB error' });
    const id = this.lastID;
    logAction(req.user.id, 'CREATE_TIME_ENTRY', 'TimeEntries', id, null, JSON.stringify({ EntryType: 'StartWork', StartTime: now }));
    res.status(201).json({
      id,
      userId: req.user.id,
      entryType: 'StartWork',
      startTime: now,
      endTime: null,
      comment: null
    });
  });
});

router.post('/end-work', (req, res) => {
  const now = new Date().toISOString();
  const sql = `
    INSERT INTO TimeEntries (UserId, EntryType, StartTime)
    VALUES (?, 'EndWork', ?)
  `;
  db.run(sql, [req.user.id, now], function (err) {
    if (err) return res.status(500).json({ message: 'DB error' });
    const id = this.lastID;
    logAction(req.user.id, 'CREATE_TIME_ENTRY', 'TimeEntries', id, null, JSON.stringify({ EntryType: 'EndWork', StartTime: now }));
    res.status(201).json({
      id,
      userId: req.user.id,
      entryType: 'EndWork',
      startTime: now,
      endTime: null,
      comment: null
    });
  });
});

router.post('/break-start', (req, res) => {
  const now = new Date().toISOString();
  const sql = `
    INSERT INTO TimeEntries (UserId, EntryType, StartTime)
    VALUES (?, 'BreakStart', ?)
  `;
  db.run(sql, [req.user.id, now], function (err) {
    if (err) return res.status(500).json({ message: 'DB error' });
    const id = this.lastID;
    logAction(req.user.id, 'CREATE_TIME_ENTRY', 'TimeEntries', id, null, JSON.stringify({ EntryType: 'BreakStart', StartTime: now }));
    res.status(201).json({
      id,
      userId: req.user.id,
      entryType: 'BreakStart',
      startTime: now,
      endTime: null,
      comment: null
    });
  });
});

router.post('/break-end', (req, res) => {
  const now = new Date().toISOString();
  const sql = `
    INSERT INTO TimeEntries (UserId, EntryType, StartTime)
    VALUES (?, 'BreakEnd', ?)
  `;
  db.run(sql, [req.user.id, now], function (err) {
    if (err) return res.status(500).json({ message: 'DB error' });
    const id = this.lastID;
    logAction(req.user.id, 'CREATE_TIME_ENTRY', 'TimeEntries', id, null, JSON.stringify({ EntryType: 'BreakEnd', StartTime: now }));
    res.status(201).json({
      id,
      userId: req.user.id,
      entryType: 'BreakEnd',
      startTime: now,
      endTime: null,
      comment: null
    });
  });
});

router.get('/my', (req, res) => {
  const { from, to } = req.query;
  let sql = 'SELECT * FROM TimeEntries WHERE UserId = ?';
  const params = [req.user.id];
  if (from) {
    sql += ' AND StartTime >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND StartTime <= ?';
    params.push(to);
  }
  sql += ' ORDER BY StartTime ASC';
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    res.json(rows);
  });
});

module.exports = router;
router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { startTime, endTime, comment } = req.body;

  if (!startTime && !endTime && comment === undefined) {
    return res.status(400).json({ message: 'Nothing to update' });
  }

  db.get('SELECT * FROM TimeEntries WHERE Id = ?', [id], (err, entry) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    if (!entry) return res.status(404).json({ message: 'Time entry not found' });

    if (req.user.role !== 'Admin' && entry.UserId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const newStartTime = startTime || entry.StartTime;
    const newEndTime = endTime || entry.EndTime;
    const newComment = comment !== undefined ? comment : entry.Comment;

    const oldValue = JSON.stringify({
      StartTime: entry.StartTime,
      EndTime: entry.EndTime,
      Comment: entry.Comment
    });

    const sql = `
      UPDATE TimeEntries
      SET StartTime = ?, EndTime = ?, Comment = ?
      WHERE Id = ?
    `;
    db.run(sql, [newStartTime, newEndTime, newComment, id], function (err) {
      if (err) return res.status(500).json({ message: 'DB error' });

      const newValue = JSON.stringify({
        StartTime: newStartTime,
        EndTime: newEndTime,
        Comment: newComment
      });

      logAction(
        req.user.id,
        'UPDATE_TIME_ENTRY',
        'TimeEntries',
        id,
        oldValue,
        newValue
      );

      res.json({
        id,
        userId: entry.UserId,
        entryType: entry.EntryType,
        startTime: newStartTime,
        endTime: newEndTime,
        comment: newComment
      });
    });
  });
});
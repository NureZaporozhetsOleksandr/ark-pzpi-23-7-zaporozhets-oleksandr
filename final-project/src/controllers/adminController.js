const express = require('express');
const db = require('../../db/db');
const { logAction } = require('../auth');

const router = express.Router();

/**
 * GET /api/admin/users-with-stats?from=2025-01-01&to=2025-01-31
 * Список користувачів з базовою статистикою за період
 */
router.get('/users-with-stats', (req, res) => {
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ message: 'Missing from or to' });
  }

  const sql = `
    SELECT 
      u.Id,
      u.FullName,
      u.Login,
      u.Email,
      u.Role,
      u.IsActive,
      COUNT(t.Id) AS timeEntryCount
    FROM Users u
    LEFT JOIN TimeEntries t 
      ON t.UserId = u.Id
      AND t.StartTime >= ?
      AND t.StartTime <= ?
    GROUP BY u.Id
    ORDER BY u.FullName
  `;

  db.all(sql, [from, to], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'DB error (users-with-stats)' });
    }

    res.json({
      from,
      to,
      items: rows
    });
  });
});

/**
 * POST /api/admin/users/:id/block
 * Блокування користувача
 */
router.post('/users/:id/block', (req, res) => {
  const userId = parseInt(req.params.id, 10);

  db.get(
    'SELECT Id, FullName, Role, IsActive FROM Users WHERE Id = ?',
    [userId],
    (err, userRow) => {
      if (err) {
        return res.status(500).json({ message: 'DB error (select user)' });
      }
      if (!userRow) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (!userRow.IsActive) {
        return res.status(400).json({ message: 'User already blocked' });
      }

      const oldValue = JSON.stringify(userRow);

      db.run(
        'UPDATE Users SET IsActive = 0 WHERE Id = ?',
        [userId],
        (err2) => {
          if (err2) {
            return res.status(500).json({ message: 'DB error (block user)' });
          }

          const newValue = JSON.stringify({ ...userRow, IsActive: 0 });

          logAction(
            req.user.id,
            'BlockUser',
            'Users',
            userId,
            oldValue,
            newValue
          );

          res.json({ message: 'User blocked', userId });
        }
      );
    }
  );
});

/**
 * POST /api/admin/users/:id/unblock
 * Розблокування користувача
 */
router.post('/users/:id/unblock', (req, res) => {
  const userId = parseInt(req.params.id, 10);

  db.get(
    'SELECT Id, FullName, Role, IsActive FROM Users WHERE Id = ?',
    [userId],
    (err, userRow) => {
      if (err) {
        return res.status(500).json({ message: 'DB error (select user)' });
      }
      if (!userRow) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (userRow.IsActive) {
        return res.status(400).json({ message: 'User already active' });
      }

      const oldValue = JSON.stringify(userRow);

      db.run(
        'UPDATE Users SET IsActive = 1 WHERE Id = ?',
        [userId],
        (err2) => {
          if (err2) {
            return res.status(500).json({ message: 'DB error (unblock user)' });
          }

          const newValue = JSON.stringify({ ...userRow, IsActive: 1 });

          logAction(
            req.user.id,
            'UnblockUser',
            'Users',
            userId,
            oldValue,
            newValue
          );

          res.json({ message: 'User unblocked', userId });
        }
      );
    }
  );
});

/**
 * PATCH /api/admin/users/:id/role
 * Зміна ролі користувача
 * body: { role: 'Admin' | 'Manager' | 'Employee' }
 */
router.patch('/users/:id/role', (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { role } = req.body;

  const allowedRoles = ['Admin', 'Manager', 'Employee'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  db.get(
    'SELECT Id, FullName, Role, IsActive FROM Users WHERE Id = ?',
    [userId],
    (err, userRow) => {
      if (err) {
        return res.status(500).json({ message: 'DB error (select user)' });
      }
      if (!userRow) {
        return res.status(404).json({ message: 'User not found' });
      }

      const oldValue = JSON.stringify(userRow);

      db.run(
        'UPDATE Users SET Role = ? WHERE Id = ?',
        [role, userId],
        (err2) => {
          if (err2) {
            return res.status(500).json({ message: 'DB error (change role)' });
          }

          const newValue = JSON.stringify({ ...userRow, Role: role });

          logAction(
            req.user.id,
            'ChangeUserRole',
            'Users',
            userId,
            oldValue,
            newValue
          );

          res.json({ message: 'Role updated', userId, role });
        }
      );
    }
  );
});

/**
 * GET /api/admin/system-stats
 * Загальна статистика системи
 */
router.get('/system-stats', (req, res) => {
  const sql = `
    SELECT
      (SELECT COUNT(*) FROM Users WHERE IsActive = 1) AS activeUsers,
      (SELECT COUNT(*) FROM Users WHERE IsActive = 0) AS blockedUsers,
      (SELECT COUNT(*) FROM Users) AS totalUsers,
      (SELECT COUNT(*) FROM TimeEntries) AS totalTimeEntries,
      (SELECT COUNT(*) FROM AbsenceRecords) AS totalAbsences
  `;

  db.get(sql, [], (err, row) => {
    if (err) {
      return res.status(500).json({ message: 'DB error (system-stats)' });
    }

    res.json(row);
  });
});

module.exports = router;

const express = require('express')
const db = require('../../db/db')
const { logAction } = require('../auth')

const router = express.Router()

router.post('/events', (req, res) => {
  const { deviceId, type } = req.body

  if (!type) return res.status(400).json({ message: 'Missing type' })

  const map = {
    START_WORK: 'StartWork',
    END_WORK: 'EndWork',
    BREAK_START: 'BreakStart',
    BREAK_END: 'BreakEnd'
  }

  const entryType = map[type] || type
  const userId = req.user.id
  const ts = new Date().toISOString()
  const comment = deviceId ? `device:${deviceId}` : null

  const sql = `
    INSERT INTO TimeEntries (UserId, EntryType, StartTime, EndTime, Comment)
    VALUES (?, ?, ?, ?, ?)
  `

  db.run(sql, [userId, entryType, ts, null, comment], function(err) {
    if (err) {
      console.error('IOT insert error:', err.message)
      return res.status(500).json({ message: 'DB error', details: err.message })
    }

    try {
      logAction(userId, 'IOT_EVENT', 'TimeEntries', this.lastID, null, JSON.stringify({ deviceId, type }))
    } catch (e) {}

    return res.status(201).json({ id: this.lastID, entryType, ts })
  })
})

module.exports = router

const express = require('express')
const bcrypt = require('bcryptjs')
const db = require('../../db/db')
const { generateToken, logAction, authMiddleware } = require('../auth')

const router = express.Router()

router.post('/register', (req, res) => {
  const { fullName, login, email, password } = req.body

  if (!fullName || !login || !email || !password) {
    return res.status(400).json({ message: 'Missing fields' })
  }

  const cleanFullName = String(fullName).trim()
  const cleanLogin = String(login).trim()
  const cleanEmail = String(email).trim().toLowerCase()
  const cleanPassword = String(password)

  db.get(
    'SELECT Id FROM Users WHERE Login = ? OR Email = ? LIMIT 1',
    [cleanLogin, cleanEmail],
    (err, row) => {
      if (err) {
        console.error('REGISTER select error:', err)
        return res.status(500).json({ message: 'DB error', details: err.message })
      }

      if (row) {
        return res.status(400).json({ message: 'Login or email already exists' })
      }

      const hash = bcrypt.hashSync(cleanPassword, 10)

      const sql = `
        INSERT INTO Users (FullName, Login, Email, PasswordHash, Role, IsActive)
        VALUES (?, ?, ?, ?, 'Employee', 1)
      `

      db.run(sql, [cleanFullName, cleanLogin, cleanEmail, hash], function(err) {
        if (err) {
          console.error('REGISTER insert error:', err)
          return res.status(500).json({ message: 'DB error', details: err.message })
        }

        const userId = this.lastID

        try {
          logAction(
            null,
            'CREATE_USER',
            'Users',
            userId,
            null,
            JSON.stringify({ fullName: cleanFullName, login: cleanLogin, email: cleanEmail })
          )
        } catch (e) {
          console.error('REGISTER logAction error:', e)
        }

        return res.status(201).json({
          id: userId,
          fullName: cleanFullName,
          login: cleanLogin,
          email: cleanEmail,
          role: 'Employee',
          isActive: true
        })
      })
    }
  )
})

router.post('/login', (req, res) => {
  const { login, password } = req.body

  if (!login || !password) {
    return res.status(400).json({ message: 'Missing login or password' })
  }

  const cleanLogin = String(login).trim()
  const cleanPassword = String(password)

  db.get('SELECT * FROM Users WHERE Login = ?', [cleanLogin], (err, user) => {
    if (err) {
      console.error('LOGIN select error:', err)
      return res.status(500).json({ message: 'DB error', details: err.message })
    }

    if (!user || !user.IsActive) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const ok = bcrypt.compareSync(cleanPassword, user.PasswordHash)
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' })

    const token = generateToken(user)

    return res.json({
      token,
      user: {
        id: user.Id,
        fullName: user.FullName,
        role: user.Role
      }
    })
  })
})

router.get('/me', authMiddleware, (req, res) => {
  db.get(
    'SELECT Id, FullName, Login, Email, Role, IsActive FROM Users WHERE Id = ?',
    [req.user.id],
    (err, user) => {
      if (err) {
        console.error('ME select error:', err)
        return res.status(500).json({ message: 'DB error', details: err.message })
      }
      if (!user) return res.status(404).json({ message: 'User not found' })
      return res.json(user)
    }
  )
})

module.exports = router

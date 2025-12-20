const sqlite3 = require('sqlite3').verbose()
const path = require('path')

const DB_PATH = path.join(__dirname, 'AtarkLabaDB.db')

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('DB open error:', err.message)
  } else {
    console.log('Connected to SQLite DB:', DB_PATH)
  }
})

// (не обов’язково, але корисно)
db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON')
})

module.exports = db

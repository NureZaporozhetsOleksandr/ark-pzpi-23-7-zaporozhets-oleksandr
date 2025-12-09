const sqlite3 = require('sqlite3').verbose();

const DB_PATH = './AtarkLabaDB.db';

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('DB error:', err.message);
  } else {
    console.log('Connected to SQLite DB');
  }
});

module.exports = db;

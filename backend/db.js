const mysql = require('mysql2/promise');
require('dotenv').config({ path: __dirname + '/.env' });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'medical_shop',
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: 'Z'
});

async function testConnection() {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    return rows.length > 0 && rows[0].ok === 1;
  } catch (error) {
    return false;
  }
}

module.exports = { pool, testConnection };

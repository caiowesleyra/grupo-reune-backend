const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'srv1896.hstgr.io',
  user: 'u167429742_adminreune',
  password: '270389Caw@',
  database: 'u167429742_gruporeune_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;

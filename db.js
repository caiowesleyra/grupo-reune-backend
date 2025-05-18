require('dotenv').config();
const mysql = require('mysql2');

console.log('✅ Variáveis carregadas:');
console.log('HOST:', process.env.DB_HOST);
console.log('PORT:', process.env.DB_PORT); // ✅ Agora também mostramos a porta
console.log('USER:', process.env.DB_USER);
console.log('DATABASE:', process.env.DB_NAME);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT, // ✅ Porta pública adicionada aqui
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Erro ao conectar ao banco:', err);
  } else {
    console.log('🟢 Banco de dados conectado com sucesso!');
    connection.release();
  }
});

module.exports = pool;

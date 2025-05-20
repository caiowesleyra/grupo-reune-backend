require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const app = express();
const db = require('./db');

const PORT = process.env.PORT;

if (!PORT) {
  console.error("❌ A variável de ambiente PORT não está definida. Encerrando.");
  process.exit(1);
}

// ✅ CORS CONFIGURADO COM TODOS OS DOMÍNIOS NECESSÁRIOS
const corsOptions = {
  origin: [
    "https://site-grupo-reune.vercel.app",
    "https://site-grupo-reune-git-deploy-fix-caio-wesleys-projects.vercel.app",
    "https://www.gruporeune.com",
    "http://localhost:3000"
  ],
  methods: ["GET", "POST"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// TESTE RÁPIDO
app.get('/', (req, res) => {
  res.send('Servidor do GRUPO REUNE está funcionando!');
});

// ✅ ROTA TEMPORÁRIA PARA CRIAR A TABELA "cotas"
app.get('/api/criar-tabela-cotas', (req, res) => {
  const sql = `
    CREATE TABLE cotas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_usuario INT NOT NULL,
      qtd_cotas INT NOT NULL,
      status ENUM('pendente', 'aprovado', 'rejeitado') DEFAULT 'pendente',
      data_contribuicao DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error("❌ Erro ao criar tabela:", err);
      return res.status(500).json({ erro: "Erro ao criar tabela." });
    }
    console.log("✅ Tabela 'cotas' criada!");
    res.status(200).json({ mensagem: "Tabela 'cotas' criada com sucesso!" });
  });
});

// CADASTRO
app.post('/api/cadastrar', async (req, res) => {
  const { nome, email, telefone, senha } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(senha, 10);
    const sql = 'INSERT INTO usuarios (nome, email, telefone, senha) VALUES (?, ?, ?, ?)';
    const values = [nome, email, telefone, hashedPassword];

    db.query(sql, values, (err, result) => {
      if (err) {
        console.error('❌ Erro ao inserir no banco:', err);
        return res.status(500).json({ erro: 'Erro ao cadastrar usuário.' });
      }

      res.status(200).json({
        success: true,
        usuario: { nome, email, telefone }
      });
    });
  } catch (error) {
    console.error('❌ Erro ao criptografar a senha:', error);
    res.status(500).json({ erro: 'Erro interno ao cadastrar.' });
  }
});

// LOGIN
app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  const sql = 'SELECT * FROM usuarios WHERE email = ?';

  db.query(sql, [email], async (err, results) => {
    if (err) return res.status(500).json({ erro: 'Erro ao buscar usuário.' });
    if (results.length === 0) return res.status(401).json({ erro: 'Email ou senha inválidos.' });

    const usuario = results[0];
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

    if (!senhaCorreta) return res.status(401).json({ erro: 'Email ou senha inválidos.' });

    res.status(200).json({
      mensagem: 'Login realizado com sucesso!',
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }
    });
  });
});

// CONTATO
app.post('/api/contato', (req, res) => {
  const { nome, email, mensagem } = req.body;
  const sql = 'INSERT INTO contatos (nome, email, mensagem) VALUES (?, ?, ?)';
  db.query(sql, [nome, email, mensagem], (err, result) => {
    if (err) return res.status(500).json({ erro: 'Erro ao enviar mensagem.' });
    res.status(200).json({ mensagem: 'Mensagem enviada com sucesso!' });
  });
});

// LISTAR CONTATOS
app.get('/api/contatos', (req, res) => {
  db.query('SELECT * FROM contatos ORDER BY id DESC', (err, results) => {
    if (err) return res.status(500).json({ erro: 'Erro ao buscar contatos.' });
    res.status(200).json(results);
  });
});

// INICIAR SERVIDOR
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});

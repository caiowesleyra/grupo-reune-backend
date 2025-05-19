require('dotenv').config(); // ✅ PRIMEIRA LINHA
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const app = express();
const PORT = process.env.PORT || 5000;
const db = require('./db');

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

// ROTA PRINCIPAL
app.get('/', (req, res) => {
  res.send('Servidor do GRUPO REUNE está funcionando!');
});

// ✅ ROTA DE CADASTRO COM SENHA CRIPTOGRAFADA
app.post('/api/cadastrar', async (req, res) => {
  const { nome, email, telefone, senha } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(senha, 10);
    const sql = 'INSERT INTO usuarios (nome, email, telefone, senha) VALUES (?, ?, ?, ?)';
    const values = [nome, email, telefone, hashedPassword];

    db.query(sql, values, (err, result) => {
      if (err) {
        console.error('Erro ao inserir no banco:', err);
        return res.status(500).json({ erro: 'Erro ao cadastrar usuário.' });
      }

      res.status(200).json({
        success: true,
        usuario: { nome, email, telefone }
      });
    });
  } catch (error) {
    console.error('Erro ao criptografar a senha:', error);
    res.status(500).json({ erro: 'Erro interno ao cadastrar.' });
  }
});

// ✅ ROTA DE LOGIN
app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  console.log('🔐 Tentando login com:', email);

  const sql = 'SELECT * FROM usuarios WHERE email = ?';
  db.query(sql, [email], async (err, results) => {
    if (err) {
      console.error('❌ Erro ao buscar usuário:', err);
      return res.status(500).json({ erro: 'Erro ao buscar usuário.' });
    }

    if (results.length === 0) {
      console.warn('⚠️ Usuário não encontrado:', email);
      return res.status(401).json({ erro: 'Email ou senha inválidos.' });
    }

    const usuario = results[0];
    console.log('✅ Usuário encontrado:', usuario);

    try {
      const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
      console.log('🔍 Comparação de senha:', senhaCorreta);

      if (!senhaCorreta) {
        console.warn('❌ Senha incorreta para o email:', email);
        return res.status(401).json({ erro: 'Email ou senha inválidos.' });
      }

      res.status(200).json({
        mensagem: 'Login realizado com sucesso!',
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email
        }
      });
    } catch (compareErr) {
      console.error('❌ Erro ao comparar senha:', compareErr);
      res.status(500).json({ erro: 'Erro ao verificar senha.' });
    }
  });
});

// ✅ ROTA DE CONTATO
app.post('/api/contato', (req, res) => {
  const { nome, email, mensagem } = req.body;
  const sql = 'INSERT INTO contatos (nome, email, mensagem) VALUES (?, ?, ?)';
  const values = [nome, email, mensagem];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('❌ Erro ao salvar contato:', err);
      return res.status(500).json({ erro: 'Erro ao enviar mensagem de contato.' });
    }

    res.status(200).json({ mensagem: 'Mensagem enviada com sucesso!' });
  });
});

// ✅ ROTA PARA LISTAR CONTATOS
app.get('/api/contatos', (req, res) => {
  const sql = 'SELECT * FROM contatos ORDER BY id DESC';

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Erro ao buscar contatos:', err);
      return res.status(500).json({ erro: 'Erro ao buscar contatos.' });
    }
    res.status(200).json(results);
  });
});

// INICIAR SERVIDOR - CORRETO PARA RAILWAY
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta`, PORT);
});

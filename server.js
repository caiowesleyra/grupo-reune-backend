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
    "https://www.gruporeune.com",
    "https://painel.gruporeune.com",
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

// ✅ ROTA TEMPORÁRIA PARA CRIAR A TABELA "premio_dia"
app.get('/api/criar-tabela-premio', (req, res) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS premio_dia (
      id INT AUTO_INCREMENT PRIMARY KEY,
      valor_total DECIMAL(10,2) NOT NULL,
      data_registro DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error("❌ Erro ao criar a tabela 'premio_dia':", err);
      return res.status(500).json({ erro: "Erro ao criar tabela 'premio_dia'." });
    }

    console.log("✅ Tabela 'premio_dia' criada com sucesso!");
    res.status(200).json({ mensagem: "Tabela 'premio_dia' criada com sucesso!" });
  });
});

// ✅ ROTA PARA CONSULTAR TOTAL DE COTAS APROVADAS DE UM USUÁRIO
app.get('/api/total-cotas/:id', (req, res) => {
  const id_usuario = req.params.id;

  const sql = `
    SELECT SUM(qtd_cotas) AS total
    FROM cotas
    WHERE id_usuario = ? AND status = 'aprovado'
  `;

  db.query(sql, [id_usuario], (err, results) => {
    if (err) {
      console.error("❌ Erro ao buscar cotas:", err);
      return res.status(500).json({ erro: "Erro ao buscar total de cotas." });
    }

    const total = results[0].total || 0;
    res.status(200).json({ total });
  });
});

// ✅ ROTA PARA CONSULTAR TOTAL DE COTAS GERAL (TODOS)
app.get('/api/total-cotas-geral', (req, res) => {
  const sql = `
    SELECT SUM(qtd_cotas) AS total
    FROM cotas
    WHERE status = 'aprovado'
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Erro ao buscar cotas gerais:", err);
      return res.status(500).json({ erro: "Erro ao buscar total geral de cotas." });
    }

    const total = results[0].total || 0;
    res.status(200).json({ total });
  });
});

// ✅ ROTA PARA OBTER O SALDO DIÁRIO DE COMISSÃO DO COLABORADOR (SEM async/await)
app.get("/api/saldo-colaborador/:id", (req, res) => {
  const { id } = req.params;
  const dataHoje = new Date().toISOString().slice(0, 10); // yyyy-mm-dd

  const sql = `
    SELECT SUM(valor_contribuicao * 0.10) AS saldo
    FROM indicacoes
    WHERE indicou_id = ? AND data_contribuicao = ?
  `;

  db.query(sql, [id, dataHoje], (err, result) => {
    if (err) {
      console.error("❌ Erro ao buscar saldo do colaborador:", err);
      return res.status(500).json({ erro: "Erro ao buscar saldo do colaborador" });
    }

    const saldo = result[0].saldo || 0;
    res.json({ saldo: parseFloat(saldo.toFixed(2)) });
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

// ✅ ROTA PARA INSERIR O VALOR DO PRÊMIO DO DIA (feito manualmente pelo admin)
app.post('/api/premio-do-dia', (req, res) => {
  const { valor_total } = req.body;

  if (!valor_total) {
    return res.status(400).json({ erro: "O valor_total é obrigatório." });
  }

  const sql = `INSERT INTO premio_dia (valor_total) VALUES (?)`;

  db.query(sql, [valor_total], (err, result) => {
    if (err) {
      console.error("❌ Erro ao inserir valor do prêmio:", err);
      return res.status(500).json({ erro: "Erro ao salvar valor do prêmio do dia." });
    }

    res.status(200).json({ mensagem: "Valor do prêmio do dia salvo com sucesso!" });
  });
});

// ✅ ROTA PARA CONSULTAR O ÚLTIMO VALOR DO PRÊMIO DO DIA
app.get('/api/premio-do-dia', (req, res) => {
  const sql = `
    SELECT valor_total FROM premio_dia
    ORDER BY data_registro DESC
    LIMIT 1
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Erro ao buscar prêmio do dia:", err);
      return res.status(500).json({ erro: "Erro ao buscar prêmio do dia." });
    }

    const valor_total = results.length > 0 ? results[0].valor_total : 0;
    res.status(200).json({ valor_total });
  });
});

// ✅ ROTA PARA CADASTRAR UM NOVO INDICADO
app.post("/api/indicar", async (req, res) => {
  const { nome, email, whatsapp, cpf, senha } = req.body;

  if (!nome || !email || !whatsapp || !senha) {
    return res.status(400).json({ erro: "Campos obrigatórios não preenchidos." });
  }

  try {
    const hashed = await bcrypt.hash(senha, 10);

    const sql = `
      INSERT INTO indicacoes (nome, email, whatsapp, cpf, senha, data_contribuicao, status, indicou_id)
      VALUES (?, ?, ?, ?, ?, NOW(), 'pendente', ?)
    `;

    const usuarioLogado = req.headers["x-user-id"];
    if (!usuarioLogado) {
      return res.status(401).json({ erro: "ID do usuário logado ausente." });
    }

    const values = [nome, email, whatsapp, cpf, hashed, usuarioLogado];

    db.query(sql, values, (err, result) => {
      if (err) {
        console.error("❌ Erro ao cadastrar indicado:", err);
        return res.status(500).json({ erro: "Erro ao cadastrar indicado." });
      }

      res.status(200).json({ mensagem: "Indicado cadastrado com sucesso!" });
    });
  } catch (error) {
    console.error("❌ Erro ao criptografar senha:", error);
    res.status(500).json({ erro: "Erro interno." });
  }
});

// Rota para consultar o saldo total disponível para saque
app.get("/api/saldo-disponivel/:id_usuario", (req, res) => {
  const { id_usuario } = req.params;

  const sql = "SELECT saldo FROM saldos_usuario WHERE id_usuario = ?";

  db.query(sql, [id_usuario], (err, results) => {
    if (err) {
      console.error("❌ Erro ao buscar saldo disponível:", err);
      return res.status(500).json({ erro: "Erro ao buscar saldo." });
    }

    const saldo = results.length > 0 ? results[0].saldo : 0;
    res.status(200).json({ saldo });
  });
});

// Rota para adicionar valor ao saldo (tanto do prêmio quanto da comissão)
app.post("/api/saldo-disponivel/adicionar", (req, res) => {
  const { id_usuario, valor } = req.body;

  if (!id_usuario || !valor) {
    return res.status(400).json({ erro: "id_usuario e valor são obrigatórios." });
  }

  const sql = `
    INSERT INTO saldos_usuario (id_usuario, saldo)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE saldo = saldo + VALUES(saldo), atualizado_em = NOW()
  `;

  db.query(sql, [id_usuario, valor], (err, result) => {
    if (err) {
      console.error("❌ Erro ao adicionar saldo:", err);
      return res.status(500).json({ erro: "Erro ao adicionar saldo." });
    }

    res.status(200).json({ mensagem: "Saldo atualizado com sucesso!" });
  });
});

// Rota para deduzir valor do saldo ao fazer saque
app.post("/api/saldo-disponivel/deduzir", (req, res) => {
  const { id_usuario, valor } = req.body;

  if (!id_usuario || !valor) {
    return res.status(400).json({ erro: "id_usuario e valor são obrigatórios." });
  }

  const sql = `
    UPDATE saldos_usuario
    SET saldo = saldo - ?, atualizado_em = NOW()
    WHERE id_usuario = ? AND saldo >= ?
  `;

  db.query(sql, [valor, id_usuario, valor], (err, result) => {
    if (err) {
      console.error("❌ Erro ao deduzir saldo:", err);
      return res.status(500).json({ erro: "Erro ao deduzir saldo." });
    }

    if (result.affectedRows === 0) {
      return res.status(400).json({ erro: "Saldo insuficiente ou usuário não encontrado." });
    }

    res.status(200).json({ mensagem: "Saldo deduzido com sucesso!" });
  });
});

// INICIAR SALDOS
app.get("/api/iniciar-saldos", (req, res) => {
  const sql = `
    INSERT INTO saldos_usuario (id_usuario, saldo, atualizado_em)
    SELECT u.id, 0.00, NOW()
    FROM usuarios u
    WHERE NOT EXISTS (
      SELECT 1 FROM saldos_usuario s WHERE s.id_usuario = u.id
    )
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error("❌ Erro ao iniciar saldos:", err);
      return res.status(500).json({ erro: "Erro ao iniciar saldos dos usuários." });
    }

    res.status(200).json({ mensagem: "✅ Saldos iniciados com sucesso!", inseridos: result.affectedRows });
  });
});

// ✅ ROTA PARA ATUALIZAR SALDO DO USUÁRIO (somar valor recebido)
app.post("/api/atualizar-saldo", (req, res) => {
  const { id_usuario, valor } = req.body;

  if (!id_usuario || typeof valor !== "number") {
    return res.status(400).json({ erro: "Dados inválidos." });
  }

  const sql = `
    INSERT INTO saldos_usuario (id_usuario, saldo, atualizado_em)
    VALUES (?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      saldo = saldo + VALUES(saldo),
      atualizado_em = NOW()
  `;

  db.query(sql, [id_usuario, valor], (err, result) => {
    if (err) {
      console.error("❌ Erro ao atualizar saldo:", err);
      return res.status(500).json({ erro: "Erro ao atualizar saldo." });
    }

    res.status(200).json({ mensagem: "✅ Saldo atualizado com sucesso!" });
  });
});

// ✅ ROTA PARA OBTER SALDO DISPONÍVEL DO USUÁRIO
app.get("/api/saldo-disponivel/:id", (req, res) => {
  const id_usuario = req.params.id;

  const sql = "SELECT saldo FROM saldos_usuario WHERE id_usuario = ?";

  db.query(sql, [id_usuario], (err, result) => {
    if (err) {
      console.error("❌ Erro ao buscar saldo disponível:", err);
      return res.status(500).json({ erro: "Erro ao buscar saldo disponível." });
    }

    const saldo = result.length > 0 ? result[0].saldo : 0;
    res.status(200).json({ saldo });
  });
});

// INICIAR SERVIDOR
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});

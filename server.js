require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const app = express();
const db = require('./db');

// 🔸 Integração com Cloudinary
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: 'dwxex99zy',
  api_key: '682346214236983',
  api_secret: 'kInIKilaI0Wc5YRa_AFQTwG64HM'
});
const multer = require('multer');
const path = require('path');
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 📝 Função para registrar atividades
function registrarAtividade(tipo, usuario, cotas = null, posicao = null) {
  db.query(
    'INSERT INTO atividades_doadores (tipo, usuario, cotas, posicao) VALUES (?, ?, ?, ?)',
    [tipo, usuario, cotas, posicao],
    (err) => {
      if (err) {
        console.error("Erro ao registrar atividade:", err);
      } else {
        console.log(`Atividade registrada: ${tipo} - ${usuario}`);
      }
    }
  );
}

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

    // 🔔 Registrar atividade de novo doador
    registrarAtividade('new', nome);

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

// Endpoint para buscar usuário por ID
app.get('/api/usuarios/:id', (req, res) => {
  const id = req.params.id;
  const sql = 'SELECT id, nome, email, telefone AS whatsapp, cpf, status FROM usuarios WHERE id = ?';

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error('Erro ao buscar usuário:', err);
      return res.status(500).json({ erro: 'Erro ao buscar usuário' });
    }

    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ erro: 'Usuário não encontrado' });
    }
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
  console.log("✅ Rota de cadastro de indicado chamada");
  const { nome, email, whatsapp, cpf, senha, qtd_cotas } = req.body; // Adicionei qtd_cotas aqui

  if (!nome || !email || !whatsapp || !senha) {
    return res.status(400).json({ erro: "Campos obrigatórios não preenchidos." });
  }

  try {
    const hashed = await bcrypt.hash(senha, 10);

    const sql = `
      INSERT INTO indicacoes (nome, email, whatsapp, cpf, senha, data_contribuicao, status, indicou_id)
      VALUES (?, ?, ?, ?, ?, NOW(), 'pendente', 1)
    `;

    const usuarioLogado = req.headers["x-user-id"];
    if (!usuarioLogado) {
      return res.status(401).json({ erro: "ID do usuário logado ausente." });
    }

    const values = [nome, email, whatsapp, cpf, hashed, usuarioLogado];

    db.query(sql, values, (err, result) => {
      if (err) {
        console.error(`❌ Erro ao cadastrar indicado:`, err);
        return res.status(500).json({
          erro: "Erro ao cadastrar indicado.",
          detalhes: err.sqlMessage || err.message || err
        });
      }

      // ✅ Registrar atividade de doação automaticamente
      registrarAtividade('donation', nome, qtd_cotas);

      // ✅ Verificar se houve mudança no ranking após a doação
      verificarMudancaRanking();

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

// ✅ ROTA PARA CONSULTAR O SALDO TOTAL DISPONÍVEL PARA SAQUE DE UM USUÁRIO
app.get("/api/saldo-disponivel/:id", (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT saldo FROM saldos_usuario WHERE id_usuario = ?
  `;

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("❌ Erro ao buscar saldo disponível:", err);
      return res.status(500).json({ erro: "Erro ao buscar saldo disponível." });
    }

    const saldo = results.length > 0 ? results[0].saldo : 0;
    res.status(200).json({ saldo });
  });
});

// ✅ ROTA PARA ATUALIZAR O SALDO DISPONÍVEL PARA SAQUE
app.post("/api/atualizar-saldo-disponivel/:id", async (req, res) => {
  const id_usuario = req.params.id;

  try {
    // Buscar o valor do prêmio do dia
    const premioSql = `SELECT valor_total FROM premio_dia ORDER BY data_registro DESC LIMIT 1`;
    const [premioResult] = await db.promise().query(premioSql);
    const premio = premioResult.length > 0 ? parseFloat(premioResult[0].valor_total) : 0;

    // Buscar comissão de hoje (10% das indicações feitas HOJE)
    const hoje = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
    const comissaoSql = `
      SELECT SUM(valor_contribuicao * 0.10) AS comissao
      FROM indicacoes
      WHERE indicou_id = ? AND data_contribuicao = ?
    `;
    const [comissaoResult] = await db.promise().query(comissaoSql, [id_usuario, hoje]);
    const comissao = comissaoResult[0].comissao || 0;

    const valorTotal = premio + comissao;

    // Verificar se já existe registro de saldo
    const [existe] = await db.promise().query(
      `SELECT * FROM saldos_usuario WHERE id_usuario = ?`,
      [id_usuario]
    );

    if (existe.length > 0) {
      // Atualizar saldo somando ao valor atual
      const saldoAtual = parseFloat(existe[0].saldo);
      const novoSaldo = saldoAtual + valorTotal;

      await db.promise().query(
        `UPDATE saldos_usuario SET saldo = ?, atualizado_em = NOW() WHERE id_usuario = ?`,
        [novoSaldo, id_usuario]
      );
    } else {
      // Inserir novo saldo
      await db.promise().query(
        `INSERT INTO saldos_usuario (id_usuario, saldo, atualizado_em) VALUES (?, ?, NOW())`,
        [id_usuario, valorTotal]
      );
    }

    res.status(200).json({
      mensagem: "Saldo atualizado com sucesso!",
      premio,
      comissao,
      acumulado: valorTotal,
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar saldo:", error);
    res.status(500).json({ erro: "Erro ao atualizar saldo disponível para saque." });
  }
});

// ✅ ROTA PARA ACUMULAR AUTOMATICAMENTE O SALDO TOTAL DISPONÍVEL
app.post("/api/atualizar-saldo", async (req, res) => {
  const dataHoje = new Date().toISOString().slice(0, 10);

  const sqlUsuarios = "SELECT id FROM usuarios";
  const sqlPremioDia = `
    SELECT valor_total FROM premio_dia
    ORDER BY data_registro DESC LIMIT 1
  `;

  db.query(sqlUsuarios, async (err, usuarios) => {
    if (err) return res.status(500).json({ erro: "Erro ao buscar usuários" });

    db.query(sqlPremioDia, async (err2, resultadoPremio) => {
      if (err2) return res.status(500).json({ erro: "Erro ao buscar prêmio do dia" });

      const premioTotal = resultadoPremio[0]?.valor_total || 0;

      for (const user of usuarios) {
        const userId = user.id;

        const sqlComissao = `
          SELECT SUM(valor_contribuicao * 0.10) AS comissao
          FROM indicacoes
          WHERE indicou_id = ? AND data_contribuicao = ?
        `;

        db.query(sqlComissao, [userId, dataHoje], (err3, resultadoComissao) => {
          if (err3) return;

          const comissao = resultadoComissao[0]?.comissao || 0;

          const sqlTotalCotas = `
            SELECT SUM(qtd_cotas) AS total
            FROM cotas
            WHERE status = 'aprovado'
          `;
          const sqlCotasUsuario = `
            SELECT SUM(qtd_cotas) AS total
            FROM cotas
            WHERE id_usuario = ? AND status = 'aprovado'
          `;

          db.query(sqlTotalCotas, (err4, resultGeral) => {
            if (err4) return;
            db.query(sqlCotasUsuario, [userId], (err5, resultUser) => {
              if (err5) return;

              const cotasGeral = resultGeral[0]?.total || 0;
              const cotasUser = resultUser[0]?.total || 0;
              const percentual = cotasGeral > 0 ? cotasUser / cotasGeral : 0;
              const premioIndividual = parseFloat((premioTotal * percentual).toFixed(2));
              const valorFinal = premioIndividual + comissao;

              // Atualizar saldo geral
              const sqlAtualizarSaldo = `
                INSERT INTO saldos_usuario (id_usuario, saldo, atualizado_em)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE saldo = saldo + VALUES(saldo), atualizado_em = VALUES(atualizado_em)
              `;
              db.query(sqlAtualizarSaldo, [userId, valorFinal, dataHoje]);

              // Registrar prêmio individual na tabela premios_recebidos
              if (premioIndividual > 0) {
                const sqlPremio = `
                  INSERT INTO premios_recebidos (id_usuario, valor, data_registro)
                  VALUES (?, ?, ?)
                `;
                db.query(sqlPremio, [userId, premioIndividual, dataHoje]);
              }
            });
          });
        });
      }

      res.status(200).json({ mensagem: "Saldo e prêmios atualizados para todos os usuários." });
    });
  });
});

// ✅ ROTA PARA SALVAR O VALOR TOTAL DO LUCRO DOS ESPECIALISTAS (manual)
app.post("/api/lucro-especialistas", (req, res) => {
  const { valor_total } = req.body;

  if (!valor_total || typeof valor_total !== "number") {
    return res.status(400).json({ erro: "Valor inválido." });
  }

  const sql = `INSERT INTO lucro_especialistas (valor_total) VALUES (?)`;

  db.query(sql, [valor_total], (err, result) => {
    if (err) {
      console.error("❌ Erro ao salvar lucro:", err);
      return res.status(500).json({ erro: "Erro ao salvar lucro dos especialistas." });
    }

    res.status(200).json({ mensagem: "✅ Lucro dos especialistas salvo com sucesso!" });
  });
});

// ✅ ROTA PARA CONSULTAR O ÚLTIMO LUCRO DOS ESPECIALISTAS
app.get("/api/lucro-especialistas", (req, res) => {
  const sql = `
    SELECT valor_total FROM lucro_especialistas
    ORDER BY data_registro DESC
    LIMIT 1
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Erro ao buscar lucro:", err);
      return res.status(500).json({ erro: "Erro ao buscar lucro dos especialistas." });
    }

    const valor_total = results.length > 0 ? results[0].valor_total : 0;
    res.status(200).json({ valor_total });
  });
});

// ✅ ROTA PARA REGISTRAR O PRÊMIO INDIVIDUAL DE CADA USUÁRIO
app.post("/api/registrar-premio", async (req, res) => {
  const { id_usuario, valor } = req.body;

  if (!id_usuario || typeof valor !== "number") {
    return res.status(400).json({ erro: "Dados inválidos." });
  }

  const sql = `
    INSERT INTO premios_recebidos (id_usuario, valor, data_registro)
    VALUES (?, ?, CURDATE())
  `;

  db.query(sql, [id_usuario, valor], (err, result) => {
    if (err) {
      console.error("❌ Erro ao registrar prêmio recebido:", err);
      return res.status(500).json({ erro: "Erro ao registrar prêmio." });
    }

    res.status(200).json({ mensagem: "✅ Prêmio registrado com sucesso!" });
  });
});

// ✅ ROTA PARA CONSULTAR O TOTAL ACUMULADO DE PRÊMIOS DO USUÁRIO
app.get("/api/premios-acumulados/:id", (req, res) => {
  const id_usuario = req.params.id;

  const sql = `
    SELECT SUM(valor) AS total
    FROM premios_recebidos
    WHERE id_usuario = ?
  `;

  db.query(sql, [id_usuario], (err, result) => {
    if (err) {
      console.error("❌ Erro ao buscar prêmios acumulados:", err);
      return res.status(500).json({ erro: "Erro ao buscar prêmios acumulados." });
    }

    const total = result[0]?.total || 0;
    res.status(200).json({ total });
  });
});

// ✅ ROTA PARA OBTER DADOS COMPLETOS DE UM USUÁRIO
app.get('/api/usuario/:id', (req, res) => {
  const id = req.params.id;

  const sql = `SELECT id, nome, email, telefone, status, whatsapp, cpf FROM usuarios WHERE id = ?`;

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("❌ Erro ao buscar dados do usuário:", err);
      return res.status(500).json({ erro: "Erro ao buscar dados do usuário." });
    }

    if (result.length === 0) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    res.status(200).json({ usuario: result[0] });
  });
});

// Endpoint para buscar total de indicados diretos de um usuário
app.get('/api/indicados-diretos/:idUsuario', (req, res) => {
  const idUsuario = req.params.idUsuario;
  const sql = 'SELECT COUNT(*) AS total FROM usuarios WHERE id_indicador = ?';
  db.query(sql, [idUsuario], (err, result) => {
    if (err) return res.status(500).json({ erro: 'Erro ao buscar indicados diretos' });
    res.json({ total: result[0].total });
  });
});

// Endpoint para buscar saldo total de comissões diretas
app.get('/api/saldo-comissoes/:idUsuario', (req, res) => {
  const idUsuario = req.params.idUsuario;
  const sql = 'SELECT SUM(valor_comissao) AS total FROM comissoes WHERE id_usuario = ? AND tipo = "direta"';
  db.query(sql, [idUsuario], (err, result) => {
    if (err) return res.status(500).json({ erro: 'Erro ao buscar saldo de comissões' });
    res.json({ total: result[0].total || 0 });
  });
});

app.get('/api/ranking-doadores', async (req, res) => {
  try {
    const [result] = await db.query(`
      SELECT 
        usuarios.id,
        usuarios.nome,
        SUM(cotas.quantidade) AS cotas
      FROM usuarios
      JOIN cotas ON usuarios.id = cotas.id_usuario
      WHERE cotas.status = 'aprovado'
      GROUP BY usuarios.id, usuarios.nome
      ORDER BY cotas DESC
      LIMIT 10
    `);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar ranking." });
  }
});

app.get('/api/atividades-recentes', (req, res) => {
  db.query(
    'SELECT tipo, usuario, cotas, posicao, DATE_FORMAT(data_hora, "%d %b %Y às %H:%i") as timestamp FROM atividades_doadores ORDER BY data_hora DESC LIMIT 10',
    (err, results) => {
      if (err) {
        console.error("Erro ao buscar atividades:", err);
        return res.status(500).json({ erro: "Erro no servidor" });
      }
      res.json(results);
    }
  );
});

// 🔸 Dependências extras:
const multer = require('multer');
const path = require('path');

// Configuração do armazenamento com multer:
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // pasta onde os uploads vão ser salvos
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// 🔸 Criar as tabelas se não existir:
app.get('/api/criar-tabela-doacoes-voluntarios', (req, res) => {
  const sql1 = `
    CREATE TABLE IF NOT EXISTS doacoes_livres (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome_completo VARCHAR(255),
      valor DECIMAL(10,2),
      comprovante_url VARCHAR(255),
      data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;
  const sql2 = `
    CREATE TABLE IF NOT EXISTS voluntarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome_completo VARCHAR(255),
      whatsapp VARCHAR(20),
      cidade_estado VARCHAR(100),
      data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;
  db.query(sql1);
  db.query(sql2);
  res.send("Tabelas criadas ou já existentes!");
});

// 🔸 Rota para doação com upload:
app.post('/api/doacoes-livres', upload.single('comprovante'), async (req, res) => {
  const { nome_completo, valor } = req.body;
  const file = req.file;

  if (!nome_completo || !valor || !file) {
    return res.status(400).json({ erro: "Nome, valor e comprovante são obrigatórios." });
  }

  try {
    // Faz upload para o Cloudinary
    const result = await cloudinary.uploader.upload_stream(
      { folder: 'doacoes_comprovantes' },
      (error, uploadResult) => {
        if (error) {
          console.error("Erro ao fazer upload para Cloudinary:", error);
          return res.status(500).json({ erro: "Erro ao enviar comprovante." });
        }

        const comprovante_url = uploadResult.secure_url;

        // Salva no banco de dados
        const sql = `INSERT INTO doacoes_livres (nome_completo, valor, comprovante_url) VALUES (?, ?, ?)`;
        db.query(sql, [nome_completo, valor, comprovante_url], (err, result) => {
          if (err) {
            console.error("Erro ao registrar doação:", err);
            return res.status(500).json({ erro: "Erro ao registrar doação." });
          }
          res.status(200).json({ mensagem: "✅ Doação registrada com sucesso!" });
        });
      }
    );
    result.end(file.buffer);
  } catch (error) {
    console.error("Erro geral:", error);
    res.status(500).json({ erro: "Erro ao processar doação." });
  }
});

// 🔸 Rota para registro de voluntário:
app.post('/api/voluntarios', (req, res) => {
  const { nome_completo, whatsapp, cidade_estado } = req.body;

  if (!nome_completo || !whatsapp || !cidade_estado) {
    return res.status(400).json({ erro: "Todos os campos são obrigatórios." });
  }

  const sql = `INSERT INTO voluntarios (nome_completo, whatsapp, cidade_estado) VALUES (?, ?, ?)`;
  db.query(sql, [nome_completo, whatsapp, cidade_estado], (err, result) => {
    if (err) {
      console.error("Erro ao registrar voluntário:", err);
      return res.status(500).json({ erro: "Erro ao registrar voluntário." });
    }
    res.status(200).json({ mensagem: "Voluntário registrado com sucesso!" });
  });
});

// INICIAR SERVIDOR
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});

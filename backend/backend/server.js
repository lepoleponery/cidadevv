/* CidadeViva - API (Node.js + Express + PostgreSQL) */
try { require("dotenv").config(); } catch { /* dotenv é opcional */ }
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-troque-em-producao";
const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",").map(e => e.trim().toLowerCase()).filter(Boolean);

if (!DATABASE_URL) {
  console.error("Defina a variável de ambiente DATABASE_URL.");
  process.exit(1);
}

const local = /localhost|127\.0\.0\.1/.test(DATABASE_URL);
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: local ? false : { rejectUnauthorized: false }
});
const q = (sql, params) => pool.query(sql, params);

/* e-mails listados em ADMIN_EMAILS viram administradores */
async function promoverAdmins() {
  if (!ADMIN_EMAILS.length) return;
  await q("UPDATE usuarios SET papel = 'admin' WHERE lower(email) = ANY($1)", [ADMIN_EMAILS]);
}

/* ---------- criação das tabelas e dados iniciais ---------- */
async function prepararBanco() {
  await q(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));

  const n = await q("SELECT count(*)::int AS total FROM noticias");
  if (n.rows[0].total === 0) {
    const noticias = [
      ["Mutirão de limpeza recolhe 5 toneladas de lixo", "Voluntários se reuniram no fim de semana para limpar praças e córregos da região central.", "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=800&q=80", "2026-09-20"],
      ["Coleta seletiva chega a mais bairros", "A prefeitura amplia a coleta de recicláveis e divulga o calendário por bairro.", "https://images.unsplash.com/photo-1604187351574-c75ca79f5807?auto=format&fit=crop&w=800&q=80", "2026-09-15"],
      ["Plantio de 1.000 árvores na zona norte", "Projeto de arborização quer reduzir ilhas de calor e melhorar a qualidade do ar.", "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=800&q=80", "2026-09-10"]
    ];
    for (const x of noticias)
      await q("INSERT INTO noticias (titulo, resumo, imagem, data) VALUES ($1,$2,$3,$4)", x);
  }

  const o = await q("SELECT count(*)::int AS total FROM orgaos");
  if (o.rows[0].total === 0) {
    const orgaos = [
      ["Defesa Civil", "🚨", "199", "Enchentes, deslizamentos e riscos de desastre."],
      ["Limpeza Urbana", "🗑️", "156", "Lixo acumulado, entulho e descarte irregular."],
      ["Polícia Ambiental", "🌳", "190", "Crimes ambientais, queimadas e desmatamento."],
      ["Vigilância Sanitária", "🩺", "160", "Focos de dengue, esgoto a céu aberto e água contaminada."]
    ];
    for (const x of orgaos)
      await q("INSERT INTO orgaos (nome, icone, telefone, descricao) VALUES ($1,$2,$3,$4)", x);
  }

  await promoverAdmins();
}

/* ---------- app ---------- */
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith("image/") ? cb(null, true) : cb(new Error("Envie apenas imagens."))
});

const h = fn => (req, res, next) => fn(req, res, next).catch(next);

function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  try {
    req.userId = jwt.verify(token, JWT_SECRET).id;
    next();
  } catch {
    res.status(401).json({ erro: "Sessão inválida. Entre novamente." });
  }
}

const admin = h(async (req, res, next) => {
  const r = await q("SELECT papel FROM usuarios WHERE id = $1", [req.userId]);
  if (!r.rowCount || r.rows[0].papel !== "admin")
    return res.status(403).json({ erro: "Acesso restrito a administradores." });
  next();
});

const COLUNAS_USUARIO = `id, nome, celular, username, email, papel, criado_em AS "criadoEm"`;
const gerarToken = id => jwt.sign({ id }, JWT_SECRET, { expiresIn: "7d" });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ---------- autenticação ---------- */
app.post("/api/auth/cadastro", h(async (req, res) => {
  const { nome, celular, username, email, senha } = req.body || {};
  if (!nome || !celular || !username || !email || !senha)
    return res.status(400).json({ erro: "Preencha todos os campos." });
  if (senha.length < 6)
    return res.status(400).json({ erro: "A senha precisa ter pelo menos 6 caracteres." });

  const email1 = await q("SELECT 1 FROM usuarios WHERE lower(email) = lower($1)", [email.trim()]);
  if (email1.rowCount) return res.status(409).json({ erro: "Este e-mail já está cadastrado." });
  const user1 = await q("SELECT 1 FROM usuarios WHERE lower(username) = lower($1)", [username.trim()]);
  if (user1.rowCount) return res.status(409).json({ erro: "Este nome de usuário já está em uso." });

  const ins = await q(
    `INSERT INTO usuarios (nome, celular, username, email, senha_hash)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [nome.trim(), celular.trim(), username.trim(), email.trim().toLowerCase(), bcrypt.hashSync(senha, 10)]
  );
  await promoverAdmins();
  const r = await q(`SELECT ${COLUNAS_USUARIO} FROM usuarios WHERE id = $1`, [ins.rows[0].id]);
  res.status(201).json({ token: gerarToken(r.rows[0].id), usuario: r.rows[0] });
}));

app.post("/api/auth/login", h(async (req, res) => {
  const { email, senha } = req.body || {};
  const r = await q("SELECT *, criado_em AS \"criadoEm\" FROM usuarios WHERE lower(email) = lower($1)", [String(email || "")]);
  const u = r.rows[0];
  if (!u || !bcrypt.compareSync(String(senha || ""), u.senha_hash))
    return res.status(401).json({ erro: "E-mail ou senha incorretos." });
  const { id, nome, celular, username, email: em, papel, criadoEm } = u;
  res.json({ token: gerarToken(id), usuario: { id, nome, celular, username, email: em, papel, criadoEm } });
}));

app.get("/api/me", auth, h(async (req, res) => {
  const r = await q(`SELECT ${COLUNAS_USUARIO} FROM usuarios WHERE id = $1`, [req.userId]);
  if (!r.rowCount) return res.status(404).json({ erro: "Usuário não encontrado." });
  res.json(r.rows[0]);
}));

app.delete("/api/me", auth, h(async (req, res) => {
  await q("DELETE FROM usuarios WHERE id = $1", [req.userId]); // apaga também as denúncias (CASCADE)
  res.status(204).end();
}));

/* ---------- denúncias ---------- */
const COLUNAS_DENUNCIA = `id, usuario_id AS "usuarioId", tipo, endereco, descricao,
  (foto IS NOT NULL) AS "temFoto", status, criado_em AS "criadoEm", atualizado_em AS "atualizadoEm"`;

app.post("/api/denuncias", auth, upload.single("foto"), h(async (req, res) => {
  const { tipo, endereco, descricao } = req.body || {};
  if (!tipo || !endereco || !descricao)
    return res.status(400).json({ erro: "Informe tipo, endereço e descrição." });
  const f = req.file;
  const r = await q(
    `INSERT INTO denuncias (usuario_id, tipo, endereco, descricao, foto, foto_tipo)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${COLUNAS_DENUNCIA}`,
    [req.userId, tipo, endereco, descricao, f ? f.buffer : null, f ? f.mimetype : null]
  );
  res.status(201).json(r.rows[0]);
}));

app.get("/api/denuncias", auth, h(async (req, res) => {
  const minhas = req.query.minhas === "1";
  const r = await q(
    `SELECT ${COLUNAS_DENUNCIA} FROM denuncias
     ${minhas ? "WHERE usuario_id = $1" : ""} ORDER BY criado_em DESC LIMIT 200`,
    minhas ? [req.userId] : []
  );
  res.json(r.rows);
}));

app.get("/api/denuncias/:id/foto", auth, h(async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(404).json({ erro: "Foto não encontrada." });
  const r = await q("SELECT foto, foto_tipo FROM denuncias WHERE id = $1", [req.params.id]);
  if (!r.rowCount || !r.rows[0].foto) return res.status(404).json({ erro: "Foto não encontrada." });
  res.type(r.rows[0].foto_tipo).send(r.rows[0].foto);
}));

app.get("/api/estatisticas", auth, h(async (req, res) => {
  const r = await q(`SELECT
    (SELECT count(*)::int FROM denuncias) AS denuncias,
    (SELECT count(*)::int FROM denuncias WHERE status = 'resolvida') AS resolvidas,
    (SELECT count(*)::int FROM usuarios) AS usuarios`);
  res.json(r.rows[0]);
}));

/* ---------- conteúdo ---------- */
app.get("/api/noticias", h(async (req, res) => {
  const r = await q("SELECT id, titulo, resumo, imagem, to_char(data, 'YYYY-MM-DD') AS data FROM noticias ORDER BY data DESC, id DESC");
  res.json(r.rows);
}));

app.get("/api/orgaos", h(async (req, res) => {
  const r = await q("SELECT id, nome, icone, telefone, descricao FROM orgaos ORDER BY id");
  res.json(r.rows);
}));

/* ---------- administração ---------- */
app.get("/api/admin/denuncias", auth, admin, h(async (req, res) => {
  const r = await q(
    `SELECT d.id, u.username AS autor, d.tipo, d.endereco, d.descricao, d.status,
            d.criado_em AS "criadoEm", d.atualizado_em AS "atualizadoEm"
     FROM denuncias d LEFT JOIN usuarios u ON u.id = d.usuario_id
     ORDER BY d.criado_em DESC LIMIT 200`
  );
  res.json(r.rows);
}));

app.patch("/api/admin/denuncias/:id", auth, admin, h(async (req, res) => {
  const { status } = req.body || {};
  if (!["recebida", "resolvida"].includes(status))
    return res.status(400).json({ erro: "Status inválido." });
  if (!UUID.test(req.params.id)) return res.status(404).json({ erro: "Denúncia não encontrada." });
  const r = await q(
    `UPDATE denuncias SET status = $1, atualizado_em = now() WHERE id = $2 RETURNING ${COLUNAS_DENUNCIA}`,
    [status, req.params.id]
  );
  if (!r.rowCount) return res.status(404).json({ erro: "Denúncia não encontrada." });
  res.json(r.rows[0]);
}));

app.post("/api/admin/noticias", auth, admin, h(async (req, res) => {
  const { titulo, resumo, imagem } = req.body || {};
  if (!titulo || !resumo) return res.status(400).json({ erro: "Informe título e resumo." });
  const img = imagem && /^https?:\/\//.test(imagem)
    ? imagem
    : "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=800&q=80";
  const r = await q(
    `INSERT INTO noticias (titulo, resumo, imagem, data) VALUES ($1,$2,$3,current_date)
     RETURNING id, titulo, resumo, imagem, to_char(data, 'YYYY-MM-DD') AS data`,
    [titulo.trim(), resumo.trim(), img]
  );
  res.status(201).json(r.rows[0]);
}));

app.delete("/api/admin/noticias/:id", auth, admin, h(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ erro: "Notícia não encontrada." });
  await q("DELETE FROM noticias WHERE id = $1", [id]);
  res.status(204).end();
}));

/* ---------- chat ---------- */
app.get("/api/chat", auth, h(async (req, res) => {
  const desde = req.query.desde || "1970-01-01T00:00:00Z";
  const r = await q(
    `SELECT * FROM (
       SELECT id, usuario_id AS "usuarioId", autor, texto, criado_em AS "criadoEm"
       FROM mensagens WHERE criado_em > $1 ORDER BY criado_em DESC LIMIT 100
     ) t ORDER BY "criadoEm"`,
    [desde]
  );
  res.json(r.rows);
}));

app.post("/api/chat", auth, h(async (req, res) => {
  const texto = String((req.body || {}).texto || "").trim().slice(0, 500);
  if (!texto) return res.status(400).json({ erro: "Mensagem vazia." });
  const u = await q("SELECT username FROM usuarios WHERE id = $1", [req.userId]);
  if (!u.rowCount) return res.status(401).json({ erro: "Sessão inválida. Entre novamente." });
  const r = await q(
    `INSERT INTO mensagens (usuario_id, autor, texto) VALUES ($1,$2,$3)
     RETURNING id, usuario_id AS "usuarioId", autor, texto, criado_em AS "criadoEm"`,
    [req.userId, u.rows[0].username, texto]
  );
  res.status(201).json(r.rows[0]);
}));

/* ---------- frontend estático ---------- */
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.use((err, req, res, next) => {
  const erroDeUpload = err instanceof multer.MulterError || err.message === "Envie apenas imagens.";
  if (!erroDeUpload) console.error(err);
  res.status(erroDeUpload ? 400 : 500).json({ erro: erroDeUpload ? err.message : "Erro interno no servidor." });
});

prepararBanco()
  .then(() => app.listen(PORT, () => console.log(`CidadeViva rodando em http://localhost:${PORT}`)))
  .catch(err => { console.error("Falha ao preparar o banco:", err); process.exit(1); });

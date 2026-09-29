/* CidadeViva - API (Node.js + Express)
   Armazenamento simples em arquivo JSON (data/db.json). */
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-troque-em-producao";
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ---------- banco de dados (JSON) ---------- */
const dbInicial = {
  usuarios: [],
  denuncias: [],
  mensagens: [],
  noticias: [
    { id: 1, titulo: "Mutirão de limpeza recolhe 5 toneladas de lixo", resumo: "Voluntários se reuniram no fim de semana para limpar praças e córregos da região central.", imagem: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=800&q=80", data: "2026-09-20" },
    { id: 2, titulo: "Coleta seletiva chega a mais bairros", resumo: "A prefeitura amplia a coleta de recicláveis e divulga o calendário por bairro.", imagem: "https://images.unsplash.com/photo-1604187351574-c75ca79f5807?auto=format&fit=crop&w=800&q=80", data: "2026-09-15" },
    { id: 3, titulo: "Plantio de 1.000 árvores na zona norte", resumo: "Projeto de arborização quer reduzir ilhas de calor e melhorar a qualidade do ar.", imagem: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=800&q=80", data: "2026-09-10" }
  ],
  orgaos: [
    { id: 1, nome: "Defesa Civil", icone: "🚨", telefone: "199", descricao: "Enchentes, deslizamentos e riscos de desastre." },
    { id: 2, nome: "Limpeza Urbana", icone: "🗑️", telefone: "156", descricao: "Lixo acumulado, entulho e descarte irregular." },
    { id: 3, nome: "Polícia Ambiental", icone: "🌳", telefone: "190", descricao: "Crimes ambientais, queimadas e desmatamento." },
    { id: 4, nome: "Vigilância Sanitária", icone: "🩺", telefone: "160", descricao: "Focos de dengue, esgoto a céu aberto e água contaminada." }
  ]
};

function lerDb() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(dbInicial, null, 2));
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}
function salvarDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
const novoId = () => crypto.randomUUID();
const publico = ({ senhaHash, ...u }) => u;

/* ---------- app ---------- */
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(UPLOAD_DIR));

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, novoId() + path.extname(file.originalname).toLowerCase())
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith("image/") ? cb(null, true) : cb(new Error("Envie apenas imagens."))
});

function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  try {
    req.userId = jwt.verify(token, JWT_SECRET).id;
    next();
  } catch {
    res.status(401).json({ erro: "Sessão inválida. Entre novamente." });
  }
}

/* ---------- autenticação ---------- */
app.post("/api/auth/cadastro", (req, res) => {
  const { nome, celular, username, email, senha } = req.body || {};
  if (!nome || !celular || !username || !email || !senha)
    return res.status(400).json({ erro: "Preencha todos os campos." });
  if (senha.length < 6)
    return res.status(400).json({ erro: "A senha precisa ter pelo menos 6 caracteres." });

  const db = lerDb();
  if (db.usuarios.some(u => u.email.toLowerCase() === email.toLowerCase()))
    return res.status(409).json({ erro: "Este e-mail já está cadastrado." });
  if (db.usuarios.some(u => u.username.toLowerCase() === username.toLowerCase()))
    return res.status(409).json({ erro: "Este nome de usuário já está em uso." });

  const usuario = {
    id: novoId(), nome: nome.trim(), celular: celular.trim(), username: username.trim(),
    email: email.trim().toLowerCase(), senhaHash: bcrypt.hashSync(senha, 10),
    criadoEm: new Date().toISOString()
  };
  db.usuarios.push(usuario);
  salvarDb(db);
  const token = jwt.sign({ id: usuario.id }, JWT_SECRET, { expiresIn: "7d" });
  res.status(201).json({ token, usuario: publico(usuario) });
});

app.post("/api/auth/login", (req, res) => {
  const { email, senha } = req.body || {};
  const usuario = lerDb().usuarios.find(u => u.email === String(email || "").toLowerCase());
  if (!usuario || !bcrypt.compareSync(String(senha || ""), usuario.senhaHash))
    return res.status(401).json({ erro: "E-mail ou senha incorretos." });
  const token = jwt.sign({ id: usuario.id }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, usuario: publico(usuario) });
});

app.get("/api/me", auth, (req, res) => {
  const usuario = lerDb().usuarios.find(u => u.id === req.userId);
  if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });
  res.json(publico(usuario));
});

app.delete("/api/me", auth, (req, res) => {
  const db = lerDb();
  db.usuarios = db.usuarios.filter(u => u.id !== req.userId);
  db.denuncias = db.denuncias.filter(d => d.usuarioId !== req.userId);
  salvarDb(db);
  res.status(204).end();
});

/* ---------- denúncias ---------- */
app.post("/api/denuncias", auth, upload.single("foto"), (req, res) => {
  const { tipo, endereco, descricao } = req.body || {};
  if (!tipo || !endereco || !descricao)
    return res.status(400).json({ erro: "Informe tipo, endereço e descrição." });
  const db = lerDb();
  const denuncia = {
    id: novoId(), usuarioId: req.userId, tipo, endereco, descricao,
    foto: req.file ? "/uploads/" + req.file.filename : null,
    status: "recebida", criadoEm: new Date().toISOString()
  };
  db.denuncias.push(denuncia);
  salvarDb(db);
  res.status(201).json(denuncia);
});

app.get("/api/denuncias", auth, (req, res) => {
  const { minhas } = req.query;
  let lista = lerDb().denuncias;
  if (minhas === "1") lista = lista.filter(d => d.usuarioId === req.userId);
  res.json(lista.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)));
});

app.get("/api/estatisticas", auth, (req, res) => {
  const db = lerDb();
  res.json({
    denuncias: db.denuncias.length,
    resolvidas: db.denuncias.filter(d => d.status === "resolvida").length,
    usuarios: db.usuarios.length
  });
});

/* ---------- conteúdo ---------- */
app.get("/api/noticias", (req, res) => res.json(lerDb().noticias));
app.get("/api/orgaos", (req, res) => res.json(lerDb().orgaos));

/* ---------- chat ---------- */
app.get("/api/chat", auth, (req, res) => {
  const desde = req.query.desde || "";
  res.json(lerDb().mensagens.filter(m => m.criadoEm > desde).slice(-100));
});

app.post("/api/chat", auth, (req, res) => {
  const texto = String((req.body || {}).texto || "").trim().slice(0, 500);
  if (!texto) return res.status(400).json({ erro: "Mensagem vazia." });
  const db = lerDb();
  const usuario = db.usuarios.find(u => u.id === req.userId);
  const msg = { id: novoId(), usuarioId: usuario.id, autor: usuario.username, texto, criadoEm: new Date().toISOString() };
  db.mensagens.push(msg);
  salvarDb(db);
  res.status(201).json(msg);
});

/* ---------- frontend estático ---------- */
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.use((err, req, res, next) => res.status(400).json({ erro: err.message || "Erro na requisição." }));

app.listen(PORT, () => console.log(`CidadeViva rodando em http://localhost:${PORT}`));

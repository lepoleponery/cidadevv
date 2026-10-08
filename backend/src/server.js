require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const db = require("./db");

// ----- configuração -----
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error("Defina JWT_SECRET no arquivo .env com pelo menos 32 caracteres.");
  process.exit(1);
}
const PORT = process.env.PORT || 3000;
const TIPOS = ["queimada", "lixo", "entulho", "esgoto", "buraco", "outros"];
const STATUS = ["Recebida", "Em análise", "Resolvida"];
const UPLOADS = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOADS, { recursive: true });

const app = express();
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
const origens = (process.env.CORS_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: origens.length ? origens : true }));
app.use(express.json({ limit: "50kb" }));
app.use("/uploads", express.static(UPLOADS, { maxAge: "7d" }));

// ----- limites de uso (contra spam e força bruta) -----
const limitar = (minutos, limite, erro) => rateLimit({
  windowMs: minutos * 60 * 1000, limit: limite,
  standardHeaders: true, legacyHeaders: false, message: { erro }
});
app.use(limitar(15, 300, "Muitas requisições. Tente de novo em alguns minutos."));
const limiteCriar = limitar(60, 5, "Limite de denúncias por hora atingido. Tente mais tarde.");
const limiteLogin = limitar(15, 10, "Muitas tentativas de login. Tente de novo em alguns minutos.");
const limiteConsulta = limitar(15, 30, "Muitas consultas. Tente de novo em alguns minutos.");

// ----- upload de foto -----
const EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString("hex") + EXT[file.mimetype])
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => EXT[file.mimetype] ? cb(null, true) : cb(new Error("FORMATO_INVALIDO"))
});
function receberFoto(req, res, next) {
  upload.single("foto")(req, res, err => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ erro: "A foto deve ter no máximo 5 MB." });
    if (err.message === "FORMATO_INVALIDO") return res.status(400).json({ erro: "Envie a foto em JPG, PNG ou WEBP." });
    return res.status(400).json({ erro: "Não foi possível receber a foto." });
  });
}
function apagarArquivo(nome) {
  if (!nome) return;
  fs.unlink(path.join(UPLOADS, path.basename(nome)), () => {});
}

// ----- autenticação -----
function lerToken(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET); } catch { return null; }
}
function ehModerador(tokenInfo) {
  if (!tokenInfo) return false;
  const u = db.prepare("SELECT papel FROM usuarios WHERE id = ?").get(tokenInfo.id);
  return !!u && u.papel === "moderador";
}
function exigirModerador(req, res, next) {
  const t = lerToken(req);
  if (!t) return res.status(401).json({ erro: "Não autenticado." });
  if (!ehModerador(t)) return res.status(403).json({ erro: "Sem permissão." });
  req.usuario = t;
  next();
}

// ----- helpers -----
const ALF = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function novoProtocolo() {
  let s = "";
  for (const b of crypto.randomBytes(6)) s += ALF[b % ALF.length];
  return "CV-" + s;
}
function serializar(r, req, admin) {
  const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
  const o = {
    id: r.id, tipo: r.tipo, local: r.local, descricao: r.descricao,
    lat: r.lat, lng: r.lng, status: r.status, resposta: r.resposta,
    apoios: r.apoios, criado_em: r.criado_em,
    foto: r.foto ? `${base}/uploads/${r.foto}` : null
  };
  if (admin) o.protocolo = r.protocolo;
  return o;
}
function lerId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ erro: "Id inválido." }); return null; }
  return id;
}
function numeroOuNulo(v, min, max) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : NaN;
}

// ================= ROTAS =================

// Login do moderador
app.post("/auth/login", limiteLogin, async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const senha = String(req.body?.senha || "");
    const u = db.prepare("SELECT * FROM usuarios WHERE email = ?").get(email);
    // compara sempre, mesmo sem usuário, para não revelar se o e-mail existe
    const ok = await bcrypt.compare(senha, u ? u.senha_hash : DUMMY_HASH);
    if (!u || !ok) return res.status(401).json({ erro: "E-mail ou senha incorretos." });
    const token = jwt.sign({ id: u.id, papel: u.papel }, JWT_SECRET, { expiresIn: "8h" });
    res.json({ token, usuario: { nome: u.nome, papel: u.papel } });
  } catch (e) { next(e); }
});
const DUMMY_HASH = bcrypt.hashSync("senha-falsa-para-comparacao", 10);

// Listar denúncias (público; moderador também recebe o protocolo)
app.get("/denuncias", (req, res) => {
  const admin = ehModerador(lerToken(req));
  const linhas = db.prepare("SELECT * FROM denuncias ORDER BY criado_em DESC LIMIT 500").all();
  res.json(linhas.map(r => serializar(r, req, admin)));
});

// Criar denúncia (público)
app.post("/denuncias", limiteCriar, receberFoto, (req, res, next) => {
  const recusar = (msg) => { apagarArquivo(req.file?.filename); return res.status(400).json({ erro: msg }); };
  try {
    const tipo = String(req.body.tipo || "");
    const local = String(req.body.local || "").trim();
    const descricao = String(req.body.descricao || "").trim();
    const lat = numeroOuNulo(req.body.lat, -90, 90);
    const lng = numeroOuNulo(req.body.lng, -180, 180);

    if (!TIPOS.includes(tipo)) return recusar("Tipo de denúncia inválido.");
    if (local.length < 3 || local.length > 200) return recusar("Informe o local (3 a 200 caracteres).");
    if (descricao.length < 10 || descricao.length > 2000) return recusar("A descrição deve ter de 10 a 2000 caracteres.");
    if (Number.isNaN(lat) || Number.isNaN(lng)) return recusar("Coordenadas inválidas.");

    const inserir = db.prepare(
      "INSERT INTO denuncias (protocolo, tipo, local, descricao, lat, lng, foto) VALUES (?,?,?,?,?,?,?)"
    );
    let protocolo;
    for (let i = 0; i < 5; i++) {
      protocolo = novoProtocolo();
      try { inserir.run(protocolo, tipo, local, descricao, lat, lng, req.file?.filename || null); break; }
      catch (e) { if (!String(e.message).includes("UNIQUE") || i === 4) throw e; }
    }
    res.status(201).json({ protocolo });
  } catch (e) { apagarArquivo(req.file?.filename); next(e); }
});

// Consultar por protocolo (público)
app.get("/denuncias/protocolo/:cod", limiteConsulta, (req, res) => {
  const cod = String(req.params.cod || "").trim().toUpperCase();
  const r = db.prepare("SELECT * FROM denuncias WHERE protocolo = ?").get(cod);
  if (!r) return res.status(404).json({ erro: "Protocolo não encontrado." });
  res.json(serializar(r, req, false));
});

// Apoiar denúncia (um apoio por pessoa/IP)
app.post("/denuncias/:id/apoio", (req, res) => {
  const id = lerId(req, res); if (id === null) return;
  if (!db.prepare("SELECT 1 FROM denuncias WHERE id = ?").get(id))
    return res.status(404).json({ erro: "Denúncia não encontrada." });
  const chave = crypto.createHash("sha256").update(`${req.ip}|${id}|${JWT_SECRET}`).digest("hex");
  const tx = db.transaction(() => {
    const r = db.prepare("INSERT OR IGNORE INTO apoios (denuncia_id, chave) VALUES (?,?)").run(id, chave);
    if (r.changes) db.prepare("UPDATE denuncias SET apoios = apoios + 1 WHERE id = ?").run(id);
    return db.prepare("SELECT apoios FROM denuncias WHERE id = ?").get(id);
  });
  res.json({ apoios: tx().apoios });
});

// Moderador: mudar status e responder
app.patch("/denuncias/:id", exigirModerador, (req, res) => {
  const id = lerId(req, res); if (id === null) return;
  const atual = db.prepare("SELECT * FROM denuncias WHERE id = ?").get(id);
  if (!atual) return res.status(404).json({ erro: "Denúncia não encontrada." });

  const status = req.body?.status !== undefined ? String(req.body.status) : atual.status;
  const resposta = req.body?.resposta !== undefined ? String(req.body.resposta).trim() : atual.resposta;
  if (!STATUS.includes(status)) return res.status(400).json({ erro: "Status inválido." });
  if (resposta.length > 1000) return res.status(400).json({ erro: "A resposta deve ter no máximo 1000 caracteres." });

  db.prepare("UPDATE denuncias SET status = ?, resposta = ? WHERE id = ?").run(status, resposta, id);
  const nova = db.prepare("SELECT * FROM denuncias WHERE id = ?").get(id);
  res.json(serializar(nova, req, true));
});

// Moderador: apagar
app.delete("/denuncias/:id", exigirModerador, (req, res) => {
  const id = lerId(req, res); if (id === null) return;
  const r = db.prepare("SELECT foto FROM denuncias WHERE id = ?").get(id);
  if (!r) return res.status(404).json({ erro: "Denúncia não encontrada." });
  db.prepare("DELETE FROM denuncias WHERE id = ?").run(id);
  apagarArquivo(r.foto);
  res.status(204).end();
});

// ----- erros -----
app.use((req, res) => res.status(404).json({ erro: "Rota não encontrada." }));
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ erro: "JSON inválido." });
  console.error(err);
  res.status(500).json({ erro: "Erro interno do servidor." });
});

app.listen(PORT, () => console.log(`Cidade Viva rodando na porta ${PORT}`));

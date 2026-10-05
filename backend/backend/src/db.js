const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const config = require('./config');

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'cidadao' CHECK (papel IN ('cidadao','admin')),
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS denuncias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  protocolo TEXT NOT NULL UNIQUE,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('lixo','queimada','desmatamento')),
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  endereco TEXT,
  bairro TEXT,
  cidade TEXT,
  foto TEXT,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','em_analise','resolvida','rejeitada')),
  prioridade TEXT NOT NULL DEFAULT 'media'
    CHECK (prioridade IN ('baixa','media','alta','urgente')),
  total_apoios INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
  resolvido_em TEXT
);

CREATE TABLE IF NOT EXISTS historico_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  denuncia_id INTEGER NOT NULL REFERENCES denuncias(id) ON DELETE CASCADE,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  observacao TEXT,
  admin_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comentarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  denuncia_id INTEGER NOT NULL REFERENCES denuncias(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS apoios (
  denuncia_id INTEGER NOT NULL REFERENCES denuncias(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (denuncia_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_denuncias_tipo ON denuncias(tipo);
CREATE INDEX IF NOT EXISTS idx_denuncias_status ON denuncias(status);
CREATE INDEX IF NOT EXISTS idx_denuncias_bairro ON denuncias(bairro);
CREATE INDEX IF NOT EXISTS idx_denuncias_usuario ON denuncias(usuario_id);
CREATE INDEX IF NOT EXISTS idx_comentarios_denuncia ON comentarios(denuncia_id);
`);

// Cria o administrador padrão se ainda não existir
const existeAdmin = db.prepare("SELECT id FROM usuarios WHERE papel = 'admin' LIMIT 1").get();
if (!existeAdmin) {
  const hash = bcrypt.hashSync(config.admin.senha, 10);
  db.prepare("INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?, ?, ?, 'admin')")
    .run(config.admin.nome, config.admin.email, hash);
  console.log(`Admin criado: ${config.admin.email}`);
}

module.exports = db;

const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(process.env.DB_PATH || path.join(__dirname, "cidadeviva.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nome       TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    papel      TEXT NOT NULL DEFAULT 'cidadao' CHECK (papel IN ('cidadao','moderador')),
    criado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS denuncias (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    protocolo  TEXT NOT NULL UNIQUE,
    tipo       TEXT NOT NULL,
    local      TEXT NOT NULL,
    bairro     TEXT NOT NULL DEFAULT '',
    descricao  TEXT NOT NULL,
    lat        REAL,
    lng        REAL,
    foto       TEXT,
    status     TEXT NOT NULL DEFAULT 'Recebida',
    resposta   TEXT NOT NULL DEFAULT '',
    apoios     INTEGER NOT NULL DEFAULT 0,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    criado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS apoios (
    denuncia_id INTEGER NOT NULL REFERENCES denuncias(id) ON DELETE CASCADE,
    chave       TEXT NOT NULL,
    PRIMARY KEY (denuncia_id, chave)
  );

  CREATE INDEX IF NOT EXISTS idx_denuncias_criado ON denuncias(criado_em DESC);
`);

// Migração: bancos criados na versão anterior ainda não têm estas colunas
const colunas = db.prepare("PRAGMA table_info(denuncias)").all().map(c => c.name);
if (!colunas.includes("usuario_id")) {
  db.exec("ALTER TABLE denuncias ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL");
}
if (!colunas.includes("bairro")) {
  db.exec("ALTER TABLE denuncias ADD COLUMN bairro TEXT NOT NULL DEFAULT ''");
}
db.exec("CREATE INDEX IF NOT EXISTS idx_denuncias_usuario ON denuncias(usuario_id)");

module.exports = db;

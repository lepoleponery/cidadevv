CREATE TABLE IF NOT EXISTS usuarios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  celular     TEXT NOT NULL,
  username    TEXT NOT NULL,
  email       TEXT NOT NULL,
  senha_hash  TEXT NOT NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT date_trunc('milliseconds', now())
);
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_idx ON usuarios (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_username_idx ON usuarios (lower(username));

CREATE TABLE IF NOT EXISTS denuncias (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL,
  endereco    TEXT NOT NULL,
  descricao   TEXT NOT NULL,
  foto        BYTEA,
  foto_tipo   TEXT,
  status      TEXT NOT NULL DEFAULT 'recebida' CHECK (status IN ('recebida', 'resolvida')),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT date_trunc('milliseconds', now())
);
CREATE INDEX IF NOT EXISTS denuncias_usuario_idx ON denuncias (usuario_id);

CREATE TABLE IF NOT EXISTS mensagens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  autor       TEXT NOT NULL,
  texto       TEXT NOT NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT date_trunc('milliseconds', now())
);
CREATE INDEX IF NOT EXISTS mensagens_data_idx ON mensagens (criado_em);

CREATE TABLE IF NOT EXISTS noticias (
  id      SERIAL PRIMARY KEY,
  titulo  TEXT NOT NULL,
  resumo  TEXT NOT NULL,
  imagem  TEXT NOT NULL,
  data    DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS orgaos (
  id         SERIAL PRIMARY KEY,
  nome       TEXT NOT NULL,
  icone      TEXT NOT NULL,
  telefone   TEXT NOT NULL,
  descricao  TEXT NOT NULL
);

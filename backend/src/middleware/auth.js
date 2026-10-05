const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');
const { ErroHttp } = require('../utils/helpers');

function extrairUsuario(req) {
  const header = req.headers.authorization || '';
  const [tipo, token] = header.split(' ');
  if (tipo !== 'Bearer' || !token) return null;
  try {
    const { id } = jwt.verify(token, config.jwtSecret);
    return db.prepare('SELECT id, nome, email, papel, ativo FROM usuarios WHERE id = ?').get(id) || null;
  } catch {
    return null;
  }
}

// Exige login
function autenticar(req, res, next) {
  const usuario = extrairUsuario(req);
  if (!usuario || !usuario.ativo) return next(new ErroHttp(401, 'Token ausente, inválido ou usuário inativo.'));
  req.usuario = usuario;
  next();
}

// Login opcional (para denúncias anônimas)
function autenticarOpcional(req, res, next) {
  const usuario = extrairUsuario(req);
  if (usuario && usuario.ativo) req.usuario = usuario;
  next();
}

function apenasAdmin(req, res, next) {
  if (!req.usuario || req.usuario.papel !== 'admin') {
    return next(new ErroHttp(403, 'Acesso restrito a administradores.'));
  }
  next();
}

module.exports = { autenticar, autenticarOpcional, apenasAdmin };

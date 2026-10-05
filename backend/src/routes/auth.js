const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const db = require('../db');
const config = require('../config');
const validar = require('../middleware/validar');
const { autenticar } = require('../middleware/auth');
const { ErroHttp, assincrono } = require('../utils/helpers');

const schemaRegistro = z.object({
  nome: z.string().trim().min(3, 'Nome deve ter ao menos 3 caracteres.').max(100),
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  senha: z
    .string()
    .min(8, 'Senha deve ter ao menos 8 caracteres.')
    .regex(/[A-Za-z]/, 'Senha deve conter letras.')
    .regex(/\d/, 'Senha deve conter números.'),
});

const schemaLogin = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  senha: z.string().min(1, 'Informe a senha.'),
});

const gerarToken = (id) => jwt.sign({ id }, config.jwtSecret, { expiresIn: config.jwtExpiraEm });

// POST /api/auth/registro
router.post('/registro', validar(schemaRegistro), assincrono(async (req, res) => {
  const { nome, email, senha } = req.dados;
  if (db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email)) {
    throw new ErroHttp(409, 'Este e-mail já está cadastrado.');
  }
  const hash = await bcrypt.hash(senha, 10);
  const { lastInsertRowid: id } = db
    .prepare('INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)')
    .run(nome, email, hash);
  res.status(201).json({
    mensagem: 'Cadastro realizado com sucesso!',
    usuario: { id, nome, email, papel: 'cidadao' },
    token: gerarToken(id),
  });
}));

// POST /api/auth/login
router.post('/login', validar(schemaLogin), assincrono(async (req, res) => {
  const { email, senha } = req.dados;
  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  const senhaOk = usuario && (await bcrypt.compare(senha, usuario.senha_hash));
  if (!senhaOk) throw new ErroHttp(401, 'E-mail ou senha incorretos.');
  if (!usuario.ativo) throw new ErroHttp(403, 'Usuário desativado.');
  res.json({
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
    token: gerarToken(usuario.id),
  });
}));

// GET /api/auth/me
router.get('/me', autenticar, (req, res) => {
  const { id, nome, email, papel } = req.usuario;
  res.json({ id, nome, email, papel });
});

module.exports = router;

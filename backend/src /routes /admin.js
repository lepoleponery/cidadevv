const router = require('express').Router();
const { z } = require('zod');
const db = require('../db');
const validar = require('../middleware/validar');
const { autenticar, apenasAdmin } = require('../middleware/auth');
const { ErroHttp } = require('../utils/helpers');

router.use(autenticar, apenasAdmin);

// GET /api/admin/usuarios
router.get('/usuarios', (req, res) => {
  res.json(db.prepare(`
    SELECT u.id, u.nome, u.email, u.papel, u.ativo, u.criado_em,
           (SELECT COUNT(*) FROM denuncias d WHERE d.usuario_id = u.id) AS total_denuncias
    FROM usuarios u ORDER BY u.criado_em DESC`).all());
});

// PATCH /api/admin/usuarios/:id  { papel?, ativo? }
const schemaUsuario = z.object({
  papel: z.enum(['cidadao', 'admin']).optional(),
  ativo: z.boolean().optional(),
}).refine((v) => v.papel !== undefined || v.ativo !== undefined, 'Informe papel ou ativo.');

router.patch('/usuarios/:id(\\d+)', validar(schemaUsuario), (req, res) => {
  const id = Number(req.params.id);
  if (id === req.usuario.id) throw new ErroHttp(400, 'Você não pode alterar a si mesmo.');
  const u = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(id);
  if (!u) throw new ErroHttp(404, 'Usuário não encontrado.');

  const { papel, ativo } = req.dados;
  db.prepare('UPDATE usuarios SET papel = COALESCE(?, papel), ativo = COALESCE(?, ativo) WHERE id = ?')
    .run(papel ?? null, ativo === undefined ? null : Number(ativo), id);
  res.json(db.prepare('SELECT id, nome, email, papel, ativo FROM usuarios WHERE id = ?').get(id));
});

module.exports = router;

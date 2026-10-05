const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const db = require('../db');
const config = require('../config');
const upload = require('../middleware/upload');
const validar = require('../middleware/validar');
const { autenticar, autenticarOpcional, apenasAdmin } = require('../middleware/auth');
const { gerarProtocolo, ErroHttp } = require('../utils/helpers');

// ---------- Schemas ----------
const texto = (min, max, nome) =>
  z.string().trim().min(min, `${nome} deve ter ao menos ${min} caracteres.`).max(max, `${nome} deve ter no máximo ${max} caracteres.`);

const schemaCriar = z.object({
  tipo: z.enum(config.tipos, { errorMap: () => ({ message: `Tipo deve ser: ${config.tipos.join(', ')}.` }) }),
  titulo: texto(5, 120, 'Título'),
  descricao: texto(10, 2000, 'Descrição'),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  endereco: z.string().trim().max(200).optional(),
  bairro: z.string().trim().max(100).optional(),
  cidade: z.string().trim().max(100).optional(),
});

const schemaEditar = schemaCriar.partial();

const schemaListar = z.object({
  tipo: z.enum(config.tipos).optional(),
  status: z.enum(config.status).optional(),
  prioridade: z.enum(config.prioridades).optional(),
  bairro: z.string().trim().optional(),
  cidade: z.string().trim().optional(),
  busca: z.string().trim().optional(),
  ordem: z.enum(['recentes', 'antigas', 'apoiadas']).default('recentes'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const schemaStatus = z.object({
  status: z.enum(config.status),
  prioridade: z.enum(config.prioridades).optional(),
  observacao: z.string().trim().max(500).optional(),
});

const schemaComentario = z.object({ texto: texto(2, 500, 'Comentário') });

// ---------- Utilitários ----------
const remover = (arquivo) => {
  if (arquivo) fs.unlink(path.join(__dirname, '..', '..', 'uploads', arquivo), () => {});
};

const formatar = (d) => ({ ...d, foto_url: d.foto ? `/uploads/${d.foto}` : null });

const buscarOu404 = (id) => {
  const d = db.prepare(`
    SELECT d.*, u.nome AS autor
    FROM denuncias d LEFT JOIN usuarios u ON u.id = d.usuario_id
    WHERE d.id = ?`).get(id);
  if (!d) throw new ErroHttp(404, 'Denúncia não encontrada.');
  return d;
};

const registrarHistorico = db.prepare(`
  INSERT INTO historico_status (denuncia_id, status_anterior, status_novo, observacao, admin_id)
  VALUES (?, ?, ?, ?, ?)`);

function montarFiltros(f) {
  const cond = [];
  const params = [];
  if (f.tipo) { cond.push('tipo = ?'); params.push(f.tipo); }
  if (f.status) { cond.push('status = ?'); params.push(f.status); }
  if (f.prioridade) { cond.push('prioridade = ?'); params.push(f.prioridade); }
  if (f.bairro) { cond.push('bairro LIKE ?'); params.push(`%${f.bairro}%`); }
  if (f.cidade) { cond.push('cidade LIKE ?'); params.push(`%${f.cidade}%`); }
  if (f.busca) {
    cond.push('(titulo LIKE ? OR descricao LIKE ? OR endereco LIKE ?)');
    params.push(`%${f.busca}%`, `%${f.busca}%`, `%${f.busca}%`);
  }
  return { where: cond.length ? `WHERE ${cond.join(' AND ')}` : '', params };
}

// ---------- Rotas fixas (ficam antes de /:id) ----------

// GET /api/denuncias/mapa -> GeoJSON para Leaflet / Google Maps
router.get('/mapa', validar(schemaListar.omit({ page: true, limit: true, ordem: true }), 'query'), (req, res) => {
  const { where, params } = montarFiltros(req.dados);
  const linhas = db.prepare(`
    SELECT id, protocolo, tipo, titulo, status, prioridade, latitude, longitude, bairro, total_apoios
    FROM denuncias ${where}`).all(...params);
  res.json({
    type: 'FeatureCollection',
    features: linhas.map((l) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [l.longitude, l.latitude] },
      properties: {
        id: l.id, protocolo: l.protocolo, tipo: l.tipo, titulo: l.titulo, status: l.status,
        prioridade: l.prioridade, bairro: l.bairro, total_apoios: l.total_apoios,
      },
    })),
  });
});

// GET /api/denuncias/minhas
router.get('/minhas', autenticar, (req, res) => {
  const linhas = db.prepare('SELECT * FROM denuncias WHERE usuario_id = ? ORDER BY criado_em DESC').all(req.usuario.id);
  res.json(linhas.map(formatar));
});

// GET /api/denuncias/protocolo/:codigo -> acompanhar denúncia (inclusive anônima)
router.get('/protocolo/:codigo', (req, res) => {
  const d = db.prepare('SELECT * FROM denuncias WHERE protocolo = ?').get(req.params.codigo.toUpperCase());
  if (!d) throw new ErroHttp(404, 'Protocolo não encontrado.');
  const historico = db.prepare(
    'SELECT status_anterior, status_novo, observacao, criado_em FROM historico_status WHERE denuncia_id = ? ORDER BY criado_em'
  ).all(d.id);
  res.json({ ...formatar(d), historico });
});

// ---------- Listagem ----------
// GET /api/denuncias?tipo=queimada&status=pendente&bairro=centro&page=1&limit=10
router.get('/', validar(schemaListar, 'query'), (req, res) => {
  const { page, limit, ordem, ...filtros } = req.dados;
  const { where, params } = montarFiltros(filtros);
  const orderBy = {
    recentes: 'criado_em DESC',
    antigas: 'criado_em ASC',
    apoiadas: 'total_apoios DESC, criado_em DESC',
  }[ordem];

  const total = db.prepare(`SELECT COUNT(*) AS n FROM denuncias ${where}`).get(...params).n;
  const dados = db.prepare(`SELECT * FROM denuncias ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, limit, (page - 1) * limit);

  res.json({
    dados: dados.map(formatar),
    paginacao: { pagina: page, limite: limit, total, totalPaginas: Math.ceil(total / limit) },
  });
});

// ---------- Criar (login opcional => denúncia anônima permitida) ----------
router.post('/', autenticarOpcional, upload.single('foto'), validar(schemaCriar), (req, res) => {
  const d = req.dados;
  let protocolo = gerarProtocolo();
  while (db.prepare('SELECT 1 FROM denuncias WHERE protocolo = ?').get(protocolo)) protocolo = gerarProtocolo();

  // Queimadas e desmatamento começam com prioridade maior
  const prioridade = d.tipo === 'lixo' ? 'media' : 'alta';

  const criar = db.transaction(() => {
    const { lastInsertRowid: id } = db.prepare(`
      INSERT INTO denuncias (protocolo, usuario_id, tipo, titulo, descricao, latitude, longitude,
                             endereco, bairro, cidade, foto, prioridade)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(protocolo, req.usuario?.id ?? null, d.tipo, d.titulo, d.descricao, d.latitude, d.longitude,
        d.endereco ?? null, d.bairro ?? null, d.cidade ?? null, req.file?.filename ?? null, prioridade);
    registrarHistorico.run(id, null, 'pendente', 'Denúncia registrada.', null);
    return id;
  });

  const id = criar();
  res.status(201).json({
    mensagem: 'Denúncia registrada com sucesso! Guarde o protocolo para acompanhar.',
    protocolo,
    denuncia: formatar(buscarOu404(id)),
  });
});

// ---------- Detalhe ----------
router.get('/:id(\\d+)', (req, res) => {
  const d = buscarOu404(req.params.id);
  const historico = db.prepare(`
    SELECT h.status_anterior, h.status_novo, h.observacao, h.criado_em, u.nome AS responsavel
    FROM historico_status h LEFT JOIN usuarios u ON u.id = h.admin_id
    WHERE h.denuncia_id = ? ORDER BY h.criado_em`).all(d.id);
  const comentarios = db.prepare(`
    SELECT c.id, c.texto, c.criado_em, u.nome AS autor
    FROM comentarios c JOIN usuarios u ON u.id = c.usuario_id
    WHERE c.denuncia_id = ? ORDER BY c.criado_em`).all(d.id);
  res.json({ ...formatar(d), historico, comentarios });
});

// ---------- Editar (dono enquanto pendente; ou admin) ----------
router.put('/:id(\\d+)', autenticar, upload.single('foto'), validar(schemaEditar), (req, res) => {
  const d = buscarOu404(req.params.id);
  const ehDono = d.usuario_id === req.usuario.id;
  const ehAdmin = req.usuario.papel === 'admin';

  if (!ehDono && !ehAdmin) {
    if (req.file) remover(req.file.filename);
    throw new ErroHttp(403, 'Você só pode editar suas próprias denúncias.');
  }
  if (ehDono && !ehAdmin && d.status !== 'pendente') {
    if (req.file) remover(req.file.filename);
    throw new ErroHttp(409, 'Só é possível editar denúncias com status pendente.');
  }

  const campos = { ...req.dados };
  if (req.file) campos.foto = req.file.filename;
  const chaves = Object.keys(campos);
  if (!chaves.length) throw new ErroHttp(400, 'Nenhum campo para atualizar.');

  const sets = chaves.map((c) => `${c} = ?`).join(', ');
  db.prepare(`UPDATE denuncias SET ${sets}, atualizado_em = datetime('now') WHERE id = ?`)
    .run(...chaves.map((c) => campos[c]), d.id);
  if (req.file) remover(d.foto); // apaga foto antiga

  res.json({ mensagem: 'Denúncia atualizada.', denuncia: formatar(buscarOu404(d.id)) });
});

// ---------- Excluir (dono ou admin) ----------
router.delete('/:id(\\d+)', autenticar, (req, res) => {
  const d = buscarOu404(req.params.id);
  if (d.usuario_id !== req.usuario.id && req.usuario.papel !== 'admin') {
    throw new ErroHttp(403, 'Você não pode excluir esta denúncia.');
  }
  db.prepare('DELETE FROM denuncias WHERE id = ?').run(d.id);
  remover(d.foto);
  res.json({ mensagem: 'Denúncia excluída.' });
});

// ---------- Alterar status (admin) ----------
router.patch('/:id(\\d+)/status', autenticar, apenasAdmin, validar(schemaStatus), (req, res) => {
  const d = buscarOu404(req.params.id);
  const { status, prioridade, observacao } = req.dados;

  db.transaction(() => {
    db.prepare(`
      UPDATE denuncias
      SET status = ?, prioridade = COALESCE(?, prioridade), atualizado_em = datetime('now'),
          resolvido_em = CASE WHEN ? = 'resolvida' THEN datetime('now') ELSE NULL END
      WHERE id = ?`).run(status, prioridade ?? null, status, d.id);
    registrarHistorico.run(d.id, d.status, status, observacao ?? null, req.usuario.id);
  })();

  res.json({ mensagem: 'Status atualizado.', denuncia: formatar(buscarOu404(d.id)) });
});

// ---------- Apoiar / remover apoio (toggle) ----------
router.post('/:id(\\d+)/apoiar', autenticar, (req, res) => {
  const d = buscarOu404(req.params.id);
  const jaApoiou = db.prepare('SELECT 1 FROM apoios WHERE denuncia_id = ? AND usuario_id = ?').get(d.id, req.usuario.id);

  db.transaction(() => {
    if (jaApoiou) {
      db.prepare('DELETE FROM apoios WHERE denuncia_id = ? AND usuario_id = ?').run(d.id, req.usuario.id);
      db.prepare('UPDATE denuncias SET total_apoios = total_apoios - 1 WHERE id = ?').run(d.id);
    } else {
      db.prepare('INSERT INTO apoios (denuncia_id, usuario_id) VALUES (?, ?)').run(d.id, req.usuario.id);
      db.prepare('UPDATE denuncias SET total_apoios = total_apoios + 1 WHERE id = ?').run(d.id);
    }
  })();

  const { total_apoios } = db.prepare('SELECT total_apoios FROM denuncias WHERE id = ?').get(d.id);
  res.json({ apoiado: !jaApoiou, total_apoios });
});

// ---------- Comentários ----------
router.get('/:id(\\d+)/comentarios', (req, res) => {
  const d = buscarOu404(req.params.id);
  res.json(db.prepare(`
    SELECT c.id, c.texto, c.criado_em, u.nome AS autor
    FROM comentarios c JOIN usuarios u ON u.id = c.usuario_id
    WHERE c.denuncia_id = ? ORDER BY c.criado_em`).all(d.id));
});

router.post('/:id(\\d+)/comentarios', autenticar, validar(schemaComentario), (req, res) => {
  const d = buscarOu404(req.params.id);
  const { lastInsertRowid } = db.prepare('INSERT INTO comentarios (denuncia_id, usuario_id, texto) VALUES (?, ?, ?)')
    .run(d.id, req.usuario.id, req.dados.texto);
  res.status(201).json({ id: lastInsertRowid, texto: req.dados.texto, autor: req.usuario.nome });
});

router.delete('/:id(\\d+)/comentarios/:comentarioId(\\d+)', autenticar, (req, res) => {
  const c = db.prepare('SELECT * FROM comentarios WHERE id = ? AND denuncia_id = ?')
    .get(req.params.comentarioId, req.params.id);
  if (!c) throw new ErroHttp(404, 'Comentário não encontrado.');
  if (c.usuario_id !== req.usuario.id && req.usuario.papel !== 'admin') throw new ErroHttp(403, 'Sem permissão.');
  db.prepare('DELETE FROM comentarios WHERE id = ?').run(c.id);
  res.json({ mensagem: 'Comentário removido.' });
});

module.exports = router;

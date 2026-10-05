const router = require('express').Router();
const db = require('../db');

// GET /api/estatisticas -> dados para gráficos e dashboard
router.get('/', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) AS n FROM denuncias').get().n;
  const resolvidas = db.prepare("SELECT COUNT(*) AS n FROM denuncias WHERE status = 'resolvida'").get().n;

  const porTipo = db.prepare('SELECT tipo, COUNT(*) AS total FROM denuncias GROUP BY tipo').all();
  const porStatus = db.prepare('SELECT status, COUNT(*) AS total FROM denuncias GROUP BY status').all();
  const porPrioridade = db.prepare('SELECT prioridade, COUNT(*) AS total FROM denuncias GROUP BY prioridade').all();
  const topBairros = db.prepare(`
    SELECT bairro, COUNT(*) AS total FROM denuncias
    WHERE bairro IS NOT NULL AND bairro <> ''
    GROUP BY bairro ORDER BY total DESC LIMIT 10`).all();
  const porMes = db.prepare(`
    SELECT strftime('%Y-%m', criado_em) AS mes, COUNT(*) AS total
    FROM denuncias GROUP BY mes ORDER BY mes DESC LIMIT 12`).all().reverse();
  const tempoMedio = db.prepare(`
    SELECT ROUND(AVG(julianday(resolvido_em) - julianday(criado_em)), 1) AS dias
    FROM denuncias WHERE status = 'resolvida' AND resolvido_em IS NOT NULL`).get().dias;
  const maisApoiadas = db.prepare(`
    SELECT id, protocolo, titulo, tipo, total_apoios FROM denuncias
    ORDER BY total_apoios DESC LIMIT 5`).all();

  res.json({
    total_denuncias: total,
    total_resolvidas: resolvidas,
    taxa_resolucao_percentual: total ? Math.round((resolvidas / total) * 1000) / 10 : 0,
    tempo_medio_resolucao_dias: tempoMedio ?? null,
    total_usuarios: db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n,
    por_tipo: porTipo,
    por_status: porStatus,
    por_prioridade: porPrioridade,
    bairros_mais_afetados: topBairros,
    evolucao_mensal: porMes,
    mais_apoiadas: maisApoiadas,
  });
});

module.exports = router;

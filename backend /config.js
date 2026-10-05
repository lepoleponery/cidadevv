require('dotenv').config();

module.exports = {
  porta: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'segredo-de-desenvolvimento',
  jwtExpiraEm: process.env.JWT_EXPIRA_EM || '7d',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  dbPath: process.env.DB_PATH || './cidade-viva.db',
  admin: {
    nome: process.env.ADMIN_NOME || 'Administrador',
    email: process.env.ADMIN_EMAIL || 'admin@cidadeviva.com',
    senha: process.env.ADMIN_SENHA || 'Admin@12345',
  },
  tipos: ['lixo', 'queimada', 'desmatamento'],
  status: ['pendente', 'em_analise', 'resolvida', 'rejeitada'],
  prioridades: ['baixa', 'media', 'alta', 'urgente'],
};

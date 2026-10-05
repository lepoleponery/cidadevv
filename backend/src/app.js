const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config');
const { naoEncontrado, tratarErros } = require('./middleware/erros');

require('./db'); // inicializa banco e tabelas

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// Limite geral e limite mais rígido para login/cadastro (contra força bruta)
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false,
  message: { erro: 'Muitas requisições. Tente novamente em alguns minutos.' },
}));
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { erro: 'Muitas tentativas de login. Aguarde alguns minutos.' },
}));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api', (req, res) => res.json({
  nome: 'API Cidade Viva',
  descricao: 'Denúncias de lixo, queimadas e desmatamento',
  versao: '1.0.0',
  status: 'online',
}));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/denuncias', require('./routes/denuncias'));
app.use('/api/estatisticas', require('./routes/estatisticas'));
app.use('/api/admin', require('./routes/admin'));

app.use(naoEncontrado);
app.use(tratarErros);

module.exports = app;

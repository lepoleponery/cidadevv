const multer = require('multer');

function naoEncontrado(req, res) {
  res.status(404).json({ erro: `Rota ${req.method} ${req.originalUrl} não encontrada.` });
}

// eslint-disable-next-line no-unused-vars
function tratarErros(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'A imagem deve ter no máximo 5 MB.' : err.message;
    return res.status(400).json({ erro: msg });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON malformado.' });
  }
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ erro: status === 500 ? 'Erro interno do servidor.' : err.message });
}

module.exports = { naoEncontrado, tratarErros };

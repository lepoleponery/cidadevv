const crypto = require('crypto');

function gerarProtocolo() {
  const ano = new Date().getFullYear();
  const codigo = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CV-${ano}-${codigo}`;
}

class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

// Permite usar funções async nas rotas sem try/catch em todas
const assincrono = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { gerarProtocolo, ErroHttp, assincrono };

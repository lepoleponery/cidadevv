const fs = require('fs');

// Valida body/query/params com Zod e guarda o resultado em req.dados
function validar(schema, origem = 'body') {
  return (req, res, next) => {
    const resultado = schema.safeParse(req[origem]);
    if (!resultado.success) {
      if (req.file) fs.unlink(req.file.path, () => {}); // remove upload se os dados forem inválidos
      return res.status(400).json({
        erro: 'Dados inválidos.',
        detalhes: resultado.error.issues.map((i) => ({
          campo: i.path.join('.'),
          mensagem: i.message,
        })),
      });
    }
    req.dados = resultado.data;
    next();
  };
}

module.exports = validar;

const app = require('./app');
const config = require('./config');

app.listen(config.porta, () => {
  console.log(`Cidade Viva API rodando em http://localhost:${config.porta}/api`);
});

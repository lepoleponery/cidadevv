require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("./db");

const [, , nome, email, senha] = process.argv;
if (!nome || !email || !senha) {
  console.log('Uso: node criar-moderador.js "Nome" email@exemplo.com SenhaForte123');
  process.exit(1);
}
if (senha.length < 8) {
  console.log("A senha precisa ter pelo menos 8 caracteres.");
  process.exit(1);
}

try {
  db.prepare("INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?,?,?, 'moderador')")
    .run(nome, email.trim().toLowerCase(), bcrypt.hashSync(senha, 12));
  console.log("Moderador criado com sucesso.");
} catch (e) {
  if (String(e.message).includes("UNIQUE")) { console.log("Esse e-mail já está cadastrado."); process.exitCode = 1; }
  else throw e;
}

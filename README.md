# Cidade Viva

Plataforma para moradores denunciarem problemas da cidade (queimadas, lixo, entulho, esgoto, buracos) e acompanharem a solução.

## Estrutura

```
cidade-viva/
├── README.md
├── backend/      API em Node.js + Express + SQLite
└── frontend/     Site em HTML, CSS e JS puro (sem build)
```

## Funcionalidades

- Denúncia com tipo, local, bairro, descrição, foto e GPS
- Protocolo para acompanhar cada denúncia
- Mapa com pinos coloridos por tipo
- Botão "Apoiar" (um apoio por pessoa)
- Aviso com o 193 (Bombeiros) em denúncias de queimada
- Conta de morador opcional, com "Minhas denúncias" e exclusão de conta
- Denúncia anônima (não liga a denúncia à conta)
- Painel do moderador: status, resposta, exclusão e estatísticas
- Página de privacidade (LGPD)
- PWA: pode ser instalado no celular

## Rodando o backend

```bash
cd backend
npm install
cp .env.example .env     # preencha o JWT_SECRET
node criar-moderador.js "Seu Nome" seu@email.com SuaSenhaForte
npm start
```

Variáveis do `.env`:

| Variável | Para que serve |
|---|---|
| `JWT_SECRET` | Obrigatória, mínimo 32 caracteres. Gere com `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `PORT` | Porta do servidor (padrão 3000) |
| `CORS_ORIGIN` | Endereço do frontend. Em produção, preencha |
| `PUBLIC_URL` | Endereço público do backend (links das fotos) |
| `TRUST_PROXY` | Use `1` se estiver atrás de proxy (Render, Railway...) |
| `DB_PATH` | Caminho do banco SQLite (opcional) |

## Rodando o frontend

1. Em `app.js`, `conta.js`, `admin.js` e `estatisticas.js`, troque `const API_URL = ""` pelo endereço do backend (ex.: `http://localhost:3000`).
2. Abra `inicio.html` por um servidor local (ex.: `npx serve frontend`). O PWA só funciona em `https` ou `localhost`.
3. Com `API_URL` vazio, o site roda em modo demonstração, sem backend.

## Rotas da API

| Método | Rota | Quem acessa |
|---|---|---|
| GET | `/denuncias` | público (moderador recebe também o protocolo) |
| POST | `/denuncias` | público (liga à conta se estiver logado e não for anônima) |
| GET | `/denuncias/protocolo/:cod` | público |
| POST | `/denuncias/:id/apoio` | público |
| POST | `/auth/cadastro` | público |
| POST | `/auth/login` | público |
| GET | `/minhas-denuncias` | logado |
| DELETE | `/conta` | morador logado |
| PATCH | `/denuncias/:id` | moderador |
| DELETE | `/denuncias/:id` | moderador |
| GET | `/estatisticas` | moderador |

## Publicação

- **Frontend:** GitHub Pages (ou qualquer hospedagem estática).
- **Backend:** precisa de um host que rode Node (Render, Railway, Fly.io, VPS). Coloque o endereço do frontend em `CORS_ORIGIN`.
- Planos gratuitos costumam apagar arquivos a cada reinício, o que perde o banco e as fotos. Use disco persistente.
- Nunca suba o `.env` nem o arquivo `.db` para o GitHub.

## Segurança e privacidade

- Senhas com hash (bcrypt), login com token (JWT) e limite de tentativas.
- Limite de denúncias por hora por IP, contra spam.
- Upload só de JPG, PNG e WEBP, até 5 MB.
- O IP não é guardado; apoios usam um código derivado.
- Preencha os campos [ ] da página `sobre.html` e peça revisão jurídica antes de publicar.

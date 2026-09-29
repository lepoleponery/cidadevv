# 🌿 CidadeViva

Aplicativo web para uma cidade mais limpa e sustentável. Os cidadãos podem denunciar problemas (lixo, entulho, queimadas, esgoto, focos de dengue), acompanhar notícias, consultar os órgãos responsáveis e conversar em um chat da comunidade.

## Funcionalidades

- Cadastro e login (nome, celular, usuário, e-mail e senha)
- Denúncias com tipo, endereço, descrição e foto
- Notícias ambientais
- Lista de órgãos responsáveis com telefone
- Chat da comunidade
- Perfil, troca de idioma (🇧🇷 🇺🇸 🇪🇸 🇫🇷) e exclusão de conta

## Estrutura

```
cidadeviva/
├── README.md
├── .gitignore
├── docs/DOCUMENTACAO.md   # documentação técnica completa
├── backend/               # API Node.js + Express
│   ├── server.js
│   ├── package.json
│   └── .env.example
└── frontend/              # interface (HTML, CSS e JS puro)
    ├── index.html
    ├── css/style.css
    └── js/app.js
```

## Como executar

Requisito: [Node.js](https://nodejs.org) 18 ou superior.

```bash
cd backend
npm install
cp .env.example .env      # opcional: defina JWT_SECRET
npm start
```

Abra **http://localhost:3000**. O backend já serve o frontend.

Para definir variáveis de ambiente sem `.env`:

```bash
JWT_SECRET="minha-chave-segura" PORT=3000 npm start
```

## API (resumo)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/cadastro` | Cria conta |
| POST | `/api/auth/login` | Entra e retorna o token |
| GET / DELETE | `/api/me` | Dados do usuário / exclui a conta |
| POST | `/api/denuncias` | Envia denúncia (multipart, campo `foto`) |
| GET | `/api/denuncias?minhas=1` | Lista denúncias |
| GET | `/api/estatisticas` | Totais da plataforma |
| GET | `/api/noticias` | Notícias |
| GET | `/api/orgaos` | Órgãos responsáveis |
| GET / POST | `/api/chat` | Lê / envia mensagens |

Detalhes em [`docs/DOCUMENTACAO.md`](docs/DOCUMENTACAO.md).

## Observações

- Os dados ficam em `backend/data/db.json` e as fotos em `backend/uploads/`. É adequado para protótipo; para produção, use um banco de dados real (PostgreSQL, MongoDB).
- Defina sempre um `JWT_SECRET` forte em produção e use HTTPS.

## Licença

Defina a licença do

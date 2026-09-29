# Documentação técnica – CidadeViva

## 1. Visão geral

O CidadeViva é um aplicativo web (SPA) que conecta cidadãos a ações de limpeza e sustentabilidade urbana. Slogan: *"Sua cidade mais limpa e sustentável"*.

**Público:** moradores que querem reportar problemas urbanos e ambientais.
**Idioma padrão:** português do Brasil, com suporte a inglês, espanhol e francês.

## 2. Arquitetura

```
Navegador (SPA)  ──HTTP/JSON──▶  Express (API)  ──▶  data/db.json
   frontend/                       backend/           uploads/ (fotos)
```

- **Frontend:** HTML, CSS e JavaScript puro, sem framework. Navegação por hash (`#/inicio`, `#/denunciar`, `#/noticias`, `#/orgaos`, `#/chat`, `#/perfil`).
- **Backend:** Node.js + Express, autenticação JWT, senhas com bcrypt, upload com multer.
- **Persistência:** arquivo JSON (protótipo). Ver seção 8 para migração.

Origem: o protótipo original guardava tudo no `localStorage` do navegador (chaves `cidadeviva_usuario`, `cidadeviva_usuarios`, `cidadeviva_idioma`). Agora os dados de usuários, denúncias e chat ficam no servidor; apenas o token e o idioma permanecem no navegador.

## 3. Telas

| Tela | Rota | Descrição |
|---|---|---|
| Login / Cadastro | (tela inicial) | Abas "Entrar" e "Criar conta", seletor de idioma |
| Início | `#/inicio` | Boas-vindas, estatísticas, dicas |
| Denunciar | `#/denunciar` | Formulário com tipo, endereço, descrição e foto |
| Notícias | `#/noticias` | Cartões de notícias |
| Órgãos | `#/orgaos` | Órgãos e telefones (acessível pela tela inicial) |
| Chat | `#/chat` | Mensagens da comunidade (atualiza a cada 4 s) |
| Perfil | `#/perfil` | Dados, idioma, sair e excluir conta |

## 4. Modelo de dados

**Usuário:** `id`, `nome`, `celular`, `username`, `email` (único), `senhaHash`, `criadoEm`
**Denúncia:** `id`, `usuarioId`, `tipo`, `endereco`, `descricao`, `foto`, `status` (`recebida` ou `resolvida`), `criadoEm`
**Mensagem:** `id`, `usuarioId`, `autor`, `texto` (máx. 500), `criadoEm`
**Notícia:** `id`, `titulo`, `resumo`, `imagem`, `data`
**Órgão:** `id`, `nome`, `icone`, `telefone`, `descricao`

## 5. API

Base: `/api`. Rotas protegidas exigem o cabeçalho `Authorization: Bearer <token>`. Erros retornam `{ "erro": "mensagem" }`.

### Autenticação

**POST `/auth/cadastro`**
```json
{ "nome": "Maria Silva", "celular": "(11) 99999-0000", "username": "@maria", "email": "maria@email.com", "senha": "123456" }
```
Resposta `201`: `{ "token": "...", "usuario": { ... } }`. Erros: `400` (campos ausentes, senha < 6), `409` (e-mail ou usuário já existe).

**POST `/auth/login`** – `{ "email": "...", "senha": "..." }` → `200` com token; `401` se inválido.

**GET `/me`** (protegida) – dados do usuário logado.
**DELETE `/me`** (protegida) – exclui conta e denúncias (`204`).

### Denúncias

**POST `/denuncias`** (protegida) – `multipart/form-data` com `tipo`, `endereco`, `descricao` e `foto` (imagem até 5 MB, opcional). Resposta `201`.
**GET `/denuncias`** (protegida) – lista; use `?minhas=1` para filtrar as do usuário.
**GET `/estatisticas`** (protegida) – `{ denuncias, resolvidas, usuarios }`.

### Conteúdo

**GET `/noticias`** e **GET `/orgaos`** – públicos.

### Chat

**GET `/chat?desde=<ISO>`** (protegida) – mensagens posteriores à data informada (até 100).
**POST `/chat`** (protegida) – `{ "texto": "..." }`.

## 6. Internacionalização

Objeto `traducoes` em `frontend/js/app.js`, com chaves `slogan`, `inicio`, `denunciar`, `noticias`, `chat`, `perfil`. Elementos com `data-i18n="chave"` são atualizados por `mudarIdioma(idioma)`; a escolha fica em `localStorage` (`cidadeviva_idioma`).
Para traduzir também as demais telas, mova os textos fixos das funções `tela*` para o objeto `traducoes`.

## 7. Segurança

- Senhas armazenadas com hash bcrypt (nunca em texto puro).
- JWT com validade de 7 dias; defina `JWT_SECRET` forte em produção.
- Todo texto do usuário é escapado no frontend (`escapar()`) para evitar XSS.
- Upload restrito a imagens de até 5 MB.
- **Recomendado antes de publicar:** HTTPS, limite de requisições (`express-rate-limit`), cabeçalhos com `helmet`, moderação do chat e das denúncias, política de privacidade (LGPD) para nome, celular e e-mail.

## 8. Melhorias futuras

- Trocar `db.json` por PostgreSQL ou MongoDB.
- Painel administrativo para atualizar o status das denúncias e publicar notícias.
- Geolocalização e mapa das denúncias.
- WebSocket no chat em vez de consulta periódica.
- Recuperação de senha por e-mail e verificação do celular.
- PWA (instalável, notificações).
- Testes automatizados (Jest + Supertest).

## 9. Como executar

Requisito: Node.js 18 ou superior.

```bash
cd backend
npm install
npm start
```

Abra http://localhost:3000. O backend já serve o frontend.

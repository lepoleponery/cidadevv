# Escopo do projeto – CidadeViva

## 1. Resumo

O CidadeViva é um aplicativo web para ajudar os moradores a cuidar da limpeza e da sustentabilidade da cidade. Ele reúne, em um só lugar, o registro de problemas urbanos e ambientais, a informação sobre a cidade e a comunicação entre a comunidade.

**Slogan:** Sua cidade mais limpa e sustentável.

## 2. Objetivos

- Facilitar que o cidadão denuncie problemas como lixo acumulado, entulho, queimadas, esgoto a céu aberto e focos de dengue.
- Mostrar quais órgãos procurar para cada tipo de problema, com telefone.
- Divulgar notícias e ações ambientais da cidade.
- Criar um espaço de conversa para a comunidade combinar mutirões e trocar dicas.

## 3. Público-alvo

- Moradores que querem reportar problemas urbanos e ambientais.
- Voluntários e grupos que organizam ações de limpeza.
- Equipes da prefeitura e de órgãos públicos que possam receber as denúncias (uso futuro).

## 4. Requisitos funcionais (dentro do escopo)

| Módulo | O que o sistema faz |
|---|---|
| Contas | Cadastro (nome, celular, usuário, e-mail e senha), login, perfil e exclusão da conta |
| Denúncias | Envio com tipo, endereço, descrição e foto opcional; lista das denúncias do próprio usuário |
| Início | Boas-vindas, estatísticas (denúncias, resolvidas, cidadãos) e dicas de como ajudar |
| Notícias | Lista de notícias ambientais |
| Órgãos responsáveis | Lista de órgãos com descrição e telefone |
| Chat | Conversa aberta da comunidade, atualizada periodicamente |
| Idiomas | Português, inglês, espanhol e francês (menu e slogan) |

## 5. Requisitos não funcionais

- **Acesso pelo celular:** interface responsiva, pensada primeiro para telas pequenas.
- **Segurança básica:** senhas com hash (bcrypt), login por token (JWT), texto do usuário escapado contra XSS, upload limitado a imagens de até 5 MB.
- **Persistência:** dados em banco PostgreSQL, sem perda ao reiniciar o servidor.
- **Simplicidade:** frontend em HTML, CSS e JavaScript puro, sem framework.

## 6. Fora do escopo (nesta versão)

- Painel administrativo para a prefeitura alterar o status das denúncias ou publicar notícias. Hoje o status é sempre "recebida".
- Mapa e geolocalização das denúncias.
- Recuperação de senha e verificação do número de celular.
- Moderação do chat e das denúncias.
- Notificações e aplicativo instalável (PWA).
- Tradução completa de todas as telas (hoje só o menu e o slogan trocam de idioma).
- Integração oficial com sistemas de órgãos públicos.

## 7. Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | HTML, CSS e JavaScript puro |
| Backend | Node.js e Express |
| Autenticação | JWT e bcrypt |
| Upload de fotos | Multer |
| Banco de dados | PostgreSQL |
| Código | GitHub |
| Hospedagem | Render (backend e banco) e GitHub Pages (versão demo) |

## 8. Entregas

- Frontend completo (`frontend/`).
- API e integração com o banco (`backend/`, incluindo `schema.sql`).
- Documentação técnica (`docs/DOCUMENTACAO.md`) e este escopo.
- README com instruções de execução.
- Versão demo autônoma (`index.html`), que guarda os dados só no aparelho do usuário.

## 9. Situação atual

- Código do projeto completo escrito e publicado no GitHub.
- Versão demo funcionando.
- Deploy completo no Render pendente: o servidor precisa encontrar `backend/package.json` e receber as variáveis `JWT_SECRET` e `DATABASE_URL`.

## 10. Riscos e cuidados

- **Dados pessoais:** o app guarda nome, celular e e-mail. Antes de abrir ao público, é necessária uma política de privacidade e adequação à LGPD.
- **Conteúdo do chat e das denúncias:** sem moderação, pode haver conteúdo ofensivo ou falso.
- **Hospedagem gratuita:** planos gratuitos costumam ter limites (servidor que "dorme", prazo do banco). Confira as condições atuais antes de depender deles.
- **Telefones e notícias:** os dados de órgãos e notícias são exemplos e precisam ser trocados pelos dados reais da cidade.

## 11. Próximas fases sugeridas

1. **Fase 1 – Publicação:** concluir o deploy no Render com o banco de dados e testar o fluxo completo.
2. **Fase 2 – Conteúdo real:** trocar notícias e telefones de exemplo pelos dados da cidade.
3. **Fase 3 – Administração:** criar painel para mudar o status das denúncias e publicar notícias.
4. **Fase 4 – Melhorias:** mapa das denúncias, recuperação de senha, moderação do chat e tradução completa.
5. **Fase 5 – Lançamento:** política de privacidade, testes com usuários reais e divulgação.

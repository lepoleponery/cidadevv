# Cidade Viva: Escopo do Projeto

## 1. Objetivo
Plataforma onde moradores registram problemas urbanos (queimadas, lixo, entulho, esgoto, buracos) e acompanham a resolução. Dá transparência ao que acontece na cidade e pressão pública sobre quem pode resolver.

## 2. Perfis de usuário
- **Visitante / morador sem conta:** denuncia, apoia, consulta por protocolo e vê o mapa.
- **Morador com conta:** tudo acima, mais "Minhas denúncias" e a opção de denunciar de forma anônima.
- **Moderador (prefeitura):** analisa, muda status, responde, apaga e vê estatísticas.

## 3. Funcionalidades

### Entregues (precisam ser testadas em uso real)
**Para o morador**
- Denúncia com tipo, local, bairro (opcional), descrição, foto (opcional) e GPS (opcional)
- Protocolo gerado a cada denúncia e consulta de andamento por protocolo
- Lista de denúncias com filtro por tipo
- Mapa com pinos coloridos por tipo (Leaflet + OpenStreetMap)
- Botão "Apoiar" (um apoio por pessoa)
- Aviso com o 193 (Bombeiros) em denúncias de queimada
- Cadastro, login e "Minhas denúncias"
- Denúncia anônima (não liga a denúncia à conta)
- Exclusão da própria conta (as denúncias publicadas ficam, sem vínculo)
- Página de privacidade (LGPD)
- PWA: instalar no celular e abrir mais rápido

**Para o moderador**
- Login por e-mail e senha
- Resumo por status, busca e filtro
- Alterar status (Recebida, Em análise, Resolvida), responder ao morador e apagar
- Estatísticas: total, últimos 7 dias, taxa de resolução, por tipo, por status e por bairro

### Fora do escopo atual (próximas versões)
- Recuperação de senha por e-mail
- Notificação por e-mail quando o status mudar
- Exportar relatório (CSV/PDF)
- Paginação da lista (hoje carrega até 500 denúncias)
- Moderação de fotos (revisão antes de publicar)
- Várias cidades na mesma plataforma
- Testes automatizados

## 4. Telas
| Tela | Arquivo | Quem usa |
|---|---|---|
| Escolha de perfil | `inicio.html` | todos |
| Denunciar, lista, mapa e protocolo | `index.html` | morador |
| Minha conta e minhas denúncias | `conta.html` | morador |
| Painel do moderador | `admin.html` | moderador |
| Estatísticas | `estatisticas.html` | moderador |
| Sobre e privacidade | `sobre.html` | todos |

## 5. API (contrato frontend e backend)
| Método | Rota | Acesso |
|---|---|---|
| GET | `/denuncias` | público (moderador recebe também o protocolo) |
| POST | `/denuncias` | público (liga à conta se logado e não anônima) |
| GET | `/denuncias/protocolo/:cod` | público |
| POST | `/denuncias/:id/apoio` | público |
| POST | `/auth/cadastro` | público |
| POST | `/auth/login` | público |
| GET | `/minhas-denuncias` | logado |
| DELETE | `/conta` | morador logado |
| PATCH | `/denuncias/:id` | moderador |
| DELETE | `/denuncias/:id` | moderador |
| GET | `/estatisticas` | moderador |

## 6. Modelo de dados
- **usuarios:** id, nome, email (único), senha_hash, papel (cidadao ou moderador), criado_em
- **denuncias:** id, protocolo (único), tipo, local, bairro, descricao, lat, lng, foto, status, resposta, apoios, usuario_id (pode ser vazio), criado_em
- **apoios:** denuncia_id, chave (código derivado do IP, nunca o IP) — um apoio por pessoa e denúncia

## 7. Tecnologias
- **Frontend:** HTML, CSS e JavaScript puro, sem build. Mapa com Leaflet.
- **Backend:** Node.js, Express e SQLite (better-sqlite3)
- **Segurança:** bcrypt (senhas), JWT (login), helmet, CORS e limite de requisições
- **Hospedagem prevista:** frontend no GitHub Pages; backend em host que rode Node (Render, Railway, Fly.io ou VPS)

## 8. Requisitos não funcionais
- Responsivo, com prioridade para o celular
- Acessível: uso por teclado, foco visível, contraste e leitor de tela
- Fotos: JPG, PNG ou WEBP, até 5 MB
- Proteção contra spam: 5 denúncias por hora por IP, limite de tentativas de login
- Senhas com hash, texto sempre escapado na tela (contra XSS) e consultas ao banco parametrizadas
- Privacidade: o IP não é guardado; dados pessoais só de quem cria conta
- LGPD: política publicada, consentimento no cadastro e exclusão de conta

## 9. Riscos e pontos de atenção
- **GPS público:** quem usa "Usar minha posição" expõe o ponto exato no mapa. Opção futura: arredondar as coordenadas.
- **Persistência:** planos gratuitos de hospedagem costumam apagar o banco e as fotos a cada reinício. Usar disco persistente ou migrar para Postgres e armazenamento de fotos na nuvem.
- **Apoio duplicado:** a trava é por IP; pessoas na mesma rede dividem o mesmo apoio.
- **Texto legal:** `sobre.html` é um modelo; precisa ser preenchido e revisado por alguém de direito.
- **Ícone do PWA:** hoje só em SVG; pode ser preciso gerar PNG de 192 e 512 px para o botão "Instalar" aparecer em alguns celulares.
- **Moderação:** não há revisão de fotos nem de textos antes de publicar.

## 10. Checklist antes de publicar
- [ ] `JWT_SECRET` forte no `.env` do servidor (nunca no GitHub)
- [ ] `CORS_ORIGIN` com o endereço real do frontend
- [ ] `API_URL` preenchido em `app.js`, `conta.js`, `admin.js` e `estatisticas.js`
- [ ] Centro e zoom do mapa ajustados para a sua cidade (`app.js`)
- [ ] Moderador criado com `criar-moderador.js` e senha forte
- [ ] Campos [ ] do `sobre.html` preenchidos e revisados
- [ ] Banco e fotos em disco persistente, com cópia de segurança
- [ ] Teste completo no celular e no computador

## 11. Critérios de pronto
- Enviar uma denúncia com foto em menos de 1 minuto
- Consultar o andamento pelo protocolo
- Moderador muda o status e o morador vê a mudança
- Funciona em celular e computador, sem erros no console
- Criar e excluir conta funcionam
- Página de privacidade publicada com os dados de contato reais

## 12. Etapas
1. Frontend do morador (concluído)
2. Painel do moderador (concluído)
3. Backend e API (concluído)
4. Conta, anônima, estatísticas, privacidade e PWA (concluído)
5. Testes ponta a ponta e correção de bugs (próximo)
6. Publicação e checklist da seção 10
7. Melhorias da lista "Fora do escopo atual"

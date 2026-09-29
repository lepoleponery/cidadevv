/* CidadeViva - frontend (JavaScript puro, comunica com a API em /api) */

/* ---------- idiomas ---------- */
const traducoes = {
  pt: { slogan: "Sua cidade mais limpa e sustentável", inicio: "Início", denunciar: "Denunciar", noticias: "Notícias", chat: "Chat", perfil: "Perfil" },
  en: { slogan: "Your city cleaner and more sustainable", inicio: "Home", denunciar: "Report", noticias: "News", chat: "Chat", perfil: "Profile" },
  es: { slogan: "Tu ciudad más limpia y sostenible", inicio: "Inicio", denunciar: "Denunciar", noticias: "Noticias", chat: "Chat", perfil: "Perfil" },
  fr: { slogan: "Votre ville plus propre et durable", inicio: "Accueil", denunciar: "Signaler", noticias: "Actualités", chat: "Chat", perfil: "Profil" }
};

let idiomaAtual = localStorage.getItem("cidadeviva_idioma") || "pt";

function mudarIdioma(idioma) {
  idiomaAtual = idioma;
  localStorage.setItem("cidadeviva_idioma", idioma);
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const t = traducoes[idioma][el.getAttribute("data-i18n")];
    if (t) el.textContent = t;
  });
  const seletor = document.getElementById("idiomaAuth");
  if (seletor) seletor.value = idioma;
}

/* ---------- utilidades ---------- */
const $ = id => document.getElementById(id);

function toast(texto) {
  const el = $("toast");
  el.textContent = texto;
  el.classList.add("mostrar");
  setTimeout(() => el.classList.remove("mostrar"), 3000);
}

function escapar(texto) {
  return String(texto).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

let usuarioAtual = null;
const getToken = () => localStorage.getItem("cidadeviva_token");

async function api(caminho, opcoes = {}) {
  const headers = { ...(opcoes.headers || {}) };
  if (getToken()) headers.Authorization = "Bearer " + getToken();
  if (opcoes.json) {
    headers["Content-Type"] = "application/json";
    opcoes.body = JSON.stringify(opcoes.json);
  }
  const resp = await fetch("/api" + caminho, { ...opcoes, headers });
  if (resp.status === 204) return null;
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    if (resp.status === 401 && getToken()) sair();
    throw new Error(dados.erro || "Erro inesperado.");
  }
  return dados;
}

/* ---------- autenticação ---------- */
function alternarAuth(login) {
  $("formLogin").classList.toggle("oculto", !login);
  $("formCadastro").classList.toggle("oculto", login);
  $("abaEntrar").classList.toggle("ativa", login);
  $("abaCriar").classList.toggle("ativa", !login);
  limparMensagem();
}
const mostrarLogin = () => alternarAuth(true);
const mostrarCadastro = () => alternarAuth(false);

function mostrarMensagem(texto, tipo) {
  const el = $("mensagemAuth");
  el.textContent = texto;
  el.className = "mensagem " + tipo;
}
function limparMensagem() {
  const el = $("mensagemAuth");
  el.textContent = "";
  el.className = "mensagem";
}

$("formCadastro").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const r = await api("/auth/cadastro", {
      method: "POST",
      json: {
        nome: $("cadNome").value.trim(), celular: $("cadCelular").value.trim(),
        username: $("cadUsuario").value.trim(), email: $("cadEmail").value.trim(),
        senha: $("cadSenha").value
      }
    });
    localStorage.setItem("cidadeviva_token", r.token);
    usuarioAtual = r.usuario;
    mostrarMensagem("Conta criada com sucesso!", "sucesso");
    setTimeout(abrirAplicativo, 600);
  } catch (err) { mostrarMensagem(err.message, "erro"); }
});

$("formLogin").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const r = await api("/auth/login", {
      method: "POST",
      json: { email: $("loginEmail").value.trim(), senha: $("loginSenha").value }
    });
    localStorage.setItem("cidadeviva_token", r.token);
    usuarioAtual = r.usuario;
    abrirAplicativo();
  } catch (err) { mostrarMensagem(err.message, "erro"); }
});

function sair() {
  localStorage.removeItem("cidadeviva_token");
  usuarioAtual = null;
  pararChat();
  $("aplicativo").classList.add("oculto");
  $("autenticacao").classList.remove("oculto");
  mostrarLogin();
}

function abrirAplicativo() {
  $("autenticacao").classList.add("oculto");
  $("aplicativo").classList.remove("oculto");
  $("avatarTopo").textContent = (usuarioAtual.nome || "CV").trim().slice(0, 2).toUpperCase();
  mudarIdioma(idiomaAtual);
  if (!location.hash || location.hash === "#/") location.hash = "#/inicio";
  rotear();
}

/* ---------- rotas ---------- */
function navegar(rota) {
  if (location.hash === rota) rotear(); else location.hash = rota;
}
window.addEventListener("hashchange", () => { if (usuarioAtual) rotear(); });

const telas = {
  "#/inicio": telaInicio, "#/denunciar": telaDenunciar, "#/noticias": telaNoticias,
  "#/orgaos": telaOrgaos, "#/chat": telaChat, "#/perfil": telaPerfil, "#/admin": telaAdmin
};

async function rotear() {
  pararChat();
  const rota = telas[location.hash] ? location.hash : "#/inicio";
  document.querySelectorAll(".menu button").forEach(b =>
    b.classList.toggle("ativo", b.dataset.rota === rota));
  $("conteudo").innerHTML = "";
  try { await telas[rota](); } catch (err) { toast(err.message); }
  window.scrollTo(0, 0);
}

/* ---------- telas ---------- */
async function telaInicio() {
  const est = await api("/estatisticas");
  $("conteudo").innerHTML = `
    <section class="hero"><div>
      <h2>Olá, ${escapar(usuarioAtual.nome.split(" ")[0])}! Vamos cuidar da cidade?</h2>
      <p>Denuncie problemas ambientais, acompanhe notícias e fale com quem quer uma cidade mais limpa e sustentável.</p>
      <div class="botoes-hero">
        <button class="botao-branco" onclick="navegar('#/denunciar')">📸 Fazer denúncia</button>
        <button class="botao-transparente" onclick="navegar('#/orgaos')">📞 Órgãos responsáveis</button>
      </div>
    </div></section>
    <div class="estatisticas">
      <div class="card"><div class="numero">${est.denuncias}</div><p>Denúncias registradas</p></div>
      <div class="card"><div class="numero">${est.resolvidas}</div><p>Problemas resolvidos</p></div>
      <div class="card"><div class="numero">${est.usuarios}</div><p>Cidadãos participando</p></div>
    </div>
    <h2 class="titulo-secao">Como ajudar</h2>
    <div class="grid">
      <div class="card"><div class="icone-grande">♻️</div><h3>Separe o lixo</h3><p>Recicláveis limpos e secos vão para a coleta seletiva.</p></div>
      <div class="card"><div class="icone-grande">🚯</div><h3>Denuncie descarte irregular</h3><p>Envie foto e endereço para agilizar a limpeza.</p></div>
      <div class="card"><div class="icone-grande">🌳</div><h3>Cuide das áreas verdes</h3><p>Avise sobre queimadas, desmatamento e árvores em risco.</p></div>
    </div>`;
}

function telaDenunciar() {
  $("conteudo").innerHTML = `
    <h2 class="titulo-secao">Nova denúncia</h2>
    <form id="formDenuncia" class="formulario"><div class="formulario-grid">
      <label>Tipo
        <select id="denTipo" required>
          <option value="">Selecione</option>
          <option>Lixo acumulado</option><option>Descarte irregular de entulho</option>
          <option>Queimada</option><option>Esgoto a céu aberto</option>
          <option>Foco de dengue</option><option>Outro</option>
        </select>
      </label>
      <label>Endereço ou ponto de referência <input id="denEndereco" required placeholder="Rua, número, bairro"></label>
      <label class="campo-grande">Descrição <textarea id="denDescricao" rows="4" required placeholder="Descreva o problema"></textarea></label>
      <div class="campo-grande">
        <label>Foto (opcional)</label>
        <div class="upload-area">
          <input id="denFoto" type="file" accept="image/*">
          <img id="denPreview" class="preview" alt="Pré-visualização da foto">
        </div>
      </div>
      <button class="botao-principal campo-grande" type="submit">Enviar denúncia</button>
    </div></form>`;

  $("denFoto").addEventListener("change", e => {
    const arq = e.target.files[0], img = $("denPreview");
    if (!arq) { img.style.display = "none"; return; }
    img.src = URL.createObjectURL(arq);
    img.style.display = "block";
  });

  $("formDenuncia").addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData();
    fd.append("tipo", $("denTipo").value);
    fd.append("endereco", $("denEndereco").value.trim());
    fd.append("descricao", $("denDescricao").value.trim());
    if ($("denFoto").files[0]) fd.append("foto", $("denFoto").files[0]);
    try {
      await api("/denuncias", { method: "POST", body: fd });
      toast("Denúncia enviada. Obrigado por ajudar!");
      navegar("#/inicio");
    } catch (err) { toast(err.message); }
  });
}

async function telaNoticias() {
  const lista = await api("/noticias");
  $("conteudo").innerHTML = `<h2 class="titulo-secao">Notícias</h2><div class="grid">${lista.map(n => `
    <article class="card noticia">
      <img src="${escapar(n.imagem)}" alt="">
      <div class="noticia-conteudo"><h3>${escapar(n.titulo)}</h3><p>${escapar(n.resumo)}</p>
      <p><small>${new Date(n.data).toLocaleDateString(idiomaAtual)}</small></p></div>
    </article>`).join("")}</div>`;
}

async function telaOrgaos() {
  const lista = await api("/orgaos");
  $("conteudo").innerHTML = `<h2 class="titulo-secao">Órgãos responsáveis</h2><div class="grid">${lista.map(o => `
    <div class="card orgao">
      <div class="orgao-icone">${escapar(o.icone)}</div>
      <div><h3>${escapar(o.nome)}</h3><p>${escapar(o.descricao)}</p>
      <a class="numero-telefone" href="tel:${escapar(o.telefone)}">${escapar(o.telefone)}</a></div>
    </div>`).join("")}</div>`;
}

/* chat */
let timerChat = null, ultimaMsg = "";
function pararChat() { clearInterval(timerChat); timerChat = null; }

function telaChat() {
  $("conteudo").innerHTML = `
    <h2 class="titulo-secao">Chat da comunidade</h2>
    <div class="chat">
      <div id="chatMensagens" class="chat-mensagens"></div>
      <form id="chatForm" class="chat-form">
        <input id="chatTexto" maxlength="500" placeholder="Escreva uma mensagem" autocomplete="off" required>
        <button class="botao-principal" type="submit">Enviar</button>
      </form>
    </div>`;
  ultimaMsg = "";

  async function carregar() {
    try {
      const novas = await api("/chat?desde=" + encodeURIComponent(ultimaMsg));
      if (!novas.length) return;
      const caixa = $("chatMensagens");
      if (!caixa) return;
      novas.forEach(m => {
        caixa.insertAdjacentHTML("beforeend",
          `<div class="mensagem-chat ${m.usuarioId === usuarioAtual.id ? "minha" : ""}">
             <strong>${escapar(m.autor)}</strong>${escapar(m.texto)}</div>`);
        ultimaMsg = m.criadoEm;
      });
      caixa.scrollTop = caixa.scrollHeight;
    } catch { /* tenta de novo no próximo ciclo */ }
  }

  $("chatForm").addEventListener("submit", async e => {
    e.preventDefault();
    const campo = $("chatTexto");
    try {
      await api("/chat", { method: "POST", json: { texto: campo.value } });
      campo.value = "";
      carregar();
    } catch (err) { toast(err.message); }
  });

  carregar();
  timerChat = setInterval(carregar, 4000);
}

async function telaPerfil() {
  const minhas = await api("/denuncias?minhas=1");
  const u = usuarioAtual;
  $("conteudo").innerHTML = `
    <h2 class="titulo-secao">Meu perfil</h2>
    <div class="perfil">
      <div class="avatar-grande">${escapar(u.nome.trim().slice(0, 2).toUpperCase())}</div>
      <h3>${escapar(u.nome)}</h3>
      <p>@${escapar(u.username.replace(/^@/, ""))}</p>
      <p>${escapar(u.email)}</p>
      <p>${escapar(u.celular)}</p>
      <p><strong>${minhas.length}</strong> denúncia(s) enviada(s)</p>
      <label style="display:block;margin-top:15px">Idioma
        <select id="idiomaPerfil">
          <option value="pt">🇧🇷 Português</option><option value="en">🇺🇸 English</option>
          <option value="es">🇪🇸 Español</option><option value="fr">🇫🇷 Français</option>
        </select>
      </label>
      <div class="acoes-perfil">
        ${u.papel === "admin" ? `<button class="botao-secundario" onclick="navegar('#/admin')">🛠️ Painel admin</button>` : ""}
        <button class="botao-secundario" id="btnSair">Sair</button>
        <button class="botao-perigo" id="btnExcluir">Excluir minha conta</button>
      </div>
    </div>`;
  $("idiomaPerfil").value = idiomaAtual;
  $("idiomaPerfil").onchange = e => mudarIdioma(e.target.value);
  $("btnSair").onclick = sair;
  $("btnExcluir").onclick = async () => {
    if (!confirm("Excluir sua conta e suas denúncias? Isso não pode ser desfeito.")) return;
    try { await api("/me", { method: "DELETE" }); sair(); toast("Conta excluída."); }
    catch (err) { toast(err.message); }
  };
}

/* ---------- painel administrativo ---------- */
async function telaAdmin() {
  if (usuarioAtual.papel !== "admin") throw new Error("Acesso restrito a administradores.");
  const [dens, nots] = await Promise.all([api("/admin/denuncias"), api("/noticias")]);

  $("conteudo").innerHTML = `
    <h2 class="titulo-secao">Painel administrativo</h2>

    <h3 style="margin:10px 0">Denúncias (${dens.length})</h3>
    ${dens.length ? dens.map(d => `
      <div class="card" style="margin-bottom:12px">
        <strong>${escapar(d.tipo)}</strong> · @${escapar((d.autor || "removido").replace(/^@/, ""))}
        <p>${escapar(d.endereco)}</p>
        <p>${escapar(d.descricao)}</p>
        <p><small>${new Date(d.criadoEm).toLocaleString(idiomaAtual)}</small></p>
        <select onchange="mudarStatus('${d.id}', this.value)">
          <option value="recebida" ${d.status === "recebida" ? "selected" : ""}>Recebida</option>
          <option value="resolvida" ${d.status === "resolvida" ? "selected" : ""}>Resolvida</option>
        </select>
      </div>`).join("") : `<div class="card"><p>Nenhuma denúncia ainda.</p></div>`}

    <h3 style="margin:24px 0 10px">Publicar notícia</h3>
    <form id="formNoticia" class="formulario"><div class="formulario-grid">
      <label class="campo-grande">Título <input id="notTitulo" required maxlength="150"></label>
      <label class="campo-grande">Resumo <textarea id="notResumo" rows="3" required maxlength="500"></textarea></label>
      <label class="campo-grande">Link da imagem (opcional) <input id="notImagem" placeholder="https://..."></label>
      <button class="botao-principal campo-grande" type="submit">Publicar</button>
    </div></form>

    <h3 style="margin:24px 0 10px">Notícias publicadas</h3>
    ${nots.map(n => `
      <div class="card" style="margin-bottom:12px">
        <strong>${escapar(n.titulo)}</strong>
        <p><small>${escapar(n.data)}</small></p>
        <button class="botao-perigo" onclick="excluirNoticia(${Number(n.id)})">Excluir</button>
      </div>`).join("")}`;

  $("formNoticia").addEventListener("submit", async e => {
    e.preventDefault();
    try {
      await api("/admin/noticias", {
        method: "POST",
        json: { titulo: $("notTitulo").value, resumo: $("notResumo").value, imagem: $("notImagem").value }
      });
      toast("Notícia publicada.");
      telaAdmin();
    } catch (err) { toast(err.message); }
  });
}

async function mudarStatus(id, status) {
  try {
    await api("/admin/denuncias/" + id, { method: "PATCH", json: { status } });
    toast("Status atualizado.");
  } catch (err) { toast(err.message); }
}

async function excluirNoticia(id) {
  if (!confirm("Excluir esta notícia?")) return;
  try {
    await api("/admin/noticias/" + id, { method: "DELETE" });
    toast("Notícia excluída.");
    telaAdmin();
  } catch (err) { toast(err.message); }
}

/* ---------- inicialização ---------- */
(async function iniciar() {
  mudarIdioma(idiomaAtual);
  if (!getToken()) return;
  try { usuarioAtual = await api("/me"); abrirAplicativo(); }
  catch { sair(); }
})();

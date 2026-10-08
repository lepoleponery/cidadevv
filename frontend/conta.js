// Mesma URL do app.js. Rotas usadas:
//   POST   {API_URL}/auth/cadastro      {nome, email, senha} -> {token, usuario}
//   POST   {API_URL}/auth/login         {email, senha}       -> {token, usuario}
//   GET    {API_URL}/minhas-denuncias   (Bearer)             -> lista
//   DELETE {API_URL}/conta              {senha} (Bearer)     -> 204
// Vazio = modo demonstração (nada é salvo de verdade).
const API_URL = "";

const TIPOS = {
  queimada:{nome:"Queimada",cor:"var(--fogo)"},
  lixo:{nome:"Lixo na rua",cor:"var(--lixo)"},
  entulho:{nome:"Entulho",cor:"var(--entulho)"},
  esgoto:{nome:"Esgoto",cor:"var(--esgoto)"},
  buraco:{nome:"Buraco",cor:"var(--buraco)"},
  outros:{nome:"Outros",cor:"var(--outros)"}
};
const $ = id => document.getElementById(id);
let sessao = null;
try { sessao = JSON.parse(localStorage.getItem("cv_conta") || "null"); } catch (_) {}

function esc(s){const e=document.createElement("div");e.textContent=s??"";return e.innerHTML}
function quando(iso){
  const m=Math.round((Date.now()-new Date(iso))/6e4);
  if(m<1) return "agora";
  if(m<60) return `há ${m} min`;
  const h=Math.round(m/60);
  if(h<24) return `há ${h} h`;
  return `há ${Math.round(h/24)} d`;
}
function aviso(id, txt, tipo){ const m=$(id); m.textContent=txt; m.className="msg "+(tipo||"") }
function guardar(s){ sessao = s; localStorage.setItem("cv_conta", JSON.stringify(s)); }

// ----- API -----
async function api(caminho, opc = {}){
  const headers = {"Content-Type":"application/json", ...(sessao ? {Authorization:"Bearer "+sessao.token} : {})};
  const r = await fetch(API_URL + caminho, {...opc, headers});
  if (r.status === 204) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.erro || "Algo deu errado. Tente de novo."); e.status = r.status; throw e; }
  return j;
}
async function entrarApi(email, senha){
  if (!API_URL) return {token:"demo", usuario:{nome:email.split("@")[0], email, papel:"cidadao"}};
  return api("/auth/login", {method:"POST", body:JSON.stringify({email, senha})});
}
async function criarApi(nome, email, senha){
  if (!API_URL) return {token:"demo", usuario:{nome, email, papel:"cidadao"}};
  return api("/auth/cadastro", {method:"POST", body:JSON.stringify({nome, email, senha})});
}
async function minhasApi(){
  if (!API_URL) return [{id:1, protocolo:"CV-DEMO01", tipo:"lixo", local:"Praça central", bairro:"Centro", descricao:"Exemplo de denúncia no modo demonstração.", status:"Recebida", resposta:"", criado_em:new Date(Date.now()-36e5*5).toISOString()}];
  return api("/minhas-denuncias");
}
async function excluirApi(senha){
  if (!API_URL) return;
  await api("/conta", {method:"DELETE", body:JSON.stringify({senha})});
}

// ----- telas -----
function mostrarConta(){
  $("tela-entrar").hidden = true;
  $("tela-conta").hidden = false;
  $("ola").textContent = `Olá, ${sessao.usuario.nome}`;
  carregarMinhas();
}
function sair(msg){
  sessao = null;
  localStorage.removeItem("cv_conta");
  $("tela-conta").hidden = true;
  $("tela-entrar").hidden = false;
  aviso("msg-entrar", msg || "");
}
async function carregarMinhas(){
  try {
    const lista = await minhasApi();
    if (!lista.length) { $("minhas").innerHTML = `<div class="vazio">Você ainda não enviou denúncias com esta conta.</div>`; return; }
    $("minhas").innerHTML = lista.map(d => {
      const t = TIPOS[d.tipo] || TIPOS.outros;
      return `<article class="item" style="--c:${t.cor}">
        <h3><span>${t.nome}</span><span class="status">${esc(d.status || "Recebida")}</span></h3>
        <p>${esc(d.descricao)}</p>
        ${d.resposta ? `<div class="resposta"><strong>Resposta:</strong> ${esc(d.resposta)}</div>` : ""}
        <small>${esc(d.local || "")}${d.bairro ? " · " + esc(d.bairro) : ""} · ${quando(d.criado_em)}</small><br>
        <small>Protocolo: <span class="protocolo">${esc(d.protocolo)}</span></small>
      </article>`;
    }).join("");
  } catch (e) {
    if (e.status === 401) return sair("Sua sessão expirou. Entre de novo.");
    $("minhas").innerHTML = `<div class="vazio">${esc(e.message)}</div>`;
  }
}

// ----- eventos -----
function aba(entrar){
  $("form-entrar").hidden = !entrar;
  $("form-criar").hidden = entrar;
  $("aba-entrar").setAttribute("aria-pressed", entrar);
  $("aba-criar").setAttribute("aria-pressed", !entrar);
  aviso("msg-entrar", "");
}
$("aba-entrar").addEventListener("click", () => aba(true));
$("aba-criar").addEventListener("click", () => aba(false));

$("form-entrar").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("e-email").value.trim(), senha = $("e-senha").value;
  if (!email || !senha) return aviso("msg-entrar", "Preencha e-mail e senha.", "erro");
  const b = $("btn-entrar"); b.disabled = true; aviso("msg-entrar", "Entrando...");
  try {
    guardar(await entrarApi(email, senha));
    $("form-entrar").reset(); aviso("msg-entrar", "");
    mostrarConta();
  } catch (err) { aviso("msg-entrar", err.message, "erro"); }
  finally { b.disabled = false; }
});

$("form-criar").addEventListener("submit", async e => {
  e.preventDefault();
  const nome = $("c-nome").value.trim(), email = $("c-email").value.trim(), senha = $("c-senha").value;
  if (nome.length < 2) return aviso("msg-entrar", "Informe seu nome.", "erro");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return aviso("msg-entrar", "Informe um e-mail válido.", "erro");
  if (senha.length < 8) return aviso("msg-entrar", "A senha precisa ter pelo menos 8 caracteres.", "erro");
  if (!$("c-aceito").checked) return aviso("msg-entrar", "Aceite a política de privacidade para criar a conta.", "erro");
  const b = $("btn-criar"); b.disabled = true; aviso("msg-entrar", "Criando conta...");
  try {
    guardar(await criarApi(nome, email, senha));
    $("form-criar").reset(); aviso("msg-entrar", "");
    mostrarConta();
  } catch (err) { aviso("msg-entrar", err.message, "erro"); }
  finally { b.disabled = false; }
});

$("btn-sair").addEventListener("click", () => sair());

$("btn-excluir").addEventListener("click", async () => {
  const senha = $("x-senha").value;
  if (!senha) return aviso("msg-conta", "Digite sua senha para confirmar.", "erro");
  if (!confirm("Excluir sua conta? Isso não pode ser desfeito.")) return;
  const b = $("btn-excluir"); b.disabled = true;
  try {
    await excluirApi(senha);
    $("x-senha").value = ""; aviso("msg-conta", "");
    sair("Conta excluída.");
  } catch (err) { aviso("msg-conta", err.message, "erro"); }
  finally { b.disabled = false; }
});

// ----- início -----
if (sessao) mostrarConta();

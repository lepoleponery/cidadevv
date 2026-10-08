// ====== CONFIGURAÇÃO ======
// Mesma URL do app.js. Rotas esperadas:
//   POST   {API_URL}/auth/login        body JSON {email, senha} -> {token, usuario:{nome, papel}}
//   GET    {API_URL}/denuncias         -> lista (igual ao site)
//   PATCH  {API_URL}/denuncias/:id     body JSON {status, resposta}   (header Authorization: Bearer TOKEN)
//   DELETE {API_URL}/denuncias/:id     (header Authorization: Bearer TOKEN)
// Se ficar vazio, roda em modo demonstração:
//   e-mail: admin@cidadeviva.com   senha: admin123   (REMOVA ISSO em produção)
const API_URL = "";

const STATUS = ["Recebida", "Em análise", "Resolvida"];
const TIPOS = {
  queimada:{nome:"Queimada",cor:"var(--fogo)"},
  lixo:{nome:"Lixo na rua",cor:"var(--lixo)"},
  entulho:{nome:"Entulho",cor:"var(--entulho)"},
  esgoto:{nome:"Esgoto",cor:"var(--esgoto)"},
  buraco:{nome:"Buraco",cor:"var(--buraco)"},
  outros:{nome:"Outros",cor:"var(--outros)"}
};

let sessao = null, dados = [], filtroStatus = "todos", termo = "";
const $ = id => document.getElementById(id);

// ----- helpers -----
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
function cab(){ return {"Content-Type":"application/json","Authorization":"Bearer "+sessao.token} }

// ----- API -----
async function login(email, senha){
  if(!API_URL){
    if(email==="admin@cidadeviva.com" && senha==="admin123")
      return {token:"demo",usuario:{nome:"Moderador Demo",papel:"moderador"}};
    throw new Error("E-mail ou senha incorretos.");
  }
  const r = await fetch(API_URL+"/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,senha})});
  if(!r.ok) throw new Error(r.status===401 ? "E-mail ou senha incorretos." : "Não foi possível entrar. Tente de novo.");
  return r.json();
}
async function carregar(){
  if(!API_URL){
    if(!dados.length) dados = [
      {id:1,tipo:"queimada",local:"Av. das Palmeiras, terreno baldio",descricao:"Fogo na vegetação seca perto das casas.",status:"Em análise",criado_em:new Date(Date.now()-36e5*3).toISOString()},
      {id:2,tipo:"lixo",local:"Praça central, lado da feira",descricao:"Sacos de lixo acumulados há quatro dias.",status:"Recebida",criado_em:new Date(Date.now()-864e5).toISOString()},
      {id:3,tipo:"buraco",local:"Rua das Acácias, 120",descricao:"Buraco grande no meio da pista.",status:"Resolvida",resposta:"Equipe da prefeitura tapou o buraco.",criado_em:new Date(Date.now()-864e5*4).toISOString()}
    ];
    return;
  }
  const r = await fetch(API_URL+"/denuncias",{headers:cab()});
  if(r.status===401||r.status===403) { sair(); throw new Error("Sessão expirada. Entre de novo."); }
  if(!r.ok) throw new Error("Não foi possível carregar as denúncias.");
  dados = await r.json();
}
async function salvar(id, status, resposta){
  if(!API_URL){
    const d = dados.find(x=>x.id==id); d.status=status; d.resposta=resposta; return;
  }
  const r = await fetch(`${API_URL}/denuncias/${id}`,{method:"PATCH",headers:cab(),body:JSON.stringify({status,resposta})});
  if(!r.ok) throw new Error("Não foi possível salvar as alterações.");
  const novo = await r.json().catch(()=>null);
  const d = dados.find(x=>x.id==id); Object.assign(d, novo||{status,resposta});
}
async function apagar(id){
  if(!API_URL){ dados = dados.filter(x=>x.id!=id); return; }
  const r = await fetch(`${API_URL}/denuncias/${id}`,{method:"DELETE",headers:cab()});
  if(!r.ok) throw new Error("Não foi possível apagar a denúncia.");
  dados = dados.filter(x=>x.id!=id);
}

// ----- sessão -----
function entrar(s){
  sessao = s;
  sessionStorage.setItem("cv_sessao", JSON.stringify(s));
  $("tela-login").hidden = true;
  $("tela-painel").hidden = false;
  $("ola").textContent = `Olá, ${s.usuario.nome}. Aqui você analisa e responde as denúncias.`;
  carregar().then(desenhar).catch(e=>aviso("msg-painel", e.message, "erro"));
}
function sair(){
  sessao = null; dados = [];
  sessionStorage.removeItem("cv_sessao");
  $("tela-painel").hidden = true;
  $("tela-login").hidden = false;
}

// ----- UI -----
function desenhar(){
  // resumo
  const cont = s => dados.filter(d=>(d.status||"Recebida")===s).length;
  $("resumo").innerHTML =
    `<div><strong>${dados.length}</strong><span>Total</span></div>` +
    STATUS.map(s=>`<div><strong>${cont(s)}</strong><span>${s}</span></div>`).join("");

  // filtros de status
  const opts = [["todos","Todas"],...STATUS.map(s=>[s,s])];
  $("filtros-status").innerHTML = opts.map(([k,n])=>
    `<button type="button" class="chip" data-s="${esc(k)}" aria-pressed="${filtroStatus===k}">${n}</button>`).join("");

  // lista
  const t = termo.toLowerCase();
  const itens = dados.filter(d =>
    (filtroStatus==="todos" || (d.status||"Recebida")===filtroStatus) &&
    (!t || (d.local||"").toLowerCase().includes(t) || (d.descricao||"").toLowerCase().includes(t)));

  if(!itens.length){
    $("lista-admin").innerHTML = `<div class="vazio">Nenhuma denúncia encontrada com esses filtros.</div>`;
    return;
  }
  $("lista-admin").innerHTML = itens.map(d=>{
    const tp = TIPOS[d.tipo]||TIPOS.outros;
    const st = d.status||"Recebida";
    return `<article class="item" style="--c:${tp.cor}" data-id="${esc(d.id)}">
      <h3><span>${tp.nome}</span><span class="status">${esc(st)}</span></h3>
      <p>${esc(d.descricao)}</p>
      ${d.foto?`<img src="${esc(d.foto)}" alt="Foto da denúncia" loading="lazy">`:""}
      <small>${esc(d.local||"Local não informado")} · ${quando(d.criado_em)}</small>
      ${d.resposta?`<div class="resposta"><strong>Resposta:</strong> ${esc(d.resposta)}</div>`:""}
      <div class="acoes">
        <div class="row">
          <label for="st-${esc(d.id)}" style="margin:0">Status</label>
          <select id="st-${esc(d.id)}">${STATUS.map(s=>`<option ${s===st?"selected":""}>${s}</option>`).join("")}</select>
        </div>
        <textarea id="rs-${esc(d.id)}" placeholder="Resposta para o cidadão (opcional)">${esc(d.resposta||"")}</textarea>
        <div class="row">
          <button type="button" class="btn" data-acao="salvar">Salvar alterações</button>
          <button type="button" class="btn perigo" data-acao="apagar">Apagar</button>
        </div>
      </div>
    </article>`}).join("");
}

// ----- eventos -----
$("form-login").addEventListener("submit", async e=>{
  e.preventDefault();
  const email=$("email").value.trim(), senha=$("senha").value;
  if(!email || !senha) return aviso("msg-login","Preencha e-mail e senha.","erro");
  const b=$("btn-login"); b.disabled=true; aviso("msg-login","Entrando...");
  try{
    const s = await login(email, senha);
    if(s.usuario?.papel !== "moderador") throw new Error("Esta conta não tem acesso ao painel.");
    $("form-login").reset(); aviso("msg-login","");
    entrar(s);
  }catch(err){ aviso("msg-login", err.message, "erro") }
  finally{ b.disabled=false }
});
$("btn-sair").addEventListener("click", sair);
$("busca").addEventListener("input", e=>{ termo=e.target.value; desenhar(); });
$("filtros-status").addEventListener("click", e=>{
  const b=e.target.closest("[data-s]"); if(!b) return;
  filtroStatus=b.dataset.s; desenhar();
});
$("lista-admin").addEventListener("click", async e=>{
  const btn=e.target.closest("[data-acao]"); if(!btn) return;
  const id = btn.closest(".item").dataset.id;
  btn.disabled=true;
  try{
    if(btn.dataset.acao==="salvar"){
      await salvar(id, $("st-"+id).value, $("rs-"+id).value.trim());
      aviso("msg-painel","Alterações salvas.","ok");
    }else{
      if(!confirm("Apagar esta denúncia? Isso não pode ser desfeito.")){ btn.disabled=false; return; }
      await apagar(id);
      aviso("msg-painel","Denúncia apagada.","ok");
    }
    desenhar();
  }catch(err){ aviso("msg-painel", err.message, "erro"); btn.disabled=false }
});

// ----- início: retoma sessão se já logado nesta aba -----
try{
  const salva = JSON.parse(sessionStorage.getItem("cv_sessao")||"null");
  if(salva) entrar(salva);
}catch(_){}

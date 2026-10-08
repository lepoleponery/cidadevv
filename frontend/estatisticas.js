// Mesma URL do admin.js. Rota: GET {API_URL}/estatisticas (Bearer, só moderador)
// Vazio = modo demonstração com números de exemplo.
const API_URL = "";

const NOMES = {queimada:"Queimada",lixo:"Lixo na rua",entulho:"Entulho",esgoto:"Esgoto",buraco:"Buraco",outros:"Outros"};
const CORES = {queimada:"var(--fogo)",lixo:"var(--lixo)",entulho:"var(--entulho)",esgoto:"var(--esgoto)",buraco:"var(--buraco)",outros:"var(--outros)"};
const $ = id => document.getElementById(id);
function esc(s){const e=document.createElement("div");e.textContent=s??"";return e.innerHTML}

let sessao = null;
try { sessao = JSON.parse(sessionStorage.getItem("cv_sessao") || "null"); } catch (_) {}

function voltarAoLogin(){ sessionStorage.removeItem("cv_sessao"); location.replace("admin.html"); }

async function carregar(){
  if (!API_URL) return {
    total:42, ultimos7dias:9,
    porTipo:[{tipo:"lixo",total:17},{tipo:"queimada",total:11},{tipo:"buraco",total:8},{tipo:"entulho",total:4},{tipo:"esgoto",total:2}],
    porStatus:[{status:"Recebida",total:20},{status:"Em análise",total:13},{status:"Resolvida",total:9}],
    porBairro:[{bairro:"Centro",total:12},{bairro:"Jardim das Flores",total:9},{bairro:"Vila Nova",total:6},{bairro:"Não informado",total:5}]
  };
  const r = await fetch(API_URL + "/estatisticas", {headers:{Authorization:"Bearer " + sessao.token}});
  if (r.status === 401 || r.status === 403) { voltarAoLogin(); return null; }
  if (!r.ok) throw new Error("Não foi possível carregar as estatísticas.");
  return r.json();
}

function barras(id, linhas, rotulo, cor){
  const el = $(id);
  if (!linhas.length) { el.innerHTML = `<div class="vazio">Sem dados ainda.</div>`; return; }
  const max = Math.max(1, ...linhas.map(l => l.total));
  el.innerHTML = linhas.map(l => `
    <div class="barra-linha">
      <span>${esc(rotulo(l))}</span>
      <div class="trilho"><i style="width:${Math.round(l.total / max * 100)}%;--c:${cor(l)}"></i></div>
      <b>${l.total}</b>
    </div>`).join("");
}

async function iniciar(){
  try {
    const d = await carregar();
    if (!d) return;
    const resolvidas = (d.porStatus.find(s => s.status === "Resolvida") || {total:0}).total;
    const pct = d.total ? Math.round(resolvidas / d.total * 100) : 0;
    $("resumo").innerHTML =
      `<div><strong>${d.total}</strong><span>Total de denúncias</span></div>` +
      `<div><strong>${d.ultimos7dias}</strong><span>Últimos 7 dias</span></div>` +
      `<div><strong>${resolvidas}</strong><span>Resolvidas</span></div>` +
      `<div><strong>${pct}%</strong><span>Taxa de resolução</span></div>`;
    barras("por-tipo", d.porTipo, l => NOMES[l.tipo] || l.tipo, l => CORES[l.tipo] || "var(--outros)");
    barras("por-status", d.porStatus, l => l.status, () => "var(--esgoto)");
    barras("por-bairro", d.porBairro, l => l.bairro, () => "var(--lixo)");
  } catch (e) {
    $("msg").className = "msg erro"; $("msg").textContent = e.message;
  }
}

if (!sessao) voltarAoLogin(); else iniciar();

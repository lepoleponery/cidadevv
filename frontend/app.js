// ====== CONFIGURAÇÃO ======
// Coloque aqui a URL do seu backend. Esperado:
//   GET  {API_URL}/denuncias  -> [{id, tipo, local, descricao, status, criado_em, foto, lat, lng}]
//   POST {API_URL}/denuncias  -> FormData: tipo, local, descricao, lat, lng, foto
// Se ficar vazio, roda em modo demonstração (dados só nesta página).
const API_URL = "";

const TIPOS = {
  queimada:{nome:"Queimada",cor:"var(--fogo)"},
  lixo:{nome:"Lixo na rua",cor:"var(--lixo)"},
  entulho:{nome:"Entulho",cor:"var(--entulho)"},
  esgoto:{nome:"Esgoto",cor:"var(--esgoto)"},
  buraco:{nome:"Buraco",cor:"var(--buraco)"},
  outros:{nome:"Outros",cor:"var(--outros)"}
};
let dados = [], filtro = "todos", coords = null, fotoData = null;
const $ = id => document.getElementById(id);

// ----- API -----
async function carregar(){
  if(!API_URL){
    if(!dados.length) dados = [
      {id:1,tipo:"queimada",local:"Av. das Palmeiras, terreno baldio",descricao:"Fogo na vegetação seca perto das casas.",status:"Em análise",criado_em:new Date(Date.now()-36e5*3).toISOString()},
      {id:2,tipo:"lixo",local:"Praça central, lado da feira",descricao:"Sacos de lixo acumulados há quatro dias.",status:"Recebida",criado_em:new Date(Date.now()-864e5).toISOString()}
    ];
    return;
  }
  const r = await fetch(API_URL+"/denuncias");
  if(!r.ok) throw new Error("Não foi possível carregar as denúncias.");
  dados = await r.json();
}
async function enviar(d, arquivo){
  if(!API_URL){
    dados.unshift({id:Date.now(),...d,foto:fotoData,status:"Recebida",criado_em:new Date().toISOString()});
    return;
  }
  const fd = new FormData();
  Object.entries(d).forEach(([k,v])=>{ if(v!=null) fd.append(k,v) });
  if(arquivo) fd.append("foto",arquivo);
  const r = await fetch(API_URL+"/denuncias",{method:"POST",body:fd});
  if(!r.ok) throw new Error("O servidor recusou a denúncia. Tente de novo.");
  await carregar();
}

// ----- UI -----
function esc(s){const e=document.createElement("div");e.textContent=s??"";return e.innerHTML}
function quando(iso){
  const m=Math.round((Date.now()-new Date(iso))/6e4);
  if(m<1) return "agora";
  if(m<60) return `há ${m} min`;
  const h=Math.round(m/60);
  if(h<24) return `há ${h} h`;
  return `há ${Math.round(h/24)} d`;
}
function desenharTipos(){
  $("tipos").innerHTML = Object.entries(TIPOS).map(([k,t],i)=>
    `<label class="tipo" style="--c:${t.cor}"><input type="radio" name="tipo" value="${k}" ${i===0?"checked":""}><span>${t.nome}</span></label>`).join("");
}
function desenharFiltros(){
  const opts = [["todos","Todas"],...Object.entries(TIPOS).map(([k,t])=>[k,t.nome])];
  $("filtros").innerHTML = opts.map(([k,n])=>`<button type="button" class="chip" data-f="${k}" aria-pressed="${filtro===k}">${n}</button>`).join("");
}
function desenharLista(){
  const itens = dados.filter(d=>filtro==="todos"||d.tipo===filtro);
  if(!itens.length){
    $("lista").innerHTML = `<div class="vazio">Nenhuma denúncia aqui ainda. Use o formulário para registrar a primeira.</div>`;
    return;
  }
  $("lista").innerHTML = itens.map(d=>{
    const t = TIPOS[d.tipo]||TIPOS.outros;
    return `<article class="item" style="--c:${t.cor}">
      <h3><span>${t.nome}</span><span class="status">${esc(d.status||"Recebida")}</span></h3>
      <p>${esc(d.descricao)}</p>
      ${d.foto?`<img src="${esc(d.foto)}" alt="Foto da denúncia" loading="lazy">`:""}
      <small>${esc(d.local||"Local não informado")} · ${quando(d.criado_em)}</small>
    </article>`}).join("");
}
function aviso(txt,tipo){ const m=$("msg"); m.textContent=txt; m.className="msg "+(tipo||"") }

// ----- Eventos -----
$("filtros").addEventListener("click",e=>{
  const b=e.target.closest("[data-f]"); if(!b) return;
  filtro=b.dataset.f; desenharFiltros(); desenharLista();
});
$("btn-gps").addEventListener("click",()=>{
  if(!navigator.geolocation) return aviso("Seu navegador não permite localização. Digite o endereço.","erro");
  aviso("Buscando sua posição...");
  navigator.geolocation.getCurrentPosition(p=>{
    coords={lat:p.coords.latitude,lng:p.coords.longitude};
    if(!$("local").value) $("local").value=`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
    aviso("Posição registrada.","ok");
  },()=>aviso("Não consegui pegar a posição. Digite o endereço.","erro"),{enableHighAccuracy:true,timeout:10000});
});
$("foto").addEventListener("change",e=>{
  const f=e.target.files[0], p=$("preview"); fotoData=null;
  if(!f){p.style.display="none";return}
  const r=new FileReader();
  r.onload=()=>{fotoData=r.result;p.src=r.result;p.style.display="block"};
  r.readAsDataURL(f);
});
$("form").addEventListener("submit",async e=>{
  e.preventDefault();
  const local=$("local").value.trim(), descricao=$("desc").value.trim();
  if(!local) return aviso("Informe onde fica o problema.","erro");
  if(descricao.length<10) return aviso("Descreva o problema com pelo menos 10 caracteres.","erro");
  const btn=$("enviar"); btn.disabled=true; aviso("Enviando...");
  try{
    await enviar({tipo:document.querySelector("[name=tipo]:checked").value,local,descricao,lat:coords?.lat,lng:coords?.lng},$("foto").files[0]);
    $("form").reset(); coords=null; fotoData=null; $("preview").style.display="none";
    aviso("Denúncia enviada. Obrigado por cuidar da cidade.","ok");
    desenharLista();
  }catch(err){ aviso(err.message,"erro") }
  finally{ btn.disabled=false }
});

// ----- Início -----
desenharTipos(); desenharFiltros();
carregar().then(desenharLista).catch(err=>{ $("lista").innerHTML=`<div class="vazio">${esc(err.message)}</div>` });

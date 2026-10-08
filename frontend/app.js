// ====== CONFIGURAÇÃO ======
// Rotas esperadas:
//   GET  {API_URL}/denuncias
//   POST {API_URL}/denuncias                 -> {protocolo}   (FormData: tipo, local, bairro, descricao, lat, lng, foto, anonima)
//   GET  {API_URL}/denuncias/protocolo/:cod  -> denúncia
//   POST {API_URL}/denuncias/:id/apoio       -> {apoios}
// Vazio = modo demonstração.
const API_URL = "";

const TIPOS = {
  queimada:{nome:"Queimada",cor:"var(--fogo)",hex:"#E4572E"},
  lixo:{nome:"Lixo na rua",cor:"var(--lixo)",hex:"#2F8F5B"},
  entulho:{nome:"Entulho",cor:"var(--entulho)",hex:"#8A6D3B"},
  esgoto:{nome:"Esgoto",cor:"var(--esgoto)",hex:"#2B7A9B"},
  buraco:{nome:"Buraco",cor:"var(--buraco)",hex:"#6B5CA5"},
  outros:{nome:"Outros",cor:"var(--outros)",hex:"#5B6E72"}
};
let dados = [], filtro = "todos", coords = null, fotoData = null, mapa = null, camada = null;
const $ = id => document.getElementById(id);
const novoProtocolo = () => "CV-" + Math.random().toString(36).slice(2, 8).toUpperCase();

function apoiados(){ try{ return JSON.parse(localStorage.getItem("cv_apoios")||"[]") }catch(_){ return [] } }
function marcarApoio(id){ try{ localStorage.setItem("cv_apoios", JSON.stringify([...apoiados(), String(id)])) }catch(_){} }
function conta(){ try{ return JSON.parse(localStorage.getItem("cv_conta")||"null") }catch(_){ return null } }

// ----- API -----
async function carregar(){
  if(!API_URL){
    if(!dados.length) dados = [
      {id:1,protocolo:"CV-DEMO01",tipo:"queimada",local:"Av. das Palmeiras, terreno baldio",bairro:"Centro",descricao:"Fogo na vegetação seca perto das casas.",status:"Em análise",apoios:12,lat:-23.55,lng:-46.63,criado_em:new Date(Date.now()-36e5*3).toISOString()},
      {id:2,protocolo:"CV-DEMO02",tipo:"lixo",local:"Praça central, lado da feira",bairro:"Jardim das Flores",descricao:"Sacos de lixo acumulados há quatro dias.",status:"Recebida",apoios:4,lat:-23.56,lng:-46.65,criado_em:new Date(Date.now()-864e5).toISOString()}
    ];
    return;
  }
  const r = await fetch(API_URL+"/denuncias");
  if(!r.ok) throw new Error("Não foi possível carregar as denúncias.");
  dados = await r.json();
}
async function enviar(d, arquivo){
  if(!API_URL){
    const protocolo = novoProtocolo();
    dados.unshift({id:Date.now(),protocolo,...d,foto:fotoData,apoios:0,status:"Recebida",criado_em:new Date().toISOString()});
    return protocolo;
  }
  const fd = new FormData();
  Object.entries(d).forEach(([k,v])=>{ if(v!=null) fd.append(k,v) });
  if(arquivo) fd.append("foto",arquivo);
  const headers = {};
  const c = conta();
  if(c && !d.anonima) headers.Authorization = "Bearer " + c.token; // liga à conta, se estiver logado
  const r = await fetch(API_URL+"/denuncias",{method:"POST",headers,body:fd});
  if(!r.ok){
    const j = await r.json().catch(()=>null);
    throw new Error(j?.erro || "O servidor recusou a denúncia. Tente de novo.");
  }
  const resp = await r.json().catch(()=>({}));
  await carregar();
  return resp.protocolo;
}
async function consultar(cod){
  if(!API_URL) return dados.find(d=>(d.protocolo||"").toUpperCase()===cod) || null;
  const r = await fetch(`${API_URL}/denuncias/protocolo/${encodeURIComponent(cod)}`);
  if(r.status===404) return null;
  if(!r.ok) throw new Error("Não foi possível consultar agora. Tente de novo.");
  return r.json();
}
async function apoiar(id){
  if(!API_URL){ const d=dados.find(x=>x.id==id); d.apoios=(d.apoios||0)+1; return; }
  const r = await fetch(`${API_URL}/denuncias/${id}/apoio`,{method:"POST"});
  if(!r.ok) throw new Error("Não foi possível registrar seu apoio.");
  const resp = await r.json().catch(()=>null);
  const d = dados.find(x=>x.id==id); d.apoios = resp?.apoios ?? (d.apoios||0)+1;
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
  atualizarAlerta();
}
function atualizarAlerta(){
  const t = document.querySelector("[name=tipo]:checked");
  $("alerta").hidden = !(t && t.value==="queimada");
}
function desenharFiltros(){
  const opts = [["todos","Todas"],...Object.entries(TIPOS).map(([k,t])=>[k,t.nome])];
  $("filtros").innerHTML = opts.map(([k,n])=>`<button type="button" class="chip" data-f="${k}" aria-pressed="${filtro===k}">${n}</button>`).join("");
}
function itensFiltrados(){ return dados.filter(d=>filtro==="todos"||d.tipo===filtro) }
function desenharLista(){
  const itens = itensFiltrados(), jaApoiou = apoiados();
  desenharMapa(itens);
  if(!itens.length){
    $("lista").innerHTML = `<div class="vazio">Nenhuma denúncia aqui ainda. Use o formulário para registrar a primeira.</div>`;
    return;
  }
  $("lista").innerHTML = itens.map(d=>{
    const t = TIPOS[d.tipo]||TIPOS.outros, ja = jaApoiou.includes(String(d.id));
    const onde = esc(d.local||"Local não informado") + (d.bairro ? " · " + esc(d.bairro) : "");
    return `<article class="item" style="--c:${t.cor}">
      <h3><span>${t.nome}</span><span class="status">${esc(d.status||"Recebida")}</span></h3>
      <p>${esc(d.descricao)}</p>
      ${d.foto?`<img src="${esc(d.foto)}" alt="Foto da denúncia" loading="lazy">`:""}
      <small>${onde} · ${quando(d.criado_em)}</small><br>
      <button type="button" class="apoiar" data-id="${esc(d.id)}" ${ja?"disabled":""}>${ja?"Você apoiou":"Apoiar"} · ${d.apoios||0}</button>
    </article>`}).join("");
}
function desenharMapa(itens){
  if(typeof L==="undefined") return $("mapa").style.display="none";
  if(!mapa){
    mapa = L.map("mapa").setView([-15.78,-47.93],4); // troque pelo centro da sua cidade
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(mapa);
    camada = L.layerGroup().addTo(mapa);
  }
  camada.clearLayers();
  const pts = [];
  itens.filter(d=>d.lat!=null&&d.lng!=null).forEach(d=>{
    const t = TIPOS[d.tipo]||TIPOS.outros;
    L.circleMarker([d.lat,d.lng],{radius:9,color:"#fff",weight:2,fillColor:t.hex,fillOpacity:.95})
      .bindPopup(`<strong>${esc(t.nome)}</strong><br>${esc(d.local||"")}<br>${esc(d.status||"Recebida")}`).addTo(camada);
    pts.push([d.lat,d.lng]);
  });
  if(pts.length) mapa.fitBounds(pts,{padding:[30,30],maxZoom:15});
}
function aviso(txt,tipo){ const m=$("msg"); m.textContent=txt; m.className="msg "+(tipo||"") }

// ----- Eventos -----
document.addEventListener("change",e=>{ if(e.target.name==="tipo") atualizarAlerta() });
$("filtros").addEventListener("click",e=>{
  const b=e.target.closest("[data-f]"); if(!b) return;
  filtro=b.dataset.f; desenharFiltros(); desenharLista();
});
$("lista").addEventListener("click",async e=>{
  const b=e.target.closest(".apoiar"); if(!b||b.disabled) return;
  b.disabled=true;
  try{ await apoiar(b.dataset.id); marcarApoio(b.dataset.id); desenharLista(); }
  catch(err){ b.disabled=false; alert(err.message) }
});
$("btn-consultar").addEventListener("click",async()=>{
  const cod=$("protocolo").value.trim().toUpperCase(), r=$("resultado");
  if(!cod){ r.className="msg erro"; r.textContent="Digite o código do protocolo."; return }
  r.className="msg"; r.textContent="Consultando...";
  try{
    const d = await consultar(cod);
    if(!d){ r.className="msg erro"; r.textContent="Não encontramos esse protocolo. Confira o código e tente de novo."; return }
    r.className="msg ok";
    r.textContent = `${(TIPOS[d.tipo]||TIPOS.outros).nome} · ${d.status||"Recebida"}` + (d.resposta?` · Resposta: ${d.resposta}`:"");
  }catch(err){ r.className="msg erro"; r.textContent=err.message }
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
  const local=$("local").value.trim(), descricao=$("desc").value.trim(), bairro=$("bairro").value.trim();
  if(!local) return aviso("Informe onde fica o problema.","erro");
  if(descricao.length<10) return aviso("Descreva o problema com pelo menos 10 caracteres.","erro");
  const btn=$("enviar"); btn.disabled=true; aviso("Enviando...");
  try{
    const dadosForm = {tipo:document.querySelector("[name=tipo]:checked").value,local,bairro,descricao,lat:coords?.lat,lng:coords?.lng};
    if($("anonima").checked) dadosForm.anonima = "1";
    const protocolo = await enviar(dadosForm,$("foto").files[0]);
    $("form").reset(); coords=null; fotoData=null; $("preview").style.display="none"; atualizarAlerta();
    aviso(protocolo ? `Denúncia enviada! Guarde seu protocolo: ${protocolo}` : "Denúncia enviada. Obrigado por cuidar da cidade.","ok");
    desenharLista();
  }catch(err){ aviso(err.message,"erro") }
  finally{ btn.disabled=false }
});

// ----- Início -----
$("box-anonima").hidden = !conta(); // só aparece para quem está logado
desenharTipos(); desenharFiltros();
carregar().then(desenharLista).catch(err=>{ $("lista").innerHTML=`<div class="vazio">${esc(err.message)}</div>` });

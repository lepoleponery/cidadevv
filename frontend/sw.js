// Guarda as telas do site para abrir mais rápido e funcionar com internet ruim.
// Os dados das denúncias (API) nunca são guardados aqui.
const VERSAO = "cv-v1";
const ARQUIVOS = [
  "./", "inicio.html", "index.html", "conta.html", "sobre.html",
  "style.css", "extras.css", "app.js", "conta.js", "manifest.webmanifest", "icone.svg"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VERSAO)
      .then(c => Promise.all(ARQUIVOS.map(a => c.add(a).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(chaves => Promise.all(chaves.filter(k => k !== VERSAO).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;   // só arquivos do próprio site
  if (req.headers.get("Authorization")) return;                         // nunca guarda pedidos logados
  if (!(/\.(html|css|js|svg|webmanifest)$/.test(url.pathname) || url.pathname.endsWith("/"))) return;

  // tenta a internet primeiro; se falhar, usa o que está guardado
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(VERSAO).then(c => c.put(req, copia)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match("inicio.html")))
  );
});

/* AMBIOMA · service worker para uso offline en campo */
// Cambia el número cuando cambie un archivo cacheado (datos_erosion.js, icon.svg,
// manifest). index.html se sirve primero desde la red, así que no requiere esto.
const CACHE = "spt-offline-v3";
const MISMOSITIO = [
  "./index.html",
  "./datos_erosion.js",
  "./manifest.webmanifest",
  "./icon.svg"
];
// El CSS de Tailwind viene de otro dominio: se guarda como respuesta opaca (no-cors).
const EXTERNOS = ["https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"];

async function guardar(c, url, opciones) {
  try {
    const r = await fetch(url, opciones || { cache: "reload" });
    await c.put(url, r);
    return true;
  } catch (e) {
    return false;
  }
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      await Promise.all(MISMOSITIO.map((u) => guardar(c, u))).then(() =>
        Promise.all(EXTERNOS.map((u) => guardar(c, u, { mode: "no-cors", cache: "reload" })))
      );
      self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const esPagina = req.mode === "navigate";
  const esMismo = url.origin === self.location.origin;

  // Páginas: red primero (ves las actualizaciones), caché si no hay señal.
  if (esPagina) {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copia).catch(() => {}));
          return r;
        })
        .catch(() => caches.match("./index.html").then((r) => r || Response.error()))
    );
    return;
  }

  // JS, CSS, íconos: caché primero y relleno la primera vez que se usan.
  e.respondWith(
    caches.match(req).then((guardado) => {
      if (guardado) return guardado;
      return fetch(req)
        .then((r) => {
          if (r && (r.status === 200 || r.type === "opaque") && (esMismo || url.hostname === "www.gstatic.com")) {
            const copia = r.clone();
            caches.open(CACHE).then((c) => c.put(req, copia).catch(() => {}));
          }
          return r;
        })
        .catch(() => Response.error());
    })
  );
});

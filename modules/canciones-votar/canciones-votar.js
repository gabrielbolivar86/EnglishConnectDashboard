/* Canciones (alumno): busca en iTunes, sugiere, vota y mira el ranking.
   - Sin límite de votos, pero un voto por canción (tocar de nuevo lo quita).
   - Las explícitas no se muestran. Se ve cuántos votos tiene cada canción, no quién votó.
   - Se actualiza sola cada 10 s mientras la pantalla está visible. */
(function () {
  const EC = window.EC;
  const INTERVALO = 10000;
  let cont, ctx, version = null, abierta = true, canciones = [], mis = new Set();
  let timer = null, montado = false, busquedaN = 0, debounce = null;
  const $ = (s) => cont.querySelector(s);

  // Misma regla que el servidor para avisar "ya está en la lista" antes de sugerir
  function clave(titulo, artista) {
    let t = String(titulo || "").replace(/\([^)]*\)|\[[^\]]*\]/g, " ").split(/\s+-\s+/)[0]
      .replace(/\b(feat|ft|featuring)\b\.?.*$/i, " ");
    t = EC.norm(t).replace(/[^a-z0-9 ]/g, " ").replace(/\b(remix|remastered|remaster)\s*$/, " ").replace(/\s+/g, " ").trim();
    const a = EC.norm(String(artista || "").split(/,|&|\bfeat\b\.?|\bft\b\.?|\bfeaturing\b|\sx\s/i)[0]).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    return t + "|" + a;
  }

  // ---------- iTunes (con respaldo JSONP por si el navegador bloquea el fetch) ----------
  function urlBusqueda(term) {
    return "https://itunes.apple.com/search?media=music&entity=song&limit=20&explicit=No&country=US&term=" + encodeURIComponent(term);
  }
  function jsonp(url) {
    return new Promise((ok, fallo) => {
      const cb = "ecItunes" + Date.now();
      const s = document.createElement("script");
      const fin = () => { delete window[cb]; s.remove(); };
      window[cb] = (d) => { fin(); ok(d); };
      s.onerror = () => { fin(); fallo(new Error("jsonp")); };
      s.src = url + "&callback=" + cb;
      document.head.appendChild(s);
      setTimeout(() => { if (window[cb]) { fin(); fallo(new Error("timeout")); } }, 10000);
    });
  }
  async function itunes(term) {
    const url = urlBusqueda(term);
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(url, { signal: ctrl.signal }); clearTimeout(t);
      return await r.json();
    } catch (e) { return await jsonp(url); }
  }

  // ---------- montaje ----------
  EC.registrar("canciones-votar", {
    montar(c, x) {
      cont = c; ctx = x; version = null; canciones = []; mis = new Set(); montado = true;
      cont.innerHTML =
        '<div id="cvBanner"></div>' +
        '<div class="caja"><div class="campo" style="margin:0"><label>Sugiere una canción</label>' +
        '<input id="cvBuscar" type="search" placeholder="Título o artista…" autocomplete="off"></div><div id="cvRes"></div></div>' +
        '<div class="caja"><h3 style="margin-bottom:4px">Ranking</h3><div id="cvLista"><p class="vacio">Cargando…</p></div></div>' +
        '<details class="cn-det" id="cvSonaron" hidden><summary>Ya sonaron</summary><div class="caja" id="cvSon"></div></details>';
      $("#cvBuscar").addEventListener("input", () => {
        clearTimeout(debounce); debounce = setTimeout(buscar, 450);
      });
      document.addEventListener("visibilitychange", alVisibilidad);
      refrescar(true);
      timer = setInterval(() => { if (!document.hidden) refrescar(false); }, INTERVALO);
    },
    desmontar() {
      montado = false; clearInterval(timer); clearTimeout(debounce);
      document.removeEventListener("visibilitychange", alVisibilidad);
    },
  });
  function alVisibilidad() { if (!document.hidden && montado) refrescar(false); }

  // ---------- datos ----------
  async function refrescar(primera) {
    try {
      const d = await ctx.api("canciones_lista", version === null ? {} : { v: version, abierta }, { reintentos: 0, silencioso: !primera });
      if (!montado || d.sin_cambios) return;
      version = d.version; abierta = d.abierta; canciones = d.canciones; mis = new Set(d.mis_votos);
      pintar();
    } catch (e) {
      if (primera && montado) $("#cvLista").innerHTML = '<p class="vacio">❌ ' + EC.esc(e.message) + "</p>";
    }
  }

  // ---------- pintar ----------
  function filaCancion(c, i) {
    const voto = mis.has(c.id);
    return '<div class="cn-item"><span class="cn-pos">' + (i + 1) + "</span>" + cover(c.portada) +
      '<div class="cn-info"><b>' + EC.esc(c.titulo) + "</b><span>" + EC.esc(c.artista) + "</span></div>" +
      '<button class="cn-voto' + (voto ? " si" : "") + '" data-v="' + EC.esc(c.id) + '"' + (abierta ? "" : " disabled") + ' aria-label="Votar">' +
      (voto ? "♥" : "♡") + " " + c.votos + "<small>" + (voto ? "votaste" : "votar") + "</small></button></div>";
  }
  function cover(url) {
    return url ? '<img class="cn-cover" src="' + EC.esc(url) + '" alt="" loading="lazy">' : '<div class="cn-cover">🎵</div>';
  }
  function arreglarImagenes(raiz) {
    raiz.querySelectorAll("img.cn-cover").forEach((im) => im.addEventListener("error", () => {
      const d = document.createElement("div"); d.className = "cn-cover"; d.textContent = "🎵"; im.replaceWith(d);
    }, { once: true }));
  }

  function pintar() {
    $("#cvBanner").innerHTML = abierta ? "" : '<div class="cn-banner cerrada">🔒 La votación está cerrada por ahora. Puedes ver el ranking.</div>';
    $("#cvBuscar").disabled = !abierta;
    const activas = canciones.filter((c) => c.estado === "activa");
    $("#cvLista").innerHTML = activas.length ? activas.map(filaCancion).join("") :
      '<p class="vacio">Todavía no hay canciones. ¡Sé el primero en sugerir una!</p>';
    $("#cvLista").querySelectorAll("[data-v]").forEach((b) => b.addEventListener("click", () => votar(b.dataset.v)));
    const ya = canciones.filter((c) => c.estado === "reproducida");
    $("#cvSonaron").hidden = !ya.length;
    $("#cvSon").innerHTML = ya.map((c) => '<div class="cn-item">' + cover(c.portada) + '<div class="cn-info"><b>' + EC.esc(c.titulo) + "</b><span>" + EC.esc(c.artista) + "</span></div></div>").join("");
    arreglarImagenes(cont);
    if ($("#cvRes").childElementCount) pintarResultados(); // actualiza los "ya está" del buscador
  }

  // ---------- votar ----------
  async function votar(id) {
    const c = canciones.find((x) => x.id === id); if (!c || !abierta) return;
    const quiere = !mis.has(id);
    quiere ? mis.add(id) : mis.delete(id); c.votos += quiere ? 1 : -1; pintar(); // al instante
    try { await ctx.api("cancion_votar", { id_cancion: id, voto: quiere }, { reintentos: 1 }); version = null; refrescar(false); }
    catch (e) {
      quiere ? mis.delete(id) : mis.add(id); c.votos += quiere ? -1 : 1; pintar();
      EC.toast(e.message, "error"); if (e.codigo === "CERRADA") { version = null; refrescar(false); }
    }
  }

  // ---------- buscar y sugerir ----------
  let resultados = [], ocultas = 0;
  async function buscar() {
    const term = $("#cvBuscar").value.trim(), n = ++busquedaN;
    if (term.length < 2) { resultados = []; $("#cvRes").innerHTML = ""; return; }
    $("#cvRes").innerHTML = '<p class="cn-nota">Buscando…</p>';
    try {
      const d = await itunes(term);
      if (n !== busquedaN || !montado) return;
      const vistos = {}; ocultas = 0; resultados = [];
      (d.results || []).forEach((x) => {
        if (x.kind && x.kind !== "song") return;
        if (x.trackExplicitness === "explicit") { ocultas++; return; }
        const item = { id_itunes: String(x.trackId), titulo: x.trackName, artista: x.artistName,
          portada: String(x.artworkUrl100 || "").replace("100x100", "200x200") };
        const k = clave(item.titulo, item.artista);
        if (vistos[k]) return; vistos[k] = true; resultados.push(item);
      });
      pintarResultados();
    } catch (e) { if (n === busquedaN) $("#cvRes").innerHTML = '<p class="cn-nota">No se pudo buscar ahora. Revisa tu internet e inténtalo otra vez.</p>'; }
  }

  function pintarResultados() {
    if (!resultados.length) { $("#cvRes").innerHTML = '<p class="cn-nota">Sin resultados' + (ocultas ? " (se ocultaron " + ocultas + " con contenido explícito)" : "") + ".</p>"; return; }
    const claves = {}; canciones.forEach((c) => (claves[clave(c.titulo, c.artista)] = c));
    $("#cvRes").innerHTML = resultados.map((r, i) => {
      const ya = claves[clave(r.titulo, r.artista)];
      return '<div class="cn-item">' + cover(r.portada) + '<div class="cn-info"><b>' + EC.esc(r.titulo) + "</b><span>" + EC.esc(r.artista) + "</span></div>" +
        (ya ? (mis.has(ya.id) ? '<span class="chip">Ya la votaste</span>' : '<button class="btn chico suave" data-ya="' + EC.esc(ya.id) + '">Ya está · Votar</button>')
            : '<button class="btn chico principal" data-s="' + i + '">Sugerir</button>') + "</div>";
    }).join("") + (ocultas ? '<p class="cn-nota">Se ocultaron ' + ocultas + " canciones con contenido explícito.</p>" : "");
    arreglarImagenes($("#cvRes"));
    $("#cvRes").querySelectorAll("[data-s]").forEach((b) => b.addEventListener("click", () => sugerir(resultados[+b.dataset.s], b)));
    $("#cvRes").querySelectorAll("[data-ya]").forEach((b) => b.addEventListener("click", () => votar(b.dataset.ya)));
  }

  async function sugerir(r, boton) {
    await EC.ocupado(boton, async () => {
      try {
        await ctx.api("cancion_sugerir", { id_itunes: r.id_itunes, titulo: r.titulo, artista: r.artista, portada: r.portada, explicita: false }, { reintentos: 0 });
        EC.toast("✅ Canción agregada y votada", "ok");
        $("#cvBuscar").value = ""; resultados = []; $("#cvRes").innerHTML = "";
      } catch (e) {
        if (e.codigo === "DUPLICADO" && e.datos && e.datos.extra) {
          EC.toast("Ya estaba en la lista: la votamos por ti.", "info", 3500);
          version = null; await refrescar(false);
          if (!mis.has(e.datos.extra.id_cancion)) await votar(e.datos.extra.id_cancion);
          return;
        }
        EC.toast(e.message, "error", 4500);
      }
      version = null; await refrescar(false);
    });
  }
})();

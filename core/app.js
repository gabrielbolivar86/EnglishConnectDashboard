/* Arranque: login único, PIN obligatorio, menú por rol y carga de módulos. */
(function () {
  const EC = window.EC;
  const $ = EC.$;
  let moduloActivo = null; // { def, impl }

  const pantallas = ["vistaLogin", "vistaPin", "app"];
  function mostrar(id) { pantallas.forEach((p) => ($("#" + p).hidden = p !== id)); }

  const nivelDe = (rol) => EC.NIVEL[rol] || 1;
  const puedeVer = (m, rol) => nivelDe(rol) >= EC.NIVEL[m.min];

  // ---------------- Login ----------------
  function mostrarLogin(mensaje) {
    detenerModulo();
    mostrar("vistaLogin");
    $("#errorLogin").textContent = mensaje || "";
    $("#loginPin").value = "";
    setTimeout(() => $("#loginUsuario").focus(), 50);
  }
  EC.alCerrarSesion = (m) => { location.hash = ""; mostrarLogin(m || "Tu sesión venció. Entra de nuevo."); };

  $("#formLogin").addEventListener("submit", async (e) => {
    e.preventDefault();
    const usuario = $("#loginUsuario").value.trim();
    const pin = $("#loginPin").value.trim();
    const err = $("#errorLogin");
    err.textContent = "";
    if (!usuario || !pin) { err.textContent = "Escribe tu usuario y tu PIN."; return; }
    const btn = $("#btnLogin");
    btn.disabled = true; btn.textContent = "Entrando…";
    try {
      const d = await EC.api("login", { usuario, pin }, { reintentos: 0, sinToken: true });
      EC.sesion.guardar({
        token: d.token, id: d.id, usuario: d.usuario, rol: d.rol,
        nombre: d.nombre, apellido: d.apellido, debe_cambiar_pin: !!d.debe_cambiar_pin,
      });
      if (d.debe_cambiar_pin) mostrarPinObligatorio(); else entrar();
    } catch (x) {
      err.textContent = x.message;
    } finally {
      btn.disabled = false; btn.textContent = "Entrar";
    }
  });

  // ---------------- PIN obligatorio ----------------
  function mostrarPinObligatorio() {
    mostrar("vistaPin");
    $("#errorPin").textContent = "";
    $("#pinNuevo").value = ""; $("#pinRepite").value = "";
    setTimeout(() => $("#pinNuevo").focus(), 50);
  }
  $("#formPin").addEventListener("submit", async (e) => {
    e.preventDefault();
    const a = $("#pinNuevo").value.trim(), b = $("#pinRepite").value.trim();
    const err = $("#errorPin");
    err.textContent = "";
    if (!/^\d{4}$/.test(a)) { err.textContent = "El PIN debe tener exactamente 4 números."; return; }
    if (a !== b) { err.textContent = "Los dos PIN no coinciden."; return; }
    const btn = $("#btnPin");
    btn.disabled = true;
    try {
      const d = await EC.api("cambiar_pin", { pin_nuevo: a }, { reintentos: 0 });
      const s = EC.sesion.obtener();
      s.token = d.token; s.debe_cambiar_pin = false;
      EC.sesion.guardar(s);
      EC.toast("PIN guardado ✅", "ok");
      entrar();
    } catch (x) { err.textContent = x.message; }
    finally { btn.disabled = false; }
  });

  // ---------------- Entrada a la app ----------------
  async function entrar() {
    let s = EC.sesion.obtener();
    // Confirma con el servidor (y actualiza el rol si lo cambiaste en la hoja)
    try {
      const d = await EC.api("sesion", {}, { reintentos: 1 });
      s = Object.assign(s, { rol: d.rol, nombre: d.nombre, apellido: d.apellido, usuario: d.usuario });
      EC.sesion.guardar(s);
    } catch (x) {
      if (x.codigo === "SESION") return; // alCerrarSesion ya mostró el login
      if (x.codigo === "CAMBIAR_PIN") { s.debe_cambiar_pin = true; EC.sesion.guardar(s); return mostrarPinObligatorio(); }
      if (x.codigo === "RED") EC.toast("Sin conexión: usando tu última sesión guardada.", "error");
    }
    mostrar("app");
    pintarRuta();
  }

  $("#btnSalir").addEventListener("click", async () => {
    if (!(await EC.confirmar("¿Cerrar sesión?", { si: "Salir" }))) return;
    EC.sesion.cerrar();
    location.hash = "";
    mostrarLogin();
  });
  $("#btnVolver").addEventListener("click", () => { location.hash = ""; });
  $("#btnDebug").addEventListener("click", () => {
    const p = $("#panelDebug");
    p.hidden = !p.hidden;
    if (!p.hidden && !$("#debugLista").childElementCount) {
      EC._logs.forEach((l) => {
        const d = document.createElement("div");
        d.className = "log-" + l.tipo; d.textContent = "[" + l.hora + "] " + l.mensaje;
        $("#debugLista").appendChild(d);
      });
    }
  });
  $("#limpiarDebug").addEventListener("click", () => { $("#debugLista").innerHTML = ""; EC._logs = []; });

  // ---------------- Menú y rutas ----------------
  function pintarRuta() {
    const id = (location.hash.match(/^#\/([\w-]+)/) || [])[1];
    const s = EC.sesion.obtener();
    if (!s) return;
    const def = EC.modulos.find((m) => m.id === id);
    if (def && puedeVer(def, s.rol)) abrirModulo(def, s);
    else pintarMenu(s);
  }
  window.addEventListener("hashchange", () => { if (!$("#app").hidden) pintarRuta(); });

  function pintarMenu(s) {
    detenerModulo();
    $("#btnVolver").hidden = true;
    $("#tituloApp").textContent = "English Connect";
    $("#subtituloApp").textContent = s.nombre ? s.nombre + " " + (s.apellido || "") : s.usuario;
    $("#contenido").className = "";
    const visibles = EC.modulos.filter((m) => puedeVer(m, s.rol));
    const grupos = [];
    visibles.forEach((m) => {
      let g = grupos.find((x) => x.nombre === m.grupo);
      if (!g) grupos.push((g = { nombre: m.grupo, mods: [] }));
      g.mods.push(m);
    });
    $("#contenido").innerHTML =
      '<div class="saludo"><h2>Hola, ' + EC.esc(s.nombre || s.usuario) + ' 👋</h2>' +
      '<span class="rol-chip">' + EC.esc(EC.ROLES[s.rol] || "Alumno") + "</span></div>" +
      grupos.map((g) =>
        '<div class="grupo-titulo">' + EC.esc(g.nombre) + '</div><div class="tarjetas">' +
        g.mods.map((m) =>
          '<button class="tarjeta" data-id="' + m.id + '"><span class="ic">' + m.icono + "</span><b>" +
          EC.esc(m.titulo) + '</b><span class="d">' + EC.esc(m.desc) + "</span></button>").join("") +
        "</div>").join("");
    EC.$$(".tarjeta").forEach((b) => b.addEventListener("click", () => { location.hash = "#/" + b.dataset.id; }));
  }

  // ---------------- Carga perezosa de módulos ----------------
  const cargados = {};
  function cargarArchivo(tipo, url) {
    if (cargados[url]) return cargados[url];
    cargados[url] = new Promise((ok, fallo) => {
      const v = url + "?v=" + EC.VERSION;
      const el = document.createElement(tipo === "css" ? "link" : "script");
      if (tipo === "css") { el.rel = "stylesheet"; el.href = v; } else { el.src = v; }
      el.onload = ok;
      el.onerror = () => { delete cargados[url]; fallo(new Error("No se pudo cargar " + url)); };
      document.head.appendChild(el);
    });
    return cargados[url];
  }

  let ticket = 0;
  async function abrirModulo(def, s) {
    detenerModulo();
    const mi = ++ticket;
    $("#btnVolver").hidden = false;
    $("#tituloApp").textContent = def.titulo;
    $("#subtituloApp").textContent = "";
    $("#contenido").className = def.ancho ? "ancho" : "";
    $("#contenido").innerHTML = '<p class="vacio">Cargando…</p>';
    try {
      if (def.css) await cargarArchivo("css", def.css);
      if (!EC._modulos || !EC._modulos[def.id]) await cargarArchivo("js", def.js);
    } catch (e) {
      $("#contenido").innerHTML = '<p class="vacio">❌ ' + EC.esc(e.message) +
        '</p><button class="btn principal" id="reint">Reintentar</button>';
      $("#reint").onclick = () => abrirModulo(def, s);
      return;
    }
    if (mi !== ticket) return; // el usuario navegó a otra cosa mientras cargaba
    const impl = EC._modulos[def.id];
    $("#contenido").innerHTML = "";
    moduloActivo = { def, impl };
    impl.montar($("#contenido"), {
      sesion: s,
      api: EC.api,
      titulo: (t, sub) => { $("#tituloApp").textContent = t; $("#subtituloApp").textContent = sub || ""; },
      ancho: (v) => { $("#contenido").className = v ? "ancho" : ""; },
    });
  }
  function detenerModulo() {
    ticket++;
    if (moduloActivo && moduloActivo.impl.desmontar) {
      try { moduloActivo.impl.desmontar(); } catch (e) { EC.log("desmontar: " + e.message, "error"); }
    }
    moduloActivo = null;
  }

  // ---------------- Inicio ----------------
  const s = EC.sesion.obtener();
  if (!s || !s.token) mostrarLogin();
  else if (s.debe_cambiar_pin) mostrarPinObligatorio();
  else entrar();
})();

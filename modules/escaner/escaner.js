/* Escáner de asistencia — 3 modos: QR, Lista y Nuevo.
   Todo se valida en el celular con la lista (roster) cargada al inicio;
   los registros se guardan en localStorage y se envían juntos al terminar. */
(function () {
  const EC = window.EC;
  const CLAVE = "ec_escaner_pendiente_v2";

  let cont, ctx;
  let roster = null;        // { alumnos, periodos, hoy }
  let registros = [];       // registros de la sesión
  let ids = new Set();      // ids ya registrados (duplicados)
  let fecha = "";           // fecha de la clase
  let modo = "qr";
  let stream = null;
  let puedeEscanear = true;
  let siguiente = 1;
  let audioCtx = null;
  let periodoNuevo = "";
  const $ = (s) => cont.querySelector(s);

  // ---------------- almacenamiento local ----------------
  function guardarLocal() {
    try { localStorage.setItem(CLAVE, JSON.stringify({ fecha, registros })); } catch (e) { /* nada */ }
  }
  function leerLocal() {
    try {
      const d = JSON.parse(localStorage.getItem(CLAVE));
      return d && d.registros && d.registros.length ? d : null;
    } catch (e) { return null; }
  }
  function borrarLocal() { try { localStorage.removeItem(CLAVE); } catch (e) { /* nada */ } }

  // ---------------- sonido ----------------
  function beep(f, ms, tipo, vol) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = tipo || "sine"; o.frequency.value = f; g.gain.value = vol || 0.3;
      o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + ms / 1000);
    } catch (e) { /* sin audio */ }
  }
  const sonidoOk = () => { beep(880, 120); setTimeout(() => beep(1200, 150), 130); };
  const sonidoError = () => beep(220, 300, "square", 0.25);

  // ---------------- montaje ----------------
  const PLANTILLA =
    '<section id="reposo" class="esc-reposo"><div id="pend" style="width:100%"></div>' +
    "<p>Toca el botón para abrir la cámara y comenzar a registrar la asistencia de hoy.</p>" +
    '<button class="btn principal grande" id="comenzar">Comenzar registro</button></section>' +
    '<section id="activa" hidden>' +
    '<div class="esc-estado"><span><span class="punto"></span>En curso · <span id="fechaTxt"></span></span><span id="contador">0 registrados</span></div>' +
    '<div class="esc-modos"><button data-modo="qr" class="activo">📷 QR</button><button data-modo="lista">📋 Lista</button><button data-modo="nuevo">➕ Nuevo</button></div>' +
    '<div id="m-qr"><div class="esc-video"><video id="video" playsinline autoplay muted></video><div class="esc-mira"></div><div class="esc-msg" id="msgCam">Apunta al QR del alumno y presiona Escanear</div></div>' +
    '<canvas id="canvas" hidden></canvas><button class="btn principal grande" id="escanear">📷 Escanear QR</button></div>' +
    '<div id="m-lista" hidden><input class="input" type="search" id="buscar" placeholder="Buscar por nombre o apellido…" autocomplete="off"><div class="esc-roster" id="roster"></div></div>' +
    '<div id="m-nuevo" hidden><div class="caja">' +
    '<div class="campo"><label>Nombre</label><input id="nNombre" autocomplete="off"></div>' +
    '<div class="campo"><label>Apellido</label><input id="nApellido" autocomplete="off"></div>' +
    '<div class="campo"><label>Celular</label><input id="nCelular" type="tel" autocomplete="off"></div>' +
    '<div class="campo"><label>Curso / periodo</label><div class="grupo-botones" id="nPeriodos"></div></div>' +
    '<button class="btn principal grande" id="nAgregar">Agregar alumno nuevo</button></div></div>' +
    '<div class="esc-log"><div class="esc-log-cab"><span id="logTitulo">Registrados hoy (0)</span><button class="btn chico suave" id="verTodo">Ver todo ⤢</button></div><div id="logCompacto"></div></div>' +
    '<div class="esc-fin"><button class="btn peligro-suave grande" id="terminar">Terminar registro</button></div></section>';

  EC.registrar("escaner", {
    montar(contenedor, c) {
      cont = contenedor; ctx = c;
      roster = null; registros = []; ids = new Set(); modo = "qr"; periodoNuevo = ""; puedeEscanear = true;
      cont.innerHTML = PLANTILLA;
      ctx.titulo("Tomar asistencia");
      document.body.addEventListener("click", () => {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      }, { once: true });

      $("#comenzar").addEventListener("click", comenzar);
      $("#escanear").addEventListener("click", capturar);
      $("#terminar").addEventListener("click", terminar);
      $("#verTodo").addEventListener("click", verTodo);
      $("#buscar").addEventListener("input", pintarRoster);
      $("#nAgregar").addEventListener("click", agregarNuevo);
      cont.querySelectorAll(".esc-modos button").forEach((b) =>
        b.addEventListener("click", () => cambiarModo(b.dataset.modo)));
      pintarPendiente();
    },
    desmontar() {
      detenerCamara();
      const f = document.getElementById("escFull"); if (f) f.remove();
      const o = document.getElementById("escOverlay"); if (o) o.remove();
    },
  });

  // ---------------- sesión pendiente ----------------
  function pintarPendiente() {
    const p = leerLocal(), caja = $("#pend");
    if (!p) { caja.innerHTML = ""; return; }
    caja.innerHTML =
      '<div class="esc-pend"><b>Tienes ' + p.registros.length + " registro(s) sin guardar</b> (" + EC.fechaCorta(p.fecha) +
      ").<div class=\"acciones\"><button class=\"btn principal chico\" id=\"pCont\">Continuar</button>" +
      '<button class="btn suave chico" id="pGuardar">Guardar ahora</button><button class="btn peligro-suave chico" id="pBorrar">Descartar</button></div></div>';
    $("#pCont").addEventListener("click", comenzar);
    $("#pGuardar").addEventListener("click", async (e) => {
      registros = p.registros; fecha = p.fecha;
      await EC.ocupado(e.target, () => enviar(true));
    });
    $("#pBorrar").addEventListener("click", async () => {
      if (await EC.confirmar("¿Descartar estos " + p.registros.length + " registros? No se podrán recuperar.", { si: "Descartar", peligro: true })) {
        borrarLocal(); pintarPendiente();
      }
    });
  }

  // ---------------- inicio ----------------
  async function comenzar() {
    $("#reposo").hidden = true; $("#activa").hidden = false;
    const p = leerLocal();
    if (p) {
      registros = p.registros; fecha = p.fecha;
      ids = new Set(registros.filter((r) => r.id).map((r) => r.id));
      siguiente = Math.max(0, ...registros.map((r) => parseInt(String(r.claveLocal || "L0").slice(1), 10) || 0)) + 1;
    } else {
      registros = []; ids = new Set(); fecha = EC.hoyLocal(); siguiente = 1;
    }
    $("#fechaTxt").textContent = EC.fechaCorta(fecha);
    pintarLog();
    cambiarModo("qr");
    await cargarRoster();
  }

  async function cargarRoster() {
    setMsg("Cargando lista de alumnos…");
    try {
      roster = await ctx.api("roster", {}, { reintentos: 2 });
      EC.log("Roster: " + roster.alumnos.length + " alumnos", "ok");
      setMsg("Apunta al QR del alumno y presiona Escanear");
      const ps = roster.periodos;
      periodoNuevo = ps.length === 1 ? ps[0].id : "";
      pintarPeriodos(); pintarRoster();
    } catch (e) {
      setMsg("❌ " + e.message);
      EC.toast(e.message, "error");
      $("#msgCam").innerHTML = '❌ ' + EC.esc(e.message) + ' <button class="btn chico" id="reintRoster">Reintentar</button>';
      $("#reintRoster").addEventListener("click", cargarRoster);
    }
  }
  const setMsg = (t) => { const m = $("#msgCam"); if (m) m.textContent = t; };

  // ---------------- modos ----------------
  function cambiarModo(m) {
    modo = m;
    cont.querySelectorAll(".esc-modos button").forEach((b) => b.classList.toggle("activo", b.dataset.modo === m));
    $("#m-qr").hidden = m !== "qr"; $("#m-lista").hidden = m !== "lista"; $("#m-nuevo").hidden = m !== "nuevo";
    if (m === "qr") iniciarCamara(); else detenerCamara();
    if (m === "lista") { pintarRoster(); setTimeout(() => $("#buscar").focus(), 50); }
  }

  function iniciarCamara() {
    if (stream) return;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (modo !== "qr") { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s; const v = $("#video"); v.srcObject = s; v.play();
        EC.log("Cámara activa", "ok");
      })
      .catch((e) => { setMsg("❌ Cámara: " + e.message); EC.log("Cámara: " + e.message, "error"); });
  }
  function detenerCamara() {
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  }

  // ---------------- QR ----------------
  async function capturar() {
    if (!puedeEscanear) return;
    if (!roster) { flash(false, "⚠️ Lista de alumnos aún no cargada"); return; }
    const v = $("#video"), c = $("#canvas");
    if (!v.videoWidth || v.readyState !== v.HAVE_ENOUGH_DATA) { setMsg("La cámara aún no está lista…"); return; }
    try { await EC.cargarScript("lib/jsQR.js"); }
    catch (e) { setMsg("❌ No cargó el lector de QR"); return; }
    c.width = v.videoWidth; c.height = v.videoHeight;
    const g = c.getContext("2d");
    g.drawImage(v, 0, 0, c.width, c.height);
    const img = g.getImageData(0, 0, c.width, c.height);
    const code = jsQR(img.data, img.width, img.height);
    if (!code) {
      setMsg("No se detectó ningún QR, intenta de nuevo");
      setTimeout(() => setMsg("Apunta al QR del alumno y presiona Escanear"), 1500);
      return;
    }
    EC.log("QR: " + code.data);
    procesarQR(code.data);
  }

  function identificar(texto) {
    texto = String(texto).trim();
    if (/^EST-\d+$/i.test(texto)) return roster.alumnos.find((a) => a.id.toUpperCase() === texto.toUpperCase()) || null;
    if (texto.indexOf(";") >= 0) {                       // formato antiguo Nombre;Apellido;Curso
      const [n, a] = texto.split(";");
      return roster.alumnos.find((x) => EC.norm(x.nombre) === EC.norm(n) && EC.norm(x.apellido) === EC.norm(a)) || null;
    }
    return null;
  }

  function procesarQR(texto) {
    puedeEscanear = false;
    const a = identificar(texto);
    if (!a) { flash(false, "❌ QR no reconocido"); return; }
    if (ids.has(a.id)) { flash(false, "⚠️ " + a.nombre + " ya fue registrado"); return; }
    agregar({ tipo: "existente", id: a.id, nombre: a.nombre, apellido: a.apellido, curso: a.curso, metodo: "qr" });
    flash(true, "✅ " + a.nombre + " " + a.apellido);
  }

  function flash(ok, texto) {
    puedeEscanear = false;
    let o = document.getElementById("escOverlay");
    if (!o) { o = document.createElement("div"); o.id = "escOverlay"; document.body.appendChild(o); }
    o.className = "esc-overlay " + (ok ? "exito" : "error");
    o.innerHTML = '<div class="ico">' + (ok ? "✅" : "⛔") + '</div><div class="txt">' + EC.esc(texto) + "</div>";
    o.hidden = false;
    ok ? sonidoOk() : sonidoError();
    setTimeout(() => { o.remove(); puedeEscanear = true; }, 1100);
  }

  // ---------------- Lista ----------------
  function pintarRoster() {
    const caja = $("#roster");
    if (!roster) { caja.innerHTML = '<p class="vacio">Cargando…</p>'; return; }
    const q = EC.norm($("#buscar").value);
    const lista = roster.alumnos
      .filter((a) => !q || EC.norm(a.nombre + " " + a.apellido).indexOf(q) >= 0)
      .sort((a, b) => EC.norm(a.apellido + a.nombre).localeCompare(EC.norm(b.apellido + b.nombre)));
    caja.innerHTML = lista.length ? lista.map((a) =>
      '<button data-id="' + EC.esc(a.id) + '"' + (ids.has(a.id) ? " disabled" : "") + "><span><b>" +
      EC.esc(a.apellido) + "</b>, " + EC.esc(a.nombre) + "</span><span>" +
      (a.curso ? '<span class="chip">' + EC.esc(a.curso) + "</span>" : "") + (ids.has(a.id) ? "✅" : "") + "</span></button>"
    ).join("") : '<p class="vacio">Sin resultados. Usa la pestaña ➕ Nuevo para registrar a alguien nuevo.</p>';
    caja.querySelectorAll("button").forEach((b) => b.addEventListener("click", async () => {
      const a = roster.alumnos.find((x) => x.id === b.dataset.id);
      if (!a || ids.has(a.id)) return;
      if (await EC.confirmar("¿Registrar a " + a.nombre + " " + a.apellido + "?", { si: "Registrar" })) {
        agregar({ tipo: "existente", id: a.id, nombre: a.nombre, apellido: a.apellido, curso: a.curso, metodo: "lista" });
        sonidoOk(); EC.toast("✅ " + a.nombre + " " + a.apellido, "ok", 1500); pintarRoster();
      }
    }));
  }

  // ---------------- Nuevo ----------------
  function pintarPeriodos() {
    const caja = $("#nPeriodos");
    caja.innerHTML = roster.periodos.length ? roster.periodos.map((p) =>
      '<button type="button" class="opcion' + (p.id === periodoNuevo ? " sel" : "") + '" data-id="' + EC.esc(p.id) + '">' + EC.esc(p.curso) + "</button>").join("")
      : '<span class="ayuda">No hay periodos activos (créalos en Periodos).</span>';
    caja.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { periodoNuevo = b.dataset.id; pintarPeriodos(); }));
  }

  function agregarNuevo() {
    if (!roster) { EC.toast("La lista aún no cargó.", "error"); return; }
    const nombre = $("#nNombre").value.trim(), apellido = $("#nApellido").value.trim(), celular = $("#nCelular").value.trim();
    if (!nombre || !apellido) { EC.toast("Nombre y apellido son obligatorios.", "error"); return; }
    if (roster.periodos.length && !periodoNuevo) { EC.toast("Elige el curso.", "error"); return; }
    const dup = roster.alumnos.find((a) => EC.norm(a.nombre) === EC.norm(nombre) && EC.norm(a.apellido) === EC.norm(apellido));
    if (dup) { EC.toast(dup.nombre + " " + dup.apellido + " ya existe: búscalo en 📋 Lista.", "error", 4500); return; }
    const per = roster.periodos.find((p) => p.id === periodoNuevo);
    agregar({ tipo: "nuevo", nombre, apellido, celular, id_periodo: periodoNuevo, curso: per ? per.curso : "", metodo: "nuevo" });
    ["#nNombre", "#nApellido", "#nCelular"].forEach((s) => ($(s).value = ""));
    sonidoOk(); EC.toast("✅ " + nombre + " " + apellido + " agregado", "ok", 1800);
  }

  // ---------------- sesión local ----------------
  function agregar(r) {
    r.claveLocal = "L" + siguiente++;
    r.hora = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    registros.push(r);
    if (r.id) ids.add(r.id);
    guardarLocal(); pintarLog();
  }

  async function quitar(clave) {
    const r = registros.find((x) => x.claveLocal === clave);
    if (!r || !(await EC.confirmar("¿Quitar a " + r.nombre + " " + r.apellido + " de esta sesión?", { si: "Quitar", peligro: true }))) return;
    registros = registros.filter((x) => x.claveLocal !== clave);
    if (r.id && !registros.some((x) => x.id === r.id)) ids.delete(r.id);
    guardarLocal(); pintarLog(); if (modo === "lista") pintarRoster();
  }

  function editar(clave) {
    const r = registros.find((x) => x.claveLocal === clave);
    if (!r || r.tipo !== "nuevo") return;
    const cuerpo = document.createElement("div");
    cuerpo.innerHTML = '<div class="campo"><label>Nombre</label><input id="eN"></div><div class="campo"><label>Apellido</label><input id="eA"></div><div class="campo"><label>Celular</label><input id="eC" type="tel"></div>';
    cuerpo.querySelector("#eN").value = r.nombre; cuerpo.querySelector("#eA").value = r.apellido; cuerpo.querySelector("#eC").value = r.celular || "";
    EC.modal({ titulo: "Editar registro", cuerpo, botones: [
      { texto: "Cancelar", clase: "suave" },
      { texto: "Guardar", clase: "principal", accion: () => {
        const n = cuerpo.querySelector("#eN").value.trim(), a = cuerpo.querySelector("#eA").value.trim();
        if (!n || !a) { EC.toast("Nombre y apellido son obligatorios.", "error"); return false; }
        r.nombre = n; r.apellido = a; r.celular = cuerpo.querySelector("#eC").value.trim();
        guardarLocal(); pintarLog();
      } }] });
  }

  const ETIQUETA = { qr: "QR", lista: "Lista", nuevo: "Nuevo" };
  function filaLog(r) {
    return '<div class="esc-item"><span>' + EC.esc(r.nombre) + " " + EC.esc(r.apellido) + '</span><span class="der"><span class="chip">' +
      (ETIQUETA[r.metodo] || "") + '</span><span class="hora">' + EC.esc(r.hora) + "</span>" +
      (r.tipo === "nuevo" ? '<button class="ic" data-ed="' + r.claveLocal + '" title="Editar">✏️</button>' : "") +
      '<button class="ic" data-del="' + r.claveLocal + '" title="Quitar">🗑️</button></span></div>';
  }
  function enlazarLog(raiz) {
    raiz.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => quitar(b.dataset.del)));
    raiz.querySelectorAll("[data-ed]").forEach((b) => b.addEventListener("click", () => editar(b.dataset.ed)));
  }
  function pintarLog() {
    $("#logTitulo").textContent = "Registrados hoy (" + registros.length + ")";
    $("#contador").textContent = registros.length + " registrados";
    const ult = registros.slice().reverse();
    $("#logCompacto").innerHTML = ult.length ? ult.slice(0, 4).map(filaLog).join("") : '<div class="vacio">Aún no hay registros en esta sesión.</div>';
    enlazarLog($("#logCompacto"));
    const full = document.getElementById("escFull");
    if (full) { full.querySelector(".lista").innerHTML = ult.map(filaLog).join(""); enlazarLog(full); full.querySelector("h2").textContent = "Registrados hoy (" + registros.length + ")"; }
  }
  function verTodo() {
    const f = document.createElement("div");
    f.id = "escFull"; f.className = "esc-full";
    f.innerHTML = '<div class="cab"><h2></h2><button aria-label="Cerrar">✕</button></div><div class="lista"></div>';
    f.querySelector("button").addEventListener("click", () => f.remove());
    document.body.appendChild(f);
    pintarLog();
  }

  // ---------------- terminar y enviar ----------------
  async function terminar() {
    if (!registros.length) {
      if (await EC.confirmar("No hay registros en esta sesión. ¿Terminar de todas formas?", { si: "Terminar" })) volverReposo();
      return;
    }
    if (!(await EC.confirmar("¿Guardar los " + registros.length + " registros y terminar?", { si: "Guardar y terminar" }))) return;
    await EC.ocupado($("#terminar"), () => enviar(false));
  }

  async function enviar(desdePendiente) {
    try {
      const d = await ctx.api("guardar_lote", { registros, fecha }, { reintentos: 2 });
      borrarLocal(); detenerCamara();
      const f = document.getElementById("escFull"); if (f) f.remove();
      EC.modal({ titulo: "Sesión guardada", cuerpo: '<p class="texto-modal">' + EC.esc(d.mensaje) + "</p>" +
        (d.desconocidos ? '<p class="ayuda">' + d.desconocidos + " registro(s) no se pudieron identificar.</p>" : ""),
        botones: [{ texto: "Listo", clase: "principal" }], alCerrar: volverReposo });
    } catch (e) {
      EC.toast(e.message + " Tus registros siguen guardados en este celular.", "error", 5000);
      EC.log("Guardar lote falló: " + e.message, "error");
    }
  }

  function volverReposo() {
    registros = []; ids = new Set(); detenerCamara();
    if (!cont || !cont.isConnected) return;
    $("#activa").hidden = true; $("#reposo").hidden = false; pintarPendiente();
  }
})();

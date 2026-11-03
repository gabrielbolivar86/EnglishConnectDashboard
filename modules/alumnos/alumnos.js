/* Alumnos (profesor): datos, QR, inscripción en periodos, unir duplicados, eliminar. */
(function () {
  const EC = window.EC;
  let cont, ctx, A = [], P = [], I = [], sel = new Set(), filtro = "todos", q = "", curso = "", orden = "nombre";
  const $ = (s) => cont.querySelector(s);

  EC.registrar("alumnos", {
    async montar(c, x) { cont = c; ctx = x; sel = new Set(); filtro = "todos"; q = ""; curso = ""; orden = "nombre"; ctx.ancho(true); await cargar(); },
  });

  async function cargar() {
    cont.innerHTML = '<p class="vacio">Cargando…</p>';
    try {
      const [a, p] = await Promise.all([ctx.api("alumnos_listar"), ctx.api("periodos_datos")]);
      A = a.alumnos; P = p.periodos; I = p.inscripciones;
      armar();
    } catch (e) { cont.innerHTML = '<div class="caja vacio">❌ ' + EC.esc(e.message) + "</div>"; }
  }

  const periodosDe = (id) => I.filter((i) => i.id_alumno === id && i.activa).map((i) => P.find((p) => p.id === i.id_periodo)).filter(Boolean);

  const sinCelular = (a) => !String(a.celular || "").replace(/\D/g, "");
  const cursosDe = (a) => (a.cursos && a.cursos.length ? a.cursos : periodosDe(a.id).map((p) => p.curso));

  function armar() {
    const cursos = Array.from(new Set(P.map((p) => p.curso).filter(Boolean))).sort();
    cont.innerHTML =
      '<div class="controles"><input class="input" id="q" type="search" placeholder="Buscar alumno…" autocomplete="off">' +
      '<button class="btn principal" id="nuevo">+ Nuevo</button></div>' +
      '<div class="controles">' +
      '<select id="c" aria-label="Curso"><option value="">Todos los cursos</option>' +
      cursos.map((c) => '<option value="' + EC.esc(c) + '">' + EC.esc(c) + "</option>").join("") +
      '<option value="__ninguno">Sin curso</option></select>' +
      '<select id="f" aria-label="Filtro"><option value="todos">Todos</option>' +
      '<optgroup label="Datos"><option value="sincel">📱 Sin celular (datos incompletos)</option><option value="sinqr">Sin QR generado</option><option value="sinper">Sin periodo</option></optgroup>' +
      '<optgroup label="Plataforma"><option value="conacceso">🔓 Ya creó su PIN (tiene acceso)</option><option value="sinacceso">🔒 Aún no creó su PIN</option></optgroup>' +
      '<optgroup label="Asistencia"><option value="f2">Faltó 2 o más clases seguidas</option><option value="f3">Faltó 3 o más clases seguidas</option><option value="f5">Faltó 5 o más clases seguidas</option><option value="nunca">Nunca vino</option></optgroup></select>' +
      '<select id="o" aria-label="Orden"><option value="nombre">Orden: apellido</option><option value="faltas">Orden: más faltas seguidas</option><option value="ultima">Orden: última vez que vino</option></select></div>' +
      '<p class="resumen" id="res"></p>' +
      '<div class="caja" id="lista"></div><div class="barra-flotante" id="barra" hidden></div>';
    $("#q").addEventListener("input", (e) => { q = EC.norm(e.target.value); pintar(); });
    $("#c").addEventListener("change", (e) => { curso = e.target.value; pintar(); });
    $("#f").addEventListener("change", (e) => { filtro = e.target.value; pintar(); });
    $("#o").addEventListener("change", (e) => { orden = e.target.value; pintar(); });
    $("#nuevo").addEventListener("click", nuevo);
    pintar();
  }

  function pasaFiltro(a) {
    if (q && EC.norm(a.nombre + " " + a.apellido + " " + a.id).indexOf(q) < 0) return false;
    const cs = cursosDe(a);
    if (curso === "__ninguno" && cs.length) return false;
    if (curso && curso !== "__ninguno" && cs.indexOf(curso) < 0) return false;
    switch (filtro) {
      case "sincel": return sinCelular(a);
      case "sinqr": return !a.qr;
      case "sinper": return !periodosDe(a.id).length;
      case "conacceso": return a.tiene_pin;
      case "sinacceso": return !a.tiene_pin;
      case "f2": return (a.faltas_seguidas || 0) >= 2;
      case "f3": return (a.faltas_seguidas || 0) >= 3;
      case "f5": return (a.faltas_seguidas || 0) >= 5;
      case "nunca": return !a.ultima_asistencia;
      default: return true;
    }
  }

  function chipFaltas(a) {
    const n = a.faltas_seguidas || 0;
    if (!a.clases) return "";
    if (!a.ultima_asistencia) return '<span class="chip rojo">Nunca vino</span>';
    if (n >= 3) return '<span class="chip rojo">Faltó ' + n + " seguidas</span>";
    if (n >= 1) return '<span class="chip ambar">Faltó ' + n + (n === 1 ? " clase" : " seguidas") + "</span>";
    return "";
  }

  function pintar() {
    const porNombre = (a, b) => EC.norm(a.apellido + a.nombre).localeCompare(EC.norm(b.apellido + b.nombre));
    const vis = A.filter(pasaFiltro).sort((a, b) => {
      if (orden === "faltas") return (b.faltas_seguidas || 0) - (a.faltas_seguidas || 0) || porNombre(a, b);
      if (orden === "ultima") return String(a.ultima_asistencia || "").localeCompare(String(b.ultima_asistencia || "")) || porNombre(a, b);
      return porNombre(a, b);
    });
    const base = A.filter((a) => a.rol === "alumno");
    $("#res").innerHTML = A.length + " en total · " +
      '<b>' + base.filter(sinCelular).length + "</b> sin celular · " +
      '<b>' + base.filter((a) => a.tiene_pin).length + "</b> con acceso · " +
      '<b>' + base.filter((a) => (a.faltas_seguidas || 0) >= 3).length + "</b> faltan 3+ seguidas · mostrando " + vis.length;
    $("#lista").innerHTML = vis.length ? vis.map((a) =>
      '<div class="fila"><input type="checkbox" data-sel="' + EC.esc(a.id) + '"' + (sel.has(a.id) ? " checked" : "") + ' aria-label="Seleccionar">' +
      '<div class="info"><span class="nombre">' + EC.esc(a.nombre) + " " + EC.esc(a.apellido) + "</span><span class=\"meta\">" + EC.esc(a.id) +
      (a.celular ? " · " + EC.esc(a.celular) : "") +
      (a.clases ? " · vino " + (a.presentes || 0) + "/" + a.clases : "") +
      (a.ultima_asistencia ? " · última: " + EC.esc(EC.fechaCorta(a.ultima_asistencia)) : "") + "</span><span class=\"meta\">" +
      (a.rol !== "alumno" ? '<span class="chip ambar">' + EC.esc(a.rol) + "</span>" : "") +
      cursosDe(a).map((c) => '<span class="chip">' + EC.esc(c) + "</span>").join("") +
      (sinCelular(a) ? '<span class="chip rojo">📱 Sin celular</span>' : "") +
      (a.tiene_pin ? '<span class="chip" title="Ya creó su PIN">🔓 Con acceso</span>' : '<span class="chip gris" title="Aún no creó su PIN">🔒 Sin acceso</span>') +
      chipFaltas(a) +
      (a.qr ? '<span class="chip gris">QR ✔</span>' : "") + "</span></div>" +
      '<div style="display:flex;flex-direction:column;gap:6px">' +
      (sinCelular(a) ? '<button class="btn chico principal" data-cel="' + EC.esc(a.id) + '">📱 Completar</button>' : "") +
      '<button class="btn chico suave" data-op="' + EC.esc(a.id) + '">Opciones</button></div></div>').join("")
      : '<p class="vacio">Sin resultados.</p>';
    $("#lista").querySelectorAll("[data-sel]").forEach((c) => c.addEventListener("change", () => {
      c.checked ? sel.add(c.dataset.sel) : sel.delete(c.dataset.sel); barra();
    }));
    $("#lista").querySelectorAll("[data-op]").forEach((b) => b.addEventListener("click", () => opciones(b.dataset.op)));
    $("#lista").querySelectorAll("[data-cel]").forEach((b) => b.addEventListener("click", () => editar(A.find((x) => x.id === b.dataset.cel), true)));
    barra();
  }

  function barra() {
    const b = $("#barra");
    b.hidden = !sel.size;
    if (!sel.size) return;
    b.innerHTML = '<span style="align-self:center;font-weight:800">' + sel.size + " sel.</span>" +
      '<button class="btn principal" id="bUnir"' + (sel.size < 2 ? " disabled" : "") + ">Unir perfiles</button>" +
      '<button class="btn suave" id="bIns">Inscribir…</button><button class="btn suave" id="bLimpiar">✕</button>';
    $("#bUnir").addEventListener("click", unir);
    $("#bIns").addEventListener("click", () => inscribir(Array.from(sel)));
    $("#bLimpiar").addEventListener("click", () => { sel.clear(); pintar(); });
  }

  // ---- opciones por alumno ----
  function opciones(id) {
    const a = A.find((x) => x.id === id);
    const cuerpo = document.createElement("div");
    cuerpo.innerHTML = '<p class="ayuda">' + EC.esc(a.id) + (a.usuario ? " · usuario: " + EC.esc(a.usuario) : "") + "</p>" +
      '<div style="display:grid;gap:8px"><button class="btn suave" data-a="edit">✏️ Editar datos</button><button class="btn suave" data-a="qr">🔳 Ver / generar QR</button>' +
      '<button class="btn suave" data-a="ins">🗓️ Inscribir en periodo</button><button class="btn peligro-suave" data-a="del">🗑️ Eliminar</button></div>';
    const m = EC.modal({ titulo: a.nombre + " " + a.apellido, cuerpo, botones: [{ texto: "Cerrar", clase: "suave" }] });
    cuerpo.querySelectorAll("[data-a]").forEach((b) => b.addEventListener("click", () => {
      m.cerrar();
      ({ edit: () => editar(a), qr: () => verQR(a), ins: () => inscribir([a.id]), del: () => eliminar(a) })[b.dataset.a]();
    }));
  }

  function editar(a, enfocarCelular) {
    const cuerpo = document.createElement("div");
    cuerpo.innerHTML = '<div class="campo"><label>Nombre</label><input id="eN"></div><div class="campo"><label>Apellido</label><input id="eA"></div><div class="campo"><label>Celular</label><input id="eC" type="tel"></div>';
    cuerpo.querySelector("#eN").value = a.nombre; cuerpo.querySelector("#eA").value = a.apellido; cuerpo.querySelector("#eC").value = a.celular || "";
    if (enfocarCelular) setTimeout(() => cuerpo.querySelector("#eC").focus(), 80);
    EC.modal({ titulo: enfocarCelular ? "Completar celular" : "Editar datos", cuerpo, botones: [{ texto: "Cancelar", clase: "suave" }, { texto: "Guardar", clase: "principal", accion: async () => {
      try {
        const r = await ctx.api("alumno_guardar", { id: a.id, nombre: cuerpo.querySelector("#eN").value, apellido: cuerpo.querySelector("#eA").value, celular: cuerpo.querySelector("#eC").value }, { reintentos: 0 });
        EC.toast(r.mensaje, "ok"); await cargar();
      } catch (x) { EC.toast(x.message, "error"); return false; }
    } }] });
  }

  async function verQR(a) {
    const cuerpo = document.createElement("div");
    const m = EC.modal({ titulo: "QR de " + a.nombre, cuerpo, botones: [
      { texto: "⬇️ Descargar imagen", clase: "principal", accion: async () => {
        const ok = await EC.descargarBadge(a);
        if (ok && !a.qr) { try { await ctx.api("marcar_qr", { ids: [a.id] }, { reintentos: 0 }); a.qr = true; pintar(); } catch (e) { /* ya queda en el log */ } }
        return false;
      } },
      { texto: "💬 WhatsApp", clase: "suave", accion: () => { EC.abrirWhatsapp(a.celular, "Hola " + a.nombre + "! Este es tu QR para la clase de English Connect. Muéstralo al llegar."); return false; } },
      { texto: "Cerrar", clase: "suave" }] });
    await EC.dibujarBadge(cuerpo, a);
  }

  function inscribir(ids) {
    const abiertos = P.slice().sort((a, b) => Number(b.activo) - Number(a.activo));
    if (!abiertos.length) { EC.toast("Primero crea un periodo en Periodos.", "error"); return; }
    const cuerpo = document.createElement("div");
    cuerpo.innerHTML = '<p class="texto-modal">' + ids.length + ' alumno(s) seleccionado(s).</p><div class="campo"><label>Periodo</label><select id="iP">' +
      abiertos.map((p) => '<option value="' + EC.esc(p.id) + '">' + EC.esc(p.nombre) + (p.activo ? "" : " (cerrado)") + "</option>").join("") + "</select></div>" +
      '<label class="ayuda"><input type="checkbox" id="iC" checked style="margin-right:6px">Cerrar sus inscripciones anteriores (cambio de curso)</label>';
    EC.modal({ titulo: "Inscribir en periodo", cuerpo, botones: [{ texto: "Cancelar", clase: "suave" }, { texto: "Inscribir", clase: "principal", accion: async () => {
      try {
        const r = await ctx.api("inscribir", { ids, id_periodo: cuerpo.querySelector("#iP").value, cerrar_anteriores: cuerpo.querySelector("#iC").checked }, { reintentos: 0 });
        EC.toast(r.mensaje, "ok", 4500); sel.clear(); await cargar();
      } catch (x) { EC.toast(x.message, "error"); return false; }
    } }] });
  }

  async function eliminar(a) {
    if (!(await EC.confirmar("¿Eliminar a " + a.nombre + " " + a.apellido + " (" + a.id + ")? Se borran también su usuario y sus inscripciones.", { si: "Eliminar", peligro: true }))) return;
    try {
      await ctx.api("alumno_eliminar", { id: a.id }, { reintentos: 0 });
    } catch (x) {
      if (x.codigo === "TIENE_ASISTENCIAS") {
        if (!(await EC.confirmar(x.message, { si: "Borrar todo", peligro: true }))) return;
        try { await ctx.api("alumno_eliminar", { id: a.id, borrar_asistencias: true }, { reintentos: 0 }); }
        catch (y) { EC.toast(y.message, "error"); return; }
      } else { EC.toast(x.message, "error"); return; }
    }
    EC.toast("🗑️ Alumno eliminado.", "ok"); sel.delete(a.id); await cargar();
  }

  function nuevo() {
    const cuerpo = document.createElement("div");
    cuerpo.innerHTML = '<div class="campo"><label>Nombre</label><input id="nN"></div><div class="campo"><label>Apellido</label><input id="nA"></div><div class="campo"><label>Celular</label><input id="nC" type="tel"></div>' +
      '<div class="campo"><label>Periodo</label><select id="nP"><option value="">(sin periodo)</option>' + P.filter((p) => p.activo).map((p) => '<option value="' + EC.esc(p.id) + '">' + EC.esc(p.nombre) + "</option>").join("") + "</select></div>";
    EC.modal({ titulo: "Nuevo alumno", cuerpo, botones: [{ texto: "Cancelar", clase: "suave" }, { texto: "Crear", clase: "principal", accion: async () => {
      try {
        const r = await ctx.api("alumno_crear", { nombre: cuerpo.querySelector("#nN").value, apellido: cuerpo.querySelector("#nA").value, celular: cuerpo.querySelector("#nC").value, id_periodo: cuerpo.querySelector("#nP").value }, { reintentos: 0 });
        EC.toast(r.mensaje, "ok"); await cargar();
      } catch (x) { EC.toast(x.message, "error"); return false; }
    } }] });
  }

  // ---- unir duplicados ----
  function unir() {
    const ids = Array.from(sel).sort();
    const elegidos = ids.map((id) => A.find((a) => a.id === id));
    const cuerpo = document.createElement("div");
    cuerpo.innerHTML = '<p class="texto-modal">Elige el perfil que se queda. Las asistencias, inscripciones y votos de los demás pasan a él, y los demás se borran.</p>' +
      elegidos.map((a, i) => '<label class="fila" style="cursor:pointer"><input type="radio" name="pp" value="' + EC.esc(a.id) + '"' + (i === 0 ? " checked" : "") + ' style="width:20px;height:20px">' +
        '<div class="info"><span class="nombre">' + EC.esc(a.nombre) + " " + EC.esc(a.apellido) + '</span><span class="meta">' + EC.esc(a.id) + (a.celular ? " · " + EC.esc(a.celular) : "") + "</span></div></label>").join("");
    EC.modal({ titulo: "Unir " + ids.length + " perfiles", cuerpo, botones: [{ texto: "Cancelar", clase: "suave" }, { texto: "Unir perfiles", clase: "peligro", accion: async () => {
      const principal = cuerpo.querySelector("input[name=pp]:checked").value;
      try {
        const r = await ctx.api("alumnos_fusionar", { ids, id_principal: principal }, { reintentos: 0 });
        EC.toast(r.mensaje, "ok", 5000); sel.clear(); await cargar();
      } catch (x) { EC.toast(x.message, "error", 5000); return false; }
    } }] });
  }
})();

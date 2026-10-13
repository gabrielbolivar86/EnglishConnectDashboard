/* Alumnos (profesor): datos, QR, inscripción en periodos, unir duplicados, eliminar. */
(function () {
  const EC = window.EC;
  let cont, ctx, A = [], P = [], I = [], sel = new Set(), filtro = "todos", q = "";
  const $ = (s) => cont.querySelector(s);

  EC.registrar("alumnos", {
    async montar(c, x) { cont = c; ctx = x; sel = new Set(); filtro = "todos"; q = ""; ctx.ancho(true); await cargar(); },
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

  function armar() {
    cont.innerHTML =
      '<div class="controles"><input class="input" id="q" type="search" placeholder="Buscar alumno…" autocomplete="off">' +
      '<select id="f"><option value="todos">Todos</option><option value="sinqr">Sin QR generado</option><option value="sinper">Sin periodo</option></select>' +
      '<button class="btn principal" id="nuevo">+ Nuevo</button></div><p class="resumen" id="res"></p>' +
      '<div class="caja" id="lista"></div><div class="barra-flotante" id="barra" hidden></div>';
    $("#q").addEventListener("input", (e) => { q = EC.norm(e.target.value); pintar(); });
    $("#f").addEventListener("change", (e) => { filtro = e.target.value; pintar(); });
    $("#nuevo").addEventListener("click", nuevo);
    pintar();
  }

  function pintar() {
    const vis = A.filter((a) => {
      if (q && EC.norm(a.nombre + " " + a.apellido + " " + a.id).indexOf(q) < 0) return false;
      if (filtro === "sinqr") return !a.qr;
      if (filtro === "sinper") return !periodosDe(a.id).length;
      return true;
    }).sort((a, b) => EC.norm(a.apellido + a.nombre).localeCompare(EC.norm(b.apellido + b.nombre)));
    $("#res").textContent = A.length + " en total · con QR: " + A.filter((a) => a.qr).length + " · mostrando " + vis.length;
    $("#lista").innerHTML = vis.length ? vis.map((a) =>
      '<div class="fila"><input type="checkbox" data-sel="' + EC.esc(a.id) + '"' + (sel.has(a.id) ? " checked" : "") + ' aria-label="Seleccionar">' +
      '<div class="info"><span class="nombre">' + EC.esc(a.nombre) + " " + EC.esc(a.apellido) + "</span><span class=\"meta\">" + EC.esc(a.id) +
      (a.celular ? " · " + EC.esc(a.celular) : " · sin celular") + "</span><span class=\"meta\">" +
      (a.rol !== "alumno" ? '<span class="chip ambar">' + EC.esc(a.rol) + "</span>" : "") +
      periodosDe(a.id).map((p) => '<span class="chip">' + EC.esc(p.curso) + "</span>").join("") +
      (a.qr ? '<span class="chip gris">QR ✔</span>' : "") + "</span></div>" +
      '<button class="btn chico suave" data-op="' + EC.esc(a.id) + '">Opciones</button></div>').join("")
      : '<p class="vacio">Sin resultados.</p>';
    $("#lista").querySelectorAll("[data-sel]").forEach((c) => c.addEventListener("change", () => {
      c.checked ? sel.add(c.dataset.sel) : sel.delete(c.dataset.sel); barra();
    }));
    $("#lista").querySelectorAll("[data-op]").forEach((b) => b.addEventListener("click", () => opciones(b.dataset.op)));
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

  function editar(a) {
    const cuerpo = document.createElement("div");
    cuerpo.innerHTML = '<div class="campo"><label>Nombre</label><input id="eN"></div><div class="campo"><label>Apellido</label><input id="eA"></div><div class="campo"><label>Celular</label><input id="eC" type="tel"></div>';
    cuerpo.querySelector("#eN").value = a.nombre; cuerpo.querySelector("#eA").value = a.apellido; cuerpo.querySelector("#eC").value = a.celular || "";
    EC.modal({ titulo: "Editar datos", cuerpo, botones: [{ texto: "Cancelar", clase: "suave" }, { texto: "Guardar", clase: "principal", accion: async () => {
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

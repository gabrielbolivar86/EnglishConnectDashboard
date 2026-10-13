/* Reportes (profesor): asistencia por clase y por alumno.
   El servidor entrega los datos crudos; las tablas se arman aquí. */
(function () {
  const EC = window.EC;
  let cont, ctx, D, vista = "alumno", idPeriodo = "", fechaSel = "";

  const $ = (s) => cont.querySelector(s);

  EC.registrar("reportes", {
    async montar(c, x) {
      cont = c; ctx = x; vista = "alumno";
      ctx.ancho(true);
      cont.innerHTML = '<p class="vacio">Cargando…</p>';
      await cargar();
    },
  });

  async function cargar() {
    try {
      D = await ctx.api("asistencia_datos");
      const act = D.periodos.filter((p) => p.activo);
      idPeriodo = (act[0] || D.periodos[0] || { id: "" }).id;
      armar();
    } catch (e) { cont.innerHTML = '<div class="caja vacio">❌ ' + EC.esc(e.message) + "</div>"; }
  }

  function datosPeriodo() {
    const asis = D.asistencias.filter((a) => (idPeriodo === "_sin" ? !a.id_periodo : a.id_periodo === idPeriodo));
    const fechas = Array.from(new Set(asis.map((a) => a.fecha))).sort();
    const inscritos = new Set();
    D.inscripciones.forEach((i) => { if (i.id_periodo === idPeriodo && i.activa) inscritos.add(i.id_alumno); });
    asis.forEach((a) => inscritos.add(a.id));
    const alumnos = D.alumnos.filter((a) => inscritos.has(a.id))
      .sort((a, b) => EC.norm(a.apellido + a.nombre).localeCompare(EC.norm(b.apellido + b.nombre)));
    const mapa = {};
    asis.forEach((a) => { (mapa[a.id] = mapa[a.id] || {})[a.fecha] = a.metodo || "x"; });
    return { asis, fechas, alumnos, mapa };
  }

  function armar() {
    const haySin = D.asistencias.some((a) => !a.id_periodo);
    const opciones = D.periodos.map((p) => '<option value="' + EC.esc(p.id) + '"' + (p.id === idPeriodo ? " selected" : "") + ">" + EC.esc(p.nombre) + (p.activo ? "" : " (cerrado)") + "</option>").join("") +
      (haySin ? '<option value="_sin"' + (idPeriodo === "_sin" ? " selected" : "") + ">Sin periodo</option>" : "");
    cont.innerHTML =
      '<div class="controles"><select id="selPer">' + opciones + "</select>" +
      '<select id="selVista"><option value="alumno"' + (vista === "alumno" ? " selected" : "") + '>Por alumno</option><option value="clase"' + (vista === "clase" ? " selected" : "") + ">Por clase</option></select>" +
      '<button class="btn suave" id="imprimir">🖨️ Imprimir / PDF</button></div><div id="rep"></div>';
    $("#selPer").addEventListener("change", (e) => { idPeriodo = e.target.value; fechaSel = ""; pintar(); });
    $("#selVista").addEventListener("change", (e) => { vista = e.target.value; pintar(); });
    $("#imprimir").addEventListener("click", () => window.print());
    pintar();
  }

  function pintar() {
    const p = datosPeriodo();
    if (!D.periodos.length) { $("#rep").innerHTML = '<div class="caja vacio">Aún no hay periodos. Créalos en Periodos.</div>'; return; }
    vista === "alumno" ? pintarMatriz(p) : pintarClase(p);
  }

  function pintarMatriz(p) {
    if (!p.fechas.length) { $("#rep").innerHTML = '<div class="caja vacio">Todavía no hay clases registradas en este periodo.</div>'; return; }
    const cab = "<tr><th>Alumno</th>" + p.fechas.map((f) => '<th class="c">' + EC.fechaCorta(f) + "</th>").join("") + '<th class="c">Total</th></tr>';
    const filas = p.alumnos.map((a) => {
      const m = p.mapa[a.id] || {};
      const n = p.fechas.filter((f) => m[f]).length;
      return "<tr><td>" + EC.esc(a.apellido) + ", " + EC.esc(a.nombre) + "</td>" +
        p.fechas.map((f) => '<td class="c ' + (m[f] ? "si" : "no") + '" data-id="' + EC.esc(a.id) + '" data-f="' + f + '">' + (m[f] ? "✔" : "–") + "</td>").join("") +
        '<td class="c pct">' + n + "/" + p.fechas.length + "</td></tr>";
    }).join("");
    $("#rep").innerHTML = '<p class="resumen">' + p.alumnos.length + " alumnos · " + p.fechas.length + ' clases · toca una celda para corregirla</p><div class="tabla-wrap"><table class="matriz"><thead>' + cab + "</thead><tbody>" + filas + "</tbody></table></div>";
    $("#rep").querySelectorAll("td[data-id]").forEach((td) => td.addEventListener("click", () => corregir(td.dataset.id, td.dataset.f, td.classList.contains("si"))));
  }

  async function corregir(id, f, estaba) {
    const a = D.alumnos.find((x) => x.id === id);
    const txt = estaba ? "¿Quitar la asistencia de " + a.nombre + " " + a.apellido + " del " + EC.fechaCorta(f) + "?" : "¿Marcar a " + a.nombre + " " + a.apellido + " como presente el " + EC.fechaCorta(f) + "?";
    if (!(await EC.confirmar(txt, { si: estaba ? "Quitar" : "Marcar", peligro: estaba }))) return;
    try {
      await ctx.api("asistencia_marcar", { id, fecha: f, presente: !estaba }, { reintentos: 0 });
      if (estaba) D.asistencias = D.asistencias.filter((x) => !(x.id === id && x.fecha === f));
      else D.asistencias.push({ id, fecha: f, id_periodo: idPeriodo === "_sin" ? "" : idPeriodo, metodo: "profesor" });
      pintar();
    } catch (e) { EC.toast(e.message, "error"); }
  }

  function pintarClase(p) {
    if (!p.fechas.length) { $("#rep").innerHTML = '<div class="caja vacio">Todavía no hay clases registradas en este periodo.</div>'; return; }
    if (!fechaSel || p.fechas.indexOf(fechaSel) < 0) fechaSel = p.fechas[p.fechas.length - 1];
    const presentes = p.alumnos.filter((a) => p.mapa[a.id] && p.mapa[a.id][fechaSel]);
    const ausentes = p.alumnos.filter((a) => !(p.mapa[a.id] && p.mapa[a.id][fechaSel]));
    const li = (a, m) => '<div class="fila"><div class="info"><span class="nombre">' + EC.esc(a.apellido) + ", " + EC.esc(a.nombre) + "</span></div>" + (m ? '<span class="chip">' + EC.esc(m) + "</span>" : "") + "</div>";
    $("#rep").innerHTML =
      '<div class="controles"><select id="selFecha">' + p.fechas.slice().reverse().map((f) => '<option value="' + f + '"' + (f === fechaSel ? " selected" : "") + ">" + EC.fechaCorta(f) + " " + f.slice(0, 4) + "</option>").join("") + "</select></div>" +
      '<div class="caja"><h3>Presentes (' + presentes.length + ")</h3>" + (presentes.map((a) => li(a, p.mapa[a.id][fechaSel])).join("") || '<p class="vacio">Nadie.</p>') + "</div>" +
      '<div class="caja"><h3>Ausentes (' + ausentes.length + ")</h3>" + (ausentes.map((a) => li(a)).join("") || '<p class="vacio">Nadie.</p>') + "</div>";
    $("#selFecha").addEventListener("change", (e) => { fechaSel = e.target.value; pintar(); });
  }
})();

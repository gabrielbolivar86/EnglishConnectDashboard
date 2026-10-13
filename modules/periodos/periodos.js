/* Periodos (profesor): cada curso tiene su propio periodo, con fechas independientes. */
(function () {
  const EC = window.EC;
  let cont, ctx, D;

  EC.registrar("periodos", {
    async montar(c, x) { cont = c; ctx = x; await cargar(); },
  });

  async function cargar() {
    cont.innerHTML = '<p class="vacio">Cargando…</p>';
    try { D = await ctx.api("periodos_datos"); pintar(); }
    catch (e) { cont.innerHTML = '<div class="caja vacio">❌ ' + EC.esc(e.message) + "</div>"; }
  }

  function pintar() {
    const cuenta = {};
    D.inscripciones.forEach((i) => { if (i.activa) cuenta[i.id_periodo] = (cuenta[i.id_periodo] || 0) + 1; });
    const ps = D.periodos.slice().sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
    cont.innerHTML = '<div class="controles"><button class="btn principal" id="nuevo">+ Nuevo periodo</button></div>' +
      '<p class="ayuda" style="margin-bottom:12px">Cada curso lleva su propio periodo; no están ligados entre sí. Para inscribir alumnos usa el módulo Alumnos.</p>' +
      (ps.length ? '<div class="caja">' + ps.map((p) =>
        '<div class="fila"><div class="info"><span class="nombre">' + EC.esc(p.nombre) + (p.activo ? "" : ' <span class="chip gris">Cerrado</span>') + "</span>" +
        '<span class="meta">' + EC.esc(p.curso) + " · " + EC.fechaCorta(p.inicio) + " " + p.inicio.slice(0, 4) + " → " + EC.fechaCorta(p.fin) + " " + p.fin.slice(0, 4) + " · " + (cuenta[p.id] || 0) + " inscritos</span></div>" +
        '<button class="btn chico suave" data-id="' + EC.esc(p.id) + '">Editar</button></div>').join("") + "</div>"
        : '<div class="caja vacio">Aún no hay periodos.</div>');
    cont.querySelector("#nuevo").addEventListener("click", () => formulario());
    cont.querySelectorAll("[data-id]").forEach((b) => b.addEventListener("click", () => formulario(D.periodos.find((p) => p.id === b.dataset.id))));
  }

  function formulario(p) {
    const e = !!p;
    const cuerpo = document.createElement("div");
    cuerpo.innerHTML =
      '<div class="campo"><label>Curso</label><input id="fCurso" placeholder="EC1"></div>' +
      '<div class="campo"><label>Inicio</label><input id="fIni" type="date"></div>' +
      '<div class="campo"><label>Fin</label><input id="fFin" type="date"></div>' +
      '<div class="campo"><label>Nombre (opcional, se arma solo)</label><input id="fNom"></div>' +
      '<div class="campo"><label><input type="checkbox" id="fAct" style="width:auto;min-height:0;margin-right:6px"> Periodo activo (aparece en el escáner)</label></div>';
    cuerpo.querySelector("#fCurso").value = e ? p.curso : "";
    cuerpo.querySelector("#fIni").value = e ? p.inicio : "";
    cuerpo.querySelector("#fFin").value = e ? p.fin : "";
    cuerpo.querySelector("#fNom").value = e ? p.nombre : "";
    cuerpo.querySelector("#fAct").checked = e ? p.activo : true;
    EC.modal({ titulo: e ? "Editar periodo" : "Nuevo periodo", cuerpo, botones: [
      { texto: "Cancelar", clase: "suave" },
      { texto: "Guardar", clase: "principal", accion: async () => {
        const datos = { id: e ? p.id : undefined, curso: cuerpo.querySelector("#fCurso").value.trim(), inicio: cuerpo.querySelector("#fIni").value,
          fin: cuerpo.querySelector("#fFin").value, nombre: cuerpo.querySelector("#fNom").value.trim(), activo: cuerpo.querySelector("#fAct").checked };
        try { const r = await ctx.api("periodo_guardar", datos, { reintentos: 0 }); EC.toast(r.mensaje, "ok"); await cargar(); }
        catch (x) { EC.toast(x.message, "error"); return false; }
      } }] });
  }
})();

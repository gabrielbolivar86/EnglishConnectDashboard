/* Mi asistencia: a qué clases vino el alumno en cada periodo. */
(function () {
  const EC = window.EC;
  EC.registrar("mi-asistencia", {
    async montar(cont, ctx) {
      cont.innerHTML = '<p class="vacio">Cargando…</p>';
      try {
        const d = await ctx.api("mi_asistencia");
        if (!d.periodos.length) {
          cont.innerHTML = '<div class="caja vacio">Todavía no estás inscrito en ningún periodo. Habla con tu profesor.</div>';
          return;
        }
        // más reciente primero: activos arriba
        const ps = d.periodos.slice().sort((a, b) => Number(b.activo) - Number(a.activo));
        cont.innerHTML = ps.map((p) => {
          const total = p.fechas.length, vino = p.presentes.length;
          const pct = total ? Math.round((vino / total) * 100) : 0;
          const set = {}; p.presentes.forEach((f) => (set[f] = true));
          return '<div class="caja"><h3 style="margin-bottom:4px">' + EC.esc(p.nombre) + "</h3>" +
            (p.activo ? "" : '<span class="chip gris">Cerrado</span>') +
            '<p class="resumen">Asististe a <b>' + vino + "</b> de <b>" + total + "</b> clases (" + pct + "%)</p>" +
            '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
            (total ? p.fechas.map((f) =>
              '<span class="chip ' + (set[f] ? "" : "rojo") + '" style="font-size:.8em;padding:5px 10px">' +
              (set[f] ? "✔ " : "– ") + EC.fechaCorta(f) + "</span>").join("") : '<span class="ayuda">Aún no hay clases registradas.</span>') +
            "</div></div>";
        }).join("");
      } catch (e) {
        cont.innerHTML = '<div class="caja vacio">❌ ' + EC.esc(e.message) + "</div>";
      }
    },
  });
})();

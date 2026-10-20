/* Canciones (profesor): abrir/cerrar la votación y moderar la lista. */
(function () {
  const EC = window.EC;
  let cont, ctx, D, filtro = "activa", timer = null, montado = false;
  const $ = (s) => cont.querySelector(s);

  EC.registrar("canciones-moderar", {
    async montar(c, x) {
      cont = c; ctx = x; filtro = "activa"; montado = true;
      cont.innerHTML = '<p class="vacio">Cargando…</p>';
      await cargar(true);
      timer = setInterval(() => { if (!document.hidden && montado) cargar(false); }, 20000);
    },
    desmontar() { montado = false; clearInterval(timer); },
  });

  async function cargar(primera) {
    try { D = await ctx.api("canciones_moderar", {}, { silencioso: !primera }); if (montado) armar(); }
    catch (e) { if (primera) cont.innerHTML = '<div class="caja vacio">❌ ' + EC.esc(e.message) + "</div>"; }
  }

  function cover(url) { return url ? '<img class="cn-cover" src="' + EC.esc(url) + '" alt="">' : '<div class="cn-cover">🎵</div>'; }

  function armar() {
    const cuenta = (e) => D.canciones.filter((c) => c.estado === e).length;
    const vis = D.canciones.filter((c) => filtro === "todas" || c.estado === filtro);
    cont.innerHTML =
      '<div class="caja"><div class="cn-banner ' + (D.abierta ? "abierta" : "cerrada") + '" style="margin:0 0 10px">' +
      (D.abierta ? "✅ La votación está abierta" : "🔒 La votación está cerrada") + "</div>" +
      '<button class="btn ' + (D.abierta ? "peligro-suave" : "principal") + ' grande" id="alterna">' + (D.abierta ? "Cerrar votación" : "Abrir votación") + "</button>" +
      '<p class="cn-nota">Cerrada: los alumnos ven el ranking pero no pueden sugerir ni votar.</p></div>' +
      '<div class="controles"><select id="fil">' +
      [["activa", "Activas (" + cuenta("activa") + ")"], ["reproducida", "Ya sonaron (" + cuenta("reproducida") + ")"], ["rechazada", "Rechazadas (" + cuenta("rechazada") + ")"], ["todas", "Todas"]]
        .map((o) => '<option value="' + o[0] + '"' + (o[0] === filtro ? " selected" : "") + ">" + o[1] + "</option>").join("") +
      '</select><button class="btn suave" id="recargar">↻ Actualizar</button></div>' +
      '<div class="caja">' + (vis.length ? vis.map((c, i) => {
        const bt = (e, t, cl) => '<button class="btn chico ' + cl + '" data-e="' + e + '" data-id="' + EC.esc(c.id) + '">' + t + "</button>";
        return '<div class="cn-item"><span class="cn-pos">' + (i + 1) + "</span>" + cover(c.portada) +
          '<div class="cn-info" style="white-space:normal"><b style="white-space:normal">' + EC.esc(c.titulo) + "</b><span>" + EC.esc(c.artista) + "</span>" +
          "<span>" + c.votos + " voto(s) · sugerida por " + EC.esc(c.sugerida_por) + "</span>" +
          '<div class="cn-acciones">' +
          (c.estado === "activa" ? bt("reproducida", "▶ Ya sonó", "suave") + bt("rechazada", "Rechazar", "peligro-suave") : "") +
          (c.estado === "reproducida" ? bt("activa", "Volver a la lista", "suave") : "") +
          (c.estado === "rechazada" ? bt("activa", "Restaurar", "suave") : "") +
          '<button class="btn chico peligro-suave" data-del="' + EC.esc(c.id) + '">Eliminar</button></div></div></div>';
      }).join("") : '<p class="vacio">No hay canciones en este filtro.</p>') + "</div>";

    $("#alterna").addEventListener("click", async (e) => {
      const abrir = !D.abierta;
      if (!abrir && !(await EC.confirmar("¿Cerrar la votación? Los alumnos ya no podrán sugerir ni votar.", { si: "Cerrar" }))) return;
      await EC.ocupado(e.target, async () => {
        try { const r = await ctx.api("canciones_config", { abierta: abrir }, { reintentos: 0 }); EC.toast(r.mensaje, "ok"); await cargar(true); }
        catch (x) { EC.toast(x.message, "error"); }
      });
    });
    $("#fil").addEventListener("change", (e) => { filtro = e.target.value; armar(); });
    $("#recargar").addEventListener("click", () => cargar(true));
    cont.querySelectorAll("[data-e]").forEach((b) => b.addEventListener("click", async () => {
      try { await ctx.api("cancion_estado", { id: b.dataset.id, estado: b.dataset.e }, { reintentos: 0 }); await cargar(true); }
      catch (x) { EC.toast(x.message, "error"); }
    }));
    cont.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      const c = D.canciones.find((x) => x.id === b.dataset.del);
      if (!(await EC.confirmar("¿Eliminar «" + c.titulo + "» y sus votos? No se puede deshacer.", { si: "Eliminar", peligro: true }))) return;
      try { await ctx.api("cancion_eliminar", { id: c.id }, { reintentos: 0 }); await cargar(true); }
      catch (x) { EC.toast(x.message, "error"); }
    }));
  }
})();

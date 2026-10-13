/* Mi badge: el QR personal del alumno. */
(function () {
  const EC = window.EC;
  EC.registrar("mi-badge", {
    montar(cont, ctx) {
      const s = ctx.sesion;
      const a = { id: s.id, nombre: s.nombre || "", apellido: s.apellido || "" };
      cont.innerHTML = '<div class="caja" style="text-align:center"><div id="mb"></div>' +
        '<p class="ayuda">Muéstralo al llegar a clase para marcar tu asistencia.</p>' +
        '<button class="btn principal grande" id="mbDescargar">⬇️ Guardar como imagen</button></div>';
      EC.dibujarBadge(cont.querySelector("#mb"), a);
      cont.querySelector("#mbDescargar").addEventListener("click", (e) =>
        EC.ocupado(e.target, () => EC.descargarBadge(a)));
    },
  });
})();

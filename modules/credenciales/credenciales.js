/* Credenciales (profesor): usuario, estado del PIN y envío por WhatsApp.
   Nunca se ven los PIN: se genera un código temporal de 48 h. */
(function () {
  const EC = window.EC;
  let cont, ctx, A = [], filtro = "todos", q = "";
  const $ = (s) => cont.querySelector(s);

  EC.registrar("credenciales", {
    async montar(c, x) { cont = c; ctx = x; filtro = "todos"; q = ""; await cargar(); },
  });

  async function cargar() {
    cont.innerHTML = '<p class="vacio">Cargando…</p>';
    try { A = (await ctx.api("alumnos_listar")).alumnos; armar(); }
    catch (e) { cont.innerHTML = '<div class="caja vacio">❌ ' + EC.esc(e.message) + "</div>"; }
  }

  function armar() {
    cont.innerHTML =
      '<div class="caja ayuda">Los PIN no se pueden ver. Con <b>Enviar credenciales</b> se genera un código temporal (vale 48 h) y se cierran las sesiones abiertas de esa persona; al entrar con él crea su PIN. ' +
      'Para dar el rol <b>profesor</b> o <b>registrador</b>, escribe ese valor (minúscula, una palabra) en la columna <b>Rol</b> de la pestaña <i>Credenciales</i> de la hoja.</div>' +
      '<div class="controles"><input class="input" id="q" type="search" placeholder="Buscar…" autocomplete="off"><select id="f">' +
      '<option value="todos">Todos</option><option value="sinpin">Sin PIN</option><option value="codigo">Con código vigente</option><option value="inactivo">Desactivados</option><option value="staff">Profesores / registradores</option></select></div>' +
      '<p class="resumen" id="res"></p><div class="caja" id="lista"></div>';
    $("#q").addEventListener("input", (e) => { q = EC.norm(e.target.value); pintar(); });
    $("#f").addEventListener("change", (e) => { filtro = e.target.value; pintar(); });
    pintar();
  }

  function pintar() {
    const vis = A.filter((a) => {
      if (q && EC.norm(a.nombre + " " + a.apellido + " " + a.usuario).indexOf(q) < 0) return false;
      if (filtro === "sinpin") return !a.tiene_pin;
      if (filtro === "codigo") return a.codigo_vigente;
      if (filtro === "inactivo") return !a.activo;
      if (filtro === "staff") return a.rol !== "alumno";
      return true;
    }).sort((a, b) => EC.norm(a.apellido + a.nombre).localeCompare(EC.norm(b.apellido + b.nombre)));
    $("#res").textContent = A.length + " cuentas · sin PIN: " + A.filter((a) => !a.tiene_pin).length + " · mostrando " + vis.length;
    $("#lista").innerHTML = vis.length ? vis.map((a) =>
      '<div class="fila"><div class="info"><span class="nombre">' + EC.esc(a.nombre) + " " + EC.esc(a.apellido) + '</span><span class="meta">' + EC.esc(a.usuario || "(sin usuario)") +
      '</span><span class="meta">' + (a.rol !== "alumno" ? '<span class="chip ambar">' + EC.esc(a.rol) + "</span>" : "") +
      (a.tiene_pin ? "" : '<span class="chip rojo">Sin PIN</span>') + (a.codigo_vigente ? '<span class="chip">Código vigente</span>' : "") +
      (a.activo ? "" : '<span class="chip gris">Desactivado</span>') + "</span></div>" +
      '<div style="display:flex;flex-direction:column;gap:6px"><button class="btn chico principal" data-env="' + EC.esc(a.id) + '">Enviar credenciales</button>' +
      '<button class="btn chico suave" data-act="' + EC.esc(a.id) + '">' + (a.activo ? "Desactivar" : "Activar") + "</button></div></div>").join("")
      : '<p class="vacio">Sin resultados.</p>';
    $("#lista").querySelectorAll("[data-env]").forEach((b) => b.addEventListener("click", () => enviar(A.find((x) => x.id === b.dataset.env))));
    $("#lista").querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => alternar(A.find((x) => x.id === b.dataset.act))));
  }

  async function enviar(a) {
    if (!(await EC.confirmar("Se generará un código temporal para " + a.nombre + " y se cerrarán sus sesiones abiertas. ¿Continuar?", { si: "Generar código" }))) return;
    let r;
    try { r = await ctx.api("credencial_reset", { id: a.id }, { reintentos: 0 }); }
    catch (x) { EC.toast(x.message, "error"); return; }
    const url = location.href.split("#")[0].replace(/index\.html$/, "");
    const texto = "Hola " + r.nombre + "! Ya puedes entrar a English Connect: " + url + "\nUsuario: " + r.usuario +
      "\nCódigo temporal: " + r.codigo + " (vale 48 horas).\nAl entrar te pedirá crear tu PIN de 4 números.";
    const cuerpo = document.createElement("div");
    cuerpo.innerHTML = '<div class="caja" style="text-align:center;margin:0 0 10px"><div class="ayuda">Usuario</div><b style="font-size:1.2em">' + EC.esc(r.usuario) +
      '</b><div class="ayuda" style="margin-top:8px">Código temporal</div><b style="font-size:1.8em;letter-spacing:.15em">' + EC.esc(r.codigo) + "</b></div>" +
      '<textarea class="input" id="msg" rows="5" readonly style="min-height:110px"></textarea>' +
      (r.celular ? "" : '<p class="error-texto">Este alumno no tiene celular registrado: copia el mensaje y envíalo a mano.</p>');
    cuerpo.querySelector("#msg").value = texto;
    EC.modal({ titulo: "Credenciales de " + r.nombre, cuerpo, enfocar: false, botones: [
      { texto: "💬 WhatsApp", clase: "principal", accion: () => { EC.abrirWhatsapp(r.celular, texto); return false; } },
      { texto: "Copiar", clase: "suave", accion: async () => {
        try { await navigator.clipboard.writeText(texto); EC.toast("Copiado ✅", "ok"); }
        catch (e) { cuerpo.querySelector("#msg").select(); EC.toast("Selecciona y copia el texto.", "info"); }
        return false;
      } },
      { texto: "Cerrar", clase: "suave" }], alCerrar: cargar });
  }

  async function alternar(a) {
    const nuevo = !a.activo;
    if (!(await EC.confirmar((nuevo ? "¿Activar" : "¿Desactivar") + " la cuenta de " + a.nombre + "?", { si: nuevo ? "Activar" : "Desactivar", peligro: !nuevo }))) return;
    try { const r = await ctx.api("credencial_activo", { id: a.id, activo: nuevo }, { reintentos: 0 }); EC.toast(r.mensaje, "ok"); await cargar(); }
    catch (x) { EC.toast(x.message, "error"); }
  }
})();

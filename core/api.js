/* Cliente del backend (Apps Script) + manejo de sesión.
   - Content-Type text/plain para evitar el preflight CORS de Apps Script.
   - El token firmado vive en localStorage; el rol real lo decide el servidor. */
(function () {
  const EC = (window.EC = window.EC || {});
  const CLAVE = "ec_sesion_v2";

  EC.sesion = {
    _mem: null,
    obtener() {
      if (this._mem) return this._mem;
      try { return JSON.parse(localStorage.getItem(CLAVE)); } catch (e) { return null; }
    },
    guardar(s) {
      this._mem = s;
      try { localStorage.setItem(CLAVE, JSON.stringify(s)); } catch (e) { /* modo privado */ }
    },
    cerrar() {
      this._mem = null;
      try { localStorage.removeItem(CLAVE); } catch (e) { /* nada */ }
    },
  };

  EC.api = async function (accion, datos, op) {
    op = Object.assign({ reintentos: 1, timeout: 30000 }, op);
    const cuerpo = Object.assign({ accion }, datos || {});
    const s = EC.sesion.obtener();
    if (s && s.token && !op.sinToken) cuerpo.token = s.token;

    for (let i = 0; i <= op.reintentos; i++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), op.timeout);
      try {
        EC.log("→ " + accion + (i ? " (reintento " + i + ")" : ""));
        const r = await fetch(EC.API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(cuerpo),
          signal: ctrl.signal,
        });
        const texto = await r.text();
        clearTimeout(t);
        let data;
        try { data = JSON.parse(texto); }
        catch (e) { throw new Error("Respuesta no válida: " + texto.slice(0, 160)); }

        if (!data.ok) {
          const err = new Error(data.mensaje || "Error del servidor");
          err.codigo = data.codigo || "ERROR";
          err.datos = data;
          EC.log("❌ " + accion + " → " + err.codigo + ": " + err.message, "error");
          if (err.codigo === "SESION" && !op.sinToken) {
            EC.sesion.cerrar();
            if (EC.alCerrarSesion) EC.alCerrarSesion(err.message);
          }
          throw err;
        }
        EC.log("✅ " + accion, "ok");
        return data;
      } catch (e) {
        clearTimeout(t);
        if (e.codigo) throw e; // error de la aplicación: no se reintenta
        EC.log("❌ red/" + accion + ": " + e.message, "error");
        if (i < op.reintentos) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
      }
    }
    const err = new Error("Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.");
    err.codigo = "RED";
    throw err;
  };
})();

/* Utilidades de interfaz compartidas por todos los módulos */
(function () {
  const EC = (window.EC = window.EC || {});

  EC.$ = (sel, raiz) => (raiz || document).querySelector(sel);
  EC.$$ = (sel, raiz) => Array.from((raiz || document).querySelectorAll(sel));

  EC.esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /** minúsculas, sin tildes, espacios simples: para comparar y buscar */
  EC.norm = (t) =>
    String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/\s+/g, " ").trim();

  EC.hoyLocal = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  };

  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  EC.fechaCorta = (f) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f || "");
    return m ? parseInt(m[3], 10) + " " + MESES[parseInt(m[2], 10) - 1] : f || "";
  };

  /** Número boliviano -> formato wa.me (591XXXXXXXX) */
  EC.telefonoWa = (cel) => {
    let n = String(cel || "").replace(/\D/g, "").replace(/^0+/, "");
    if (!n) return "";
    if (n.length <= 8) n = "591" + n;
    return n;
  };
  EC.abrirWhatsapp = (cel, texto) => {
    const n = EC.telefonoWa(cel);
    if (!n) { EC.toast("Este alumno no tiene celular registrado.", "error"); return false; }
    window.open("https://wa.me/" + n + "?text=" + encodeURIComponent(texto), "_blank");
    return true;
  };

  // ---------- Log de depuración (botón 🐞) ----------
  EC._logs = [];
  EC.log = (mensaje, tipo) => {
    const hora = new Date().toLocaleTimeString("es-ES");
    EC._logs.push({ hora, mensaje, tipo: tipo || "info" });
    if (EC._logs.length > 300) EC._logs.shift();
    const lista = document.getElementById("debugLista");
    if (lista) {
      const l = document.createElement("div");
      l.className = "log-" + (tipo || "info");
      l.textContent = "[" + hora + "] " + mensaje;
      lista.appendChild(l);
      lista.scrollTop = lista.scrollHeight;
    }
  };

  // ---------- Avisos ----------
  EC.toast = (mensaje, tipo, ms) => {
    const caja = document.getElementById("toasts");
    if (!caja) return;
    const t = document.createElement("div");
    t.className = "toast " + (tipo || "info");
    t.textContent = mensaje;
    caja.appendChild(t);
    setTimeout(() => t.classList.add("sale"), (ms || 3200) - 300);
    setTimeout(() => t.remove(), ms || 3200);
  };

  // ---------- Modal ----------
  /** EC.modal({titulo, cuerpo:(html|Node), botones:[{texto, clase, accion}]})
      accion puede ser async; si devuelve false el modal no se cierra. */
  EC.modal = (op) => {
    const fondo = document.createElement("div");
    fondo.className = "modal-fondo";
    const caja = document.createElement("div");
    caja.className = "modal-caja" + (op.ancho ? " ancha" : "");
    if (op.titulo) {
      const h = document.createElement("h2");
      h.textContent = op.titulo;
      caja.appendChild(h);
    }
    const cuerpo = document.createElement("div");
    cuerpo.className = "modal-cuerpo";
    if (typeof op.cuerpo === "string") cuerpo.innerHTML = op.cuerpo;
    else if (op.cuerpo) cuerpo.appendChild(op.cuerpo);
    caja.appendChild(cuerpo);
    const barra = document.createElement("div");
    barra.className = "modal-botones";
    const api = {
      el: caja,
      cerrar() { fondo.remove(); if (op.alCerrar) op.alCerrar(); },
    };
    (op.botones || [{ texto: "Cerrar", clase: "suave" }]).forEach((b) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn " + (b.clase || "suave");
      btn.textContent = b.texto;
      btn.addEventListener("click", async () => {
        if (btn.disabled) return;
        let r;
        if (b.accion) {
          btn.disabled = true;
          try { r = await b.accion(api, btn); } finally { btn.disabled = false; }
        }
        if (r !== false) api.cerrar();
      });
      barra.appendChild(btn);
    });
    caja.appendChild(barra);
    fondo.appendChild(caja);
    if (op.cerrable !== false) {
      fondo.addEventListener("click", (e) => { if (e.target === fondo) api.cerrar(); });
    }
    document.body.appendChild(fondo);
    const primero = caja.querySelector("input,select,textarea");
    if (primero && op.enfocar !== false) setTimeout(() => primero.focus(), 50);
    return api;
  };

  EC.confirmar = (texto, op) =>
    new Promise((resolver) => {
      op = op || {};
      let respondido = false;
      const fin = (v) => { if (!respondido) { respondido = true; resolver(v); } };
      EC.modal({
        titulo: op.titulo || "",
        cuerpo: '<p class="texto-modal">' + EC.esc(texto) + "</p>",
        enfocar: false,
        botones: [
          { texto: op.no || "Cancelar", clase: "suave", accion: () => { fin(false); } },
          { texto: op.si || "Confirmar", clase: op.peligro ? "peligro" : "principal", accion: () => { fin(true); } },
        ],
        alCerrar: () => fin(false),
      });
    });

  /** Ejecuta una promesa mostrando "…" en el botón mientras tanto */
  EC.ocupado = async (boton, fn) => {
    const texto = boton.textContent;
    boton.disabled = true;
    boton.textContent = "Espera…";
    try { return await fn(); }
    finally { boton.disabled = false; boton.textContent = texto; }
  };

  /** Carga un script una sola vez (para librerías pesadas bajo demanda) */
  const _scripts = {};
  EC.cargarScript = (url) => {
    if (!_scripts[url]) {
      _scripts[url] = new Promise((ok, fallo) => {
        const el = document.createElement("script");
        el.src = url + "?v=" + (EC.VERSION || "1");
        el.onload = ok;
        el.onerror = () => { delete _scripts[url]; fallo(new Error("No se pudo cargar " + url)); };
        document.head.appendChild(el);
      });
    }
    return _scripts[url];
  };

  EC.registrar = (id, modulo) => { (EC._modulos = EC._modulos || {})[id] = modulo; };
})();

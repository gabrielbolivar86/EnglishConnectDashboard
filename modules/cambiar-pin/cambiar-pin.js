/* Cambiar PIN (4 números). */
(function () {
  const EC = window.EC;
  EC.registrar("cambiar-pin", {
    montar(cont, ctx) {
      cont.innerHTML =
        '<form class="caja" id="fPin" autocomplete="off">' +
        '<div class="campo"><label>PIN actual</label><input id="pa" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password"></div>' +
        '<div class="campo"><label>PIN nuevo (4 números)</label><input id="pn" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password"></div>' +
        '<div class="campo"><label>Repite el PIN nuevo</label><input id="pr" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password"></div>' +
        '<button class="btn principal grande" type="submit">Guardar PIN</button><p class="error-texto" id="pe"></p></form>';
      const f = cont.querySelector("#fPin"), err = cont.querySelector("#pe");
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        err.textContent = "";
        const a = f.pa.value.trim(), n = f.pn.value.trim(), r = f.pr.value.trim();
        if (!/^\d{4}$/.test(a)) { err.textContent = "Escribe tu PIN actual (4 números)."; return; }
        if (!/^\d{4}$/.test(n)) { err.textContent = "El PIN nuevo debe tener exactamente 4 números."; return; }
        if (n !== r) { err.textContent = "Los PIN nuevos no coinciden."; return; }
        const btn = f.querySelector("button");
        btn.disabled = true;
        try {
          const d = await ctx.api("cambiar_pin", { pin_actual: a, pin_nuevo: n }, { reintentos: 0 });
          const s = EC.sesion.obtener(); s.token = d.token; EC.sesion.guardar(s);
          EC.toast("PIN actualizado ✅", "ok");
          f.reset();
        } catch (x) { err.textContent = x.message; }
        finally { btn.disabled = false; }
      });
    },
  });
})();

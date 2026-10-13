/* Badge con QR (contiene sólo el ID del alumno). Lo usan "Mi badge" y "Alumnos". */
(function () {
  const EC = window.EC;

  EC.dibujarBadge = async function (cont, a) {
    cont.innerHTML =
      '<div class="badge" id="badgeImg"><div class="cab">English<i>Connect</i></div>' +
      '<div class="qr" id="badgeQr"></div><div class="nom">' + EC.esc(a.nombre + " " + a.apellido) +
      '</div><div class="idt">' + EC.esc(a.id) + "</div></div>";
    try { await EC.cargarScript("lib/qrcode-lib.js"); }
    catch (e) { cont.querySelector("#badgeQr").textContent = "❌ No cargó la librería de QR"; return; }
    cont.querySelector("#badgeQr").innerHTML = "";
    new QRCode(cont.querySelector("#badgeQr"), {
      text: a.id, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M,
    });
  };

  EC.descargarBadge = async function (a) {
    try { await EC.cargarScript("lib/html2canvas.min.js"); }
    catch (e) { EC.toast("No cargó la librería de imágenes.", "error"); return false; }
    const canvas = await html2canvas(document.getElementById("badgeImg"), { backgroundColor: "#ffffff", scale: 2 });
    const link = document.createElement("a");
    link.download = ("QR_" + a.nombre + "_" + a.apellido + ".png").replace(/\s+/g, "_");
    link.href = canvas.toDataURL("image/png");
    link.click();
    return true;
  };
})();

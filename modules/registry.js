/* Registro de módulos. Para agregar una app nueva:
   1) crea modules/<id>/<id>.js que llame a EC.registrar('<id>', { montar, desmontar })
   2) añade una entrada aquí con el rol mínimo que puede verla.
   Roles: alumno < registrador < profesor (el servidor vuelve a validar todo). */
window.EC = window.EC || {};
EC.NIVEL = { alumno: 1, registrador: 2, profesor: 3 };
EC.ROLES = { alumno: "Alumno", registrador: "Registrador", profesor: "Profesor" };

EC.modulos = [
  { id: "escaner", grupo: "Clase", icono: "📷", titulo: "Tomar asistencia", desc: "Escanea los QR de la clase", min: "registrador", js: "modules/escaner/escaner.js", css: "modules/escaner/escaner.css" },
  { id: "reportes", grupo: "Administración", icono: "📊", titulo: "Reportes", desc: "Asistencia por clase y por alumno", min: "profesor", js: "modules/reportes/reportes.js" },
  { id: "alumnos", grupo: "Administración", icono: "👥", titulo: "Alumnos", desc: "Datos, QR, duplicados y periodos", min: "profesor", js: "modules/alumnos/alumnos.js" },
  { id: "credenciales", grupo: "Administración", icono: "🔑", titulo: "Credenciales", desc: "Usuarios, PIN y envío por WhatsApp", min: "profesor", js: "modules/credenciales/credenciales.js" },
  { id: "periodos", grupo: "Administración", icono: "🗓️", titulo: "Periodos", desc: "Periodos por curso (EC1, EC2…)", min: "profesor", js: "modules/periodos/periodos.js" },
  { id: "mi-badge", grupo: "Mi espacio", icono: "🪪", titulo: "Mi badge", desc: "Tu QR para marcar asistencia", min: "alumno", js: "modules/mi-badge/mi-badge.js" },
  { id: "mi-asistencia", grupo: "Mi espacio", icono: "✅", titulo: "Mi asistencia", desc: "A qué clases has venido", min: "alumno", js: "modules/mi-asistencia/mi-asistencia.js" },
  { id: "cambiar-pin", grupo: "Mi espacio", icono: "🔒", titulo: "Cambiar PIN", desc: "Cambia tu PIN de 4 números", min: "alumno", js: "modules/cambiar-pin/cambiar-pin.js" },
];

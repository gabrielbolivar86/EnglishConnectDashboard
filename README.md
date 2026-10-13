# English Connect

Plataforma de clases: un solo inicio de sesión y un menú según el rol (alumno, registrador, profesor).
Se publica con GitHub Pages desde la raíz de este repo. El backend vive aparte (Google Apps Script).

```
index.html            pantalla de login + contenedor de la app
core/                 config (URL del backend), cliente API, UI, menú y rutas
modules/registry.js   lista de módulos y rol mínimo de cada uno
modules/<modulo>/     un módulo por carpeta (escaner, reportes, alumnos, credenciales,
                      periodos, mi-badge, mi-asistencia, cambiar-pin)
lib/                  librerías locales (jsQR, qrcodejs, html2canvas)
```

## Agregar un módulo
1. Crea `modules/<id>/<id>.js` y regístralo con `EC.registrar('<id>', { montar(contenedor, ctx), desmontar() })`.
2. Añade una entrada en `modules/registry.js` con el rol mínimo (`alumno` < `registrador` < `profesor`).

## Cambiar la URL del backend
Sólo en `core/config.js` (`EC.API_URL`). Si cambias archivos y los celulares no los ven, sube `EC.VERSION`
en `core/config.js` y el `?v=` de los `<script>` de `index.html`.

> No se guardan contraseñas ni claves en este repo: el servidor las guarda en Script Properties.
> Los datos de alumnos (listas, QR, badges) no deben subirse aquí: es un repo público.

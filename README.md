# Votación disfraces — 29° Cumple 🎉

Página estática (HTML + CSS + JS vanilla, sin build) para que los invitados voten
desde el celular, por QR, el mejor disfraz de la fiesta. Cada dispositivo vota una
sola vez (control por token en `localStorage` + verificación en el backend).

- **Frontend:** [`index.html`](./index.html) — una sola página, mobile-first.
- **Backend:** Google Apps Script ([`apps-script/Code.gs`](./apps-script/Code.gs)) publicado como Web App, que escribe en un Google Sheet.
- **Hosting:** Vercel (deploy automático al pushear a `main`).

## Cómo cambiar la URL del Apps Script

La URL del endpoint está hardcodeada como constante al principio del `<script>` de `index.html`:

```js
const APPS_SCRIPT_URL = 'PON_AQUI_LA_URL_DEL_APPS_SCRIPT';
```

Reemplazá ese valor por la URL que te da Google al publicar el deployment
(termina en `/exec`). Después hacé commit y push — Vercel redeploya solo.

```bash
git add index.html
git commit -m "Actualizar URL del Apps Script"
git push
```

## Cómo redeployar

No hace falta nada especial: cualquier push a `main` dispara un deploy nuevo en
Vercel automáticamente (está conectado al repo). Si necesitás forzar un redeploy
sin cambios de código, podés hacerlo desde el dashboard de Vercel ("Redeploy")
o con un commit vacío:

```bash
git commit --allow-empty -m "Redeploy"
git push
```

## Apps Script — cómo publicarlo (manual, una sola vez)

1. Abrí el Google Sheet del proyecto ("Votos Disfraces - Cumple 29").
2. Menú **Extensiones → Apps Script**.
3. Borrá el contenido de `Code.gs` que aparece por defecto y pegá el contenido de
   [`apps-script/Code.gs`](./apps-script/Code.gs) de este repo.
4. Guardá (ícono de disco o `Ctrl+S`).
5. Arriba a la derecha, botón **Implementar → Nueva implementación**.
6. En "Seleccionar tipo", elegí **Aplicación web**.
7. Configurá:
   - **Ejecutar como:** Yo (tu cuenta)
   - **Quién tiene acceso:** Cualquier usuario
8. Hacé clic en **Implementar**. Google va a pedir autorizar permisos (es tu propio
   script accediendo a tu propia hoja) — aceptá.
9. Copiá la **URL de la aplicación web** que te muestra (termina en `/exec`).
10. Pegá esa URL en `APPS_SCRIPT_URL` dentro de `index.html` (ver sección anterior) y pusheá.

Si más adelante editás `Code.gs`, tenés que crear **una nueva versión** del
deployment para que los cambios se apliquen: Implementar → Administrar
implementaciones → ícono de lápiz → en "Versión" elegí "Nueva versión" → Implementar.
(La URL no cambia.)

## Estructura del Sheet

La hoja "Hoja 1" tiene los encabezados `timestamp | token | voto`. Cada voto
agrega una fila nueva. Si votás dos veces con el mismo token, la segunda vez el
script responde `duplicado` y no agrega fila.

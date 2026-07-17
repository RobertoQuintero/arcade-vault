# 03 — Página "Acerca de" con envío de contacto por email

- **Estado:** Aprobado
- **Dependencias:** SPEC 01 (MVP visual), SPEC 02 (Landing page — dejó pendiente el link "Acerca de" en el nav)
- **Fecha:** 2026-07-17

## Objetivo

Implementar la ruta `/about` con el contenido de `references/templates/home-about/about.jsx` (hero "Acerca de" + formulario de contacto), conectando el formulario a un envío real de email vía Resend a través de un Server Action, y agregar el link "Acerca de" al nav.

## Alcance

**Incluido:**

- Nueva ruta `app/about/page.tsx` (Client Component) con el contenido de `about.jsx`: hero "ACERCA DE" (kicker, título, párrafo de misión, 3 tarjetas highlight con iconos pixel SVG), banner divisor animado, y sección de contacto (intro + tips + formulario).
- Hook de reveal-on-scroll (`IntersectionObserver` que agrega `.in` a `.reveal`) aplicado a las secciones de `/about`, siguiendo el mismo patrón ya usado en la landing (spec 02).
- Formulario de contacto (nombre, correo, mensaje) con validación en cliente: campos no vacíos (con animación shake existente en la plantilla) + formato de correo válido antes de invocar el envío.
- Server Action `app/about/actions.ts` (`"use server"`) que envía el mensaje por email usando el SDK de Resend: `from: onboarding@resend.dev`, `to` = `CONTACT_TO_EMAIL` (variable de entorno), `reply-to` = correo ingresado por el usuario, asunto y cuerpo con nombre/correo/mensaje.
- Estado de envío en el formulario: botón deshabilitado con texto "ENVIANDO..." mientras la Server Action está pendiente.
- Estado de éxito: animación de terminal de la plantilla (`terminal-success`) tras confirmación real de envío por parte de Resend.
- Estado de error: si la Server Action falla (key inválida, Resend caído, etc.), el formulario se mantiene editable y muestra un mensaje de error, permitiendo reintentar.
- Nuevas variables de entorno en `.env`: `RESEND_API_KEY` (renombrando la actual `API_KEY`) y `CONTACT_TO_EMAIL=langdonhp435@gmail.com`.
- Nueva dependencia `resend` en `package.json`.
- Actualización de `components/nav.tsx`: nuevo link "Acerca de" → `/about` en el nav de escritorio y en el panel móvil, con su estado activo (`isAboutActive`).
- Porte a `app/globals.css` del subconjunto de clases de `references/templates/home-about/styles.css` que usa `about.jsx` (`about-*`, `contact-*`, `highlight-*`, `div-bar`/`div-pixels`, `term-*`, `dot`, `caret`, `tip-*`) que todavía no fue portado en specs anteriores.

**Explícitamente fuera de alcance:**

- Persistencia de los mensajes de contacto en base de datos o `localStorage` — el mensaje solo se envía por correo, no se guarda en el proyecto.
- Protección anti-spam (honeypot, CAPTCHA, rate limiting).
- Verificación de dominio propio en Resend — se usa la dirección de pruebas `onboarding@resend.dev`.
- Reintentos automáticos ante fallo de envío — el usuario reintenta manualmente reenviando el formulario.
- Adjuntos, CC/BCC o múltiples destinatarios en el correo.
- Internacionalización.
- Tests automatizados.
- Cambios a otras páginas o rutas más allá de `components/nav.tsx`.

## Modelo de datos

No se introduce persistencia en servidor ni base de datos; solo tipos para el flujo de envío del formulario.

### Server Action (`app/about/actions.ts`)

```ts
export interface ContactFormResult {
  status: "success" | "error";
  message: string; // texto a mostrar en el formulario (éxito o error)
}

export async function sendContactMessage(
  name: string,
  email: string,
  msg: string
): Promise<ContactFormResult>;
```

`sendContactMessage` instancia el cliente de Resend con `process.env.RESEND_API_KEY`, envía el correo (`from: "onboarding@resend.dev"`, `to: process.env.CONTACT_TO_EMAIL`, `reply_to: email`, asunto tipo `Nuevo mensaje de contacto — Arcade Vault`, cuerpo con nombre/correo/mensaje) y devuelve `{ status: "success", message: ... }` si Resend confirma el envío, o `{ status: "error", message: ... }` si la llamada lanza o Resend devuelve error.

### Estado local del formulario (`app/about/page.tsx`)

No se agregan claves nuevas de `localStorage`. El componente mantiene en estado de React: los valores del formulario (`name`, `email`, `msg`), un estado de envío (`idle` | `pending` | `success` | `error`), y el mensaje de error/éxito recibido de `sendContactMessage`.

## Plan de implementación

1. **Dependencias y entorno**: agregar `resend` a `package.json` (`npm install resend`), renombrar `API_KEY` a `RESEND_API_KEY` en `.env` y agregar `CONTACT_TO_EMAIL=langdonhp435@gmail.com`. El proyecto sigue compilando, sin cambios visuales.
2. **`app/globals.css`**: portar el subconjunto de clases de `references/templates/home-about/styles.css` que usa `about.jsx` (`about-*`, `contact-*`, `highlight-*`, `div-bar`/`div-pixels`, `term-*`, `dot`, `caret`, `tip-*`). Sin uso todavía, no hay cambio visual.
3. **`app/about/actions.ts`**: crear el Server Action `sendContactMessage` (`"use server"`) que instancia el cliente de Resend con `RESEND_API_KEY`, envía el correo a `CONTACT_TO_EMAIL` con `reply_to` del remitente, y devuelve `ContactFormResult` (`success`/`error`) capturando cualquier excepción. No se invoca desde la UI todavía.
4. **`app/about/page.tsx` — hero**: crear la ruta con el hero "ACERCA DE" (kicker, título, párrafo de misión, 3 tarjetas highlight con iconos SVG) y el banner divisor, aplicando el hook `useReveal` (mismo patrón de la landing). `/about` queda navegable mostrando el hero, sin la sección de contacto todavía.
5. **`app/about/page.tsx` — formulario de contacto (UI)**: agregar la sección de contacto (intro + tips + formulario controlado name/email/msg), con validación de campos vacíos (shake, igual que la plantilla) y validación de formato de correo. El submit solo valida en este paso, sin llamar al Server Action.
6. **Conectar formulario al Server Action**: al pasar la validación, invocar `sendContactMessage` envuelto en `startTransition`, manejando los estados `pending` (botón deshabilitado "ENVIANDO..."), `success` (animación de terminal de la plantilla) y `error` (mensaje de error, formulario reeditable para reintentar).
7. **`components/nav.tsx`**: agregar el link "Acerca de" → `/about` en el nav de escritorio y en el panel móvil, con su estado activo (`isAboutActive`).
8. **Repaso final**: probar el envío real con la key de Resend en `.env`, simular un fallo (key inválida) para verificar el estado de error, revisar responsive y la animación reveal-on-scroll en `/about`.

## Criterios de aceptación

- [ ] `/about` muestra el hero "ACERCA DE" con kicker, título, párrafo de misión y las 3 tarjetas highlight (corazón, navegador, planta) con sus iconos pixel.
- [ ] El banner divisor y las secciones marcadas `.reveal` se animan (agregan la clase `.in`) al hacer scroll hasta que entran en el viewport.
- [ ] `/about` muestra la sección de contacto con la intro, los 3 tips y el formulario (nombre, correo, mensaje).
- [ ] Enviar el formulario con algún campo vacío dispara la animación shake y no invoca el Server Action.
- [ ] Enviar el formulario con un correo de formato inválido (ej. `abc`) muestra un error de validación y no invoca el Server Action.
- [ ] Enviar el formulario con datos válidos deshabilita el botón y muestra "ENVIANDO..." mientras el Server Action está pendiente.
- [ ] Con `RESEND_API_KEY` válida, enviar el formulario válido resulta en un correo real recibido en `CONTACT_TO_EMAIL`, y la UI muestra la animación de terminal de éxito con el nombre del remitente.
- [ ] Con una `RESEND_API_KEY` inválida (o Resend caído), enviar el formulario válido muestra un mensaje de error en el formulario, que permanece editable para reintentar.
- [ ] El botón "ENVIAR OTRO MENSAJE" del estado de éxito limpia el formulario y permite enviar un nuevo mensaje.
- [ ] El nav muestra 4 links: "Inicio", "Biblioteca", "Acerca de", "Salón de la Fama"; "Acerca de" se resalta solo en `/about`.
- [ ] En viewport móvil (<840px), el panel lateral del nav muestra el link "Acerca de" y su estado activo coincide con el del nav de escritorio.
- [ ] No hay ninguna ruta rota (404 inesperado) al navegar por todos los enlaces del nav incluyendo el nuevo link.

## Decisiones tomadas y descartadas

- **Server Action (`app/about/actions.ts`) en vez de Route Handler** (tomada): es el mecanismo más idiomático para mutaciones en Next.js 16 App Router, sin necesidad de un `fetch` manual desde el cliente.
- **`from: onboarding@resend.dev` en vez de un dominio propio verificado** (tomada): no hay un dominio verificado en el dashboard de Resend todavía; la dirección de pruebas permite enviar correos sin configuración adicional.
- **`CONTACT_TO_EMAIL` como variable de entorno en vez de hardcodeado en código** (tomada): permite cambiar el correo destino sin tocar código ni hacer un deploy de código, solo de configuración.
- **Renombrar `API_KEY` a `RESEND_API_KEY` en `.env`** (tomada): el nombre original no indicaba a qué servicio pertenecía la clave; el nombre convencional del SDK de Resend la hace identificable.
- **Agregar validación de formato de correo en cliente** (tomada): la plantilla original (`about.jsx`) solo validaba que los campos no estuvieran vacíos; se agrega el chequeo de formato para evitar mensajes con correos inválidos que impidan responder.
- **Estado de error explícito y reintentable en el formulario** (tomada), en vez de fire-and-forget: la plantilla no contempla fallos de red/API porque no tenía envío real; mostrar el error y dejar el formulario editable es más honesto que fingir éxito cuando Resend falla.
- **Botón deshabilitado con texto "ENVIANDO..." durante el envío** (tomada): ahora existe una llamada de red real al Server Action (la plantilla original mostraba el éxito de forma instantánea, sin espera); el estado de carga evita doble envío y da feedback claro.
- **Agregar el link "Acerca de" al nav en este spec** (tomada): el spec 02 lo dejó explícitamente pendiente hasta que existiera la ruta `/about`.
- **Sin persistencia de mensajes en base de datos o `localStorage`** (descartada): no fue solicitado y agrega complejidad (esquema, almacenamiento) no requerida para el objetivo de contacto por correo.
- **Sin protección anti-spam/CAPTCHA** (descartada): fuera de alcance para este MVP; puede añadirse en un spec futuro si se detecta abuso real.
- **Reintentos automáticos ante fallo de Resend** (descartada): se prefirió que el usuario reintente manualmente en vez de añadir lógica de retry/backoff no solicitada.

## Riesgos identificados

- **Restricción de `onboarding@resend.dev`**: Resend solo permite enviar desde esta dirección de pruebas hacia el correo que es propietario de la cuenta de Resend. Si `CONTACT_TO_EMAIL` no coincide con ese correo, el envío fallará (mostrando el estado de error) aunque `RESEND_API_KEY` sea válida. Mitigación: confirmar que `CONTACT_TO_EMAIL` es el correo de la cuenta de Resend, o verificar un dominio propio más adelante.
- **Límites del plan gratuito de Resend** (envíos por día/mes): si se supera el límite, los envíos fallarán y se mostrarán como el estado de error normal del formulario, sin manejo especial.
- **Rotación de IDs de Server Actions en cada deploy**: Next.js rota los IDs de acción hasta cada 14 días; un usuario con `/about` abierto desde antes de un nuevo deploy puede ver el error "Failed to find Server Action" al enviar el formulario. No se agrega manejo especial más allá de que el error cae en el estado de error existente.
- **`RESEND_API_KEY` en `.env`**: queda en texto plano en el archivo local (ya ignorado por git vía `.env*`); si el proyecto se despliega, la clave debe configurarse como variable de entorno en la plataforma de hosting, no copiarse al repositorio.

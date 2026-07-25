# 15 — Conectar autenticación de Arcade Vault a Supabase (OAuth + recuperación de contraseña)

- **Estado:** Aprobado
- **Dependencias:** Ninguna nueva. Se construye sobre la infraestructura ya existente: `app/auth/page.tsx` (UI con tabs login/registro + botones sociales sin lógica), `app/auth/actions.ts` (Server Actions `signIn`/`signUp`/`signOut` con email/password), `lib/session-user.ts` (`useSessionUser`/`nameFromSupabaseUser`), `lib/supabase/client.ts` y `server.ts`.
- **Fecha:** 2026-07-25

## Objetivo

Conectar el login con Google/GitHub (los botones ya existen en el formulario, sin `onClick`) a Supabase Auth vía OAuth, ampliar `nameFromSupabaseUser()` para reconocer el nombre real de usuarios OAuth, y agregar el flujo de recuperación de contraseña (solicitar reset por email + pantalla para definir la nueva contraseña), sin tocar el modo INVITADO ni el formulario de email/password existente.

## Alcance

**Incluido:**

- **OAuth Google y GitHub** desde `app/auth/page.tsx`: los botones `◆ GOOGLE` / `▣ GITHUB` (ya en el JSX, sin `onClick`) llaman a `supabase.auth.signInWithOAuth({ provider, options: { redirectTo: \`${origin}/auth/callback\` } })` usando el cliente browser (`lib/supabase/client.ts`). Redirect simple de página completa, sin estado de loading adicional en el botón (Supabase ya navega fuera de la SPA).
- **Nueva ruta `app/auth/callback/route.ts`**: Route Handler (`GET`) que recibe `?code=` desde el redirect de Google/GitHub, llama a `supabase.auth.exchangeCodeForSession(code)` con el cliente server (`lib/supabase/server.ts`), y redirige a `/` (o a `/auth?error=...` si falla el exchange).
- **Recuperación de contraseña — solicitud**: en el tab `INICIAR SESIÓN` de `app/auth/page.tsx`, un link `¿OLVIDASTE TU CONTRASEÑA?` que muestra un campo de email y llama a una nueva Server Action `resetPassword(email)` en `app/auth/actions.ts`, que ejecuta `supabase.auth.resetPasswordForEmail(email, { redirectTo: \`${origin}/auth/reset-password\` })`. Muestra un mensaje de confirmación genérico ("Si el correo existe, te enviamos un enlace") sin revelar si el email está registrado.
- **Recuperación de contraseña — nueva contraseña**: nueva ruta `app/auth/reset-password/page.tsx`, accesible solo tras clickear el enlace del correo (Supabase deja una sesión de recuperación activa). Formulario con "Nueva contraseña" + "Confirmar contraseña" (mismo `minLength={6}` que signUp), valida que coincidan en el cliente, y llama a una nueva Server Action `updatePassword(password)` que ejecuta `supabase.auth.updateUser({ password })`. Éxito → redirige a `/auth` con mensaje para volver a iniciar sesión.
- **Ampliar `nameFromSupabaseUser()`** en `lib/session-user.ts`: probar `user_metadata.name` → `user_metadata.full_name` → `user_metadata.user_name` → fallback a email, para que usuarios de Google/GitHub muestren su nombre real en vez del email truncado.
- Documentar como **paso previo manual requerido** (fuera del código, en la sección de riesgos/decisiones): activar Google y GitHub como providers en Supabase Dashboard → Authentication → Providers, con sus credenciales OAuth, y registrar la Redirect URL (`<site-url>/auth/callback`).

**Explícitamente fuera de alcance:**

- El modo INVITADO (`lib/storage.ts` `getUser`/`setUser`, botón "JUGAR COMO INVITADO") se mantiene exactamente igual — no se toca.
- El formulario de email/password existente (`signIn`/`signUp` actuales) no cambia su lógica ni su UI, salvo el link nuevo de "olvidé mi contraseña" agregado al tab de login.
- Cambio de contraseña desde un usuario ya logueado (configuración de cuenta / "cambiar mi contraseña" estando en sesión) — esta spec solo cubre el flujo de recuperación vía email para un usuario deslogueado.
- Vincular/desvincular proveedores OAuth a una cuenta ya existente con email/password (account linking) — Supabase lo maneja según su configuración por defecto, no se agrega UI para gestionarlo.
- Página de perfil de usuario o edición de nombre/avatar.
- Configurar realmente las credenciales OAuth en el dashboard de Supabase — es un paso manual que debe hacer el usuario, documentado pero no ejecutado por esta spec.
- Tests automatizados (no hay test runner configurado en el proyecto).

## Modelo de datos

No se introducen tablas ni migraciones nuevas — Supabase Auth ya gestiona `auth.users`, incluyendo las identidades OAuth (`auth.identities`) y el flujo de recovery, de forma nativa. Tampoco se agregan tipos públicos nuevos a `lib/`.

Se agregan estas piezas internas (sin persistencia propia, sin tocar `scores`/`games`):

- `app/auth/actions.ts` — dos Server Actions nuevas junto a las existentes `signIn`/`signUp`/`signOut`:
  - `resetPassword(email: string): Promise<AuthResult>` — envuelve `supabase.auth.resetPasswordForEmail`.
  - `updatePassword(password: string): Promise<AuthResult>` — envuelve `supabase.auth.updateUser({ password })`. Reutilizan la interfaz `AuthResult` (`{ status: "success" | "error"; message: string }`) ya definida en el archivo.
- `app/auth/callback/route.ts` — nuevo Route Handler, sin estado propio; solo orquesta `exchangeCodeForSession` y una redirección HTTP.
- `app/auth/reset-password/page.tsx` — nuevo Client Component, estado local (`password`, `confirmPassword`, `error`, `isPending`) análogo al de `app/auth/page.tsx`.
- `lib/session-user.ts` — `nameFromSupabaseUser()` amplía su lectura de `user_metadata` (no cambia la forma de `SessionUser`).

## Plan de implementación

1. **`resetPassword` y `updatePassword` en `app/auth/actions.ts`**: agregar las dos Server Actions nuevas junto a `signIn`/`signUp`/`signOut`, siguiendo el mismo patrón (`"use server"`, cliente vía `createClient()` de `lib/supabase/server.ts`, devolver `AuthResult`). `resetPassword` siempre devuelve `status: "success"` con mensaje genérico salvo error real de red/config (no revela si el email existe). `updatePassword` valida solo en el cliente que las contraseñas coincidan antes de llamar a la acción.
2. **Ruta de callback OAuth (`app/auth/callback/route.ts`)**: Route Handler `GET` que lee `searchParams.get("code")`, si existe llama a `supabase.auth.exchangeCodeForSession(code)` con el cliente server, y usa `NextResponse.redirect` a `/` en éxito o a `/auth?error=oauth` si falla o no hay `code`.
3. **Botones sociales en `app/auth/page.tsx`**: agregar `onClick` a `◆ GOOGLE` / `▣ GITHUB` que llaman a `createClient().auth.signInWithOAuth({ provider: "google" | "github", options: { redirectTo: \`${window.location.origin}/auth/callback\` } })`. Sin estado de loading (la navegación sale de la SPA de inmediato).
4. **Ampliar `nameFromSupabaseUser()` en `lib/session-user.ts`**: cambiar el `||` actual para probar en orden `user_metadata?.name`, `user_metadata?.full_name`, `user_metadata?.user_name`, y por último el fallback a email ya existente.
5. **Link "¿OLVIDASTE TU CONTRASEÑA?" en `app/auth/page.tsx`**: dentro del tab `INICIAR SESIÓN`, agregar el link que alterna un pequeño estado (`showReset`) mostrando un campo de email + botón "ENVIAR ENLACE", que llama a `resetPassword(email)` y muestra el mensaje de confirmación (éxito o error) reutilizando el bloque de `error`/mensaje ya existente en el formulario.
6. **Nueva página `app/auth/reset-password/page.tsx`**: Client Component con el mismo look visual que `app/auth/page.tsx` (`av-auth-wrap`, `auth-card`), dos campos password (nueva/confirmar), validación de coincidencia en cliente, llamada a `updatePassword(password)` vía `useTransition`, y redirect a `/auth` con query (`?reset=ok`) en éxito para mostrar un mensaje de "contraseña actualizada" en el tab de login.
7. **Mensaje post-reset en `app/auth/page.tsx`**: leer `?reset=ok` de `useSearchParams` al montar y mostrar un aviso breve (mismo estilo que los errores, pero en color neutro/cyan) invitando a iniciar sesión con la nueva contraseña.
8. **Verificación de tipos**: `npx tsc --noEmit` sin errores.
9. **Verificación manual — email/password sin regresión**: confirmar que login y registro con email/password siguen funcionando exactamente igual que antes (sin cambios de comportamiento).
10. **Verificación manual — OAuth**: con los providers ya activados en el Dashboard de Supabase (paso previo manual, ver Riesgos), probar login con Google y con GitHub desde `/auth`, confirmar que `app/auth/callback` procesa el `code`, la sesión queda activa, y `nav.tsx`/`useSessionUser()` muestran el nombre correcto (no el email truncado) para una cuenta Google/GitHub con nombre disponible en sus metadatos.
11. **Verificación manual — recuperación de contraseña**: desde `/auth`, click en "¿OLVIDASTE TU CONTRASEÑA?", enviar el email, revisar que llega el correo de Supabase, clickear el enlace, llegar a `/auth/reset-password`, definir nueva contraseña, confirmar redirect a `/auth?reset=ok` con el aviso visible, y volver a iniciar sesión con la contraseña nueva.
12. **Verificación manual — modo invitado sin regresión**: confirmar que "JUGAR COMO INVITADO" sigue funcionando igual, sin interferencia de los cambios anteriores.

## Criterios de aceptación

- [ ] Desde `/auth`, hacer clic en `◆ GOOGLE` redirige al consentimiento de Google y, tras autorizar, vuelve a Arcade Vault con sesión activa (verificable en `nav.tsx`, que deja de mostrar el estado deslogueado).
- [ ] Desde `/auth`, hacer clic en `▣ GITHUB` redirige al consentimiento de GitHub y, tras autorizar, vuelve a Arcade Vault con sesión activa.
- [ ] `app/auth/callback/route.ts` intercambia correctamente el `code` por una sesión (`exchangeCodeForSession`) y redirige a `/`; si el `code` falta o el exchange falla, redirige a `/auth` con un estado de error visible en el formulario.
- [ ] Un usuario logueado vía Google o GitHub con nombre disponible en sus metadatos (`full_name`/`user_name`) ve ese nombre real en el HUD (`nav.tsx`), no el email truncado.
- [ ] En el tab `INICIAR SESIÓN` de `/auth`, el link "¿OLVIDASTE TU CONTRASEÑA?" muestra un campo de email; al enviarlo, se dispara `resetPassword` y se muestra un mensaje de confirmación genérico, sin revelar si el email existe en el sistema.
- [ ] Al clickear el enlace de recuperación recibido por correo, se llega a `/auth/reset-password`, que muestra un formulario de nueva contraseña + confirmación.
- [ ] En `/auth/reset-password`, si las contraseñas no coinciden se muestra un error sin llamar al servidor; si coinciden y tienen ≥6 caracteres, `updatePassword` actualiza la contraseña y redirige a `/auth?reset=ok`, donde se ve un aviso de éxito.
- [ ] Tras un reset exitoso, el usuario puede iniciar sesión con la nueva contraseña usando el formulario normal de email/password.
- [ ] El login/registro con email/password (`signIn`/`signUp` existentes) no cambia de comportamiento respecto a antes de esta spec.
- [ ] El botón "JUGAR COMO INVITADO" sigue funcionando exactamente igual que antes, sin cuenta Supabase involucrada.
- [ ] `npx tsc --noEmit` no reporta errores.

## Decisiones tomadas y descartadas

- **Modo INVITADO se mantiene sin cambios** (tomada, confirmada con el usuario): OAuth y recuperación de contraseña se agregan como capacidades adicionales sobre el sistema actual; forzar cuenta real queda fuera de alcance y sería un cambio de producto mayor, no una conexión de infraestructura.
- **Callback en un Route Handler dedicado (`app/auth/callback/route.ts`) en vez de manejarlo en `app/auth/page.tsx`** (tomada): es el patrón estándar de `@supabase/ssr` para Next.js App Router — el intercambio de `code` por sesión debe ocurrir en el servidor (para poder escribir la cookie de sesión), no en un Client Component.
- **Redirect simple sin loading state en los botones OAuth** (tomada, confirmada con el usuario): `signInWithOAuth` navega la pestaña completa fuera de la SPA de inmediato: cualquier estado de "cargando" quedaría visible por una fracción de segundo antes del salto, sin aportar valor real.
- **Mensaje de reset de contraseña siempre genérico ("si el correo existe...")** (tomada): evita enumeración de cuentas (confirmar por el mensaje si un email está o no registrado), siguiendo práctica estándar de seguridad para flujos de recuperación.
- **`nameFromSupabaseUser` amplía el fallback en vez de dejarlo en email** (tomada, confirmada con el usuario): sin esto, todo usuario que entre por Google/GitHub vería su email truncado como nombre en el HUD, una regresión de UX evidente frente al flujo de email/password que sí captura un nombre.
- **Sin UI de account linking (vincular OAuth a una cuenta existente con la misma contraseña)** (tomada): Supabase ya tiene su propio comportamiento por defecto ante emails duplicados entre providers; construir una UI de gestión de identidades es un feature aparte, no necesario para "que funcione el login".
- **Configuración de providers OAuth en el Dashboard de Supabase queda fuera del código, documentada como paso previo** (tomada, confirmada con el usuario): son credenciales y configuración que vive en la plataforma de Supabase (Client ID/Secret de Google Cloud Console / GitHub OAuth Apps, Redirect URLs), no en el repositorio; el código asume que ese paso ya se hizo o se hará antes de probar en producción.
- **Sin tests automatizados** (tomada): consistente con el resto del proyecto, que no tiene test runner configurado.

## Riesgos identificados

- **Providers OAuth no configurados o mal configurados en el Dashboard de Supabase**: si Google/GitHub no están activados, o la Redirect URL registrada no coincide con `<site-url>/auth/callback`, el flujo falla en el paso de consentimiento o en el exchange. Mitigado documentando el paso previo explícitamente (ver Decisiones) y verificando manualmente antes de dar la spec por completa.
- **Diferencia entre entorno local y producción para `redirectTo`**: `window.location.origin` en desarrollo apunta a `localhost`, que debe estar también registrado como Redirect URL válida en Supabase junto con el dominio de producción; si falta alguno, OAuth funciona en un entorno y falla en el otro.
- **Sesión de recuperación de contraseña expirada o reusada**: si el usuario tarda demasiado en clickear el enlace del correo, o lo abre dos veces, Supabase puede rechazar `updateUser({ password })`. Mitigado mostrando el error devuelto por `AuthResult` en `/auth/reset-password` (mismo patrón que errores de login/registro), no bloqueante para el resto del flujo.
- **Emails duplicados entre providers**: un usuario que se registró con email/password y luego intenta entrar con Google usando el mismo email puede toparse con el comportamiento por defecto de Supabase ante identidades duplicadas (rechazo o vinculación automática, según configuración del proyecto). No se agrega manejo especial en esta spec — riesgo menor, aceptado.

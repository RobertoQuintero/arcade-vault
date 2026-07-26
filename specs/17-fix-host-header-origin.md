# 17 — Fix: Host header injection en construcción de origin (auth)

- **Estado:** Aprobado
- **Dependencias:** Ninguna nueva. Modifica infraestructura existente de la spec 15 (`app/auth/actions.ts`, `app/auth/callback/route.ts`).
- **Fecha:** 2026-07-26

## Objetivo

Reemplazar la construcción del origin a partir de headers de la request (`Host`, `X-Forwarded-Proto`, `request.url`) por una variable de entorno fija `SITE_URL`, para eliminar el riesgo de envenenamiento del link de recuperación de contraseña y de open-redirect en el callback OAuth vía Host header spoofing.

## Alcance

**Incluido:**

- **Nueva variable de entorno `SITE_URL`** (server-only, sin prefijo `NEXT_PUBLIC_`): origin canónico del sitio (ej. `https://arcadevault.app` en producción, `http://localhost:3000` en desarrollo).
- **`app/auth/actions.ts`**: reemplazar `getOrigin()` (que lee `x-forwarded-proto` y `host` de `headers()`) por una lectura directa de `process.env.SITE_URL`. Si la variable no está definida, lanzar un error explícito en vez de caer a un valor derivado de la request. Usado por `resetPassword` para construir `redirectTo`.
- **`app/auth/callback/route.ts`**: reemplazar `origin` (hoy tomado de `new URL(request.url)`) por `process.env.SITE_URL` al construir las URLs de redirect (`/` en éxito, `/auth?error=oauth` en fallo). Mismo comportamiento de error explícito si falta la variable.
- **Documentar `SITE_URL`** en la sección "Environment variables" de `CLAUDE.md` y en `.env.local` (o `.env.example` si existe) junto a las variables ya documentadas de Supabase/Resend.

**Explícitamente fuera de alcance:**

- `signInWithOAuth` en `app/auth/page.tsx`: sigue usando `window.location.origin` (valor real del navegador, no viene de headers de la request server-side — no es parte de esta vulnerabilidad).
- Cualquier cambio a la lógica de negocio de `signIn`, `signUp`, `updatePassword`, `signOut`.
- Configurar `SITE_URL` en el entorno de producción real (Vercel/hosting) — queda como paso manual del usuario, igual que las credenciales OAuth de la spec 15.
- Validación o allowlist de `Host`/`X-Forwarded-Host` a nivel de middleware — se opta por eliminar la dependencia del header por completo en vez de validarlo.
- Tests automatizados (no hay test runner configurado en el proyecto).

## Modelo de datos

No se introducen tablas, migraciones ni tipos nuevos. El único elemento nuevo es la variable de entorno `SITE_URL` (no es un dato persistido ni una estructura de código, así que se omite esta sección más allá de mencionarlo aquí).

## Plan de implementación

1. **Agregar `SITE_URL` a `.env.local`** con el valor `http://localhost:3000` (y a `.env.example` si existe en el repo, con un placeholder documentado).
2. **Documentar `SITE_URL` en `CLAUDE.md`**, sección "Environment variables", junto a `NEXT_PUBLIC_SUPABASE_URL` y las demás, indicando que es server-only y su propósito (origin canónico para links de auth, evita depender de headers de la request).
3. **Reescribir `getOrigin()` en `app/auth/actions.ts`**: eliminar la lectura de `headers()` (`x-forwarded-proto`, `host`) y devolver `process.env.SITE_URL`, lanzando un error (`throw new Error(...)`) si la variable no está definida o está vacía. `resetPassword` sigue llamando a `getOrigin()` sin cambios en su propia lógica.
4. **Actualizar `app/auth/callback/route.ts`**: reemplazar el `origin` derivado de `new URL(request.url)` por `process.env.SITE_URL` (con el mismo throw explícito si falta), manteniendo el resto del flujo (`exchangeCodeForSession`, redirect a `/` o `/auth?error=oauth`) igual.
5. **Verificación de tipos**: `npx tsc --noEmit` sin errores.
6. **Verificación manual — reset de contraseña**: con `SITE_URL=http://localhost:3000` en `.env.local` y `npm run dev` corriendo, solicitar un reset desde `/auth`, confirmar que el correo recibido contiene un link apuntando a `http://localhost:3000/auth/reset-password` (no a un valor derivado de headers), y completar el flujo hasta loguearse con la nueva contraseña.
7. **Verificación manual — callback OAuth**: repetir el login con Google/GitHub desde `/auth`, confirmar que tras el consentimiento el redirect final aterriza en `http://localhost:3000/`, usando `SITE_URL` y no el host de la request.
8. **Verificación manual — falta de `SITE_URL`**: comentar temporalmente `SITE_URL` en `.env.local`, reiniciar el server, e intentar un reset de contraseña o el callback OAuth; confirmar que la acción falla explícitamente (error visible o excepción en el server) en vez de continuar con un origin no confiable. Restaurar la variable al terminar la prueba.

## Criterios de aceptación

- [ ] `SITE_URL` existe en `.env.local` con valor `http://localhost:3000` y está documentada en `CLAUDE.md` (sección "Environment variables") y en `.env.example` (si existe).
- [ ] `getOrigin()` en `app/auth/actions.ts` ya no lee `headers()` (`host`/`x-forwarded-proto`); construye el origin exclusivamente desde `process.env.SITE_URL`.
- [ ] `app/auth/callback/route.ts` ya no deriva `origin` de `new URL(request.url)`; usa `process.env.SITE_URL` para las URLs de redirect.
- [ ] Si `SITE_URL` no está definida, tanto `resetPassword` como el callback OAuth fallan explícitamente (error visible en el flujo, no un fallback silencioso a un origin derivado de la request).
- [ ] El correo de recuperación de contraseña generado en desarrollo contiene un link con origin `http://localhost:3000` verificado manualmente.
- [ ] El login OAuth (Google/GitHub) redirige correctamente a `http://localhost:3000/` tras el consentimiento, usando `SITE_URL`.
- [ ] `signInWithOAuth` en `app/auth/page.tsx` no fue modificado (sigue usando `window.location.origin`).
- [ ] `npx tsc --noEmit` no reporta errores.

## Decisiones tomadas y descartadas

- **`SITE_URL` sin prefijo `NEXT_PUBLIC_`** (tomada, confirmada con el usuario): el origin solo se necesita server-side (Server Actions y Route Handler); exponerlo al bundle del cliente no aporta nada y amplía innecesariamente la superficie.
- **Fallar explícitamente si falta `SITE_URL`, en vez de caer de vuelta a los headers de la request** (tomada, confirmada con el usuario): un fallback silencioso reintroduciría el mismo bug de forma condicional (solo se manifestaría si alguien olvida configurar la variable), lo cual es peor que un error ruidoso y fácil de diagnosticar.
- **No tocar `signInWithOAuth` / `window.location.origin` en `app/auth/page.tsx`** (tomada, confirmada con el usuario): ese valor lo determina el propio navegador de la víctima, no headers de la request al servidor — no es vector de este ataque, y cambiarlo sin necesidad ampliaría el alcance sin beneficio de seguridad real.
- **No agregar validación/allowlist de `Host` a nivel de middleware** (tomada, confirmada con el usuario): eliminar la dependencia del header por completo (usando `SITE_URL`) es más simple y robusto que mantener la lectura de headers y validarla contra una lista.
- **Configuración de `SITE_URL` en producción queda como paso manual** (tomada, confirmada con el usuario): mismo patrón que las credenciales OAuth (spec 15) y los ajustes de Auth Dashboard (spec 16) — no hay mecanismo en este repo para gestionar env vars de un hosting remoto por código.
- **Sin tests automatizados** (tomada): consistente con el resto del proyecto, que no tiene test runner configurado.

## Riesgos identificados

- **`SITE_URL` mal configurada en producción (ej. apuntando a un preview deploy o dominio incorrecto)**: los links de reset y el redirect OAuth apuntarían a un origin válido pero no deseado. Mitigado por el error explícito si la variable falta (criterio de aceptación), aunque no protege contra un valor _incorrecto pero presente_ — eso queda sujeto a que el usuario configure bien la variable en el hosting, igual que cualquier otra env var del proyecto.
- **Desincronización entre `SITE_URL` y el dominio real configurado como Redirect URL en el Dashboard de Supabase**: si difieren, Supabase puede rechazar el `redirectTo` o el flujo OAuth puede fallar en el exchange. Mitigado documentando ambos valores deben coincidir (paso manual ya cubierto en la spec 15 para OAuth, extendido aquí a `SITE_URL`).
- **Desarrolladores que clonan el repo sin setear `SITE_URL` en `.env.local`**: fallarán al probar reset de contraseña u OAuth localmente hasta configurarla. Riesgo bajo y esperado — es el comportamiento intencional (fail-fast) descrito en las decisiones, y queda documentado en `CLAUDE.md`.

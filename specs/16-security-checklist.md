# 16 — Checklist de seguridad básico

- **Estado:** Implementado
- **Dependencias:** Ninguna nueva. Se apoya en la infraestructura existente: `supabase/migrations/` (RLS de `scores`/`games`), `next.config.ts`, y la configuración de Auth del proyecto Supabase (ya usada en la spec 15 para OAuth).
- **Fecha:** 2026-07-25

## Objetivo

Cerrar los 4 hallazgos de seguridad reportados por `mcp__supabase__get_advisors` (función `rls_auto_enable()` invocable públicamente, policy de INSERT en `scores` con `WITH CHECK (true)` aceptada como riesgo documentado, leaked password protection deshabilitado) y agregar headers de seguridad básicos en Next.js, dejando además documentados como pasos manuales los ajustes de Auth (password mínimo 8 caracteres, max signup rate por IP) que no se gestionan por código en este repo.

## Alcance

**Incluido:**

- **Migración: revocar `EXECUTE` en `public.rls_auto_enable()`** para los roles `anon` y `authenticated` (`REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;`). La función sigue existiendo y ejecutándose como event trigger interno (dueño `postgres`), solo deja de ser invocable vía `/rest/v1/rpc/rls_auto_enable`.
- **Documentar como decisión tomada** (sección correspondiente) que la policy `anyone can insert a score` (`WITH CHECK (true)`) en `public.scores` se mantiene sin cambios: es intencional para soportar el modo INVITADO, y el WARN del linter se acepta como riesgo conocido.
- **Headers de seguridad en `next.config.ts`**: agregar `headers: async () => [...]` aplicando `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` a `/(.*)`, tal como el ejemplo del checklist.
- **Documentación de pasos manuales en Supabase Dashboard** (Authentication → Policies/Settings), sin ejecutarlos por código:
  - Minimum password length → 8.
  - Leaked password protection → habilitado (HaveIBeenPwned).
  - Max signup rate por IP → configurar un límite anti-bot.
- **Verificación post-fix**: re-ejecutar `mcp__supabase__get_advisors(security)` tras aplicar la migración y confirmar que el warning de `rls_auto_enable` desaparece, dejando solo el de `scores` INSERT (aceptado) y el de leaked password protection (pendiente de paso manual) hasta que el usuario lo habilite.

**Explícitamente fuera de alcance:**

- Cambiar la policy de INSERT en `scores` (se acepta el riesgo, no se modifica el `WITH CHECK`).
- Performance advisors de Supabase (el checklist es de seguridad; performance queda para un spec aparte si hace falta).
- Headers adicionales no listados en el checklist (`Strict-Transport-Security`, `Permissions-Policy`, CSP, etc.).
- Ejecutar realmente los cambios de configuración de Auth en el Dashboard (password length, leaked password protection, signup rate) — quedan documentados como paso manual del usuario, igual que las credenciales OAuth en la spec 15.
- Cualquier otro hallazgo que no esté en el checklist ni en el resultado actual de `get_advisors(security)`.
- Tests automatizados (no hay test runner configurado en el proyecto).

## Modelo de datos

No se introducen tablas ni tipos nuevos. Se agrega una única migración SQL:

- `supabase/migrations/<timestamp>_security_hardening.sql`:
  ```sql
  revoke execute on function public.rls_auto_enable() from anon, authenticated;
  ```
  No se toca la definición de la función ni su `SECURITY DEFINER` — solo se restringe quién puede invocarla vía API pública. No afecta al event trigger que la dispara (sigue corriendo como el dueño `postgres`).

No hay cambios a `public.scores` ni `public.games` (la policy de INSERT se deja intacta, ver Alcance/Decisiones).

## Plan de implementación

1. **Migración de hardening SQL**: crear `supabase/migrations/<timestamp>_security_hardening.sql` con `revoke execute on function public.rls_auto_enable() from anon, authenticated;` y aplicarla vía `mcp__supabase__apply_migration`.
2. **Verificar con advisors**: correr `mcp__supabase__get_advisors(type: "security")` y confirmar que `anon_security_definer_function_executable` y `authenticated_security_definer_function_executable` ya no aparecen. Confirmar que `rls_policy_always_true` (scores INSERT) y `auth_leaked_password_protection` siguen apareciendo (son los aceptados/pendientes de paso manual).
3. **Security headers en `next.config.ts`**: agregar el arreglo `securityHeaders` y la función `headers()` async aplicándolos a `/(.*)`, siguiendo el ejemplo del checklist.
4. **Verificación manual de headers**: con `npm run dev` corriendo, inspeccionar las response headers de una request a `/` (DevTools → Network o `curl -I`) y confirmar que `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy` están presentes con los valores esperados.
5. **Documentar pasos manuales de Auth**: agregar al spec (sección de Riesgos/Decisiones) las instrucciones exactas para que el usuario, desde el Dashboard de Supabase → Authentication → Settings/Policies, active: minimum password length = 8, leaked password protection = on, y un límite de max signup rate por IP.
6. **Verificación de tipos**: `npx tsc --noEmit` sin errores.
7. **Verificación de no regresión**: confirmar que el modo INVITADO (`scores` INSERT anónimo) sigue funcionando exactamente igual — jugar una partida rápida y verificar que el score se guarda sin sesión iniciada.

## Criterios de aceptación

- [ ] La migración `supabase/migrations/<timestamp>_security_hardening.sql` está aplicada al proyecto Supabase (visible en `mcp__supabase__list_migrations`).
- [ ] `mcp__supabase__get_advisors(type: "security")` ya no reporta `anon_security_definer_function_executable` ni `authenticated_security_definer_function_executable` para `public.rls_auto_enable()`.
- [ ] `mcp__supabase__get_advisors(type: "security")` sigue reportando `rls_policy_always_true` (scores INSERT) — aceptado y documentado, no es una regresión.
- [ ] `next.config.ts` responde con los headers `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin` en todas las rutas (verificado con `npm run dev` + inspección de response headers).
- [ ] El spec documenta, como pasos manuales pendientes del usuario en el Dashboard de Supabase, la configuración de: minimum password length (8), leaked password protection (on), y max signup rate por IP.
- [ ] El modo INVITADO sigue permitiendo insertar un score sin sesión iniciada (sin regresión sobre `public.scores`).
- [ ] `npx tsc --noEmit` no reporta errores.

## Decisiones tomadas y descartadas

- **Un solo spec para las 4 áreas del checklist** (tomada, confirmada con el usuario): aunque toca DB/RLS, una función Postgres, configuración de Auth y headers de Next.js, el checklist ya es la unidad de trabajo natural y cada ítem es pequeño — dividir en varios specs habría sido overhead sin beneficio real.
- **La policy `anyone can insert a score` (`WITH CHECK (true)`) se mantiene sin cambios** (tomada, confirmada con el usuario): es intencional para el modo INVITADO (jugar y guardar score sin cuenta). El WARN del linter se acepta como riesgo conocido en vez de agregar validaciones al `WITH CHECK`, para no introducir una decisión de producto (qué constituye un score "válido") fuera del pedido original.
- **Revocar `EXECUTE` de `rls_auto_enable()` en vez de dejarla fuera de alcance** (tomada, confirmada con el usuario): aunque la función no fue creada por nuestras migraciones (es infraestructura ya presente en el proyecto remoto), es un event trigger interno que no tiene motivo para ser invocable vía API pública — revocar `EXECUTE` es una mitigación segura y reversible que no cambia su comportamiento como trigger.
- **Solo los 3 headers del ejemplo del checklist** (tomada, confirmada con el usuario): se descarta agregar `Strict-Transport-Security`/`Permissions-Policy`/CSP en este spec porque requieren decisiones adicionales (max-age, política de permisos) no especificadas en el checklist original.
- **Configuración de Auth (password mínimo, leaked password protection, max signup rate) documentada como paso manual, no ejecutada por código** (tomada, confirmada con el usuario): no existe `supabase/config.toml` en el repo para gestionarlas por migración/CLI, y son ajustes del Dashboard de Auth — mismo patrón que las credenciales OAuth de la spec 15.
- **Solo se revisan advisors de seguridad, no de performance** (tomada, confirmada con el usuario): el checklist se titula explícitamente "checklist de seguridad básico"; performance queda fuera y podría ser un spec aparte si surge la necesidad.
- **Sin tests automatizados** (tomada): consistente con el resto del proyecto, que no tiene test runner configurado.

## Riesgos identificados

- **Password mínimo/leaked password protection/max signup rate no configurados**: hasta que el usuario ejecute el paso manual en el Dashboard, `auth_leaked_password_protection` y los otros dos ítems del checklist siguen sin resolver — el spec deja el código listo pero no puede forzar esa configuración. Mitigado documentando las instrucciones exactas (ver Decisiones/Plan) para que el usuario las aplique cuando pueda.
- **`rls_auto_enable()` podría estar pensada para ser invocada manualmente por algún flujo externo que desconocemos** (por ejemplo, alguna automatización fuera del repo que la llama vía RPC): revocar `EXECUTE` rompería ese flujo. Riesgo bajo — es un patrón de event trigger interno estándar (auto-habilitar RLS en tablas nuevas), no un patrón de función pública típica; se verifica con `get_advisors` tras aplicar el cambio y queda revertible con un `GRANT EXECUTE` si hiciera falta.
- **WARN de `scores` INSERT permanece visible en advisors indefinidamente**: al aceptarse como riesgo conocido, cualquier auditoría futura de seguridad lo volverá a reportar. Mitigado dejándolo documentado explícitamente en este spec como decisión tomada, para que no se interprete como una regresión sin investigar.

## Pasos manuales pendientes (Supabase Dashboard)

Estos ajustes no se gestionan por código en este repo (no hay `supabase/config.toml`) y deben aplicarse manualmente por el usuario en el Dashboard del proyecto:

1. **Minimum password length → 8**
   Dashboard → **Authentication** → **Settings** → sección **Password** → campo `Minimum password length` → establecer en `8` → Guardar.
2. **Leaked password protection → habilitado**
   Dashboard → **Authentication** → **Settings** → sección **Password** → activar el toggle `Leaked password protection` (verifica contra HaveIBeenPwned.org) → Guardar.
3. **Max signup rate por IP → configurar un límite anti-bot**
   Dashboard → **Authentication** → **Settings** → sección **Rate Limits** → campo `Rate limit for sign ups and sign ins` (o equivalente `IP-based rate limits`) → establecer un límite razonable (p. ej. no más de unos pocos signups por IP por hora) → Guardar.

Hasta que estos tres pasos se completen, `mcp__supabase__get_advisors(type: "security")` seguirá reportando `auth_leaked_password_protection`. Esto es esperado y no representa una regresión de este spec.

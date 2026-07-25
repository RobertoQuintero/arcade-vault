---
name: spec-impl-game
description: Implementa un spec de juego aprobado (los que produce /game-impl). Valida que el estado sea "Aprobado", crea la rama del spec, implementa el plan paso a paso con pausas y, al terminar, encadena en serie dos auditorías de solo lectura — skin-designer y luego mobile-porter — sobre el juego recién implementado.
disable-model-invocation: true
argument-hint: <NN-spec-name>
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — Implementador de specs de juego con auditoría post-implementación

## Contexto de sesión

Estado del repo:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles en esta carpeta:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe"`

Config de creación de rama:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, sin archivo de config)"`

---

## Instrucciones

Este comando es una variante de `/spec-impl` especializada en specs de juego (los que produce `/game-impl`, ej. `07-tetris-real`, `08-arkanoid-real`, `10-snake-real`). Las Fases 1–4 son **idénticas** a `/spec-impl`. La diferencia es la **Fase 5**, que se dispara automáticamente al terminar la implementación y encadena dos subagentes de auditoría de solo lectura, **uno después del otro, nunca en paralelo**.

Sigue las cinco fases en orden estricto. **No avances a la siguiente fase si la anterior no se completó correctamente.**

---

### Fase 1 — Identificar el spec

El argumento recibido es: `$ARGUMENTS`

Si `$ARGUMENTS` está vacío:

- Lista los archivos disponibles en `specs/` (ya los tienes arriba).
- Pide al usuario que indique el nombre exacto del spec.
- Detente y espera respuesta. No continúes.

Si `$ARGUMENTS` tiene valor:

- Busca el archivo en `specs/`. El usuario pudo haber escrito el nombre completo (`07-tetris-real`), solo el número (`07`) o solo el slug (`tetris-real`). Intenta encontrar el archivo correcto en cualquiera de esos casos.
- Si no encuentras el archivo, muestra los specs disponibles y pide al usuario que corrija el nombre.
- Si lo encuentras, continúa a la Fase 2.

---

### Fase 2 — Validar el estado del spec

Lee el archivo del spec localizado en la Fase 1 con la herramienta Read o `cat`.

En el contenido, busca la línea que contiene el estado del spec. La etiqueta suele ser `**Estado:**` (español) o `**Status:**` (inglés), pero puede estar en cualquier idioma. Identifícala por posición (línea de estado cerca del inicio del spec) y por la máquina de estados circundante, no por la etiqueta exacta.

**Regla absoluta:** solo puedes continuar si el estado **significa "Aprobado"**, sin importar el idioma usado.

Trata como estado **Aprobado** (y continúa) cualquiera de estos (y sus equivalentes en otros idiomas):

- Español: `Aprobado`
- Inglés: `Approved`
- Portugués: `Aprovado`
- Francés: `Approuvé`
- Alemán: `Genehmigt`
- Italiano: `Approvato`
- …o cualquier otra palabra que claramente signifique "aprobado"

Cualquier otro valor (Draft/Borrador, En revisión/In review, Implementado/Implemented, Obsoleto/Obsolete, o cualquier valor no reconocido) significa **detente** y muestra el mensaje de error de abajo.

| Categoría de estado                                 | Ejemplos (cualquier idioma)                       | Acción                                                                     |
| --------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| Aprobado                                            | `Aprobado`, `Approved`, `Aprovado`, `Approuvé`, … | Continuar a la Fase 3.                                                     |
| Borrador                                            | `Borrador`, `Draft`, …                            | Detener. Mostrar el mensaje de error de abajo.                             |
| En revisión                                         | `En revisión`, `In review`, …                     | Detener. Mostrar el mensaje de error de abajo.                             |
| Implementado                                        | `Implementado`, `Implemented`, …                  | Detener. Mostrar el mensaje de error de abajo.                             |
| Obsoleto                                            | `Obsoleto`, `Obsolete`, …                         | Detener. Mostrar el mensaje de error de abajo.                             |
| Línea de estado no encontrada / valor no reconocido | —                                                 | Detener. El archivo no sigue el formato esperado. Informa esto al usuario. |

Si no estás seguro de si un valor significa "aprobado", **no asumas**. Detente y pide al usuario que aclare o actualice el spec a la redacción canónica.

**Mensaje de error estándar cuando el estado no significa Aprobado:**

```
❌ No puedo implementar este spec.

Estado actual: [ESTADO ENCONTRADO]
Solo trabajo con specs cuyo estado signifique "Aprobado" (p. ej. `Aprobado`, `Approved`,
o el equivalente en otro idioma).

Para continuar tienes dos opciones:
  1. Si el spec está listo para implementarse, ábrelo y cambia el estado
     a "Aprobado" (o el término equivalente que use tu equipo) manualmente.
     Ese cambio lo hace el humano, no el agente.
  2. Si el spec todavía necesita trabajo, usa /spec [nombre] para retomarlo.
```

No ofrezcas alternativas, no sugieras "puedo empezar igual si quieres". El bloqueo es intencional.

---

### Fase 3 — Crear la rama de git y cambiar a ella

Una vez confirmado que el estado significa `Aprobado`:

1. Deriva el nombre de rama del nombre completo del archivo del spec, sin extensión. Formato: `spec-NN-slug`. Ejemplos:

   - `07-tetris-real.md` → rama `spec-07-tetris-real`
   - `10-snake-real.md` → rama `spec-10-snake-real`

2. Lee el flag `AutoCreateBranch` de la config mostrada arriba en el contexto de sesión.

   - Si el archivo de config no existe, falta el valor, o el valor no se reconoce → trátalo como `true` (default).
   - Solo un `false` explícito (en cualquier capitalización) desactiva la creación automática de rama.

   **Si `AutoCreateBranch` es `true` (default):** procede sin preguntar.

   - Si la rama **no existe**: créala con `git checkout -b spec-NN-slug`.
   - Si **ya existe**: informa al usuario que la rama ya existía (puede significar que se retoma trabajo previo).
   - En ambos casos: cambia a la rama con `git checkout spec-NN-slug` y confirma el cambio antes de continuar.

   **Si `AutoCreateBranch` es `false`:** pregunta antes de tocar git. Muestra:

   ```
   AutoCreateBranch está en false.
   ¿Crear y cambiar a la rama spec-NN-slug? [y/N]
   ```

   - Si el usuario responde **sí**: crea/cambia a la rama exactamente como en el caso `true`.
   - Si el usuario responde **no** o deja vacío: **no crees ninguna rama.** Dile al usuario que implementarás en la rama actual (la mostrada en el contexto de sesión) y pide confirmación explícita para continuar ahí. No improvises — espera la respuesta.

3. Confirma visualmente al usuario que el spec está listo y qué rama está activa:

   ```
   ✅ Listo para implementar.

   Spec:   specs/NN-slug.md
   Rama:   spec-NN-slug  (activa)   (← o la rama actual, si no se creó una nueva)
   Estado: Aprobado   (← repite el valor real encontrado en el spec)
   ```

4. **No empieces a implementar todavía.** Primero muestra el resumen del spec al usuario para que lo tenga fresco. Extrae y muestra:
   - El **objetivo** (la línea después de `**Objetivo:**` / `**Objective:**` / equivalente).
   - El **alcance** (la sección `## Alcance` / `## Scope` / equivalente).
   - El **plan de implementación** (la sección con los pasos numerados — `## Plan de implementación` / `## Implementation plan` / equivalente).
   - Los **criterios de aceptación** (el checklist — `## Criterios de aceptación` / `## Acceptance criteria` / equivalente).

Empareja los encabezados de sección por significado, no por redacción exacta — el spec puede estar en cualquier idioma.

---

### Fase 4 — Implementar paso a paso

Después de mostrar el resumen del spec, dile al usuario:

```
Voy a implementar el spec siguiendo exactamente el plan de implementación.
Pausaré después de cada paso para que revises el diff.

¿Empezamos con el Paso 1?
```

Espera confirmación explícita ("sí", "dale", "adelante", o equivalente). No empieces sin ella.

Una vez confirmado, sigue estas reglas durante toda la implementación:

**Una regla por encima de todas:** implementa lo que dice el spec. Si algo del spec te parece subóptimo, menciónalo como observación pero implementa lo acordado. Los cambios al spec van al spec, no al código por sorpresa.

**Ritmo de trabajo:**

- Implementa un paso del plan.
- Muestra un resumen de qué archivos tocaste y qué hiciste.
- Di: `Paso N completado. ¿Puedes revisar el diff y avisarme si continúo con el Paso N+1?`
- Espera confirmación antes de continuar.

**Si durante la implementación encuentras una ambigüedad** que el spec no resuelve:

- Detente.
- Describe la ambigüedad con precisión.
- Presenta dos o tres opciones concretas.
- Espera la decisión del usuario.
- No improvises.

**Si el usuario pide algo fuera del alcance del spec:**

- Recuérdale que está fuera del alcance de este spec.
- Sugiere anotarlo para el siguiente spec.
- No lo implementes en esta rama.

**Al terminar el último paso del plan**, no cierres el flujo todavía — pasa directamente a la Fase 5 (no esperes a que el usuario lo pida).

---

### Fase 5 — Auditorías post-implementación (skin-designer → mobile-porter, en serie)

Esta fase es el diferencial de `/spec-impl-game` frente a `/spec-impl`. Se dispara automáticamente apenas termina el último paso del plan de la Fase 4.

1. **Extrae el `game_id`** del juego recién implementado: es el campo `id` de la fila `games` descrito en el spec (Modelo de datos / metadatos), el mismo slug usado en la URL `/games/<id>`.

2. Anuncia al usuario:

   ```
   ✅ Todos los pasos del plan están implementados.

   Ahora ejecuto dos auditorías de solo lectura sobre "<game_id>", una después de la otra:
     1. skin-designer — verifica las 3 skins obligatorias (clasico/neon/retro).
     2. mobile-porter — verifica el layout táctil/móvil del reproductor.

   Ninguna de las dos escribe código; sus hallazgos quedan para implementación posterior.
   ```

3. **Paso 1 — lanza el agente `skin-designer`** (Agent tool, `subagent_type: skin-designer`) pidiéndole que audite el juego `<game_id>`. **Espera su informe completo antes de continuar** — no lo lances en paralelo con el siguiente paso.

4. Muestra el informe de `skin-designer` al usuario.

5. **Paso 2 — solo después de recibir el informe de `skin-designer`**, lanza el agente `mobile-porter` (Agent tool, `subagent_type: mobile-porter`) pidiéndole que audite el mismo juego `<game_id>`.

6. Muestra el informe de `mobile-porter` al usuario.

7. Cierra con:

   ```
   Siguiente paso: verifica los criterios de aceptación del spec uno por uno.
   Si todos pasan, actualiza el estado del spec a "Implementado" (o el equivalente
   en el idioma de tu repo) y haz el commit final antes de mergear esta rama.

   Los hallazgos de skin-designer y mobile-porter (si los hay) son trabajo aparte —
   este comando no los implementa.
   ```

---

## Resumen del comportamiento esperado

```
/spec-impl-game 07-tetris-real

  Fase 1  →  Encuentra specs/07-tetris-real.md
  Fase 2  →  Lee el estado → "Aprobado" → ✅ continúa
  Fase 3  →  git checkout -b spec-07-tetris-real → git checkout spec-07-tetris-real
             Muestra objetivo, alcance, plan y criterios
  Fase 4  →  Implementa paso a paso con pausas
  Fase 5  →  Lanza skin-designer sobre "tetris", espera su informe
             Luego (no antes) lanza mobile-porter sobre "tetris", espera su informe
             Muestra ambos informes y recuerda verificar criterios de aceptación

/spec-impl-game 02-powerups  (estado: Borrador)

  Fase 1  →  Encuentra specs/02-powerups.md
  Fase 2  →  Lee el estado → "Borrador" → ❌ detiene
             Muestra el mensaje de error estándar
             No crea rama, no toca código, no llega a la Fase 5
```

**La creación de rama se controla con el flag `AutoCreateBranch`** en `specs/.spec-config.yml`, igual que en `/spec-impl`. Por defecto es `true`.

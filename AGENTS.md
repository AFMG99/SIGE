# AGENTS.md

Guía operativa única para colaboradores humanos e inteligencias artificiales que trabajan en SIGE. Lee esto antes de escribir código. Si algo aquí contradice el código, **el código manda** — actualiza este archivo.

> SIGE — Sistema de Información para la Gestión Energética del Tecnológico de Antioquia. Implementa la Resolución UPME 0016 de 2024 (líneas base energéticas, ajustes de ahorro) sobre facturas EPM, inventario de equipos eléctricos y variables operativas. Proyecto de grado (TDG); 22 historias de usuario (HU-01..HU-22) trackeadas como issues de GitHub.

---

## Stack y convenciones del repo

| Capa | Tecnología | Nota |
|---|---|---|
| Framework | Next.js **14** App Router | `src/app/`; **no usar Edge Middleware** (Vercel Services lo rechaza) — guards en layouts/páginas server |
| Lenguaje | TypeScript **strict** | `tsc --noEmit` en CI |
| ORM / BD | Prisma 5 + PostgreSQL (Neon) | Regenerar cliente: `npm run db:generate` (NO existe `npm run prisma:generate`) |
| Estilos | **Tailwind v4 CSS-first** | Tokens en `src/app/globals.css` (`@theme`); **no existe `tailwind.config`** |
| Validación | Zod | Re-validar SIEMPRE en servidor |
| Auth | `jose` (JWT) + `bcryptjs` cost 12 | 2FA: `otplib` + `qrcode` |
| Deploy | Vercel | 2 servicios: `app` (Next) + `engine` (Python LBEn), binding `LBEN_URL` |
| Alias de import | `@/*` → `./src/*` | En app, tests y Storybook |
| i18n | **No hay** — UI en español (Colombia) hardcodeado | `<html lang="es">`; no introducir librería i18n sin decisión explícita |
| Lint | ESLint inline en `package.json` | No hay Prettier — imitar el estilo del archivo vecino |

**Scripts clave**: `npm run validate` (= lint + typecheck + test + build + build-storybook) — gate obligatorio antes de cada commit/PR. En Windows puede crashear con exit `-1073740791` (libuv cosmético de Storybook); verificar con `npm run lint` + `npm run typecheck` por separado si pasa eso.

**Commits**: convencionales (`feat:` `fix:` `refactor:` `chore:` `docs:` `test:` `ci:`), **en inglés**, **sin atribución IA**. Ver `GIT_WORKFLOW.md` para el flujo completo (git-flow, squash merge, HU↔issue).

---

## 🎨 Diseño

### Paleta de marca (`uv-*` en `globals.css`)

| Token | Hex | Rol |
|---|---|---|
| `uv-forest` | `#00652e` | **Acciones primarias** (AA sobre blanco) |
| `uv-lime` | `#92bd24` | **Solo decorativo + focus rings** |
| `uv-ink` | `#211915` | Texto principal (casi negro) |
| `uv-mid` | `#afafb4` | Gris medio |
| `uv-sky` | `#82c7e6` | Azul claro |
| `uv-soft` | `#46b258` | Verde suave |
| `uv-turquoise` | `#45a78f` | Turquesa |
| `uv-deep` | `#1d4851` | Azul oscuro |
| `uv-purple` | `#7357c1` | Púrpura |
| `uv-yellow` | `#d7db4d` | Amarillo suave |

### Reglas duras de color

- **`emerald-500` (lime) NUNCA en texto, botones ni controles** — es decorativo. Para acciones y texto verde usar `emerald-600+` (forest). `emerald-500` solo para focus rings y elementos decorativos.
- **Superficies oscuras: solo `slate-*`** (`dark:bg-slate-900`, `slate-950`). No usar `gray`/`neutral` oscuros.
- El modo oscuro se hereda automáticamente al adoptar las primitivas `ui-*` (tokens dark dentro de los componentes). Tema en `localStorage['uv-theme']`; helpers en `src/shared/utils/theme.ts`.

### Primitivas `ui-*` (capa componentes en `globals.css`)

Usar estas clases directamente en JSX — **no** recrear botones/paneles/inputs desde cero:

- Paneles: `.ui-panel` (2xl), `.ui-card` (xl), `.ui-card-stat`
- Botones: `.ui-btn` + **exactamente uno** de `-primary | -secondary | -accent | -ghost | -danger | -danger-outline | -sm`
- Formularios: `.ui-field` (label→control gap), `.ui-label`, `.ui-input`, `.ui-input-error`
- Feedback: `.ui-callout` + `-info | -warn | -danger | -success`, `.ui-empty`, `.ui-stat`
- Tablas: `.ui-table-shell` / `.ui-table` (colores de estado de fila en JSX)
- Texto: `.ui-title` (semibold ink), `.ui-muted`
- Focus: **siempre** `.focus-ring` (ring-uv-lime). En superficies `.chrome-forest`: ring sin offset.
- Radio: 2xl = página · xl = card · lg = input/botón · md = control pequeño
- Spacing: stack mayor `space-y-6` · inner `space-y-4` · helper/error `mt-1`

### Responsive

- Matriz de viewports Storybook: **320 / 375 / 768 / 1024 / 1280 / 1920** — verificar toda UI nueva en todos.
- Targets táctiles ≥ 40px bajo `lg` (`.ui-btn-sm` ya tiene `min-h-10`).
- Tests responsive en `src/**/*.responsive.test.tsx` (sin overflow horizontal, targets ≥40px). **Nunca bajar umbrales para que pasen.**

### Componentes React compartidos (`src/shared/views/ui/`)

`ConfirmDialog` (portal + focus trap + ESC, variant `destructive|primary`), `ToastProvider` (`useToast()`, variants `success|error|info`, auto-dismiss 4s), `ListboxSelect`, `DropdownMenu`, `Avatar`, `Skeleton`. **No hay Radix/shadcn** — son implementaciones propias sobre `ui-*`. Para la mayoría de superficies, usar las clases CSS directamente, no un componente wrapper.

### Gráficos compartidos (`src/shared/views/charts/`)

**SVG propio, sin librería de charts** (decisión explícita del proyecto; recharts/chart.js no). Exportados desde `@/shared/views/charts`:

- `SeriesChart` — área/línea con 2+ series, curvas monotonas (Fritsch–Carlson), gradiente, crosshair + tooltip, leyenda toggle (`aria-pressed`), teclado ←/→/Esc, `useReducedMotion`, huecos por `null` (nunca interpola), estado vacío `.ui-empty`.
- `BarList` — barras horizontales valor + delta (`role="meter"`). Semántica: `deltaPositivoEsBueno` (default `true`; consumo/costo → `false`, un alza se pinta rose).
- `Sparkline` — miniárea decorativa (`aria-hidden` por defecto).
- `curvas.ts` — puro, con tests unit (`curvas.test.ts`).

Fixtures, stories con play tests y `__responsive__/charts.responsive.test.tsx` viven junto a los componentes. Para dashboards/paneles nuevos, usar estos en vez de SVG ad-hoc.

---

## 🏗️ Arquitectura

```
src/
├── app/                  # Rutas (thin). Páginas server con guard → props a vista client
│   ├── api/              # Route handlers → delegan a controllers
│   ├── dashboard/        # Páginas autenticadas (server components)
│   └── globals.css       # Tokens + primitivas ui-*
├── features/<modulo>/
│   ├── controllers/      # Server actions ('use server') + handlers API
│   ├── models/           # Zod schemas + catálogos + constantes de dominio
│   └── views/            # Componentes client ('use client'), props-driven
│       ├── __stories__/  # Storybook (tags: ['ai-generated'], play tests)
│       ├── __fixtures__/ # Datos demo deterministas
│       ├── __mocks__/    # Doubles de server actions (aliased en .storybook/main.ts)
│       └── __docs__/
└── shared/
    ├── models/           # prisma, auth, authz, permissions, jwt, audit, 2FA*
    ├── hooks/, utils/, views/ (shell, nav, ui/)
```

**Capas (inviolables):**
1. `page.tsx` (server) = guard de auth → queries Prisma → props serializables. **Sin lógica de negocio ni estado client.**
2. `controllers/` = permisos + Zod + transacciones + audit. Retornan `{ estado: 'ok'|'error', mensaje?, ... }` (server actions) o `{ message }` + status (REST).
3. `models/` = fuente única de schemas Zod, catálogos (`CATALOGO_EDIFICACIONES`) y constantes compartidas por UI + server + Storybook.
4. `views/` = client components, **todo dato entra por props**.

**Referencia viva**: `src/features/datos/` es el módulo completo bien hecho — copiar su patrón.

---

## 🔒 Seguridad y roles (innegociables)

- **Fuente única**: `src/shared/models/permissions.ts` (roles, módulos, matriz, labels). Guards en `src/shared/models/authz.ts`.
- **Roles** (enum Prisma): `ADMIN_TI`, `GESTOR_ENERGETICO`, `COORD_INFRAESTRUCTURA`, `DIRECTIVO`, `COMUNIDAD_UNIVERSITARIA`.
- **Módulos** (`ModuleId`): `users`, `consumption`, `estimates`, `plans`, `inventory`, `reports`.
- **Gate de acciones**: `canWithOverrides(user, module, action)` — matriz estática primero, luego `UserPermissionOverride` de BD. El módulo `users` **nunca** acepta overrides.
- **El check SIEMPRE es server-side** en cada página y cada API route. Ocultar links en la UI es cosmético, no seguridad.
- **El rol SIEMPRE se lee de BD** (`getCurrentUser`), nunca del JWT (riesgo de enum desactualizado).
- **2FA policy** (`twoFactorPolicy.ts`): obligatoria para `ADMIN_TI` + `GESTOR_ENERGETICO`; opcional el resto. Rate limit en BD: 5 intentos → lock 15 min (fail-closed).
- **Audit**: `logAudit()` en TODA mutación admin (`user.create`, `user.suspend`, ...); `auditarAccion()` en mutaciones de energía.
- **Secrets**: solo en GitHub Secrets / env de Vercel / `.env` local (gitignored). Nunca en el repo. `JWT_SECRET` y `TOTP_ENCRYPTION_KEY` requeridos en producción.

---

## 🔌 API y validación

- **REST** (`src/app/api/**/route.ts`): thin — `export async function POST(req) { return controller(req) }`.
- **Server actions** (`'use server'` en `features/*/controllers/`): para mutaciones desde client.
- **Validación**: `schema.safeParse(body)` SIEMPRE en servidor. On failure: `{ message: 'Datos inválidos', errors }` + 400.
- **Errores REST**: `{ message: string }` (español) + status (400/401/403/404/409/500).
- **Éxito REST**: `{ user: {...}, total, page, pageSize }` (fechas `.toISOString()`).
- **Server actions**: discriminated `{ estado: 'ok'|'error', mensaje?, ... }`.
- **Paginación**: `page` (≥1), `pageSize` (1..100, default 25), `sort` whitelist + `order`. Búsqueda: `contains` case/accent-insensitive multi-campo.
- **Bulk**: `/api/users/bulk` con `{ action, ids, role? }`, self-protection (admin no actúa sobre su propio id), audit por target.
- **Import**: `MAX_FILAS_POR_IMPORTACION = 5000`, transacciones upsert, flujo de confirmación de conflictos.

---

## ⚡ Dominio energético (conceptos, no fórmulas)

- **Entidades**: `Edificacion` (tipo catálogo) → `Bloque` (código único, `factorInfraestructura`) → `Espacio` / `EquipoElectrico` (HVAC/ILUMINACION/OFICINA/MOTORES). `FacturaEnergia` period-scoped (`periodo` `YYYY-MM`, unique `[periodo, edificacionId]`). `VariableOperativa` (población, días clase, GDE; unique `[bloqueId, mes, ano]`).
- **LBEn** (`LineaBaseEnergia`, unique `[bloqueId, tipo]`, upsert-only): 4 modelos — `VALOR_ABSOLUTO`, `COCIENTE`, `REGRESSION_ESTADISTICA`, `CONFORT_THERMAL`. Motor Python en `python/lben/` invocado via CLI desde server actions (`features/datos/`). Constantes espejo en `features/datos/models/lineasBase.ts`.
- **Normalización facturas**: `ConsumoNorm = (Consumo / DíasPeriodo) × 30`.
- **Regulatorio mínimo**: min 36 meses datos, outliers ±10%, p-value 0.05, MAPE ≤5%. Detalle de fórmulas → `docs/modelos_lben_y_formulas_ahorro-v2.md`. Resolución completa → `docs/resolucion_upme_0016_2024.md`.
- **Catálogo edificaciones**: `RESIDENCIAL_UNIFAMILIAR`, `EDUCATIVO_CAMPUS`, `OFICINA_PUBLICA` (`requiereBloque` controla los formularios dinámicos).
- **DB**: sin soft-delete (borrados duros, "suspender" via `status = INACTIVE`). `FacturaEnergia → Edificacion` usa `Restrict` (la BD nunca borra facturas en cascada; el app bloquea con mensaje amigable). Tablas `snake_case @@map`, ids CUID, constraints únicos en claves naturales.

---

## ✅ Checklist: módulo nuevo en 7 pasos

1. **Registrar el módulo**: añadir a `MODULES` en `shared/models/permissions.ts` + filas en `PERMISSIONS` (+ `ACTION_TEXT`/`ACTION_LABELS`); icono/href en `ModuleNav.tsx`; ruta `src/app/dashboard/<modulo>/page.tsx` con guard `requireModuleAccess('<modulo>')`.
2. **Feature folder**: `src/features/<modulo>/{controllers,models,views}` siguiendo las capas.
3. **BD**: extender `prisma/schema.prisma` (`@@map` snake_case, CUID, unique en claves naturales, `Restrict` donde el borrado debe bloquearse). Actualizar seed si aplica. `npx prisma db push` en Neon si cambia el schema.
4. **Seguridad**: `canWithOverrides` server-side en cada mutación; `logAudit`/`auditarAccion`; nunca confiar en validación del cliente.
5. **UI**: primitivas `ui-*` + tokens de marca (`emerald-600` para primario, `slate-*` para superficies oscuras, `.focus-ring`, radius ladder). Verificar en todos los viewports Storybook; targets ≥40px bajo `lg`.
6. **Tests**: `__fixtures__` + `__stories__` con `play` interaction tests; unit tests `*.test.ts` para lógica pura; responsive test si hay chrome/layout nuevo.
7. **Validar**: `npm run validate` verde local → commit convencional en inglés → PR contra `develop` con HU/issue correlacionado.

---

## 💻 Comandos útiles

### Scripts reales (`package.json`)

```bash
npm run dev            # Next dev (localhost:3000)
npm run build          # Build producción
npm run lint           # next lint
npm run typecheck      # tsc --noEmit
npm run test           # vitest run (unit + node)
npm run test:storybook # Tests de interacción (play) en Storybook
npm run test:responsive# Tests responsive (overflow, touch targets)
npm run validate       # lint + typecheck + test + build + build-storybook  ← GATE
npm run db:generate    # prisma generate (regenerar cliente tras tocar schema)
npm run db:push        # prisma db push (schema → Neon; NO usa migrate)
npm run db:studio      # Prisma Studio (GUI de BD)
npm run storybook      # Storybook en :6006
```

### Gotchas de Windows (acumulados en este repo)

- **`npm run prisma:generate` NO existe** — el script es `npm run db:generate` (o `npx prisma generate`).
- **EPERM al hacer `prisma generate`**: si `next dev` está corriendo, Windows bloquea `query_engine-windows.dll.node`. Fix: cerrar procesos node → `npm run db:generate` → limpiar los `*.tmp*` que deje.
- **`npm run validate` puede crashear con exit `-1073740791`** (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`) después del build de Storybook — es cosmético de libuv, NO un fallo del código. Fallback: `npm run lint` + `npm run typecheck` por separado (y `npm run test` si hace falta).
- **PowerShell se come `$var` en `node -e "..."`**: usar comillas simples o escribir un archivo `.cjs` temporal y ejecutar `node archivo.cjs`.
- **Neon free tier** suspende el compute tras ~5 min inactivo → error `Can't reach database server`. Localmente solo hay que reintentar (Vercel serverless crea cliente fresco). `DATABASE_URL` ya incluye `connection_limit=5&pool_timeout=10`.
- **`sharp-cli`**: flags globales, no hay subcomando `webp` — `npx sharp-cli -i in.jpg -o out.webp --format webp --quality 70`.

### Prisma — reglas

- **`db push`, no `migrate`**: el schema vive en sincronía con Neon (`migrate diff` = "No difference"). Tras cambiar `schema.prisma`: `npm run db:generate` (cliente) + `npm run db:push` (BD).
- Si un endpoint da **500 con columna inexistente** en Neon → falta `db push`; las columnas nuevas no llegan solas.

---

## 📝 Mantenimiento del informe TDG

`docs/Plantilla_TDG_Desarrollo_SW_InformeTecnico.md` es un entregable académico vivo que debe reflejar siempre el estado real del proyecto. Sincronizarlo es parte de la Definition of Done. Reglas:

- **HU nueva** → fila nueva en la **sección 7.2** (Backlog), con los puntos y el estado actuales.
- **HU que cambia de estado** (`estado:pendiente` → `en-progreso` → `completado` en GitHub) → actualizar su fila en la **7.2** y la narrativa + fila de la tabla de la revisión del sprint correspondiente (**8.1.2** = Sprint 1, **8.2.2** = Sprint 2).
- **Bug corregido o funcionalidad añadida sobre una HU ya completada** (issues cerrados después de que la HU marcó `completado`) → **no reescribir** la narrativa original: añadir una nota de revisión fechada (`**Nota de revisión (dd de mes de año).**`) en la revisión del sprint de su módulo (8.1.2 para carga de datos, 8.2.2 para HU-04/05/07 y LBEn) + fila «Correcciones posteriores» en la tabla de ese sprint. Respetar el mapeo 1:1 con issues de GitHub.
- **Afirmación ya falsa** (p. ej. «2FA sin implementar», «middleware») → corregirla en su sitio con grep: el informe nunca debe contradecir al código. Antes de asumir que un hallazgo es nuevo, buscar el texto con `grep -n` y verificar contra el código/`gh`.
- Estados espejo de los labels de GitHub: `estado:pendiente` → Pendiente · `estado:en-progreso` → En progreso · `estado:completado` → Completado.

---

## 📌 Issues y Project

El tablero **SIGE** (GitHub Projects v2: `github.com/users/AFMG99/projects/5`) es el espejo del avance. Reglas para toda tarea o corrección derivada de una HU:

- **Abrir la issue antes de codificar**: `[TASK]` o `[BUG]` con labels `sub-task`, `estado:pendiente`, el módulo (`m1-*`…`m6-*` o `usuarios-permisos`) y el sprint; vincularla como **sub-issue** de su HU (Parent issue en el board). Si el trabajo ya se hizo sin issue, crearla retroactivamente con los SHAs en el cuerpo (referencia #56–#58).
- **Asignación**: la issue y el item del board van **asignados al colaborador que asume el trabajo** (`Assignees` del board es un espejo de la asignatura de la issue).
- **Campos del board al abrir**: `Size` (T-shirt) y `Estimate` en story points alineados (**XS=1 · S=2 · M=3 · L=5 · XL=8**), `Start date` y `Target date` reales, `Priority` (P0/P1/P2).
- **Estados espejo**: label `estado:*` ↔ campo `Status` (`estado:pendiente`→Backlog, `estado:en-progreso`→In progress, `estado:completado`→Done). **`Status=Done` cierra automáticamente la issue** (campo Status integrado de GitHub): al terminar el trabajo, mover el Status a Done y verificar el label `estado:completado`.
- **Trazabilidad**: los commits/PRs que implementan la issue deben mencionarla (`Ref #N` / `Closes #N`) o documentar los SHAs en el cuerpo de la issue. Las correcciones sobre HU completadas también se registran en el informe TDG (sección anterior).

---

## 📚 Docs relacionados

- `GIT_WORKFLOW.md` — flujo git completo, ramas, Dependabot, secrets, staging/production.
- `README.md` — quick start y scripts.
- `docs/modelos_lben_y_formulas_ahorro-v2.md` — fórmulas LBEn con atribuciones.
- `docs/resolucion_upme_0016_2024.md` — resolución regulatoria.
- `docs/Resumen_Ejecutivo_Linea_base_edificaciones_y_oficinas.md`.

---

## 🔑 Lee esto primero (5 archivos)

1. `src/app/globals.css` — todos los tokens de diseño y primitivas.
2. `src/shared/models/permissions.ts` + `authz.ts` — matriz de roles/permisos y guards.
3. `prisma/schema.prisma` — modelo de datos completo.
4. `src/features/datos/` — referencia viva del patrón de módulo completo.
5. `GIT_WORKFLOW.md` — proceso de ramas, commits y PRs.

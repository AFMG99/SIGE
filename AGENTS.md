# AGENTS.md

Guía operativa única para colaboradores humanos e inteligencias artificiales que trabajan en SIGE. Lee esto antes de escribir código. Si algo aquí contradice el código, **el código manda** — actualiza este archivo.

> SIGE — Sistema de Información para la Gestión Energética del Tecnológico de Antioquia. Implementa la Resolución UPME 0016 de 2024 (líneas base energéticas, ajustes de ahorro) sobre facturas EPM, inventario de equipos eléctricos y variables operativas. Proyecto de grado (TDG); 22 historias de usuario (HU-01..HU-22) trackeadas como issues de GitHub.

---

## Stack y convenciones del repo

| Capa | Tecnología | Nota |
|---|---|---|
| Framework | Next.js **14** App Router | `src/app/`; **no usar Edge Middleware** (Vercel Services lo rechaza) — guards en layouts/páginas server |
| Lenguaje | TypeScript **strict** | `tsc --noEmit` en CI |
| ORM / BD | Prisma 5 + PostgreSQL (Neon) | `npx prisma generate` (NO existe `npm run prisma:generate`) |
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

# Informe de rediseño UI/UX y rendimiento — SIGE

> **Fecha**: 2026-10-14 · **Rama**: `feat/ui-redesign` (7 commits, sin push) · **Base**: `702bae6` (`main`)
> Incremento ejecutado con ODD por fases (Fase 1 auditoría → Fase 5 validación). Documento vivo en `odd/tasks/sige-ui-redesign.md`.

---

## 1. Estado inicial y principales problemas

Auditoría Fase 1 (2 exploradores + build baseline de línea base):

- **Shell de navegación inconsistente**: chrome, estados de foco y levels de heading variables entre módulos; `SidebarNav` y `MobileNavDrawer` sin estados a11y uniformes.
- **Dashboard inicial sin identidad**: lista plana de links; el resumen energético no estaba gateado por permiso en el servidor.
- **`users` y `datos` fuera del sistema `ui-*`**: foco ad-hoc (`ring-emerald-500`), callouts y botones implementados desde cero en vez de usar `.ui-btn`/`.ui-callout`/`.ui-table-shell`.
- **Ruta `/dashboard/datos` = 345 kB First Load JS** (la más pesada; el resto 87–149 kB): SheetJS (~110 kB gzip) empaquetado eager aunque solo se usa detrás de un switch de sección.
- **`potenciaTotalKw` cargaba todas las filas de `equipos_electricos`** en memoria para sumar un número.

## 2. Mejoras visuales e interactivas implementadas

| Área | Mejora |
|---|---|
| **Shell (T2)** | Chrome unificado con primitivas `ui-*`; estados de foco/aria en `SidebarNav` y `MobileNavDrawer`. |
| **Home (T3)** | `/dashboard` como vista de inicio con identidad de marca; tarjetas de módulo gateadas por `canWithOverrides`; resumen energético gateado en servidor (solo `consumption`). |
| **users (T4)** | Focus → `.focus-ring`; callouts → `ui-callout-warn`; botones → `ui-btn-danger-outline`/`ui-btn-accent`; tabla → `ui-table-shell`. |
| **datos (T5)** | 6 swaps de foco ad-hoc → `.focus-ring` (0 `focus:ring-emerald` restantes en `src/`). |
| **datos rendimiento (T6)** | `potenciaTotalKw` vía agregación SQL (`$queryRaw` SUM). |
| **datos bundle (T7)** | 5 secciones bajo demanda con `React.lazy` + `SectionSkeleton` (3 importadores XLSX, `LineasBase`, `AjustesSection`). |

Ninguna funcionalidad se eliminó ni cambió de comportamiento (más allá del fallback de carga en lazy loading).

## 3. Módulos y archivos modificados

**33 archivos en `src/` (+1499 / −172)**, 7 commits convencionales:

| Commit | Descripción |
|---|---|
| `7498a55` | Shell: chrome unificado + a11y |
| `2a61ae3` | Shell: corrección de headings/chrome (verificado) |
| `358bab5` | Home: vista de inicio gateada |
| `d062de6` | users: design compliance |
| `84fec5f` | datos: focus-ring compliance |
| `ae9efa5` | datos: potencia vía SQL + test regresión |
| `c2b53d0` | datos: code-split secciones bajo demanda |

**Archivos clave** (lista completa: `git diff --name-status 702bae6..HEAD -- src/`):

- `src/shared/views/`: `DashboardShell.tsx`, `DashboardHome.tsx` (nuevo), `ModuleNav.tsx`, `ModulePlaceholder.tsx`, `DashboardHeader.tsx`, `MobileNavDrawer.tsx`, `SidebarNav.tsx`
- `src/app/`: `dashboard/page.tsx`, `dashboard/datos/page.tsx`, `globals.css`
- `src/features/users/views/`: `CountryPhoneInput`, `PermissionMatrixModal`, `UserDrawer`, `UserTable`, `detail/SecurityTab`, `twofa/BackupCodesDisplay`, `settings/tabs/*`
- `src/features/datos/views/`: `DatosContent`, `GestionFacturas`, `ImportadorEquipos/Facturas/Variables`, `VistaDatos`, `SectionSkeleton.tsx` (nuevo)
- **Tests/stories nuevos**: `dashboardHome.responsive.test.tsx`, `datosPage.responsive.test.tsx`, `DashboardHome.stories.tsx`, `DashboardShell.stories.tsx`

## 4. Optimizaciones de rendimiento y justificación

1. **Agregación SQL (T6)** — `findMany` sin límite + `reduce` JS → `$queryRaw` con `COALESCE(SUM("potenciaNominal" * cantidad), 0)`. *Justificación*: la query traía todas las filas de equipo a memoria para derivar un único número; ahora una sola agregación en BD devuelve el total. Semántica idéntica (suma global sin filtro, consistente con el count global). Columnas verificadas contra el esquema (`equipos_electricos`, `potenciaNominal` Float camelCase, `cantidad` Int).
2. **Code splitting (T7)** — 5 secciones montadas solo detrás de switch de sección/modo pasan a `React.lazy` + `Suspense` con `SectionSkeleton` (altura estable). *Justificación*: SheetJS (~110 kB gzip) y las calculadoras solo se usan bajo demanda; cargarlos eager penalizaba el primer paint de toda la ruta. `React.lazy` en lugar de `next/dynamic` por compatibilidad con el optimizer de Vitest (evita dual React copies).

*LCP/INP y latencia Neon/Vercel*: no medibles en local (declarado desde la auditoría; requiere Vercel/Neon en producción).

## 5. Métricas antes y después

| Métrica | Antes (baseline Fase 1) | Después | Δ |
|---|---|---|---|
| `/dashboard/datos` First Load JS | **345 kB** | **169 kB** | **−176 kB (−51 %)** |
| Datos transferidos por `potenciaTotalKw` | todas las filas de equipo | 1 fila (SUM en BD) | −O(filas) |
| Tests vitest | 317 | 319 | +2 (test de regresión T6) |
| Tests Storybook | — | 107 | — |
| `focus:ring-emerald` en `src/` | varios | **0** | ✓ |

## 6. Pruebas ejecutadas y resultado

| Prueba | Resultado |
|---|---|
| `npm run lint` | ✓ (solo warnings preexistentes: `<img>`, hooks) |
| `npm run typecheck` | ✓ (0 errores TS) |
| `npm run test` | ✓ **319 passed / 6 skipped** (29 archivos) |
| `npm run test:storybook` | ✓ **107 passed** (20 archivos) |
| `npm run build` | ✓ Compiled successfully |
| `npm run build-storybook` | ✓ Storybook build completed successfully |
| `npm run validate` (gate completo) | ✓ EXIT 0 |

**Nota Windows**: `validate` puede fallar en `build-storybook` con `ENOENT pages-manifest.json` (bloqueo transitorio de archivos entre `next build` y `build-storybook`, ambos usan `.next`). No es fallo del código; `build-storybook` pasa en aislamiento. Patrón ya conocido del repo (junto al crash `-1073740791` de libuv).

## 7. Problemas detectados que permanecen pendientes

- **`analisis`**: solo tiene colores semánticos de dominio (indigo/amber). El prompt prohíbe tocarlos sin decisión explícita del usuario.
- **`reportes` / `alertas` / `estimaciones` / `espacial`**: son `ModulePlaceholder` (features pendientes); no hay UI que rediseñar hasta que se implementen.
- **HU-04 y HU-07**: siguen «En progreso» hasta prueba funcional aprobada. Los cambios del rediseño no las cierran por sí solos.

## 8. Riesgos o cambios que requieren aprobación adicional

- **Push / issues / PRs**: los 7 commits están sin push; la issue del incremento no se abrió (regla issue-first). Requiere autorización explícita antes de tocar GitHub.
- **Colores de dominio (`analisis`)**: indigo/amber portan significado semántico; cualquier armonización con la paleta `uv-*` requiere decisión explícita.
- **Esquema Prisma / auth / autorización / auditoría**: no se tocaron (verificado). Cualquier cambio futuro sobre estas capas requiere aprobación.

## 9. Próximos pasos priorizados por impacto

1. **Autorizar push** de los 7 commits + abrir la issue del incremento + PRs *stacked-to-main* (PR1=`T2` … PR7=`T8`, en orden).
2. **Validación funcional manual en Vercel/Neon**: los gates locales no cubren latencia real ni SSR contra BD viva (Neon free tier suspende compute; retry en local).
3. **Decidir sobre `analisis`** (colores de dominio) y el roadmap de los placeholders (`reportes`, `alertas`, `estimaciones`, `espacial`).
4. **Medir LCP/INP reales en producción** (Vercel Analytics o Lighthouse) — no medible en local.

---

*Informe generado como parte de T8 (Fase 5) del incremento ODD `sige-ui-redesign`. Fuente de verdad del trabajo: `odd/tasks/sige-ui-redesign.md`.*

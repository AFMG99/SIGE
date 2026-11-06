# Trazabilidad de cambios — SIGE

**Generado:** 2026-11-06 · **Rama de referencia:** `develop@7872234`
**Alcance:** todos los cambios entregados en el repositorio, con su rama, commit, PR e issue de origen.
**Regeneración:** ver la sección 6.

---

## 1. Estado de las ramas

| Rama | Rol | Último commit | Fecha | Estado frente al remoto |
|---|---|---|---|---|
| `main` | producción | `3de0221` | 2026-11-04 | sincronizada con `origin/main` |
| `develop` | integración | `7872234` | 2026-11-06 | +36 commits sobre `origin/develop` |
| `feat/espacial-modelo-arquitectonico` | módulo espacial (PR #161) | `24af5de` | 2026-11-06 | sincronizada; ya integrada en `develop` |
| `feat/issue-150-151-espacial` | módulo espacial (PR #156) | `a4cadb2` | 2026-11-02 | entregada por squash merge |
| `fix/issue-152-anexo4` | LBEn (PR #153) | `f71a727` | 2026-11-02 | entregada por squash merge |
| `fix/issue-158-storybook-date-tests` | tests (PR #159) | `1b4c492` | 2026-11-02 | entregada por squash merge |
| `feat/issue-147-arima` | estimaciones (PR #154) | `8668cfa` | 2026-11-02 | entregada por squash merge |
| `feat/issue-21-23-reportes` | reportes (PR #155) | `3a60822` | 2026-11-02 | entregada por squash merge |

`main` ⊆ `develop`: `develop` contiene todo el historial de `main`.
Historial total: **194 commits en `develop`**, 42 PRs fusionados.

> **Nota sobre ramas squash-mergeadas.** Cuando un PR se fusiona con *squash*, sus commits
> originales no aparecen en el historial de `develop` aunque su contenido sí esté integrado.
> Por eso ramas como `fix/issue-152-anexo4` muestran commits "no presentes" en `develop`:
> no son trabajo sin entregar.

---

## 2. Iteración actual (2026-11-06): módulo espacial → `develop`

- **Merge:** `7872234` (`--no-ff`, sin squash para conservar la granularidad)
- **Rango:** `origin/develop..develop` — **13 archivos, +2058 / −6** (10 añadidos, 3 modificados)
- **Origen:** `feat/espacial-modelo-arquitectonico`, 35 commits + merge
- **Verificación:** typecheck limpio; 22 tests de `vistaInterior.test.ts` en verde

### 2.1 Archivos afectados

| Archivo | Tipo | Contenido |
|---|---|---|
| `prisma/schema.prisma` | M | 3 tablas nuevas + enum `EstadoModeloArquitectonico` (aditivo) |
| `src/app/api/espacial/modelos/route.ts` | A | API de listado/creación de modelos |
| `src/app/api/espacial/modelos/[modeloId]/partes/[indice]/route.ts` | A | Carga/descarga de fragmentos GLB |
| `src/app/api/espacial/modelos/[modeloId]/finalizar/route.ts` | A | Finalización de carga fragmentada |
| `src/app/api/espacial/modelos/[modeloId]/elementos/route.ts` | A | Asociación nodo ↔ espacio |
| `src/app/api/espacial/modelos/[modeloId]/energia/route.ts` | A | Consumo estimado por espacio |
| `src/app/dashboard/espacial/page.tsx` | A | Página server con guard de permisos |
| `src/features/espacial/views/EspacialDashboard.tsx` | M | Integración de la pestaña de modelo |
| `src/features/espacial/views/ui/ModeloArquitectonicoPreview.tsx` | M | Visor GLB + control de cámara interior |
| `src/features/espacial/views/ui/AsociacionEspacioModelo.tsx` | A | UI de asociación nodo-espacio |
| `src/features/espacial/views/ui/EnergiaEspacioModelo.tsx` | M | Panel energético del nodo |
| `src/features/espacial/views/ui/vistaInterior.ts` | A | Geometría pura de la vista interior |
| `src/features/espacial/views/ui/vistaInterior.test.ts` | A | 22 tests unitarios |

### 2.2 Commits de la iteración

| Commit | Fecha | Mensaje |
|---|---|---|
| `7872234` | 2026-11-06 | Merge branch 'feat/espacial-modelo-arquitectonico' into develop |
| `24af5de` | 2026-11-06 | feat(espacial): add interior camera view with confined orbit |
| `373aee0` | 2026-11-05 | fix(espacial): tipar JSON de dimensiones en Prisma |
| `c1b67db` | 2026-11-05 | fix(espacial): corregir composición del panel energético |
| `7de8749` | 2026-11-05 | feat(espacial): agregar leyenda del mapa de consumo 3D |
| `a6fcd7b` | 2026-11-05 | feat(espacial): colorear nodos del modelo según consumo estimado |
| `8322300` | 2026-11-05 | feat(espacial): exponer datos energéticos para mapa 3D |
| `2618268` | 2026-11-05 | fix(espacial): no tratar equipos sin uso como consumo cero |
| `58257de` | 2026-11-05 | feat(espacial): integrar panel energético al nodo seleccionado |
| `f5caa3c` | 2026-11-05 | feat(espacial): mostrar consumo estimado por espacio y periodo |
| `c05e288` | 2026-11-05 | feat(espacial): consultar consumo estimado por espacio asociado |
| `0c330ac` | 2026-11-05 | fix(espacial): validar datos y permisos de asociaciones |
| `666a07f` | 2026-11-05 | feat(espacial): integrar asociación de nodos con espacios |
| `29fa224` | 2026-11-05 | feat(espacial): crear interfaz de asociación nodo-espacio |
| `0b9df86` | 2026-11-05 | feat(espacial): agregar API de asociación nodo-espacio |
| `75e4b53` | 2026-11-05 | security(espacial): evitar cache persistente de fragmentos protegidos |
| `5474d5a` | 2026-11-05 | fix(espacial): validar content-length cuando el navegador lo informa |
| `daeddf1` | 2026-11-05 | fix(espacial): tolerar solicitudes sin content-length explícito |
| `a3fdc54` | 2026-11-05 | fix(espacial): limitar tamaño de solicitudes de fragmentos GLB |
| `b580646` | 2026-11-05 | perf(espacial): validar fragmentos sin leer el archivo completo |
| `b1b1d5b` | 2026-11-05 | feat(espacial): controlar permiso de carga de modelo GLB |
| `2293fc9` | 2026-11-05 | fix(espacial): cargar visor GLB únicamente en navegador |
| `01430ec` | 2026-11-05 | fix(espacial): corregir selección GLB y persistir carga fragmentada |
| `10d7ffd` | 2026-11-05 | fix(espacial): respetar acceso de lectura al módulo de planos |
| `0ea7d06` | 2026-11-05 | fix(espacial): respetar acceso de lectura al módulo de planos |
| `bdef120` | 2026-11-05 | feat(espacial): API segura para carga GLB por fragmentos |
| `9d40a4d` | 2026-11-05 | feat(espacial): API segura para carga GLB por fragmentos |
| `4db149d` | 2026-11-05 | feat(espacial): API segura para carga GLB por fragmentos |
| `35e7dc8` | 2026-11-05 | feat(espacial): almacenar modelos GLB en partes BYTEA |
| `d9c1a0e` | 2026-11-05 | fix(espacial): use stable node paths for GLB inspection |
| `f6622e4` | 2026-11-05 | fix(espacial): keep architectural object storage provider-neutral |
| `82ffb87` | 2026-11-05 | feat(espacial): add architectural model metadata schema |
| `4bd4c46` | 2026-11-05 | fix(espacial): validate GLB preview and handle load errors |
| `84bedb3` | 2026-11-05 | feat(espacial): add architectural model workspace tab |
| `67aefe7` | 2026-11-05 | feat(espacial): add local GLB architectural model preview |

### 2.3 Cambio de schema Prisma — requiere `db push`

`prisma/schema.prisma` añade (todo aditivo, sin borrados ni renombres):

- Tablas `modelos_arquitectonicos`, `partes_archivo_modelo`, `elementos_modelo_3d`
- Enum `EstadoModeloArquitectonico`
- Relaciones en `Edificacion`, `Bloque` y `Espacio`

**Antes de desplegar esta iteración a producción hay que ejecutar `npm run db:push`**
contra la base de datos de Neon (`npx prisma db push`). Hasta entonces, las rutas
`/api/espacial/modelos/**` fallarán con error de columna/tabla inexistente.

---

## 3. Historial de entrega (PRs fusionados — 42)

| PR | Fecha | Rama | Título |
|---|---|---|---|
| #160 | 2026-11-02 | `integrar-master-en-main` | Integrar mejoras del módulo de estimaciones |
| #159 | 2026-11-02 | `fix/issue-158-storybook-date-tests` | test(datos): stabilize date-dependent Storybook stories |
| #156 | 2026-11-02 | `feat/issue-150-151-espacial` | feat(espacial): add floor geometry and CAD imports |
| #155 | 2026-11-02 | `feat/issue-21-23-reportes` | feat(reportes): add PDF exports and temporal aggregation |
| #154 | 2026-11-02 | `feat/issue-147-arima` | feat(estimaciones): add ARIMA forecasts |
| #153 | 2026-11-02 | `fix/issue-152-anexo4` | fix(lben): validate Anexo 4 non-routine adjustments |
| #149 | 2026-10-28 | `feature/calculos-opcionales-importadores` | feat(datos): rebuild equipment importer usage step as calendar-driven table |
| #146 | 2026-10-24 | `feat/importador-paso-calculo` | feat(datos): offer optional usage calculation after import |
| #144 | 2026-10-23 | `feat/calculo-uso-slice-f` | feat(datos): explicit usage recalculation with friendly delete guards (slice F) |
| #143 | 2026-10-22 | `feat/calculo-uso-slice-e` | feat(datos): batched mass usage calculation with resumable progress (slice E) |
| #142 | 2026-10-21 | `feat/calculo-uso-slice-d` | feat(datos): usage-calculation section UI in Datos (slice D) |
| #141 | 2026-10-21 | `feat/calculo-uso-slice-c` | feat(datos): usage-calculation server actions (slice C) |
| #140 | 2026-10-21 | `feat/calculo-uso-slice-b2` | test(datos): characterize importer usage-fill behavior (slice B2) |
| #139 | 2026-10-21 | `feat/calculo-uso-slice-b` | feat(datos): pure usage calculation core (slice B1) |
| #138 | 2026-10-21 | `feat/calculo-uso-slice-a` | feat(datos): usage-period schema and pure calculation foundations (slice A/6) |
| #136 | 2026-10-20 | `release/calendario-uso-flags` | feat(datos): scope-effective schedules and Sunday/holiday operating policy |
| #135 | 2026-10-19 | `feat/issue-18-cal-uso-flags-p4` | feat(datos): add Sunday/holiday operating policy switches |
| #134 | 2026-10-19 | `feat/issue-18-cal-uso-flags-p3` | feat(datos): persist per-building Sunday/holiday operating policy |
| #133 | 2026-10-19 | `feat/issue-18-cal-uso-flags-p2` | feat(datos): apply scope-effective schedules to equipment usage |
| #132 | 2026-10-19 | `feat/issue-18-cal-uso-flags-p1` | feat(datos): add operating-day policy flags for Sundays and holidays |
| #130 | 2026-10-19 | `develop` | feat(alerts): deliver the unusual consumption alerts module (HU-08) |
| #129 | 2026-10-19 | `feat/hu-08-alertas` | feat(alerts): add the unusual consumption alerts module (HU-08) |
| #119 | 2026-10-17 | `release/fase6d-t4` | feat(datos): opt-in equipment usage auto-calculation from calendar Xe (6d4) |
| #118 | 2026-10-17 | `release/fase6d-t3` | feat(datos): interactive day-detail expansion (6d3) |
| #117 | 2026-10-17 | `release/fase6d-t2` | feat(datos): date ranges, TdeA template and schedules in calendar view (6d2/6d3) |
| #116 | 2026-10-17 | `release/fase6d-t1` | feat(datos): replace calendar drawer with operational configuration tab (6d1) |
| #114 | 2026-10-16 | `develop` | feat(data): Geocoding, GDE en Variables con Xe, calendario (HU-24) |
| #113 | 2026-10-16 | `feat/fase6b-vistas-calendario` | [Fase 6b] Calendario con vista de año, semana y agenda |
| #112 | 2026-10-16 | `feat/fase6a-geocoding-gde-trazabilidad` | [Fase 6a] Ubicación por ciudad, GDE y trazabilidad de horarios |
| #111 | 2026-10-16 | `feat/fase6c-eventos-calendario` | [Fase 6c] Módulo de eventos con herencia y calendario |
| #105 | 2026-10-16 | `develop` | feat(data): UPME infrastructure, operating calendar, GDE (HU-23) |
| #104 | 2026-10-16 | `feat/carga-fase-5-horarios-jerarquicos` | feat(data): hierarchical equipment schedules with conflict checks |
| #103 | 2026-10-16 | `feat/carga-fase-4-festivos` | feat(datos): monthly calendar view with official holidays |
| #102 | 2026-10-16 | `feat/carga-fase-3-horarios` | feat(datos): per-building equipment schedules |
| #101 | 2026-10-16 | `feat/carga-fase-2-calendario-gde` | feat(datos): per-building operating calendar and GDE |
| #100 | 2026-10-16 | `feat/carga-fase-1-edificaciones` | feat(datos): standalone Edificaciones section with UPME fields |
| #93 | 2026-10-15 | `feat/lben-flex-home-carousel` | feat: flexible LBEn and animated home module carousel |
| #91 | 2026-10-15 | `feat/dashboard-analisis-overview` | feat(dashboard): overview redesign with real KPIs and SVG charts |
| #89 | 2026-10-14 | `chore/issue-80-repo-hygiene` | chore: drop stale schema dump, untrack .atl |
| #88 | 2026-10-14 | `feat/ui-redesign` | Feat/UI redesign |
| #4 | 2026-10-06 | `dependabot/.../dev-deps-4e0da53338` | chore(dev-deps): bump the dev-deps group with 2 updates |
| #2 | 2026-10-06 | `dependabot/.../prod-deps-4858ab72f8` | chore(deps): bump the prod-deps group with 8 updates |

### PRs abiertos

| PR | Estado | Rama | Nota |
|---|---|---|---|
| #161 | DRAFT | `feat/espacial-modelo-arquitectonico` | Apunta a `main`; contenido ya integrado en `develop` por `7872234`. Debe retargetearse o cerrarse. |
| #157, #64–#72 | OPEN | ramas Dependabot | Actualizaciones *major* / dev-deps: requieren proyecto de migración propio (ver `GIT_WORKFLOW.md`) |

---

## 4. Mapeo HU ↔ issue

La fuente única del mapa historias de usuario ↔ issues de GitHub es la tabla
**«Historias de usuario como issues»** de [`GIT_WORKFLOW.md`](../GIT_WORKFLOW.md)
(HU-01 ↔ #12 … HU-22 ↔ #33). No se duplica aquí para evitar que las dos copias diverjan.

---

## 5. Pendientes conocidos

1. **`npm run db:push`** — aplicar el schema nuevo a Neon antes de desplegar (sección 2.3).
2. **PR #161 (DRAFT)** — retargetear a `develop` o cerrar, ya que su contenido está integrado.
3. **`response_mapping.md`** — archivo de trabajo sin trackear en la raíz (mapa de navegación
   de screenshots de `/dashboard/datos`). Excluido deliberadamente de este entregable.
4. **Review RDD** — el rango `origin/develop..develop` fue evaluado como riesgo **medium**
   (`review_due: false`, motivo `under_budget`, 2064 líneas). Queda pendiente en el slice.
5. **Ramas Dependabot con *major upgrades*** — cerrar o tratar como proyecto aparte.

---

## 6. Cómo regenerar esta trazabilidad

```bash
# Estado de ramas y su relación con el remoto
git fetch --all --prune
git for-each-ref --format='%(refname:short)|%(objectname:short)|%(committerdate:short)' refs/heads

# Commits de una iteración (rango entre dos puntos)
git log --pretty=format:'%h|%ad|%s' --date=short <base>..<head>

# Volumen de cambios de una iteración
git diff --shortstat <base>..<head>
git diff --name-status <base>..<head>

# Historial de entrega
gh pr list --state merged --limit 50
gh pr list --state open --limit 20

# Commits en develop aún no publicados / no integrados en main
git rev-list --left-right --count develop...origin/develop
git rev-list --left-right --count main...develop
```

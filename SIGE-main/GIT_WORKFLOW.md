# Flujo de trabajo Git/GitHub — SIGE

## Ramas

- `main` → **production-ready**. Solo se recibe desde `develop` vía PR (squash merge).
- `develop` → **integración**. Las features se mergean aquí vía PR.
- `feature/*`, `fix/*`, `chore/*` → una por ticket/issue.
  Ejemplos: `feat/issue-15-consumo-historico`, `fix/issue-456-error-login`, `chore/deps`.

## Proceso

1. Crear la rama desde `develop` actualizada:
   ```bash
   git checkout develop && git pull && git checkout -b feat/issue-15-nombre
   ```
2. Desarrollar y validar localmente:
   ```bash
   npm run validate   # lint + typecheck + tests + build + build-storybook
   ```
3. Push y abrir PR contra `develop`.
4. El CI (GitHub Actions) debe pasar los 4 checks en verde.
5. Code review: mínimo 1 aprobación.
6. Merge **squash** a `develop`.
7. Release: PR de `develop` → `main` (squash), con revisión y checks en verde.
8. Tag del release:
   ```bash
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```

## Commits convencionales

```
feat: nueva funcionalidad
fix: corrección de bug
refactor: reestructuración sin cambio de comportamiento
chore: tareas de mantenimiento (deps, config, etc.)
docs: documentación
test: tests
ci: pipelines
```

## Historias de usuario como issues

Cada HU del Product backlog del TDG (Tabla 8 de `docs/Plantilla_TDG_Desarrollo_SW_InformeTecnico.md`)
tiene un issue en el repositorio con el alcance, los criterios de aceptación, la cobertura en el
código y los commits de correlación.

| HU | Issue | Estado | HU | Issue | Estado |
|----|-------|--------|----|-------|--------|
| HU-01 | #12 | cerrado | HU-12 | #23 | abierto |
| HU-02 | #13 | cerrado | HU-13 | #24 | abierto |
| HU-03 | #14 | cerrado | HU-14 | #25 | abierto |
| HU-04 | #15 | abierto | HU-15 | #26 | cerrado |
| HU-05 | #16 | abierto | HU-16 | #27 | cerrado |
| HU-06 | #17 | abierto | HU-17 | #28 | cerrado |
| HU-07 | #18 | abierto | HU-18 | #29 | cerrado |
| HU-08 | #19 | abierto | HU-19 | #30 | cerrado |
| HU-09 | #20 | abierto | HU-20 | #31 | cerrado |
| HU-10 | #21 | abierto | HU-21 | #32 | cerrado |
| HU-11 | #22 | abierto | HU-22 | #33 | abierto |

**Convención de cierre.** Una HU se cierra con `--reason completed` y un comentario que documenta
la correlación: commits, archivos que la cubren, historias de Storybook que la evidencian y la
verificación de `npm run validate`.

```bash
gh issue comment <n> --body-file correlacion.md
gh issue close <n> --reason completed
```

**Labels.** `sprint-1` · `sprint-2` · `por-planificar` · `diseno-ingenieria` · `pruebas-cierre`
— `estado:completado` · `estado:en-progreso` · `estado:pendiente`
— `m1-carga-datos` · `m1-lben` · `usuarios-permisos` · `m2-dashboard` · `m3-analisis` ·
`m4-alertas` · `m5-estimaciones` · `m6-reportes` · `espacial` · `ingenieria`

## Protección de ramas

> **Estado actual: NO DISPONIBLE.** La protección de ramas de GitHub (clásica y *rulesets*) está
> reservada a repos **públicos** o a cuentas con **GitHub Pro**. Este repositorio es privado y la
> cuenta es *GitHub Free*, por lo que la API responde `HTTP 403: Upgrade to GitHub Pro or make
> this repository public to enable this feature`. Mientras se mantenga el plan Free y la
> visibilidad privada, **el mensaje «Your main branch isn't protected» no se puede eliminar por
> configuración**: no existe una regla equivalente gratuita para repos privados.

La tabla siguiente queda como especificación objetivo, por si el repositorio se vuelve público
o la cuenta sube de plan (Settings → Branches):

| Regla | `main` | `develop` |
|-------|--------|-----------|
| Pull requests obligatorios | ✅ | ✅ |
| Approvals requeridos | 1 | 1 |
| Status checks (CI) | ✅ | ✅ |
| Squash merge / linear history | ✅ | — |
| Bloquear force push | ✅ | ✅ |
| Bloquear deletes | ✅ | ✅ |

### Disciplina compensatoria (obligatoria mientras no haya protección)

Sin reglas en el servidor, la única barrera es la revisión manual. Antes de pulsar *Merge*:

1. **Los 4 checks del CI en verde** (`Lint`, `TypeCheck`, `Tests (Storybook + Vitest)`,
   `Build (Next.js + Storybook)`). Si alguno está en rojo o *skipped*, **no se hace merge**.
2. **`npm run validate` en verde en local**, en la misma rama.
3. **Nunca forzar push** en `main` ni `develop`, ni borrar esas ramas.
4. **Revisar el diff completo** del PR, no solo el título.
5. Los PRs abiertos se revisan antes de mergear cualquier cosa nueva: si la rama base avanzó,
   se hace *merge* de `develop` en la rama de la feature y se revalida.

## Dependabot

Configurado en `.github/dependabot.yml`: los grupos `prod-deps` y `dev-deps` se limitan a
actualizaciones `minor` y `patch`.

**Las actualizaciones *major* llegan como PR individuales.** Una versión mayor casi siempre
implica una migración con cambios de API (p. ej. `next` 14→16, `prisma` 5→7, `zod` 3→4,
`react` 18→19). Se tratan como **proyecto aparte**, nunca como merge rutinario:

```bash
# Rechazar una actualización mayor que no se va a migrar ahora:
gh pr close <n> --comment "Deferred: major upgrade requires its own migration project."
```

Reglas:

- **No mergear ningún PR de dependabot con el CI en rojo.**
- **No mergear *mayors* sin plan de migración**, aunque el CI esté verde.
- Las *minor*/*patch* se prueban con `npm run validate` antes del merge.

## Secretos (Settings → Secrets → Actions)

Solo vía GitHub Secrets/Variables. **Nunca** en el repositorio (`.env` está en `.gitignore`).

| Secret | Descripción | Environment |
|--------|-------------|-------------|
| `DATABASE_URL` | String de conexión PostgreSQL | `staging`, `production` |
| `NEXTAUTH_SECRET` | Generar con `openssl rand -base64 32` | `staging`, `production` |
| `NEXTAUTH_URL` | URL pública del despliegue | `staging`, `production` |
| `VERCEL_TOKEN` | Token de Vercel (cuando se configure CD) | `staging`, `production` |
| `VERCEL_ORG_ID` | Org ID de Vercel | `staging`, `production` |
| `VERCEL_PROJECT_ID` | Project ID de Vercel | `staging`, `production` |

Variables (no secretos): `NEXT_PUBLIC_*` si se necesitan → Settings → Secrets → Actions → **Variables**.

## Ambientes (Settings → Environments)

- `staging` → despliegue automático desde `develop`.
- `production` → despliegue desde `main`; se recomienda añadir **Required reviewers** para aprobación manual.

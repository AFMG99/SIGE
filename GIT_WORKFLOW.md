# Flujo de trabajo Git/GitHub — SIGE

## Ramas

- `main` → **production-ready**. Solo se recibe desde `develop` vía PR (squash merge).
- `develop` → **integración**. Las features se mergean aquí vía PR.
- `feature/*`, `fix/*`, `chore/*` → una por ticket/issue.
  Ejemplos: `feat/issue-123-cargar-facturas`, `fix/issue-456-error-login`, `chore/deps`.

## Proceso

1. Crear la rama desde `develop` actualizada:
   ```bash
   git checkout develop && git pull && git checkout -b feat/issue-123-nombre
   ```
2. Desarrollar y validar localmente:
   ```bash
   npm run validate   # lint + typecheck + tests + build + build-storybook
   ```
3. Push y abrir PR contra `develop`.
4. El CI (GitHub Actions) debe pasar: lint → typecheck → tests → build.
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

## Protección de ramas (Settings → Branches)

| Regla | `main` | `develop` |
|-------|--------|-----------|
| Pull requests obligatorios | ✅ | ✅ |
| Approvals requeridos | 1 | 1 |
| Status checks (CI) | ✅ | ✅ |
| Squash merge / linear history | ✅ | — |
| Bloquear force push | ✅ | ✅ |
| Bloquear deletes | ✅ | ✅ |

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

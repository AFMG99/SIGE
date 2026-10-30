# SIGE-TdeA

Sistema de Información para la Gestión Energética del Tecnológico de Antioquia. Plataforma web (Next.js 14 + Prisma/PostgreSQL) que centraliza facturas EPM, inventario de equipos, variables operativas y líneas base energéticas conforme a la Resolución UPME 0016 de 2024.

## Inicio rápido

```bash
npm install              # dependencias
cp .env.example .env     # configurar DATABASE_URL
npx prisma generate      # cliente Prisma
npm run db:push          # sincronizar esquema (o npm run seed:users)
npm run dev              # http://localhost:3000
```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción (Next.js) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm run test` | Tests (Storybook + Vitest) |
| `npm run build-storybook` | Build estático de Storybook |
| `npm run validate` | lint + typecheck + test + build + build-storybook |
| `npm run db:push` / `db:generate` / `db:studio` | Utilidades Prisma |

## CI/CD

- **CI** (`.github/workflows/ci.yml`): en cada push/PR a `main` y `develop` corre
  lint → typecheck → tests → build (Next.js + Storybook).
- **CD** (`.github/workflows/cd.yml`): preparado con placeholders para Vercel
  (`develop` → environment `staging`, `main` → environment `production`).
  Los secretos viven **solo** en GitHub Secrets (nunca en el repo).
- Flujo completo de ramas, PRs, secretos y ambientes: ver **[GIT_WORKFLOW.md](./GIT_WORKFLOW.md)**.

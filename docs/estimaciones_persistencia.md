# Historial persistente y horizonte de estimaciones

El modelo Prisma `EstimacionConsumo` almacena una instantánea de la proyección (histórico, pronóstico, LBEn comparativa, diagnósticos y advertencias), sus parámetros y alcance. Cada registro se relaciona con una edificación y opcionalmente con un bloque y el usuario creador. El historial permite consultar las últimas 50 estimaciones por edificación y restaurar la visualización guardada sin recalcularla.

## Actualización de esquema

El repositorio utiliza actualmente `prisma db push` y no mantiene migraciones Prisma versionadas. En desarrollo, verificar primero que `DATABASE_URL` apunta a una base local, ejecutar `npm run db:generate` y revisar el diff de `npx prisma db push --accept-data-loss=false`. Aplicar `npm run db:push` solo después de comprobar que los cambios son aditivos.

No ejecutar `db push` contra producción durante el build de Vercel. Antes de producción, respaldar PostgreSQL, revisar la creación de `estimaciones_consumo` e índices y aplicar el cambio de forma controlada. El historial requiere que la tabla exista; la proyección en memoria seguirá separada de la persistencia.

Los horizontes 13–24 se marcan como escenarios exploratorios. Las bandas MA/SES son aproximaciones basadas en residuos, no intervalos probabilísticos exactos.

/**
 * Migración de `variables_operativas`: 4 columnas de población → 2.
 *
 *   1. ADD     → crea `poblacionFija` y `poblacionFlotante` (NULL)
 *   2. BACKFILL→ suma docentes+administrativos y estudiantes+visitantes
 *   3. DROP    → elimina las 4 columnas legadas
 *
 * Es idempotente: si la BD ya está en el formato nuevo, no hace nada.
 * Uso: node scripts/migrar-poblacion.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TABLA = 'variables_operativas'
const VIEJAS = [
  'poblacionFijaDocentes',
  'poblacionFijaAdministrativos',
  'poblacionFlotanteEstudiantes',
  'poblacionFlotanteVisitantes',
]
const NUEVAS = ['poblacionFija', 'poblacionFlotante']

async function columnasExistentes() {
  const filas = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    TABLA
  )
  return new Set(filas.map((f) => f.column_name))
}

async function main() {
  const actuales = await columnasExistentes()
  const tieneViejas = VIEJAS.filter((c) => actuales.has(c))
  const tieneNuevas = NUEVAS.filter((c) => actuales.has(c))

  if (tieneViejas.length === 0 && tieneNuevas.length === NUEVAS.length) {
    console.log('variables_operativas ya está en el formato nuevo; nada que migrar.')
    return
  }

  if (tieneViejas.length === 0) {
    throw new Error(
      `Formato inesperado: sin columnas legadas (${VIEJAS.join(', ')}) ni completas (${NUEVAS.join(', ')}).`
    )
  }

  // 1. ADD
  for (const columna of NUEVAS) {
    if (!actuales.has(columna)) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${TABLA}" ADD COLUMN "${columna}" INTEGER`
      )
      console.log(`+ columna "${columna}" creada`)
    }
  }

  // 2. BACKFILL (solo filas aún sin valor, por si la corrida anterior fue interrumpida)
  const backfill = await prisma.$executeRawUnsafe(
    `UPDATE "${TABLA}"
        SET "poblacionFija" = COALESCE("poblacionFijaDocentes", 0) + COALESCE("poblacionFijaAdministrativos", 0),
            "poblacionFlotante" = COALESCE("poblacionFlotanteEstudiantes", 0) + COALESCE("poblacionFlotanteVisitantes", 0)
      WHERE "poblacionFija" IS NULL OR "poblacionFlotante" IS NULL`
  )
  console.log(`~ backfill aplicado a ${backfill} fila(s)`)

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "${TABLA}" ALTER COLUMN "poblacionFija" SET NOT NULL`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "${TABLA}" ALTER COLUMN "poblacionFlotante" SET NOT NULL`
  )

  // 3. DROP
  for (const columna of VIEJAS) {
    if (actuales.has(columna)) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${TABLA}" DROP COLUMN "${columna}"`
      )
      console.log(`- columna "${columna}" eliminada`)
    }
  }

  const tras = await columnasExistentes()
  const listas = NUEVAS.filter((c) => tras.has(c)).length
  const restos = VIEJAS.filter((c) => tras.has(c)).length
  if (listas !== NUEVAS.length || restos > 0) {
    throw new Error('La migración no quedó en el estado esperado.')
  }
  console.log('Migración completada: 2 columnas de población, 0 legadas.')
}

main()
  .catch((e) => {
    console.error('Error en la migración:', e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

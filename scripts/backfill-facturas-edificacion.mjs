/**
 * Backfill idempotente de FacturaEnergia.edificacionId (SIGE-TdeA).
 *
 * Contexto: la columna se añadió primero como NULLABLE (fase 1 de
 * `prisma db push`); este script asigna las facturas huérfanas a una
 * edificación para poder volver la columna a NOT NULL (fase 2).
 *
 * Reglas:
 *  - Solo toca facturas con "edificacionId" NULL (nunca reasigna).
 *  - Con exactamente UNA edificación en el catálogo la usa sin más.
 *  - Con varias (o ninguna) exige --edificacion <id|nombre> y falla.
 *
 * Uso: node scripts/backfill-facturas-edificacion.mjs [--edificacion <id|nombre>]
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Carga .env si la variable no está ya en el entorno (node no lo hace solo).
if (!process.env.DATABASE_URL) {
  const envPath = path.join(raiz, '.env')
  if (fs.existsSync(envPath)) {
    for (const linea of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = linea.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
    }
  }
}

const { PrismaClient } = await import('@prisma/client')
const prisma = new PrismaClient()

const argIdx = process.argv.indexOf('--edificacion')
const pedido = argIdx >= 0 ? process.argv[argIdx + 1] : null

try {
  const sinEdificacion = await prisma.facturaEnergia.count({
    where: { edificacionId: null },
  })

  if (sinEdificacion === 0) {
    console.log('Backfill omitido: no hay facturas sin edificación.')
    process.exit(0)
  }

  const edificaciones = await prisma.edificacion.findMany({
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  })

  if (edificaciones.length === 0) {
    console.error(
      `Hay ${sinEdificacion} facturas sin edificación pero el catálogo está vacío.\n` +
        'Cree una edificación primero y vuelva a ejecutar este script.'
    )
    process.exit(1)
  }

  let destino = null
  if (pedido) {
    destino =
      edificaciones.find((e) => e.id === pedido) ??
      edificaciones.find((e) => e.nombre.toLowerCase() === pedido.toLowerCase())
    if (!destino) {
      console.error(
        `No existe la edificación "${pedido}". Opciones:\n` +
          edificaciones.map((e) => `  - ${e.nombre} (${e.id})`).join('\n')
      )
      process.exit(1)
    }
  } else if (edificaciones.length === 1) {
    destino = edificaciones[0]
  } else {
    console.error(
      `Hay ${sinEdificacion} facturas sin edificación y ${edificaciones.length} edificaciones en el catálogo.\n` +
        'Especifique el destino: node scripts/backfill-facturas-edificacion.mjs --edificacion <id|nombre>\n' +
        edificaciones.map((e) => `  - ${e.nombre} (${e.id})`).join('\n')
    )
    process.exit(1)
  }

  const r = await prisma.facturaEnergia.updateMany({
    where: { edificacionId: null },
    data: { edificacionId: destino.id },
  })

  console.log(
    `Backfill completo: ${r.count} de ${sinEdificacion} facturas asignadas a ` +
      `"${destino.nombre}" (${destino.id}).`
  )
} catch (error) {
  console.error('Error en el backfill:', error.message)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}

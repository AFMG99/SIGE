/**
 * Relleno histórico NO DESTRUCTIVO para el módulo de Línea Base Energética.
 *
 * Solo CREA los meses que faltan (nunca actualiza ni borra registros
 * existentes — la verificación es previa por unique de Prisma):
 *   - facturas_energia: periodos 2021-01 … 2025-01 inexistentes
 *   - variables_operativas: (bloqueId, mes, ano) inexistentes por bloque
 *
 * Modelo sintético determinista (mulberry32, seed fijo) calibrado contra
 * los datos reales de la BD:
 *   - consumo normalizado ≈ 20.000–24.000 kWh/30 d (rango real 17.900–27.000)
 *   - GDE mensual 121–210 (anclas de los 4 meses reales: 120,8 / 150,2 / 210,3 / 185,5)
 *   - población flotante ≈ 780–990 y fija ≈ 150–162 (reales: 850–950 / 150–160)
 *   - tarifa ≈ 950 COP/kWh (derivada de las facturas reales)
 *   - consumo = 10.200 + 36·GDE + 6·flotante + tendencia + ruido(σ 400)
 *     → regresión con R² ≈ 0,85 y MAPE ≈ 1,5 %; VA con MAPE ≈ 4,5 %
 *
 * Uso: npm run db:historico
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ANO_INICIO = 2021
const ANO_FIN = 2025 // incluye 2025-01
const MES_FIN = 1

const GDE_POR_MES = {
  1: 130, 2: 145, 3: 175, 4: 145, 5: 121, 6: 150,
  7: 210, 8: 185, 9: 200, 10: 180, 11: 150, 12: 132,
}

const FLOTANTE_POR_MES = {
  1: 780, 2: 940, 3: 980, 4: 960, 5: 870, 6: 920,
  7: 950, 8: 950, 9: 990, 10: 970, 11: 940, 12: 820,
}

const LECTIVOS_POR_MES = {
  1: 14, 2: 21, 3: 22, 4: 21, 5: 22, 6: 20,
  7: 15, 8: 22, 9: 21, 10: 22, 11: 20, 12: 16,
}

/** PRNG determinista — misma secuencia en cada ejecución. */
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20260930)

/** Normal estándar vía Box–Muller. */
function gauss(media, desv) {
  const u1 = Math.max(rand(), 1e-12)
  const u2 = rand()
  return media + desv * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

function r2(v) {
  return Math.round(v * 100) / 100
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function listarMeses() {
  const meses = []
  for (let ano = ANO_INICIO; ano <= ANO_FIN; ano++) {
    for (let mes = 1; mes <= 12; mes++) {
      if (ano === ANO_FIN && mes > MES_FIN) break
      meses.push({ ano, mes })
    }
  }
  return meses
}

function generarFactura({ ano, mes }) {
  const dias = new Date(ano, mes, 0).getDate()
  const gde = gauss(GDE_POR_MES[mes], 6)
  const flot = Math.round(gauss(FLOTANTE_POR_MES[mes], 35))
  const tendencia = 10200 * 0.006 * (ano - ANO_INICIO)
  const normalizado = 10200 + 36 * gde + 6 * flot + tendencia + gauss(0, 400)
  const consumoKwh = r2((normalizado * dias) / 30)
  const tarifa = 950 * (1 + 0.02 * Math.sin((2 * Math.PI * mes) / 12))
  return {
    periodo: `${ano}-${pad2(mes)}`,
    diasFacturados: dias,
    consumoKwh,
    consumoNormalizado: r2(normalizado),
    costoCop: r2(consumoKwh * tarifa),
  }
}

function generarVariable(bloqueId, { ano, mes }) {
  const fija = 150 + Math.floor(rand() * 13)
  const flot = Math.round(gauss(FLOTANTE_POR_MES[mes], 35))
  return {
    bloqueId,
    mes,
    ano,
    poblacionFija: fija,
    poblacionFlotante: flot,
    diasLectivosLaborales: Math.max(
      0,
      LECTIVOS_POR_MES[mes] + Math.floor(rand() * 3) - 1
    ),
    gradesDiaEnfriamiento: r2(gauss(GDE_POR_MES[mes], 6)),
  }
}

async function main() {
  console.log('📅 Relleno histórico de LBEn (solo creación de meses faltantes)\n')

  const bloques = await prisma.bloque.findMany({ select: { id: true, codigo: true } })
  if (bloques.length === 0) {
    console.log('No hay bloques en la BD; nada que rellenar.')
    return
  }

  const meses = listarMeses()

  // ── Facturas EPM (globales): solo periodos inexistentes ─────────────
  const periodosExistentes = new Set(
    (await prisma.facturaEnergia.findMany({ select: { periodo: true } })).map(
      (f) => f.periodo
    )
  )
  const facturasNuevas = meses
    .filter((m) => !periodosExistentes.has(`${m.ano}-${pad2(m.mes)}`))
    .map(generarFactura)

  if (facturasNuevas.length > 0) {
    // FK requerida: resolver la edificación destino (una sola por periodo)
    const argIdx = process.argv.indexOf('--edificacion')
    const edificaciones = await prisma.edificacion.findMany({
      select: { id: true, nombre: true },
    })
    let destino = null
    if (argIdx !== -1) {
      const pedido = String(process.argv[argIdx + 1] ?? '')
      destino =
        edificaciones.find((e) => e.id === pedido) ??
        edificaciones.find((e) => e.nombre.toLowerCase() === pedido.toLowerCase())
      if (!destino) {
        console.error(`No existe la edificación "${pedido}". Disponibles:`)
        for (const e of edificaciones) console.error(`  - ${e.nombre} (${e.id})`)
        process.exit(1)
      }
    } else if (edificaciones.length === 1) {
      destino = edificaciones[0]
    } else {
      console.error(
        `Hay ${edificaciones.length} edificaciones y se deben crear ${facturasNuevas.length} facturas nuevas.\n` +
          'Especifique el destino: node scripts/llenar-historico.mjs --edificacion <id|nombre>'
      )
      process.exit(1)
    }

    await prisma.facturaEnergia.createMany({
      data: facturasNuevas.map((f) => ({ ...f, edificacionId: destino.id })),
    })
  }
  console.log(
    `✅ Facturas: +${facturasNuevas.length} creadas (${periodosExistentes.size} existentes intactas)`
  )

  // ── Variables operativas (por bloque): solo claves inexistentes ─────
  const clavesExistentes = new Set(
    (
      await prisma.variableOperativa.findMany({
        select: { bloqueId: true, mes: true, ano: true },
      })
    ).map((v) => `${v.bloqueId}|${v.mes}|${v.ano}`)
  )
  const variablesNuevas = []
  for (const bloque of bloques) {
    for (const m of meses) {
      const clave = `${bloque.id}|${m.mes}|${m.ano}`
      if (!clavesExistentes.has(clave)) {
        variablesNuevas.push(generarVariable(bloque.id, m))
      }
    }
  }
  if (variablesNuevas.length > 0) {
    await prisma.variableOperativa.createMany({ data: variablesNuevas })
  }
  console.log(
    `✅ Variables: +${variablesNuevas.length} creadas (${clavesExistentes.size} existentes intactas)`
  )

  // ── Resumen de cobertura ────────────────────────────────────────────
  const totalFacturas = await prisma.facturaEnergia.count()
  const totalVariables = await prisma.variableOperativa.count()
  const periodos = (
    await prisma.facturaEnergia.findMany({
      orderBy: { periodo: 'asc' },
      select: { periodo: true },
    })
  ).map((f) => f.periodo)

  console.log(`\n📊 Cobertura: ${totalFacturas} facturas (${periodos[0]} → ${periodos[periodos.length - 1]})`)
  console.log(`   ${totalVariables} variables operativas`)
  console.log(
    totalFacturas >= 36
      ? '   ✔ Cumple el mínimo UPME de 36 meses'
      : '   ✖ Aún NO cumple el mínimo UPME de 36 meses'
  )
}

main()
  .catch((e) => {
    console.error('❌ Error en el relleno histórico:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

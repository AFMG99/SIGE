'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import {
  IconCociente,
  IconConfort,
  IconRegresion,
  IconValorAbsoluto,
} from './icons'
import { LineaBaseChart } from './LineaBaseChart'
import { TablaJerarquia, TablaPreparacion } from './LineasBaseTablas'
import { LineasBasePreguntas } from './LineasBasePreguntas'
import { calcularModelosLineaBase, guardarLineaBase } from '@/features/datos/controllers/lineasBase'
import {
  MODELOS_LBEN,
  TEXTOS_CRITERIO,
  UPME_K_INTERVALO,
  UPME_MAPE_MAXIMO,
  UPME_MIN_MESES,
  UPME_MIN_VALORES_MES,
  UPME_P_VALUE,
  lineaBaseKwh,
} from '@/features/datos/models/lineasBase'
import type {
  AlcanceSolicitud,
  CalculoLineaBase,
  CriterioDepuracion,
  ModeloLbenId,
  ResultadoModelo,
} from '@/features/datos/models/lineasBase'

/**
 * Líneas Base Energéticas (LBEn) — sección de los 4 modelos de la
 * Resolución UPME 0016 de 2024.
 *
 * Doble capa: (1) panel descriptivo por modelo (concepto, fórmula,
 * criterios) y (2) cálculo real con datos de BD — server action que
 * invoca el motor Python — con gráfica serie vs línea base, puertas
 * UPME y guardado explícito en LineaBaseEnergia.
 *
 * Navegación por pills segmentadas sin Motion UI: estado local +
 * transiciones CSS.
 */

type ModeloId = ModeloLbenId

type ModeloDef = {
  label: string
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  subtitulo: string
  concepto: string
  formula: string
  formulaNota?: string
  variables: { nombre: string; detalle: string }[]
  entradas: string[]
  salida: string[]
  ejemplo: string
}

const MODELOS: Record<ModeloId, ModeloDef> = {
  valor_absoluto: {
    label: 'Valor Absoluto',
    Icon: IconValorAbsoluto,
    subtitulo: 'Promedio simple mensual',
    concepto:
      'Toma el promedio de cada mes calendario (ene–dic) sobre un periodo base de al menos 36 meses (3 años) ya depurado con banda por mes (§7.5.1: ±10 % ec. 3; los valores anómalos con causa conocida se corrigen mediante ajustes no rutinarios del Anexo 4 antes de la verificación), y proyecta esos 12 valores como línea base. Es el modelo más directo: no requiere variables explicativas y sirve de referencia para validar los demás.',
    formula: 'LBEn_m = (1 / n_m) · Σ consumo_normalizado(m)',
    formulaNota: '12 valores (ene–dic) · banda por mes (§7.5.1)',
    variables: [
      {
        nombre: 'consumo_kwh',
        detalle:
          'Serie histórica mensual en kWh, normalizada a 30 días y depurada con banda por mes (§7.5.1).',
      },
    ],
    entradas: [
      'Serie mensual de consumo con mínimo 36 meses',
      'Sin variables explicativas',
      'Periodo sin cambios estructurales (obras, ampliaciones)',
    ],
    salida: [
      '12 LBEn_m (ene–dic) en kWh/30 d',
      'Mediana y desviación estándar del periodo',
      'Banda de confianza por mes',
      'MAPE del ajuste',
    ],
    ejemplo:
      'Con un consumo promedio de 12.480 kWh/mes, la línea base queda en 12.480 kWh: la banda por defecto (ec. 3, ±10 %) es 11.232 – 13.728 kWh. Los meses fuera de banda con causa conocida se corrigen con ajustes no rutinarios (Anexo 4) antes de la verificación.',
  },
  cociente: {
    label: 'Cociente',
    Icon: IconCociente,
    subtitulo: 'Relación simple por unidad de referencia',
    concepto:
      'Expresa el consumo como un cociente por unidad de una variable de referencia —área útil o población— de modo que la línea base escala con el uso real del espacio (kWh/m²·mes o kWh/persona·mes).',
    formula: 'cociente = consumo_promedio / variable_ref_promedio',
    formulaNota: 'LB = variable_ref × cociente',
    variables: [
      {
        nombre: 'variable_ref (área útil u ocupación)',
        detalle:
          'Valor promedio de la variable de referencia (m², personas); debe ser distinta de cero.',
      },
    ],
    entradas: [
      'Serie mensual de consumo (≥ 36 meses)',
      'Área útil (m²) o población promedio por periodo',
    ],
    salida: [
      'Cociente (kWh por unidad de referencia)',
      'Variable de referencia promedio',
      'R² y MAPE del ajuste',
    ],
    ejemplo:
      'Con 12.480 kWh/mes y 4.000 m² de área útil, el cociente es 3,12 kWh/m²·mes: cada m² proyecta ese consumo y la línea base se ajusta si el área cambia.',
  },
  regresion: {
    label: 'Regresión',
    Icon: IconRegresion,
    subtitulo: 'Ajuste estadístico multivariable (OLS)',
    concepto:
      'Modela el consumo como combinación lineal de variables explicativas (población, clima, calendario). Las variables se validan una a una por p-value y multicolinealidad (VIF) antes de aceptar el modelo.',
    formula: 'Y (kWh) = β₀ + β₁·Población + β₂·GDE + β₃·Días lectivos + …',
    variables: [
      {
        nombre: 'Población',
        detalle: 'Flotante y fija por periodo; coeficiente β por persona.',
      },
      {
        nombre: 'GDE',
        detalle:
          'Grados día de enfriamiento; mide la exigencia de climatización.',
      },
      {
        nombre: 'Días lectivos / temperatura',
        detalle: 'Calendario operativo y condición térmica del periodo.',
      },
    ],
    entradas: [
      'Serie mensual de consumo (≥ 36 meses)',
      'Variables explicativas mensuales (población, GDE, calendario)',
    ],
    salida: [
      'Coeficientes β con sus p-values',
      'R² y R² ajustado (sin tope: §7.5.3)',
      'Descarte iterativo si p > 0,05 o VIF > 5',
      'MAPE ≤ 5 % (confiabilidad, ejemplo Anexo 3)',
    ],
    ejemplo:
      'Y = 1.250,5 + 45,2·Temp + 8,7·Población + 12,3·DíaSemana con R² = 0,87 y p = 0,001: el registro sembrado en la base de datos.',
  },
  confort: {
    label: 'Confort Térmico',
    Icon: IconConfort,
    subtitulo: 'ASHRAE 55 · 20,2 °C – 27,6 °C',
    concepto:
      'Normaliza la línea base según la temperatura operativa: valida si el periodo opera dentro del rango de confort adaptativo de Medellín (ASHRAE 55) y estima la energía virtual asociada a desviarse del punto medio del rango.',
    formula: 'E_virtual = consumo_base + ΔT · 15 kWh/°C·mes',
    formulaNota: 'ΔT = T_operativa − 23,9 °C (punto medio del rango)',
    variables: [
      {
        nombre: 'T_operativa (°C)',
        detalle: 'Temperatura promedio de operación del periodo.',
      },
      {
        nombre: 'consumo_base (kWh)',
        detalle:
          'Promedio mensual depurado, tomado del modelo de valor absoluto.',
      },
    ],
    entradas: [
      'Temperatura promedio operativa por periodo',
      'Consumo base mensual depurado',
    ],
    salida: [
      'Modo: CONFORT, CALEFACCIÓN o ENFRIAMIENTO',
      'ΔT respecto al punto medio (23,9 °C)',
      'Energía virtual estimada (kWh)',
    ],
    ejemplo:
      'Con T = 26,0 °C: ΔT = +2,1 °C → +31,5 kWh sobre el consumo base y modo CONFORT, dentro del rango ASHRAE 55.',
  },
}

const CRITERIOS = [
  'Periodo base mínimo: 36 meses (3 años)',
  'Depuración: por mes con recomputo (§7.5.1): banda ±10 % (ec. 3); ajustes no rutinarios (Anexo 4) corrigen anómalos antes de la verificación',
  'Meses con menos de 3 valores: sin banda (regla 3×12)',
  'Banda de confianza: ±10 % (ec. 3) por defecto; ajustes no rutinarios Anexo 4 corrigen anómalos antes de la verificación',
  'Significancia: p-value ≤ 0,05 (§7.5.3)',
  'Bondad de ajuste: R² sin tope (§7.5.3: un R² bajo no invalida)',
  'Error promedio: MAPE ≤ 5 % (confiabilidad, ejemplo Anexo 3)',
]

const fmtEntero = new Intl.NumberFormat('es-CO')
const fmt1 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })
const fmt2 = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const fmt4 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 4 })

function fmtPValue(p: number): string {
  if (p < 0.001) return '< 0,001'
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(p)
}

function CheckChico({ className }: { className?: string }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

type Puerta = { label: string; ok: boolean }

/** Puertas de calidad UPME 0016 que aplican a cada modelo. */
function construirPuertas(
  id: ModeloId,
  r: ResultadoModelo,
  calc: Pick<CalculoLineaBase, 'depurados' | 'mesesInsuficientes'>
): Puerta[] {
  const puertas: Puerta[] = [
    {
      label: `${calc.depurados} meses depurados (mín. ${fmtEntero.format(UPME_MIN_MESES)})`,
      ok: calc.depurados >= UPME_MIN_MESES,
    },
    {
      // Regla 3×12: los 12 meses deben tener ≥ 3 valores para no salir
      // `estimado`; sin eso no se puede guardar (gate de la action).
      label:
        calc.mesesInsuficientes.length > 0
          ? `3×12: sin ≥${UPME_MIN_VALORES_MES} valores en ${calc.mesesInsuficientes.join(', ')}`
          : `3×12: 12 meses con ≥${UPME_MIN_VALORES_MES} valores`,
      ok: calc.mesesInsuficientes.length === 0,
    },
  ]
  if (id !== 'confort' && typeof r.mape === 'number') {
    puertas.push({
      label: `MAPE ${fmt2.format(r.mape)} % ≤ ${fmtEntero.format(UPME_MAPE_MAXIMO)} %`,
      ok: r.mape <= UPME_MAPE_MAXIMO,
    })
  }
  if (id === 'regresion' && r.p_values) {
    const peor = Math.max(...Object.values(r.p_values))
    puertas.push({
      label: `p máximo ${fmtPValue(peor)} ≤ ${fmt2.format(UPME_P_VALUE)}`,
      ok: peor <= UPME_P_VALUE,
    })
  }
  if (id === 'confort' && typeof r.en_rango_confort === 'boolean') {
    puertas.push({
      label: `T = ${fmt1.format(r.temperatura_promedio ?? 0)} °C en rango ASHRAE 55`,
      ok: r.en_rango_confort,
    })
  }
  return puertas
}

function Metrica({
  label,
  valor,
}: {
  label: string
  valor: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
        {valor}
      </dd>
    </div>
  )
}

function GraficaPara({
  id,
  serie,
  criterio,
}: {
  id: ModeloId
  serie: CalculoLineaBase['serie']
  criterio: CriterioDepuracion
}) {
  if (id === 'valor_absoluto') {
    return (
      <LineaBaseChart
        serie={serie}
        columna="pred_va"
        criterio={criterio}
        etiquetaPred="Línea base (LBEn_m)"
      />
    )
  }
  if (id === 'cociente') {
    return (
      <LineaBaseChart
        serie={serie}
        columna="pred_coc"
        criterio={criterio}
        etiquetaPred="Línea base (población × cociente)"
      />
    )
  }
  if (id === 'regresion') {
    return (
      <LineaBaseChart
        serie={serie}
        columna="pred_reg"
        criterio={criterio}
        etiquetaPred="Valor ajustado (OLS)"
      />
    )
  }
  return (
    <LineaBaseChart
      serie={serie}
      columna="pred_conf"
      criterio={criterio}
      etiquetaPred="Energía virtual"
    />
  )
}

/** Métricas específicas de cada modelo. */
function Metricas({
  id,
  r,
  criterio,
}: {
  id: ModeloId
  r: ResultadoModelo
  criterio: CriterioDepuracion
}) {
  if (id === 'valor_absoluto') {
    const banda = r.rango_confianza_10_pct
    const ic = r.intervalo_confianza ?? null
    return (
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metrica
          label="Línea base (kWh/mes)"
          valor={fmt1.format(r.consumo_promedio_mensual ?? 0)}
        />
        <Metrica label="Mediana" valor={fmt1.format(r.consumo_mediana ?? 0)} />
        <Metrica
          label="Desv. estándar"
          valor={fmt1.format(r.desvio_estandar ?? 0)}
        />
        <Metrica
          label={`IC ec.(4) · ±${UPME_K_INTERVALO}·DesvEst`}
          valor={
            ic
              ? `${fmtEntero.format(ic[0])} – ${fmtEntero.format(ic[1])}`
              : 'N < 10 (ec. 3)'
          }
        />
        <Metrica
          label="Banda ±10 %"
          valor={
            banda
              ? `${fmtEntero.format(banda[0])} – ${fmtEntero.format(banda[1])}`
              : '—'
          }
        />
        <Metrica label="MAPE" valor={`${fmt2.format(r.mape ?? 0)} %`} />
        <Metrica label="R² (definicional)" valor={fmt2.format(r.r2 ?? 1)} />
        <Metrica
          label="Depuración"
          valor={TEXTOS_CRITERIO[criterio].nombre}
        />
      </dl>
    )
  }
  if (id === 'cociente') {
    return (
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metrica
          label={`Cociente (kWh/${r.unidad ?? 'unidad'}·mes)`}
          valor={fmt4.format(r.cociente_estimado ?? 0)}
        />
        <Metrica
          label="Variable ref. promedio"
          valor={fmt1.format(r.variable_referencia_promedio ?? 0)}
        />
        <Metrica label="Consumo promedio" valor={fmt1.format(r.consumo_promedio ?? 0)} />
        <Metrica
          label="Desv. estándar (cocientes)"
          valor={
            r.desvio_estandar != null ? fmt4.format(r.desvio_estandar) : '—'
          }
        />
        <Metrica label="R²" valor={fmt2.format(r.r2 ?? 0)} />
        <Metrica label="MAPE" valor={`${fmt2.format(r.mape ?? 0)} %`} />
      </dl>
    )
  }
  if (id === 'regresion') {
    const coef = r.coeficientes ?? {}
    const ps = r.p_values ?? {}
    return (
      <div className="space-y-2">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Metrica label="R²" valor={fmt2.format(r.r2 ?? 0)} />
          <Metrica label="R² ajustado" valor={fmt2.format(r.r2_ajustado ?? 0)} />
          <Metrica label="Estadístico F" valor={fmt1.format(r.f_statistic ?? 0)} />
          <Metrica label="MAPE" valor={`${fmt2.format(r.mape ?? 0)} %`} />
          <Metrica
            label="Desv. estándar"
            valor={
              r.desvio_estandar != null ? fmt1.format(r.desvio_estandar) : '—'
            }
          />
        </dl>
        <dl className="space-y-1.5">
          {(r.variables_explicativas_usadas ?? Object.keys(coef)).map((v) => (
            <div
              key={v}
              className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
            >
              <dt className="font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">
                β<sub>{v}</sub> = {fmt4.format(coef[v] ?? 0)}
              </dt>
              <dd className="text-xs text-gray-500 dark:text-gray-400">
                p = {ps[v] !== undefined ? fmtPValue(ps[v]) : '—'}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    )
  }
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Metrica
        label="Temperatura"
        valor={`${fmt1.format(r.temperatura_promedio ?? 0)} °C`}
      />
      <Metrica label="Modo" valor={r.modo_operacion ?? '—'} />
      <Metrica label="ΔT vs 23,9 °C" valor={`${fmt2.format(r.delta_temperatura ?? 0)} °C`} />
      <Metrica label="Consumo base" valor={fmt1.format(r.consumo_base_kwh ?? 0)} />
      <Metrica label="Energía virtual" valor={fmt1.format(r.energia_virtual_kwh ?? 0)} />
      <Metrica
        label="Rango ASHRAE 55"
        valor={r.en_rango_confort ? 'En rango' : 'Fuera de rango'}
      />
    </dl>
  )
}

export type LineasBaseProps = {
  /** Total de modelos guardados en BD (viene de `stats.lineasBase`). */
  total?: number
  /** Edificaciones para el selector de ámbito del cálculo. */
  edificaciones?: { id: string; nombre: string }[]
  /** Bloques disponibles para el selector de alcance del cálculo. */
  bloques?: { id: string; codigo: string; nombre: string; edificacionId?: string }[]
  /** Espacios disponibles (hijos de los bloques) para el selector. */
  espacios?: { id: string; bloqueId: string; nombre: string }[]
  /** Permiso `analyze` — habilita el botón Calcular. */
  puedeCalcular?: boolean
  /** Permiso `upload` — habilita el botón Guardar. */
  puedeGuardar?: boolean
}

/**
 * Clave del select de alcance: `global` | `b:<bloqueId>` | `e:<espacioId>`.
 * `edificacionId` acota el cálculo a una edificación; vacío = todas.
 */
function parseAlcance(clave: string, edificacionId?: string): AlcanceSolicitud {
  const base = { edificacionId: edificacionId || null }
  if (clave.startsWith('b:')) return { tipo: 'bloque', id: clave.slice(2), ...base }
  if (clave.startsWith('e:')) return { tipo: 'espacio', id: clave.slice(2), ...base }
  return { tipo: 'global', ...base }
}

export function LineasBase({
  total,
  edificaciones = [],
  bloques = [],
  espacios = [],
  puedeCalcular = false,
  puedeGuardar = false,
}: LineasBaseProps) {
  const router = useRouter()
  const [modelo, setModelo] = React.useState<ModeloId>('valor_absoluto')
  // Ámbito por defecto: todas las edificaciones (comportamiento histórico)
  const [edificacionClave, setEdificacionClave] = React.useState('')
  // Alcance por defecto: el primer bloque si existe (guardar aplica a
  // nivel de bloque), si no, el total global.
  const [alcanceClave, setAlcanceClave] = React.useState(
    () => (bloques.length > 0 ? `b:${bloques[0].id}` : 'global')
  )

  const [cargando, setCargando] = React.useState(false)
  const [errorCalculo, setErrorCalculo] = React.useState<string | null>(null)
  const [calc, setCalc] = React.useState<CalculoLineaBase | null>(null)

  const [guardados, setGuardados] = React.useState<
    Partial<Record<ModeloLbenId, string>>
  >({})
  const [guardando, setGuardando] = React.useState<ModeloLbenId | null>(null)
  const [errorGuardado, setErrorGuardado] = React.useState<string | null>(null)

  const M = MODELOS[modelo]
  const estado: CalculoLineaBase['resultados'][ModeloId] | undefined =
    calc?.resultados[modelo]
  const lbKwh =
    calc && estado?.estado === 'ok'
      ? lineaBaseKwh(modelo, estado.resultado, calc.serie)
      : null

  // Gate de conformidad UPME: el cálculo es libre (sirve para diagnóstico),
  // pero sin 36 meses depurados o sin los 12 meses con ≥ 3 valores (3×12)
  // no se puede persistir la LB.
  const conformeParaGuardar =
    calc !== null &&
    calc.depurados >= UPME_MIN_MESES &&
    calc.mesesInsuficientes.length === 0

  async function calcular() {
    setCargando(true)
    setErrorCalculo(null)
    setErrorGuardado(null)
    const res = await calcularModelosLineaBase(
      parseAlcance(alcanceClave, edificacionClave)
    )
    setCargando(false)
    if (res.ok) {
      setCalc(res.calculo)
      setGuardados({})
    } else {
      setCalc(null)
      setErrorCalculo(res.error)
    }
  }

  async function guardar(id: ModeloLbenId) {
    const previo = calc?.resultados[id]
    const bloqueId = calc?.alcance.tipo === 'bloque' ? calc.alcance.bloqueId : null
    if (!calc || !bloqueId || previo?.estado !== 'ok') return
    setGuardando(id)
    setErrorGuardado(null)
    const res = await guardarLineaBase({
      bloqueId,
      modelo: id,
      resultado: previo.resultado as unknown as Record<string, unknown>,
      depurados: calc.depurados,
      mesesInsuficientes: calc.mesesInsuficientes,
      origen: calc.origen,
    })
    setGuardando(null)
    if (res.ok) {
      setGuardados((prev) => ({ ...prev, [id]: new Date().toISOString() }))
      router.refresh()
    } else {
      setErrorGuardado(res.error)
    }
  }

  function cambiarAlcance(clave: string) {
    setAlcanceClave(clave)
    setCalc(null)
    setErrorCalculo(null)
    setErrorGuardado(null)
    setGuardados({})
  }

  function cambiarEdificacion(id: string) {
    setEdificacionClave(id)
    // El alcance anterior puede no pertenecer a la nueva edificación:
    // se vuelve al primer bloque visible (o al total).
    const bloquesNuevos = id ? bloques.filter((b) => b.edificacionId === id) : bloques
    setAlcanceClave(bloquesNuevos.length > 0 ? `b:${bloquesNuevos[0].id}` : 'global')
    setCalc(null)
    setErrorCalculo(null)
    setErrorGuardado(null)
    setGuardados({})
  }

  // Bloques/espacios visibles acotados a la edificación elegida
  const bloquesVisibles = edificacionClave
    ? bloques.filter((b) => b.edificacionId === edificacionClave)
    : bloques
  const idsBloquesVisibles = new Set(bloquesVisibles.map((b) => b.id))
  const espaciosVisibles = espacios.filter((e) => idsBloquesVisibles.has(e.bloqueId))
  const edificacionSel = edificaciones.find((e) => e.id === edificacionClave)

  return (
    <div className="space-y-4">
      {/* Encabezado centrado + navegación de modelos */}
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="mx-auto max-w-2xl">
          <p className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <span
              className="h-1.5 w-1.5 rounded-full bg-uv-lime"
              aria-hidden
            />
            Línea base energética · UPME 0016
          </p>
          <h2 className="ui-title mt-1 text-lg">Líneas Base Energéticas</h2>
          <p className="ui-muted mt-1 text-sm">
            Modelos de línea base de consumo energético (LBEn). Seleccione un
            modelo para ver su fundamento, fórmula y criterios de calidad.
            {typeof total === 'number' && (
              <span className="ml-1 font-medium text-emerald-600 dark:text-emerald-400">
                {total} modelos guardados.
              </span>
            )}
          </p>
        </div>

        <div className="inline-flex flex-wrap justify-center rounded-xl border border-gray-200 bg-gray-100 p-1.5 dark:border-slate-700 dark:bg-slate-800">
          {MODELOS_LBEN.map((id) => {
            const def = MODELOS[id]
            const activa = modelo === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setModelo(id)}
                aria-pressed={activa}
                className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors duration-300 focus-ring ${
                  activa
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-500 hover:bg-white hover:text-gray-800 dark:text-gray-400 dark:hover:bg-slate-700 dark:hover:text-gray-200'
                }`}
              >
                <def.Icon />
                {def.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Controles de cálculo: edificación + alcance de la jerarquía + acción */}
      <div className="flex flex-wrap items-end justify-center gap-3">
        <div className="min-w-[260px]">
          <label htmlFor="edificacion-lben-sel" className="ui-label text-xs">
            Edificación
          </label>
          <select
            id="edificacion-lben-sel"
            className="ui-input mt-1 cursor-pointer"
            value={edificacionClave}
            onChange={(e) => cambiarEdificacion(e.target.value)}
          >
            <option value="">Todas las edificaciones</option>
            {edificaciones.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[300px]">
          <label htmlFor="alcance-lben-sel" className="ui-label text-xs">
            Alcance (jerarquía facturas → bloque → espacio)
          </label>
          <select
            id="alcance-lben-sel"
            className="ui-input mt-1 cursor-pointer"
            value={alcanceClave}
            onChange={(e) => cambiarAlcance(e.target.value)}
          >
            <option value="global">
              {edificacionSel
                ? `Total — facturas de energía (${edificacionSel.nombre})`
                : 'Total global — facturas de energía (todas las edificaciones)'}
            </option>
            {bloquesVisibles.length > 0 && (
              <optgroup label="Bloques">
                {bloquesVisibles.map((b) => (
                  <option key={b.id} value={`b:${b.id}`}>
                    {b.codigo} — {b.nombre}
                  </option>
                ))}
              </optgroup>
            )}
            {espaciosVisibles.length > 0 && (
              <optgroup label="Espacios de los bloques">
                {espaciosVisibles.map((e) => (
                  <option key={e.id} value={`e:${e.id}`}>
                    {e.nombre} (
                    {bloquesVisibles.find((b) => b.id === e.bloqueId)?.codigo ?? '—'})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
        <button
          type="button"
          onClick={calcular}
          disabled={!puedeCalcular || cargando}
          className="ui-btn ui-btn-primary"
        >
          {cargando ? 'Calculando…' : 'Calcular modelos'}
        </button>
        {!puedeCalcular && (
          <p className="ui-muted w-full text-center text-xs">
            Su rol no tiene permiso para calcular (requiere permiso «Analiza»
            en el módulo de Registro de Consumo).
          </p>
        )}
      </div>

      {errorCalculo && (
        <div className="ui-callout ui-callout-danger" role="alert">
          {errorCalculo}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ═══ Panel del modelo activo ═══ */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 md:p-5 dark:border-slate-800 dark:bg-slate-900/60">
            {/* Identidad del modelo */}
            <div className="mb-4 flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white">
                <M.Icon />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {M.subtitulo}
                </p>
                <h5 className="ui-title mt-0.5 text-base">{M.label}</h5>
                <p className="ui-muted mt-1 text-sm leading-relaxed">
                  {M.concepto}
                </p>
              </div>
            </div>

            {/* Fórmula */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Fórmula
              </p>
              <code className="mt-2 block font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                {M.formula}
              </code>
              {M.formulaNota && (
                <code className="mt-1 block font-mono text-xs text-emerald-600 dark:text-emerald-400">
                  {M.formulaNota}
                </code>
              )}
            </div>

            {/* Variables */}
            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Variables
              </p>
              <dl className="mt-2 space-y-2">
                {M.variables.map((v) => (
                  <div
                    key={v.nombre}
                    className="rounded-lg border border-gray-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <dt className="font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">
                      {v.nombre}
                    </dt>
                    <dd className="mt-0.5 text-xs leading-snug text-gray-500 dark:text-gray-400">
                      {v.detalle}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Datos de entrada */}
            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Datos de entrada
              </p>
              <ul className="mt-2 space-y-1.5">
                {M.entradas.map((e) => (
                  <li
                    key={e}
                    className="flex items-start gap-2 text-xs leading-snug text-gray-500 dark:text-gray-400"
                  >
                    <CheckChico className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    {e}
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>

        {/* ═══ Criterios, salida y ejemplo ═══ */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Criterios de calidad UPME 0016
            </p>
            <ul className="mt-3 space-y-2">
              {CRITERIOS.map((c) => (
                <li
                  key={c}
                  className="flex items-start gap-2 text-xs leading-snug text-gray-500 dark:text-gray-400"
                >
                  <CheckChico className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  {c}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Salida del modelo
            </p>
            <ul className="mt-3 space-y-2">
              {M.salida.map((s) => (
                <li
                  key={s}
                  className="flex items-start gap-2 text-xs leading-snug text-gray-500 dark:text-gray-400"
                >
                  <CheckChico className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  {s}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Ejemplo ilustrativo
            </p>
            <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
              {M.ejemplo}
            </p>
          </div>
        </div>
      </div>

      {/* ═══ Banda de resultados a ancho completo (fuera de la tarjeta del modelo) ═══ */}
      {!calc && !errorCalculo && (
        <div className="ui-empty rounded-2xl border border-dashed border-gray-300 dark:border-slate-700">
          <p>
            Aún no se ha calculado este modelo con los datos reales de la base
            de datos. Elija un alcance de la jerarquía (facturas → bloque →
            espacio) y pulse «Calcular modelos».
          </p>
          {puedeCalcular && (
            <button
              type="button"
              onClick={calcular}
              disabled={cargando}
              className="ui-btn ui-btn-primary ui-btn-sm mt-1"
            >
              {cargando ? 'Calculando…' : 'Calcular modelos'}
            </button>
          )}
        </div>
      )}

      {calc && (
        <div className="space-y-4">
          {/* Cabecera de resultados */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/40">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Resultados reales
              </p>
              <span className="rounded-full bg-emerald-600/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                {calc.alcance.codigo}
              </span>
              <span className="text-xs text-gray-500 dark:text-slate-400">
                {calc.alcance.tipo === 'global'
                  ? 'Total global'
                  : calc.alcance.tipo === 'bloque'
                    ? 'Bloque'
                    : 'Espacio'}{' '}
                · share {fmt2.format(calc.alcance.share * 100)} %
              </span>
              {calc.origen === 'modelo_ingenieria' && (
                <span
                  title="Share derivado de la carga nominal de equipos dividida por la factura media global, no del área de los bloques."
                  className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                >
                  Share estimado
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 dark:text-slate-300">
              Cálculo del{' '}
              {new Date(calc.calculadoEn).toLocaleString('es-CO', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}{' '}
              · {fmtEntero.format(calc.depurados)} de{' '}
              {fmtEntero.format(calc.originales)} meses depurados (
              {TEXTOS_CRITERIO[calc.criterioDepuracion].nombre})
            </p>
          </div>

          {calc.aviso && (
            <div className="ui-callout ui-callout-warn" role="status">
              <p className="font-semibold">Aviso del cálculo</p>
              <p className="mt-1">{calc.aviso}</p>
            </div>
          )}

          {/* Métricas/puertas/guardado (2/5) + gráfica (3/5) */}
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="space-y-3 lg:col-span-2">
              {estado?.estado === 'error' && (
                <div className="ui-callout ui-callout-warn" role="status">
                  <p className="font-semibold">
                    Modelo no aceptado por el motor.
                  </p>
                  <p className="mt-1">{estado.mensaje}</p>
                  <p className="mt-1 text-xs opacity-80">
                    Es un hallazgo válido de las puertas UPME: revise los
                    criterios de calidad o use otro modelo de línea base.
                  </p>
                </div>
              )}

              {estado?.estado === 'ok' && (
                <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <Metricas
                    id={modelo}
                    r={estado.resultado}
                    criterio={calc.criterioDepuracion}
                  />

                  {/* Puertas UPME */}
                  <ul className="flex flex-wrap gap-1.5">
                    {construirPuertas(modelo, estado.resultado, calc).map(
                      (p) => (
                      <li
                        key={p.label}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          p.ok
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                        }`}
                      >
                        {p.ok ? <CheckChico /> : <span aria-hidden>✗</span>}
                        {p.label}
                      </li>
                    ))}
                  </ul>

                  {/* Guardado explícito (solo a nivel de bloque) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-slate-800">
                    <p className="ui-muted text-xs">
                      {calc.alcance.tipo !== 'bloque'
                        ? 'El guardado oficial aplica a nivel de bloque: elija un bloque como alcance para guardar.'
                        : conformeParaGuardar
                          ? 'Guardar persiste este resultado como línea base oficial del bloque (LineaBaseEnergia).'
                          : calc.mesesInsuficientes.length > 0
                            ? `Faltan al menos ${UPME_MIN_VALORES_MES} valores en el(los) mes(es) ${calc.mesesInsuficientes.join(', ')} (regla 3×12) y se exigen ${UPME_MIN_MESES} meses depurados: hay ${calc.depurados}. El cálculo sirve para diagnóstico.`
                            : `Se requieren al menos ${UPME_MIN_MESES} meses depurados para persistir una línea base conforme: hay ${calc.depurados}. El cálculo sirve para diagnóstico.`}
                    </p>
                    {calc.alcance.tipo === 'bloque' &&
                      puedeGuardar &&
                      conformeParaGuardar && (
                      <button
                        type="button"
                        onClick={() => guardar(modelo)}
                        disabled={
                          guardando !== null ||
                          guardados[modelo] !== undefined
                        }
                        className={`ui-btn ui-btn-sm ${
                          guardados[modelo]
                            ? 'ui-btn-secondary'
                            : 'ui-btn-accent'
                        }`}
                      >
                        {guardando === modelo
                          ? 'Guardando…'
                          : guardados[modelo]
                            ? 'Guardado ✓'
                            : 'Guardar modelo'}
                      </button>
                    )}
                    {calc.alcance.tipo === 'bloque' && !puedeGuardar && (
                      <p className="ui-muted text-xs">
                        Su rol no tiene permiso para guardar (requiere «Carga»).
                      </p>
                    )}
                  </div>

                  {errorGuardado && (
                    <p
                      className="text-xs font-medium text-red-600 dark:text-red-400"
                      role="alert"
                    >
                      {errorGuardado}
                    </p>
                  )}
                </div>
              )}
            </div>

            {estado?.estado === 'ok' && (
              <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-3">
                <GraficaPara
                  id={modelo}
                  serie={calc.serie}
                  criterio={calc.criterioDepuracion}
                />
              </div>
            )}
          </div>

          {/* Tablas de transparencia a todo el ancho */}
          <TablaPreparacion
            preparacion={calc.preparacion}
            bandas={calc.bandas}
            criterio={calc.criterioDepuracion}
          />
          <TablaJerarquia
            jerarquia={calc.jerarquia}
            lbKwh={lbKwh}
            alcance={calc.alcance}
          />
        </div>
      )}

      <LineasBasePreguntas />
    </div>
  )
}

import type { ReactNode } from 'react'

import type {
  Alcance,
  CriterioDepuracion,
  DepuracionBandas,
  FilaPreparacion,
  NodoJerarquia,
} from '@/features/datos/models/lineasBase'
import { TEXTOS_CRITERIO } from '@/features/datos/models/lineasBase'

/**
 * Tablas de transparencia del cálculo de LBEn:
 *
 * - `TablaPreparacion`: qué le pasa a cada factura antes de modelar
 *   (crudo → normalizado a 30 d → asignado al alcance → decisión de la
 *   banda del mes: ±10 % (ec. 3); ajustes no rutinarios Anexo 4 corrigen
 *   anómalos antes de la verificación; §7.5.1).
 * - `TablaJerarquia`: cómo se segmenta el consumo por la cadena
 *   facturas → bloques → espacios y la línea base desglosada por nodo.
 *
 * Presentación pura: los datos llegan armados desde
 * `calcularModelosLineaBase`.
 */

const fmtEntero = new Intl.NumberFormat('es-CO')
const fmt1 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })
const fmt2 = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

function formatoPeriodo(periodo: string): string {
  const [ano, mes] = periodo.split('-').map(Number)
  if (!ano || !mes || mes < 1 || mes > 12) return periodo
  return `${MESES_CORTOS[mes - 1]} ${ano}`
}

function Th({ children, align = 'right' }: { children: ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap bg-gray-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:bg-slate-900 dark:text-slate-400 ${
        align === 'left' ? 'text-left' : 'text-right'
      }`}
    >
      {children}
    </th>
  )
}

function EstadoCelda({
  fila,
  criterio,
}: {
  fila: FilaPreparacion
  criterio: CriterioDepuracion
}) {
  if (!fila.descartado) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        Incluido
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">
      Descartado ·{' '}
      {fila.motivoDescarte === 'cero'
        ? '≤ 0'
        : TEXTOS_CRITERIO[criterio].descarte}
    </span>
  )
}

export function TablaPreparacion({
  preparacion,
  bandas,
  criterio = 'banda_10_pct',
}: {
  preparacion: FilaPreparacion[]
  bandas: DepuracionBandas[]
  criterio?: CriterioDepuracion
}) {
  const descartadas = preparacion.filter((f) => f.descartado).length
  const share = preparacion[0]?.share ?? null
  const fueraBanda = bandas.reduce((suma, b) => suma + b.descartados, 0)
  const estimados = bandas.filter((b) => b.estimado).map((b) => b.mes)
  const textos = TEXTOS_CRITERIO[criterio]

  return (
    <section className="rounded-2xl border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-gray-100 px-4 py-3 dark:border-slate-800">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Preparación y depuración de los datos
          </p>
          <p className="ui-muted mt-0.5 text-xs">
            De la factura de energía a la serie que entra al motor: normalización a
            30 días, asignación por share y {textos.nombre} por mes.
          </p>
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          {fmtEntero.format(preparacion.length)} meses ·{' '}
          {fmtEntero.format(descartadas)} descartados
          {share !== null && (
            <> · share aplicado {fmt2.format(share * 100)} %</>
          )}
        </p>
      </div>

      <div className="border-b border-gray-100 bg-emerald-50/60 px-4 py-2 text-xs text-gray-600 dark:border-slate-800 dark:bg-emerald-950/30 dark:text-slate-300">
        Banda ±10 % por mes (§7.5.1, ec. 3); ajustes no rutinarios Anexo 4 corrigen anómalos antes de la verificación:{' '}
        <strong className="font-semibold text-gray-900 dark:text-gray-100">
          {fueraBanda}
        </strong>{' '}
        valor(es) fuera de la banda de su mes se descartaron y la media se
        recalculó. Los meses con menos de 3 valores se calculan sin banda
        {estimados.length > 0 ? (
          <>
            :{' '}
            <strong className="font-semibold text-gray-900 dark:text-gray-100">
              {estimados.join(', ')}
            </strong>{' '}
            (estimado)
          </>
        ) : (
          <>: ninguno (3×12 completo)</>
        )}
        .
      </div>

      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              <Th align="left">Periodo</Th>
              <Th>Factura cruda (kWh)</Th>
              <Th>Días</Th>
              <Th>Costo (COP)</Th>
              <Th>Normalizado 30 d (kWh)</Th>
              <Th>Asignado al alcance (kWh)</Th>
              <Th align="left">Estado</Th>
            </tr>
          </thead>
          <tbody>
            {preparacion.map((f) => (
              <tr
                key={f.periodo}
                className={`border-t border-gray-100 dark:border-slate-800/70 ${
                  f.descartado
                    ? 'bg-red-50/50 text-gray-400 dark:bg-red-950/20 dark:text-slate-500'
                    : 'hover:bg-gray-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <td className="whitespace-nowrap px-3 py-1.5 font-medium text-gray-900 dark:text-gray-100">
                  {formatoPeriodo(f.periodo)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {fmt1.format(f.consumoKwh)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {f.diasFacturados}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  $ {fmtEntero.format(f.costoCop)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {fmt1.format(f.consumoNormalizado)}
                </td>
                <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                  {fmt1.format(f.consumoAsignado)}
                </td>
                <td className="px-3 py-1.5">
                  <EstadoCelda fila={f} criterio={criterio} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const NIVEL_TEXTO: Record<NodoJerarquia['nivel'], string> = {
  global: 'Total',
  bloque: 'Bloque',
  espacio: 'Espacio',
}

const NIVEL_CLASE: Record<NodoJerarquia['nivel'], string> = {
  global:
    'bg-gray-900 text-white dark:bg-slate-100 dark:text-slate-900',
  bloque:
    'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white',
  espacio:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
}

const SANGRIA: Record<NodoJerarquia['nivel'], string> = {
  global: 'pl-3',
  bloque: 'pl-8',
  espacio: 'pl-14',
}

export function TablaJerarquia({
  jerarquia,
  lbKwh,
  alcance,
}: {
  jerarquia: NodoJerarquia[]
  lbKwh: number | null
  alcance: Alcance | null
}) {
  const esAlcance = (n: NodoJerarquia) =>
    alcance !== null &&
    ((alcance.tipo === 'global' && n.nivel === 'global') ||
      (alcance.id !== null && n.id === alcance.id))

  return (
    <section className="rounded-2xl border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-gray-100 px-4 py-3 dark:border-slate-800">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Jerarquía de segmentación
          </p>
          <p className="ui-muted mt-0.5 text-xs">
            Facturas → bloques → espacios: peso, share global y consumo
            promedio asignado a cada nodo. El share no es una participación
            que sume 100 %: es la fracción de la factura de energía que se asigna a
            cada nodo.
          </p>
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Línea base desglosada = LB del alcance × share acumulado
        </p>
      </div>

      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              <Th align="left">Nivel</Th>
              <Th align="left">Nodo</Th>
              <Th align="left">Criterio de peso</Th>
              <Th>Peso (ver criterio)</Th>
              <Th>Share global</Th>
              <Th>Consumo prom. (kWh/mes)</Th>
              <Th>Línea base (kWh/mes)</Th>
            </tr>
          </thead>
          <tbody>
            {jerarquia.map((n) => {
              const destacado = esAlcance(n)
              return (
                <tr
                  key={`${n.nivel}-${n.id ?? 'raiz'}`}
                  className={`border-t border-gray-100 dark:border-slate-800/70 ${
                    destacado
                      ? 'bg-emerald-50 dark:bg-emerald-950/30'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <td className="whitespace-nowrap px-3 py-1.5">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${NIVEL_CLASE[n.nivel]}`}
                    >
                      {NIVEL_TEXTO[n.nivel]}
                    </span>
                  </td>
                  <td
                    className={`whitespace-nowrap px-3 py-1.5 font-semibold text-gray-900 dark:text-gray-100 ${SANGRIA[n.nivel]}`}
                  >
                    {n.nivel === 'global' ? n.nombre : n.codigo}
                    {destacado && (
                      <span className="ml-1.5 text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                        ← alcance
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-gray-500 dark:text-slate-400">
                    {n.criterio}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {fmtEntero.format(Math.round(n.peso))}
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                    {fmt2.format(n.share * 100)} %
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {fmtEntero.format(Math.round(n.consumoPromedio))}
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                    {lbKwh !== null
                      ? fmtEntero.format(Math.round(lbKwh * n.share))
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

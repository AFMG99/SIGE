'use client'

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { IconCarga, IconImportar } from './icons'
import { EASE } from './motion'

/**
 * Mockups animados de la guía "Cómo funciona".
 *
 * Cada mock es una copia simplificada del UI real (importadores con paleta
 * emerald/amber, dropzone dashed, stepper; y el flujo de Líneas Base con
 * selector, gráfica y puertas UPME) animada por código con una máquina de
 * estados: `useStages` encadena timers y `AnimatePresence` revela los
 * bloques — sin dependencias más allá de framer-motion.
 */

export type MockProps = { isActive: boolean }

const EASE_MOCK: [number, number, number, number] = [0.25, 0.1, 0.25, 1]

const enter = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.35, ease: EASE_MOCK },
} as const

/** Avanza 1..N en los tiempos dados (ms); vuelve a 0 al desmontar/inactivo. */
function useStages(isActive: boolean, delaysMs: readonly number[]): number {
  const [stage, setStage] = React.useState(0)
  const key = delaysMs.join(',')
  React.useEffect(() => {
    if (!isActive) {
      setStage(0)
      return
    }
    setStage(0)
    const timers = key
      .split(',')
      .map((ms, i) => window.setTimeout(() => setStage(i + 1), Number(ms)))
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [isActive, key])
  return stage
}

/** Efecto de tecleo carácter a carácter (se detiene al desmontar). */
function useTyping(text: string, active: boolean, speedMs = 40): string {
  const [typed, setTyped] = React.useState('')
  React.useEffect(() => {
    if (!active) {
      setTyped('')
      return
    }
    setTyped('')
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setTyped(text.slice(0, i))
      if (i >= text.length) window.clearInterval(id)
    }, speedMs)
    return () => window.clearInterval(id)
  }, [text, active, speedMs])
  return typed
}

function Cursor({ tono = 'emerald' }: { tono?: 'emerald' | 'amber' }) {
  return (
    <motion.span
      animate={{ opacity: [1, 0] }}
      transition={{ repeat: Infinity, duration: 0.7 }}
      className={`font-bold ${tono === 'emerald' ? 'text-emerald-600' : 'text-amber-600'}`}
      aria-hidden
    >
      |
    </motion.span>
  )
}

type MockFrameProps = {
  titulo: string
  acento: 'emerald' | 'amber'
  children: React.ReactNode
}

function MockFrame({ titulo, acento, children }: MockFrameProps) {
  const barra = acento === 'emerald' ? 'bg-emerald-600' : 'bg-amber-600'
  return (
    <div
      className={`overflow-hidden rounded-xl border-2 shadow-lg ${
        acento === 'emerald' ? 'border-emerald-600/25' : 'border-amber-600/25'
      }`}
    >
      <div className={`flex items-center gap-2 px-4 py-2.5 ${barra}`}>
        <span className="text-xs font-semibold uppercase tracking-wider text-white">
          {titulo}
        </span>
      </div>
      <div className="space-y-3 bg-white dark:bg-slate-900 p-4">{children}</div>
    </div>
  )
}

function Chip({ children, tono = 'gray' }: { children: React.ReactNode; tono?: 'gray' | 'emerald' | 'amber' | 'red' }) {
  const tonos = {
    gray: 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${tonos[tono]}`}>
      {children}
    </span>
  )
}

function MockButton({ children }: { children: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white"
    >
      {children}
    </motion.button>
  )
}

function Dropzone({ texto }: { texto: React.ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 px-4 py-5 text-center">
      <IconCarga className="mx-auto h-6 w-6 text-emerald-600" />
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{texto}</div>
    </div>
  )
}

/* ══════════════════════════════════════
   MOCKS — Facturas de energía
   ══════════════════════════════════════ */

export function MockFacturaCarga({ isActive }: MockProps) {
  const stage = useStages(isActive, [400, 1300, 2200])
  const nombre = useTyping('facturas_energia_2024.csv', isActive)

  return (
    <MockFrame titulo="Paso 1 · Cargar archivo" acento="emerald">
      <Dropzone texto={<span>Arrastre aquí su XLSX o CSV</span>} />

      <AnimatePresence>
        {stage >= 1 && (
          <motion.div {...enter} className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-emerald-100 text-emerald-600">
              <IconCarga />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-gray-900 dark:text-gray-100">
                {nombre}
                {nombre.length < 'facturas_energia_2024.csv'.length && <Cursor />}
              </p>
              <p className="text-[10px] text-gray-400">CSV · 42 KB · leído en el navegador</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage >= 2 && (
          <motion.div {...enter} className="flex flex-wrap gap-2">
            <Chip tono="emerald">24 filas detectadas</Chip>
            <Chip>8 columnas</Chip>
            <Chip tono="emerald">Encabezados reconocidos</Chip>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{stage >= 3 && <MockButton>Continuar al mapeo</MockButton>}</AnimatePresence>
    </MockFrame>
  )
}

const MAPEO_FACTURAS: { desde: string; hacia: string }[] = [
  { desde: 'FECHA', hacia: 'fechaFactura' },
  { desde: 'TOTAL ($)', hacia: 'valorTotal' },
  { desde: 'CONSUMO (kWh)', hacia: 'consumoKwh' },
]

export function MockFacturaMapeo({ isActive }: MockProps) {
  const stage = useStages(isActive, [400, 1300, 2200])

  return (
    <MockFrame titulo="Paso 2 · Mapeo de columnas" acento="emerald">
      <div className="space-y-2">
        {MAPEO_FACTURAS.map((fila, i) => (
          <AnimatePresence key={fila.desde}>
            {stage >= i + 1 && (
              <motion.div
                {...enter}
                transition={{ ...enter.transition, delay: 0.05 * i }}
                className="flex items-center gap-2 text-xs"
              >
                <span className="rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-2 py-1 font-mono text-[11px] text-gray-600 dark:text-gray-300">
                  {fila.desde}
                </span>
                <span className="text-gray-400" aria-hidden>
                  →
                </span>
                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 font-mono text-[11px] text-emerald-700">
                  {fila.hacia}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>

      <AnimatePresence>
        {stage >= 2 && (
          <motion.div {...enter}>
            <Chip tono="emerald">Mapeo automático con autoMapear()</Chip>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage >= 3 && (
          <motion.div {...enter} className="space-y-2">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Todos los campos obligatorios asignados.</p>
            <MockButton>Continuar a vista previa</MockButton>
          </motion.div>
        )}
      </AnimatePresence>
    </MockFrame>
  )
}

type FilaPrevia = { fecha: string; total: string; consumo: string; error?: boolean }

const FILAS_PREVIA: FilaPrevia[] = [
  { fecha: '01/2024', total: '$ 4.820.000', consumo: '38.410' },
  { fecha: '02/2024', total: '$ 4.610.000', consumo: '36.902' },
  { fecha: '03/2024', total: '—', consumo: '31.220', error: true },
  { fecha: '04/2024', total: '$ 4.402.000', consumo: '35.110' },
]

export function MockFacturaVistaPrevia({ isActive }: MockProps) {
  const stage = useStages(isActive, [400, 1300, 2200])

  return (
    <MockFrame titulo="Paso 3 · Vista previa con validación" acento="emerald">
      <AnimatePresence>
        {stage >= 1 && (
          <motion.div {...enter} className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-2 text-center">
              <p className="text-sm font-semibold text-emerald-600">22</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Válidas</p>
            </div>
            <div className="rounded-lg border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-2 text-center">
              <p className="text-sm font-semibold text-red-600">2</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Con error</p>
            </div>
            <div className="rounded-lg border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-2 text-center">
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">0</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Duplicadas</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage >= 2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700"
          >
            <table className="w-full text-left text-[11px]">
              <caption className="sr-only">Vista previa simulada de facturas de energía.</caption>
              <thead className="bg-gray-50 dark:bg-slate-800 text-[10px] uppercase text-gray-500 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-2 py-1.5 font-medium">Fecha</th>
                  <th scope="col" className="px-2 py-1.5 font-medium">Total</th>
                  <th scope="col" className="px-2 py-1.5 font-medium">Consumo</th>
                </tr>
              </thead>
              <tbody>
                {FILAS_PREVIA.map((fila, i) => (
                  <motion.tr
                    key={fila.fecha}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.12 * i, duration: 0.3 }}
                    className={`border-t border-gray-100 dark:border-slate-700 ${fila.error ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-2 py-1.5">{fila.fecha}</td>
                    <td className={`px-2 py-1.5 ${fila.error ? 'font-semibold text-red-600' : ''}`}>
                      {fila.error ? 'dato inválido' : fila.total}
                    </td>
                    <td className="px-2 py-1.5">{fila.consumo}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage >= 3 && (
          <motion.div {...enter} className="space-y-2">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Listo para importar: <strong className="text-gray-900 dark:text-gray-100">22 filas válidas</strong>
            </p>
            <MockButton>Importar 22 filas</MockButton>
          </motion.div>
        )}
      </AnimatePresence>
    </MockFrame>
  )
}

export function MockFacturaResultado({ isActive }: MockProps) {
  const stage = useStages(isActive, [400, 2000])

  return (
    <MockFrame titulo="Paso 4 · Importación y resultado" acento="emerald">
      <AnimatePresence>
        {stage >= 1 && stage < 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
              <span>Enviando filas válidas…</span>
              <span>00:02</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
              <motion.div
                className="h-full rounded-full bg-emerald-500"
                initial={{ width: '5%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.6, ease: 'easeInOut' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage >= 2 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: EASE_MOCK }}
            className="space-y-3"
          >
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
                <IconImportar />
              </span>
              <div>
                <p className="text-xs font-semibold text-emerald-800">Importación finalizada</p>
                <p className="text-[10px] text-emerald-600">22 filas importadas · 2 con error</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-gray-50 dark:bg-slate-800 p-2">
                <p className="text-sm font-semibold text-emerald-600">22</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Importadas</p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-slate-800 p-2">
                <p className="text-sm font-semibold text-red-600">2</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Rechazadas</p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-slate-800 p-2">
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">0</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Duplicadas</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MockFrame>
  )
}

/* ══════════════════════════════════════
   MOCKS — Equipos eléctricos
   ══════════════════════════════════════ */

const EDIFICACIONES = ['Campus Bloque A', 'Administración Principal', 'Vivienda 1']

export function MockEquipoSegmento({ isActive }: MockProps) {
  const stage = useStages(isActive, [400, 1300, 2200])

  return (
    <MockFrame titulo="Paso 1 · Elegir segmento" acento="amber">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Edificación *
        </p>
        <div className="flex items-center justify-between rounded-lg border border-amber-300 dark:border-amber-600 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
          <span>{stage >= 3 ? 'Campus Bloque A' : 'Seleccione la edificación'}</span>
          <span className="text-gray-400" aria-hidden>
            ▾
          </span>
        </div>
      </div>

      <AnimatePresence>
        {stage >= 1 && stage < 3 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 shadow-md"
          >
            {EDIFICACIONES.map((nombre, i) => (
              <div
                key={nombre}
                className={`px-3 py-2 text-xs transition-colors duration-300 ${
                  stage >= 2 && i === 0
                    ? 'bg-amber-50 font-semibold text-amber-700'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                {nombre}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage >= 3 && (
          <motion.div {...enter} className="flex flex-wrap gap-2">
            <Chip tono="amber">Bloque A-101</Chip>
            <Chip tono="amber">Bloque A-102</Chip>
            <Chip>2 espacios</Chip>
          </motion.div>
        )}
      </AnimatePresence>
    </MockFrame>
  )
}

export function MockEquipoCarga({ isActive }: MockProps) {
  const stage = useStages(isActive, [400, 1300, 2200])
  const nombre = useTyping('inventario_electrico.csv', isActive)
  const columnas = ['bloque', 'espacio', 'tipo', 'cantidad', 'potencia_nominal']

  return (
    <MockFrame titulo="Paso 2 · Cargar archivo" acento="amber">
      <Dropzone texto={<span>CSV del inventario eléctrico</span>} />

      <AnimatePresence>
        {stage >= 1 && (
          <motion.div {...enter} className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-amber-100 text-amber-600">
              <IconCarga />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-gray-900 dark:text-gray-100">
                {nombre}
                {nombre.length < 'inventario_electrico.csv'.length && <Cursor tono="amber" />}
              </p>
              <p className="text-[10px] text-gray-400">CSV · 8 equipos · segmentado</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage >= 2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex flex-wrap gap-1.5"
          >
            {columnas.map((col, i) => (
              <motion.span
                key={col}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 * i, duration: 0.25 }}
                className="rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-gray-600 dark:text-gray-300"
              >
                {col}
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage >= 3 && (
          <motion.div {...enter} className="space-y-2">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Destino: <strong className="text-gray-900 dark:text-gray-100">Campus Bloque A / A-101</strong>
            </p>
            <MockButton>Continuar al mapeo</MockButton>
          </motion.div>
        )}
      </AnimatePresence>
    </MockFrame>
  )
}

const MAPEO_EQUIPOS: { desde: string; hacia: string; desdeStage: number }[] = [
  { desde: 'bloque', hacia: 'Bloque', desdeStage: 1 },
  { desde: 'espacio', hacia: 'Espacio', desdeStage: 2 },
  { desde: 'tipo', hacia: 'Tipo de equipo', desdeStage: 2 },
  { desde: 'usen_indicador', hacia: '¿En uso?', desdeStage: 3 },
]

export function MockEquipoMapeo({ isActive }: MockProps) {
  const stage = useStages(isActive, [400, 1300, 2200])

  return (
    <MockFrame titulo="Paso 3 · Mapeo con columnas adicionales" acento="amber">
      <div className="space-y-2">
        {MAPEO_EQUIPOS.map((fila) => (
          <AnimatePresence key={fila.desde}>
            {stage >= fila.desdeStage && (
              <motion.div {...enter} className="flex items-center gap-2 text-xs">
                <span className="rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-2 py-1 font-mono text-[11px] text-gray-600 dark:text-gray-300">
                  {fila.desde}
                </span>
                <span className="text-gray-400" aria-hidden>
                  →
                </span>
                <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 font-mono text-[11px] text-amber-700">
                  {fila.hacia}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>

      <AnimatePresence>
        {stage >= 2 && (
          <motion.div {...enter}>
            <Chip tono="amber">Columnas adicionales del inventario</Chip>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage >= 3 && <MockButton>Continuar a vista previa</MockButton>}
      </AnimatePresence>
    </MockFrame>
  )
}

type FilaEquipo = { espacio: string; tipo: string; potencia: string; indicador: string }

const FILAS_EQUIPO: FilaEquipo[] = [
  { espacio: 'Aula 101', tipo: 'ILUMINACION', potencia: '800 W', indicador: 'ACTIVO' },
  { espacio: 'Aula 102', tipo: 'HVAC', potencia: '2.500 W', indicador: 'ACTIVO' },
  { espacio: 'Laboratorio 201', tipo: 'OFICINA', potencia: '350 W', indicador: 'INACTIVO' },
]

export function MockEquipoResultado({ isActive }: MockProps) {
  const stage = useStages(isActive, [400, 1300, 2200])

  return (
    <MockFrame titulo="Paso 4 · Vista previa e importación" acento="amber">
      <AnimatePresence>
        {stage >= 1 && (
          <motion.div {...enter} className="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
            <Chip tono="amber">Campus Bloque A</Chip>
            <span aria-hidden>›</span>
            <Chip tono="amber">A-101</Chip>
            <span aria-hidden>›</span>
            <Chip>8 equipos</Chip>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage >= 2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700"
          >
            <table className="w-full text-left text-[11px]">
              <caption className="sr-only">Vista previa simulada del inventario eléctrico.</caption>
              <thead className="bg-gray-50 dark:bg-slate-800 text-[10px] uppercase text-gray-500 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-2 py-1.5 font-medium">Espacio</th>
                  <th scope="col" className="px-2 py-1.5 font-medium">Tipo</th>
                  <th scope="col" className="px-2 py-1.5 font-medium">Potencia</th>
                </tr>
              </thead>
              <tbody>
                {FILAS_EQUIPO.map((fila, i) => (
                  <motion.tr
                    key={fila.espacio}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.12 * i, duration: 0.3 }}
                    className="border-t border-gray-100 dark:border-slate-700"
                  >
                    <td className="px-2 py-1.5">{fila.espacio}</td>
                    <td className="px-2 py-1.5">{fila.tipo}</td>
                    <td className="px-2 py-1.5">{fila.potencia}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage >= 3 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: EASE_MOCK }}
            className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-600 text-white">
              <IconImportar />
            </span>
            <div>
              <p className="text-xs font-semibold text-amber-800">Importación finalizada</p>
              <p className="text-[10px] text-amber-700">8 equipos segmentados por bloque y espacio</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MockFrame>
  )
}

/* ══════════════════════════════════════
   MOCKS — Líneas Base
   ══════════════════════════════════════ */

const BLOQUES_LB = [
  'Bloque A-101 · 48 meses',
  'Bloque B-201 · 41 meses',
  'Vivienda V-03 · 37 meses',
]

export function MockLbBloque({ isActive }: MockProps) {
  const stage = useStages(isActive, [400, 1300, 2200])

  return (
    <MockFrame titulo="Paso 1 · Elegir bloque" acento="emerald">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Bloque *
        </p>
        <div className="flex items-center justify-between rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
          <span>{stage >= 3 ? 'Bloque A-101' : 'Seleccione el bloque'}</span>
          <span className="text-gray-400" aria-hidden>
            ▾
          </span>
        </div>
      </div>

      <AnimatePresence>
        {stage >= 1 && stage < 3 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700 shadow-md"
          >
            {BLOQUES_LB.map((nombre, i) => (
              <div
                key={nombre}
                className={`px-3 py-2 text-xs transition-colors duration-300 ${
                  stage >= 2 && i === 0
                    ? 'bg-emerald-50 font-semibold text-emerald-700'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                {nombre}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage >= 3 && (
          <motion.div {...enter} className="flex flex-wrap gap-2">
            <Chip tono="emerald">48 meses de historia</Chip>
            <Chip tono="emerald">Depurado con banda ±10 %</Chip>
            <Chip>Cumple ≥ 36 meses</Chip>
          </motion.div>
        )}
      </AnimatePresence>
    </MockFrame>
  )
}

export function MockLbCalcular({ isActive }: MockProps) {
  const stage = useStages(isActive, [400, 1600, 2600])

  return (
    <MockFrame titulo="Paso 2 · Calcular modelos" acento="emerald">
      <AnimatePresence>
        {stage >= 1 && stage < 2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
              <span>Ejecutando el motor Python…</span>
              <span>4 modelos</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
              <motion.div
                className="h-full rounded-full bg-emerald-500"
                initial={{ width: '5%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.4, ease: 'easeInOut' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage >= 2 && (
          <motion.div {...enter} className="flex flex-wrap gap-2">
            <Chip tono="emerald">Valor Absoluto</Chip>
            <Chip tono="emerald">Cociente</Chip>
            <Chip tono="emerald">Regresión</Chip>
            <Chip tono="emerald">Confort Térmico</Chip>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{stage >= 3 && <MockButton>Ver resultados</MockButton>}</AnimatePresence>
    </MockFrame>
  )
}

export function MockLbGrafica({ isActive }: MockProps) {
  const stage = useStages(isActive, [400, 1300, 2200])

  return (
    <MockFrame titulo="Paso 3 · Gráfica y puertas UPME" acento="emerald">
      <AnimatePresence>
        {stage >= 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-2"
          >
            <svg
              viewBox="0 0 240 72"
              className="h-16 w-full"
              role="img"
              aria-label="Serie real contra la línea base"
            >
              <motion.path
                d="M4 46 L24 40 L44 48 L64 38 L84 42 L104 34 L124 44 L144 36 L164 42 L184 32 L204 38 L224 36"
                fill="none"
                stroke="#059669"
                strokeWidth="2"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.1, ease: 'easeInOut' }}
              />
              <motion.line
                x1="4"
                y1="42"
                x2="224"
                y2="42"
                stroke="#d97706"
                strokeWidth="2"
                strokeDasharray="6 4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.5 }}
              />
            </svg>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Chip tono="emerald">Serie real</Chip>
              <Chip tono="amber">Línea base</Chip>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage >= 2 && (
          <motion.div {...enter} className="flex flex-wrap gap-2">
            <Chip tono="emerald">R² = 0,97</Chip>
            <Chip tono="emerald">p = 0,003</Chip>
            <Chip tono="emerald">MAPE = 3,1 %</Chip>
            <Chip>48 meses</Chip>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage >= 3 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: EASE_MOCK }}
            className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
              ✓
            </span>
            <p className="text-xs font-semibold text-emerald-800">4 de 4 puertas aprobadas</p>
          </motion.div>
        )}
      </AnimatePresence>
    </MockFrame>
  )
}

export function MockLbGuardar({ isActive }: MockProps) {
  const stage = useStages(isActive, [400, 1400])

  return (
    <MockFrame titulo="Paso 4 · Guardar modelo" acento="emerald">
      <AnimatePresence>
        {stage >= 1 && stage < 2 && <MockButton>Guardar modelo</MockButton>}
      </AnimatePresence>

      <AnimatePresence>
        {stage >= 2 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: EASE_MOCK }}
            className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
              <IconImportar />
            </span>
            <div>
              <p className="text-xs font-semibold text-emerald-800">Modelo guardado en la base</p>
              <p className="text-[10px] text-emerald-600">Conteo de líneas base: 4</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MockFrame>
  )
}

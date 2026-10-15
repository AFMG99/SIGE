'use client'

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  IconCarga,
  IconCociente,
  IconEquipo,
  IconFactura,
  IconImportar,
  IconLineaBase,
  IconMapeo,
  IconRegresion,
  IconResumen,
  IconVistaPrevia,
} from './icons'
import { EASE } from './motion'
import {
  MockEquipoCarga,
  MockEquipoMapeo,
  MockEquipoResultado,
  MockEquipoSegmento,
  MockFacturaCarga,
  MockFacturaMapeo,
  MockFacturaResultado,
  MockFacturaVistaPrevia,
  MockLbBloque,
  MockLbCalcular,
  MockLbGrafica,
  MockLbGuardar,
} from './ComoFuncionaMocks'

/**
 * "Cómo funciona" — guía interactiva con mockups animados por código.
 *
 * Patrón: un timeline de pasos a la izquierda (auto-play de 5 s que se
 * pausa al hover) y a la derecha un mockup del flujo real que avanza
 * por su máquina de estados. Cada paso lleva la descripción de la función
 * que demuestra + sus beneficios. Tres guías: Facturas, Equipos y Líneas Base.
 */

type Guia = 'facturas' | 'equipos' | 'lineas-base'

type Paso = {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  titulo: string
  subtitulo: string
  descripcion: string
  beneficios: string[]
  Mock: React.ComponentType<{ isActive: boolean }>
}

const PASOS_FACTURAS: Paso[] = [
  {
    icon: IconCarga,
    titulo: 'Cargar archivo',
    subtitulo: 'Arrastre y suelte',
    descripcion:
      'Suba un XLSX o CSV con las facturas de energía. El archivo se lee en el navegador: verá nombre, filas y columnas detectadas antes de enviar nada al servidor.',
    beneficios: [
      'XLSX y CSV sin plantilla',
      'Lectura local: aún no se sube',
      'Encabezados reconocidos al instante',
    ],
    Mock: MockFacturaCarga,
  },
  {
    icon: IconMapeo,
    titulo: 'Mapeo de columnas',
    subtitulo: 'autoMapear() en acción',
    descripcion:
      'Las columnas del archivo se asignan solas a los campos del sistema (fecha, valor, consumo). Puede ajustar cualquier asignación a mano antes de continuar.',
    beneficios: [
      'Mapeo automático y editable',
      'Campos obligatorios verificados',
      'Sin conocimiento técnico',
    ],
    Mock: MockFacturaMapeo,
  },
  {
    icon: IconVistaPrevia,
    titulo: 'Vista previa',
    subtitulo: 'Valide antes de importar',
    descripcion:
      'Cada fila se valida contra el esquema del sistema: verá cuántas son válidas, cuántas tienen errores y cuántas están duplicadas, con las filas problemáticas resaltadas.',
    beneficios: [
      'Conteo válido / error / duplicado',
      'Errores resaltados por fila',
      'Edición antes de importar',
    ],
    Mock: MockFacturaVistaPrevia,
  },
  {
    icon: IconImportar,
    titulo: 'Importación',
    subtitulo: 'Resultado en un clic',
    descripcion:
      'Al confirmar, solo se envían las filas válidas. Recibirá el resumen final: importadas, rechazadas y duplicadas.',
    beneficios: [
      'Envío solo al confirmar',
      'Resumen de resultados',
      'Manejo de conflictos',
    ],
    Mock: MockFacturaResultado,
  },
]

const PASOS_EQUIPOS: Paso[] = [
  {
    icon: IconResumen,
    titulo: 'Elegir segmento',
    subtitulo: 'Edificación, bloque y espacio',
    descripcion:
      'Antes de leer el archivo, elija o cree la edificación destino: el inventario queda segmentado por bloque y espacio desde el primer paso.',
    beneficios: [
      'Catálogo existente en vivo',
      'Cree edificaciones y bloques al momento',
      'Segmentación obligatoria',
    ],
    Mock: MockEquipoSegmento,
  },
  {
    icon: IconCarga,
    titulo: 'Cargar archivo',
    subtitulo: 'Inventario eléctrico',
    descripcion:
      'Suba el CSV con los equipos del segmento elegido: HVAC, iluminación, ofimática y motores. Se detectan las columnas adicionales del inventario.',
    beneficios: [
      'Columnas adicionales detectadas',
      'Lectura local del archivo',
      'Reconocimiento automático',
    ],
    Mock: MockEquipoCarga,
  },
  {
    icon: IconMapeo,
    titulo: 'Mapeo con columnas adicionales',
    subtitulo: 'Más campos que en facturas',
    descripcion:
      'Además de consumo y potencia, este flujo mapea bloque, espacio, tipo de equipo y el indicador de uso; todo autoasignado y editable.',
    beneficios: [
      'Mapeo de bloque / espacio / tipo',
      'Indicador de uso normalizado',
      'Editable antes de continuar',
    ],
    Mock: MockEquipoMapeo,
  },
  {
    icon: IconImportar,
    titulo: 'Vista previa e importación',
    subtitulo: 'Todo segmentado',
    descripcion:
      'Revise las filas ya asociadas a su segmento e importe: el resultado confirma cuántos equipos quedaron registrados por bloque y espacio.',
    beneficios: [
      'Vista previa por segmento',
      'Resumen de importación',
      'Sin duplicados',
    ],
    Mock: MockEquipoResultado,
  },
]

const PASOS_LINEAS_BASE: Paso[] = [
  {
    icon: IconLineaBase,
    titulo: 'Elegir bloque',
    subtitulo: 'Serie con mínimo 36 meses',
    descripcion:
      'Seleccione el bloque a evaluar: se recomiendan al menos 36 meses de consumo depurado para guardar oficialmente (con menos meses se guarda con advertencia y sugerencia de ajustes). La depuración usa la banda ±10 % de la ec. 3 (§7.5.1); los meses anómalos con causa conocida se corrigen mediante ajustes no rutinarios (Anexo 4) antes de la verificación, en lugar de ensanchar la banda o descartarlos.',
    beneficios: [
      'Mínimo 36 meses de historia',
      'Depuración ±10 % (ec. 3) + ajustes Anexo 4',
      'Criterios UPME 0016 / Auto 444/2024',
    ],
    Mock: MockLbBloque,
  },
  {
    icon: IconCociente,
    titulo: 'Calcular modelos',
    subtitulo: 'Los 4 modelos LBEn de una vez',
    descripcion:
      'Un solo clic ejecuta los 4 modelos de la Resolución UPME 0016 en el servidor: la serie se arma por bloque y un motor Python devuelve cada resultado.',
    beneficios: [
      'Los 4 modelos en un clic',
      'Motor Python en el servidor',
      'Errores tipados, sin pantallas rotas',
    ],
    Mock: MockLbCalcular,
  },
  {
    icon: IconRegresion,
    titulo: 'Gráfica y puertas UPME',
    subtitulo: 'Serie real vs línea base',
    descripcion:
      'Compare la serie real contra cada línea base y verifique las puertas de aceptación: ≥36 meses, regla 3×12, p ≤ 0,05 y MAPE ≤ 5 %, sin tope de R² (§7.5.3).',
    beneficios: [
      'Serie real vs predicha',
      'Semáforo por puerta',
      'R², p y MAPE al instante',
    ],
    Mock: MockLbGrafica,
  },
  {
    icon: IconImportar,
    titulo: 'Guardar modelo',
    subtitulo: 'Ud. decide qué persistir',
    descripcion:
      'La persistencia es explícita: si las puertas pasan, guarde el modelo en la base con su permiso de carga y el conteo de líneas base se refresca al instante.',
    beneficios: [
      'Guardado solo con su permiso',
      'Conteo actualizado al guardar',
      'Nada se guarda sin confirmar',
    ],
    Mock: MockLbGuardar,
  },
]

const GUIAS: Record<
  Guia,
  { label: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; pasos: Paso[]; intro: string }
> = {
  facturas: {
    label: 'Facturas de energía',
    Icon: IconFactura,
    pasos: PASOS_FACTURAS,
    intro: 'Importe facturas de energía en 4 pasos, con validación antes de enviar.',
  },
  equipos: {
    label: 'Equipos Eléctricos',
    Icon: IconEquipo,
    pasos: PASOS_EQUIPOS,
    intro: 'Inventario segmentado por edificación, bloque y espacio, en 4 pasos.',
  },
  'lineas-base': {
    label: 'Líneas Base',
    Icon: IconLineaBase,
    pasos: PASOS_LINEAS_BASE,
    intro: 'Modelos LBEn de la Resolución UPME 0016 en 4 pasos.',
  },
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
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

export type ComoFuncionaProps = {
  /** Desactiva el auto-play de 5 s (las stories lo pasan para tests deterministas). */
  autoPlay?: boolean
}

export function ComoFunciona({ autoPlay = true }: ComoFuncionaProps) {
  const [guia, setGuia] = React.useState<Guia>('facturas')
  const [paso, setPaso] = React.useState(0)
  const [direccion, setDireccion] = React.useState(1)
  const [pausado, setPausado] = React.useState(!autoPlay)
  const [enHover, setEnHover] = React.useState(false)

  const meta = GUIAS[guia]
  const pasos = meta.pasos
  const total = pasos.length
  const actual = pasos[paso]
  const MockActual = actual.Mock
  const acentoClase = 'text-emerald-600 dark:text-emerald-400'
  const acentoBg = 'bg-emerald-600'

  React.useEffect(() => {
    setPausado(!autoPlay)
  }, [autoPlay])

  React.useEffect(() => {
    setPaso(0)
    setDireccion(1)
  }, [guia])

  React.useEffect(() => {
    if (pausado || enHover) return
    const id = window.setInterval(() => {
      setDireccion(1)
      setPaso((p) => (p + 1) % total)
    }, 5000)
    return () => window.clearInterval(id)
  }, [pausado, enHover, total])

  const irA = (i: number) => {
    setDireccion(i > paso ? 1 : -1)
    setPaso(i)
  }

  const siguiente = () => {
    setDireccion(1)
    setPaso((p) => (p + 1) % total)
  }

  const anterior = () => {
    setDireccion(-1)
    setPaso((p) => (p - 1 + total) % total)
  }

  return (
    <div className="space-y-4">
      {/* Encabezado + toggle de guía */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="ui-title text-lg">Cómo funciona</h2>
          <p className="ui-muted text-sm">
            Guía animada del módulo: importadores y líneas base, cada paso describe la función y
            la ve en acción.
          </p>
        </div>

        <div data-pill-strip className="scrollbar-hide inline-flex max-w-full shrink-0 snap-x snap-mandatory overflow-x-auto rounded-xl border border-gray-200 bg-gray-100 p-1.5 dark:border-slate-700 dark:bg-slate-800 lg:justify-center lg:overflow-x-visible">
          {(Object.keys(GUIAS) as Guia[]).map((g) => {
            const G = GUIAS[g]
            const activa = guia === g
            return (
              <button
                key={g}
                type="button"
                onClick={() => setGuia(g)}
                aria-pressed={activa}
                className={`relative flex min-h-10 shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-colors duration-300 focus-ring lg:min-h-0 ${
                  activa ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {activa && (
                  <motion.span
                    layoutId="guia-pill-activa"
                    className={`absolute inset-0 rounded-lg ${acentoBg}`}
                    transition={{ duration: 0.3, ease: EASE }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <G.Icon />
                  {G.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ═══ Timeline de pasos ═══ */}
        <div
          className="space-y-3 lg:col-span-2"
          onMouseEnter={() => setEnHover(true)}
          onMouseLeave={() => setEnHover(false)}
        >
          {pasos.map((s, i) => {
            const Icon = s.icon
            const activo = i === paso
            const pasado = i < paso
            return (
              <button
                key={s.titulo}
                type="button"
                onClick={() => irA(i)}
                aria-current={activo ? 'step' : undefined}
                className={`relative flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-all duration-500 ${
                  activo
                    ? 'bg-white shadow-md border-emerald-500 dark:bg-slate-900 dark:border-emerald-600'
                    : pasado
                      ? 'border-transparent bg-white/60 hover:border-gray-200 dark:bg-slate-800/60 dark:hover:border-slate-700'
                      : 'border-transparent bg-transparent hover:bg-white/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg transition-all duration-500 ${
                    activo
                      ? `${acentoBg} text-white shadow-sm`
                      : pasado
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                        : 'bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-slate-500'
                  }`}
                >
                  {pasado ? <CheckChico /> : <Icon />}
                </span>

                <span className="min-w-0 flex-1 pt-0.5">
                  <span className="mb-0.5 flex items-center gap-2">
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wider ${
                        activo ? acentoClase : 'text-gray-400 dark:text-slate-500'
                      }`}
                    >
                      Paso {i + 1}
                    </span>
                    {activo && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="rounded-full bg-gray-900/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-gray-600 dark:bg-slate-100/10 dark:text-gray-300"
                      >
                        Actual
                      </motion.span>
                    )}
                  </span>
                  <span
                    className={`block text-sm font-semibold transition-colors ${
                      activo
                        ? 'text-gray-900 dark:text-gray-100'
                        : pasado
                          ? 'text-gray-500 dark:text-gray-400'
                          : 'text-gray-400 dark:text-slate-500'
                    }`}
                  >
                    {s.titulo}
                  </span>
                  <span
                    className={`block text-xs transition-colors ${
                      activo ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400/70 dark:text-slate-500'
                    }`}
                  >
                    {s.subtitulo}
                  </span>
                </span>

                {activo && (
                  <motion.span
                    layoutId="guia-paso-activo"
                    className="absolute bottom-3 left-0 top-3 w-1 rounded-full"
                    style={{ backgroundColor: '#00652e' }}
                    transition={{ duration: 0.3, ease: EASE }}
                  />
                )}
              </button>
            )
          })}

          {/* Navegación */}
          <div className="flex items-center justify-between px-1 pt-1">
            <div className="flex items-center gap-2">
              {pasos.map((s, i) => (
                <button
                  key={s.titulo}
                  type="button"
                  onClick={() => irA(i)}
                  aria-label={`Ir al paso ${i + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 focus-ring ${
                    i === paso ? 'w-6' : 'w-2 bg-gray-300 hover:bg-gray-400 dark:bg-slate-700 dark:hover:bg-slate-600'
                  } ${i === paso ? acentoBg : ''}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={anterior}
                aria-label="Paso anterior"
                className="focus-ring rounded-lg px-2.5 py-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-gray-200"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={siguiente}
                aria-label="Paso siguiente"
                className="focus-ring rounded-lg px-2.5 py-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-gray-200"
              >
                ›
              </button>
            </div>
          </div>

          {/* Estado del auto-play */}
          <div className="px-1">
            <button
              type="button"
              onClick={() => setPausado((v) => !v)}
              className="focus-ring flex items-center gap-2 text-xs text-gray-400 transition-colors hover:text-gray-600 dark:text-slate-500 dark:hover:text-gray-300"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  pausado ? 'bg-gray-400' : 'animate-pulse bg-emerald-500'
                }`}
                aria-hidden
              />
              {pausado ? 'Pausado' : 'Reproduciendo automáticamente'}
            </button>
          </div>
        </div>

        {/* ═══ Mockup animado + descripción ═══ */}
        <div
          className="lg:col-span-3"
          onMouseEnter={() => setEnHover(true)}
          onMouseLeave={() => setEnHover(false)}
        >
          {/* El mockup desliza con `x` entre pasos: el escenario lo recorta para
              que la transición no abra scroll horizontal en el documento. */}
          <div className="relative min-h-[440px] overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 p-4 md:p-5 dark:border-slate-800 dark:bg-slate-900/60">
            {/* Encabezado del paso activo */}
            <div key={`cab-${guia}-${paso}`} className="mb-4 flex items-start gap-3">
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: EASE }}
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white ${acentoBg}`}
              >
                <actual.icon />
              </motion.span>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="min-w-0"
              >
                <p className={`text-[11px] font-bold uppercase tracking-wider ${acentoClase}`}>
                  Paso {paso + 1} · {actual.subtitulo}
                </p>
                <h5 className="ui-title mt-0.5 text-base">{actual.titulo}</h5>
                <p className="ui-muted mt-1 text-sm leading-relaxed">{actual.descripcion}</p>
              </motion.div>
            </div>

            {/* Mockup con transición entre pasos */}
            <AnimatePresence mode="wait" custom={direccion}>
              <motion.div
                key={`${guia}-${paso}`}
                custom={direccion}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: EASE }}
              >
                <MockActual isActive />
              </motion.div>
            </AnimatePresence>

            {/* Beneficios de la función (se re-animan por paso) */}
            <div key={`ben-${guia}-${paso}`} className="mt-4 grid gap-2 sm:grid-cols-3">
              {actual.beneficios.map((b, i) => (
                <motion.div
                  key={b}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.08, duration: 0.35, ease: EASE }}
                  className={`flex items-start gap-2 rounded-lg border bg-white/80 p-2.5 backdrop-blur-sm dark:border-emerald-900 dark:bg-slate-900/80`}
                >
                  <CheckChico className={`mt-0.5 shrink-0 ${acentoClase}`} />
                  <span className="text-xs leading-snug text-gray-500 dark:text-gray-400">{b}</span>
                </motion.div>
              ))}
            </div>

            {/* Indicador de auto-play */}
            <div className="absolute bottom-3 right-4">
              <button
                type="button"
                onClick={() => setPausado((v) => !v)}
                className="focus-ring flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 transition-colors hover:text-gray-600 dark:text-slate-500 dark:hover:text-gray-300"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    pausado ? 'bg-gray-400' : 'animate-pulse bg-emerald-500'
                  }`}
                  aria-hidden
                />
                {pausado ? 'Manual' : 'Auto'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

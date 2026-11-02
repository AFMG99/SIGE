'use client'

import React, { useState, useTransition } from 'react'
import type { DatosReporteUPME, PeriodicidadReporte } from '../models/reportes'
import { obtenerDatosReporte } from '../controllers/reportesController'
import { SeriesChart, BarList } from '@/shared/views/charts'

export interface EdificacionOpcion {
  id: string
  nombre: string
}

export interface BloqueOpcion {
  id: string
  edificacionId: string
  codigo: string
  nombre: string
}

export interface ReportesViewProps {
  edificaciones: EdificacionOpcion[]
  bloques: BloqueOpcion[]
  datosIniciales?: DatosReporteUPME | null
  puedeGenerar: boolean
  puedeDescargar: boolean
}

type TabReporte = 'generalidades' | 'lben' | 'ahorros' | 'historico'

function formatearDato(value: number | null): string {
  return value === null ? 'No registrado' : value.toLocaleString('es-CO')
}

export function ReportesView({
  edificaciones,
  bloques,
  datosIniciales = null,
  puedeGenerar,
  puedeDescargar,
}: ReportesViewProps) {
  const [edificacionId, setEdificacionId] = useState<string>(
    edificaciones[0]?.id ?? ''
  )
  const [bloqueId, setBloqueId] = useState<string>('')
  const [periodicidad, setPeriodicidad] = useState<PeriodicidadReporte>('mes')
  const [datos, setDatos] = useState<DatosReporteUPME | null>(datosIniciales)
  const [tabActiva, setTabActiva] = useState<TabReporte>('generalidades')
  const [mensajeError, setMensajeError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [descargando, setDescargando] = useState<'pdf' | 'docx' | null>(null)

  const bloquesDisponibles = bloques.filter(
    (b) => b.edificacionId === edificacionId
  )

  const handleConsultar = () => {
    setMensajeError(null)
    startTransition(async () => {
      const res = await obtenerDatosReporte({
        edificacionId,
        bloqueId: bloqueId || undefined,
        periodicidad,
      })

      if (res.estado === 'ok') {
        setDatos(res.datos)
      } else {
        setMensajeError(res.mensaje)
      }
    })
  }

  const handleDescargar = async (formato: 'pdf' | 'docx') => {
    setDescargando(formato)
    setMensajeError(null)
    try {
      const res = await fetch('/api/reportes/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          edificacionId,
          bloqueId: bloqueId || undefined,
          periodicidad,
          formato,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || 'Error al descargar el archivo')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const extension = formato === 'docx' ? 'docx' : 'pdf'
      a.download = `Reporte_UPME_0016_${formato.toUpperCase()}.${extension}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setMensajeError(err instanceof Error ? err.message : 'Error en la descarga')
    } finally {
      setDescargando(null)
    }
  }

  // Preparación de datos para la gráfica interactiva de Línea Base
  const etiquetasGrafica = datos?.historico.filas.map((f) => f.periodo) ?? []
  const valoresConsumo = datos?.historico.filas.map((f) => f.consumoNormalizado) ?? []
  const valorLben = datos?.lineaBase.consumoBaseMensualKwh ?? null
  const mostrarLben = valorLben !== null && periodicidad === 'mes'
  const valoresLben =
    !mostrarLben ? [] : etiquetasGrafica.map(() => valorLben)

  const seriesGrafica = [
    {
      clave: 'consumo',
      nombre:
        periodicidad === 'mes'
          ? 'Consumo Norm. 30d (kWh)'
          : 'Consumo normalizado agregado (kWh)',
      valores: valoresConsumo,
      tipo: 'area' as const,
      color: 'forest' as const,
    },
    ...(!mostrarLben
      ? []
      : [
          {
            clave: 'lben',
            nombre: 'Línea Base LBEn (E0)',
            valores: valoresLben,
            tipo: 'linea' as const,
            color: 'sky' as const,
          },
        ]),
  ]

  // Datos para BarList de inventario
  const datosBarrasInventario =
    datos?.inventario.categorias.map((c) => ({
      clave: c.categoria,
      etiqueta: c.categoria,
      valor: c.potenciaTotalKw,
      textoValor: `${c.potenciaTotalKw.toLocaleString('es-CO')} kW (${c.participacionPct}%)`,
      color: 'forest' as const,
    })) ?? []

  // Datos para BarList de medidas de eficiencia
  const datosBarrasMedidas =
    datos?.ahorros.medidasEficiencia.flatMap((m, idx) =>
      m.ahorroEstimadoPct === null
        ? []
        : [
            {
              clave: `medida-${idx}`,
              etiqueta: m.medida,
              valor: m.ahorroEstimadoPct,
              textoValor: `${m.ahorroEstimadoPct}% ahorro`,
              color: 'sky' as const,
            },
          ]
    ) ?? []

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Encabezado Institucional */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
            Resolución UPME 0016 de 2024 · Art. 237 Ley 2294 de 2023
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Reportes Técnicos de Gestión Energética
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
            Consulta y exportación de datos energéticos registrados, con referencia a la Resolución
            UPME 0016 de 2024. El informe no constituye una certificación regulatoria.
          </p>
        </div>

        {/* Acciones de Descarga Rápidas */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleDescargar('docx')}
            disabled={!puedeDescargar || descargando !== null || !edificacionId}
            className="ui-btn ui-btn-secondary min-h-10 focus-ring shadow-sm inline-flex items-center gap-2"
          >
            <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
            </svg>
            {descargando === 'docx' ? 'Compilando Word...' : 'Descargar Word (.docx)'}
          </button>

          <button
            type="button"
            onClick={() => handleDescargar('pdf')}
            disabled={!puedeDescargar || descargando !== null || !edificacionId}
            className="ui-btn ui-btn-primary min-h-10 focus-ring shadow-sm inline-flex items-center gap-2"
          >
            <svg className="h-4 w-4 text-emerald-200" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H8v-2h4v2zm4-4H8v-2h8v2zm0-4H8V7h8v2z" />
            </svg>
            {descargando === 'pdf' ? 'Compilando PDF...' : 'Descargar PDF (.pdf)'}
          </button>
        </div>
      </div>

      {/* Barra de Filtros y Configuración */}
      <div className="ui-panel p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="ui-field">
            <label htmlFor="select-edificacion" className="ui-label">
              Edificación / Instalación
            </label>
            <select
              id="select-edificacion"
              className="ui-input min-h-10 focus-ring w-full"
              value={edificacionId}
              onChange={(e) => {
                setEdificacionId(e.target.value)
                setBloqueId('')
              }}
            >
              {edificaciones.map((ed) => (
                <option key={ed.id} value={ed.id}>
                  {ed.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="ui-field">
            <label htmlFor="select-bloque" className="ui-label">
              Ámbito de Alcance
            </label>
            <select
              id="select-bloque"
              className="ui-input min-h-10 focus-ring w-full"
              value={bloqueId}
              onChange={(e) => setBloqueId(e.target.value)}
            >
              <option value="">Toda la Edificación (Consolidado)</option>
              {bloquesDisponibles.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.codigo} - {b.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="ui-field">
            <label htmlFor="select-periodicidad" className="ui-label">
              Agregación Temporal (HU-12)
            </label>
            <select
              id="select-periodicidad"
              className="ui-input min-h-10 focus-ring w-full"
              value={periodicidad}
              onChange={(e) => setPeriodicidad(e.target.value as PeriodicidadReporte)}
            >
              <option value="mes">Mensual</option>
              <option value="semestre">Semestral</option>
              <option value="ano">Anual</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleConsultar}
              disabled={isPending || !edificacionId}
              className="ui-btn ui-btn-primary w-full min-h-10 focus-ring shadow-sm"
            >
              {isPending ? 'Consultando datos...' : 'Actualizar Vista Previa'}
            </button>
          </div>
        </div>
      </div>

      {/* Feedback de error si ocurre */}
      {mensajeError && (
        <div className="ui-callout ui-callout-danger" role="alert">
          {mensajeError}
        </div>
      )}

      {/* Vista Previa Interactiva */}
      {datos ? (
        <div className="space-y-6">
          {/* Tarjetas de Estadísticas Principales (KPI Cards) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="ui-card-stat p-5">
              <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Consumo Base LBEn (E0)
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {formatearDato(datos.lineaBase.consumoBaseMensualKwh)}
                </span>
                <span className="text-xs font-medium text-slate-500">kWh/mes</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                  σ = {formatearDato(datos.lineaBase.desviacionEstandarKwh)}
                  {datos.lineaBase.desviacionEstandarKwh === null ? '' : ' kWh'}
                </span>
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {valorLben === null ? 'Sin banda LBEn' : 'Banda LBEn'}
                </span>
              </div>
            </div>

            <div className="ui-card-stat p-5">
              <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Meta de Ahorro Anual
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {formatearDato(datos.ahorros.metaAhorroAnualKwh)}
                </span>
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {datos.ahorros.metaAhorroAnualKwh === null ? '' : 'kWh/año'}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Sin objetivo de ahorro registrado</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {datos.ahorros.metaAhorroAnualPct === null
                    ? 'Sin estimación'
                    : `${datos.ahorros.metaAhorroAnualPct}% reducción`}
                </span>
              </div>
            </div>

            <div className="ui-card-stat p-5">
              <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Calidad de Serie Histórica
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {datos.historico.facturasDentroBanda ?? 'N/D'} / {datos.historico.totalFacturas}
                </span>
                <span className="text-xs font-medium text-slate-500">meses</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  {datos.historico.facturasAtipicas === null
                    ? 'Sin clasificación por LBEn'
                    : `${datos.historico.facturasAtipicas} atípicos identificados`}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 font-medium ${
                    datos.lineaBase.alcanzaMinimo36Facturas
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {datos.lineaBase.alcanzaMinimo36Facturas
                    ? '≥ 36 facturas'
                    : '< 36 facturas'}
                </span>
              </div>
            </div>

            <div className="ui-card-stat p-5">
              <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Potencia Instalada (USEs)
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {datos.inventario.potenciaTotalKw.toLocaleString('es-CO')}
                </span>
                <span className="text-xs font-medium text-slate-500">kW</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{datos.inventario.totalEquipos} equipos</span>
                <span>{datos.inventario.categorias.length} categorías</span>
              </div>
            </div>
          </div>

          {/* Aviso sobre el tamaño de la serie disponible */}
          {!datos.lineaBase.alcanzaMinimo36Facturas && (
            <div className="ui-callout ui-callout-warn" role="status">
              <span className="font-semibold">Histórico disponible: </span>
              {datos.lineaBase.criterioAprobacion}
            </div>
          )}

          {/* Pestañas de Navegación del Informe */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
            <button
              type="button"
              onClick={() => setTabActiva('generalidades')}
              className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors whitespace-nowrap min-h-10 ${
                tabActiva === 'generalidades'
                  ? 'border-emerald-600 text-emerald-700 dark:border-emerald-500 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              1. Generalidades UPME (§9.1)
            </button>
            <button
              type="button"
              onClick={() => setTabActiva('lben')}
              className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors whitespace-nowrap min-h-10 ${
                tabActiva === 'lben'
                  ? 'border-emerald-600 text-emerald-700 dark:border-emerald-500 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              2. Línea Base y Validación (§9.2–9.4)
            </button>
            <button
              type="button"
              onClick={() => setTabActiva('ahorros')}
              className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors whitespace-nowrap min-h-10 ${
                tabActiva === 'ahorros'
                  ? 'border-emerald-600 text-emerald-700 dark:border-emerald-500 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              3. Ahorros y Medidas (§8, Anexo 5)
            </button>
            <button
              type="button"
              onClick={() => setTabActiva('historico')}
              className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors whitespace-nowrap min-h-10 ${
                tabActiva === 'historico'
                  ? 'border-emerald-600 text-emerald-700 dark:border-emerald-500 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              4. Histórico y USEs (§7.1–7.3)
            </button>
          </div>

          {/* Contenido de la Pestaña Activa */}
          <div className="ui-panel p-6 sm:p-8 shadow-sm">
            {tabActiva === 'generalidades' && (
              <div className="space-y-6">
                <div>
                  <h3 className="ui-title text-lg">
                    Identificación y Parámetros Operacionales
                  </h3>
                  <p className="ui-muted text-xs mt-1">
                    Información base exigida por el Numeral 9.1 de la Resolución UPME 0016 de 2024.
                  </p>
                </div>

                <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="ui-card p-5">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Entidad y Sede
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {datos.generalidades.institucion}
                      <span className="block mt-0.5 text-xs font-normal text-slate-500 dark:text-slate-400">
                        {datos.generalidades.sede}
                      </span>
                    </dd>
                  </div>

                  <div className="ui-card p-5">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Área Útil Ocupada
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {formatearDato(datos.generalidades.areaUtilM2)}
                      {datos.generalidades.areaUtilM2 === null ? '' : ' m²'}
                      <span className="block mt-0.5 text-xs font-normal text-slate-500 dark:text-slate-400">
                        Superficie con demanda energética asociada
                      </span>
                    </dd>
                  </div>

                  <div className="ui-card p-5">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Ocupación Promedio
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {formatearDato(datos.generalidades.ocupantes.total)}
                      {datos.generalidades.ocupantes.total === null ? '' : ' ocupantes'}
                      <span className="block mt-0.5 text-xs font-normal text-slate-500 dark:text-slate-400">
                        Fija: {formatearDato(datos.generalidades.ocupantes.poblacionFija)} | Flotante:{' '}
                        {formatearDato(datos.generalidades.ocupantes.poblacionFlotante)}
                      </span>
                    </dd>
                  </div>

                  <div className="ui-card p-5">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Fuentes Energéticas Utilizadas
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {datos.generalidades.fuentesEnergia.join(', ')}
                    </dd>
                  </div>

                  <div className="sm:col-span-2 ui-card p-5">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Actividades y Operaciones Principales
                    </dt>
                    <dd className="mt-1 text-sm text-slate-900 dark:text-white leading-relaxed">
                      {datos.generalidades.actividades}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {tabActiva === 'lben' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="ui-title text-lg">
                      Parámetros Estadísticos y Validación de LBEn
                    </h3>
                    <p className="ui-muted text-xs mt-1">
                      Modelo seleccionado conforme a los numerales 9.2, 9.3 y 9.4 de la UPME 0016.
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {datos.lineaBase.modeloSeleccionado}
                  </span>
                </div>

                {/* Gráfica interactiva de la serie de consumo y línea base */}
                <div className="ui-card p-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                    Curva Histórica de Consumo vs. Línea Base Regulada
                  </h4>
                  {etiquetasGrafica.length > 0 ? (
                    <SeriesChart
                      titulo="Consumo histórico y línea base de energía"
                      etiquetas={etiquetasGrafica}
                      series={seriesGrafica}
                      altoGrafica={240}
                      formatoValor={(v) => `${v.toLocaleString('es-CO')} kWh`}
                    />
                  ) : (
                    <div className="ui-empty py-10 text-center">
                      No hay suficientes puntos históricos para graficar.
                    </div>
                  )}
                </div>

                {/* Parámetros de validación */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="ui-card p-4">
                    <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                      Consumo Base (E0)
                    </div>
                    <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                      {formatearDato(datos.lineaBase.consumoBaseMensualKwh)}
                      {datos.lineaBase.consumoBaseMensualKwh === null ? '' : ' kWh/mes'}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      σ = {formatearDato(datos.lineaBase.desviacionEstandarKwh)}
                      {datos.lineaBase.desviacionEstandarKwh === null ? '' : ' kWh'}
                    </div>
                  </div>

                  <div className="ui-card p-4">
                    <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                      Intervalo 90% – 110%
                    </div>
                    <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                      {datos.lineaBase.bandaInferiorKwh === null ||
                      datos.lineaBase.bandaSuperiorKwh === null
                        ? 'No disponible'
                        : `[${datos.lineaBase.bandaInferiorKwh.toLocaleString('es-CO')} – ${datos.lineaBase.bandaSuperiorKwh.toLocaleString('es-CO')}]`}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Rango guardado en la LBEn
                    </div>
                  </div>

                  <div className="ui-card p-4">
                    <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                      Bondad de Ajuste R² / MAPE
                    </div>
                    <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                      R² = {datos.lineaBase.estadisticos.r2?.toFixed(3) ?? 'N/A'}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      MAPE = {datos.lineaBase.estadisticos.mape?.toFixed(1) ?? 'N/A'}% (Req ≤ 5%)
                    </div>
                  </div>
                </div>

                <div className="ui-card p-5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Ecuación Matemática del Modelo
                  </div>
                  <div className="mt-1 font-mono text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    {datos.lineaBase.estadisticos.ecuacion ?? 'No registrada en la LBEn'}
                  </div>
                </div>
              </div>
            )}

            {tabActiva === 'ahorros' && (
              <div className="space-y-6">
                <div>
                  <h3 className="ui-title text-lg">
                    Estimación de Potenciales de Ahorro y Medidas Recomendadas
                  </h3>
                  <p className="ui-muted text-xs mt-1">
                    El catálogo orienta acciones posibles. No se estiman porcentajes ni ahorros sin
                    una evaluación registrada para la edificación.
                  </p>
                </div>

                {/* BarList interactivo de medidas */}
                <div className="ui-card p-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                    Impacto registrado por Medida de Eficiencia Energética
                  </h4>
                  {datosBarrasMedidas.length > 0 ? (
                    <BarList
                      titulo="Medidas de eficiencia energética recomendadas"
                      datos={datosBarrasMedidas}
                    />
                  ) : (
                    <div className="ui-empty">
                      No hay estimaciones de ahorro registradas para estas medidas.
                    </div>
                  )}
                </div>

                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Catálogo Detallado de Medidas UPME
                </h4>
                <div className="ui-table-shell overflow-x-auto">
                  <table className="ui-table min-w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 font-semibold">Tipo</th>
                        <th className="px-4 py-3 font-semibold">Medida de Eficiencia</th>
                        <th className="px-4 py-3 text-right font-semibold">Ahorro (%)</th>
                        <th className="px-4 py-3 font-semibold">Descripción Operativa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.ahorros.medidasEficiencia.map((m, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-3 font-medium">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                m.tipo === 'BPO'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  : m.tipo === 'Medida Activa'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                              }`}
                            >
                              {m.tipo}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                            {m.medida}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                            {m.ahorroEstimadoPct === null
                              ? 'No estimado'
                              : `${m.ahorroEstimadoPct}%`}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                            {m.descripcion}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tabActiva === 'historico' && (
              <div className="space-y-6">
                <div>
                  <h3 className="ui-title text-lg">
                    Usos Significativos de Energía (USEs) y Facturación
                  </h3>
                  <p className="ui-muted text-xs mt-1">
                    Distribución de demanda por sistemas y trazabilidad de facturación con
                    detección de atípicos.
                  </p>
                </div>

                {/* BarList interactivo de potencia por categoría */}
                <div className="ui-card p-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                    Participación de Potencia Eléctrica Instalada por Categoría (kW)
                  </h4>
                  <BarList
                    titulo="Potencia instalada por categoría de equipos"
                    datos={datosBarrasInventario}
                  />
                </div>

                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Últimos Períodos Facturados y clasificación frente a la LBEn
                </h4>
                <div className="ui-table-shell overflow-x-auto">
                  <table className="ui-table min-w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 font-semibold">Período</th>
                        <th className="px-4 py-3 text-right font-semibold">Consumo Real (kWh)</th>
                        <th className="px-4 py-3 text-right font-semibold">Norm. 30 Días</th>
                        <th className="px-4 py-3 text-right font-semibold">Costo (COP)</th>
                        <th className="px-4 py-3 font-semibold">Clasificación LBEn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.historico.filas.slice(-8).map((f, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                            {f.periodo}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                            {f.consumoKwh.toLocaleString('es-CO')}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
                            {f.consumoNormalizado.toLocaleString('es-CO')}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                            ${f.costoCop.toLocaleString('es-CO')}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {f.esAtipico === true ? (
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                Atípico ({f.motivoAtipico})
                              </span>
                            ) : f.esAtipico === false ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                Dentro de banda
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                Sin clasificación
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="ui-panel p-16 text-center">
          <svg className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
            Vista previa no inicializada
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Haga clic en «Actualizar Vista Previa» para procesar los datos de la edificación seleccionada.
          </p>
        </div>
      )}
    </div>
  )
}

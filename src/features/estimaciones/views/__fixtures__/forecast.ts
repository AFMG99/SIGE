import type {
  ProyeccionExitosa,
  ResultadoProyeccion,
} from '../../models/forecast'

const baseMensual = Array.from({ length: 12 }, (_, indice) =>
  9800 + indice * 140
)

const serie = Array.from({ length: 48 }, (_, indice) => {
  const fecha = new Date(Date.UTC(2023, indice, 1))
  const mes = fecha.getUTCMonth()
  const observado = baseMensual[mes] + (indice % 12 === 2 ? 110 : 0)
  const descartado = indice === 14
  const modelado = descartado ? baseMensual[mes] : observado
  return {
    periodo: `${fecha.getUTCFullYear()}-${String(mes + 1).padStart(2, '0')}`,
    consumo_observado: observado,
    consumo_modelado: modelado,
    descartado,
    lben_valor_absoluto: baseMensual[mes],
  }
})

export const proyeccionDemo: ProyeccionExitosa = {
  ok: true,
  originales: 48,
  depurados: 47,
  min_meses: 36,
  criterio_depuracion: 'banda_10_pct',
  ajustes_aplicados: 0,
  modelo: 'SARIMA',
  orden: [1, 1, 0],
  orden_estacional: [0, 1, 1, 12],
  serie,
  pronostico: [
    {
      periodo: '2027-01',
      consumo_kwh: 9960,
      limite_inferior: 9520,
      limite_superior: 10400,
      lben_valor_absoluto: baseMensual[0],
    },
    {
      periodo: '2027-02',
      consumo_kwh: 10120,
      limite_inferior: 9580,
      limite_superior: 10660,
      lben_valor_absoluto: baseMensual[1],
    },
    {
      periodo: '2027-03',
      consumo_kwh: 10340,
      limite_inferior: 9690,
      limite_superior: 10990,
      lben_valor_absoluto: baseMensual[2],
    },
  ],
  diagnosticos: {
    aic: 384.2,
    mape_entrenamiento: 2.4,
    media_residuos: 0.6,
    ljung_box_p_value: 0.37,
  },
}

export const resultadoProyeccionDemo: ResultadoProyeccion = {
  proyeccion: proyeccionDemo,
  edificacionNombre: 'Campus Robledo',
  bloqueNombre: 'Bloque A',
  lineaBase: {
    origen: 'bloque',
    nombre: 'Bloque A',
    lbenMensual: baseMensual,
  },
}

export const edificacionesDemo = [
  { id: 'edificacion-demo', nombre: 'Campus Robledo' },
  { id: 'edificacion-centro', nombre: 'Sede Centro' },
]

export const bloquesDemo = [
  {
    id: 'bloque-a',
    edificacionId: 'edificacion-demo',
    codigo: 'A',
    nombre: 'Bloque A',
  },
  {
    id: 'bloque-b',
    edificacionId: 'edificacion-demo',
    codigo: 'B',
    nombre: 'Bloque B',
  },
]

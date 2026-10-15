/**
 * Gráficos SVG compartidos del proyecto (dashboard + análisis).
 * Sin librerías externas: tokens `uv-*`, framer-motion y curvas monotonas.
 */
export { SeriesChart, type SeriesChartProps, type SerieGrafica, type ColorSerie } from './SeriesChart'
export { BarList, type BarListProps, type DatoBarra } from './BarList'
export { Sparkline, type SparklineProps } from './Sparkline'
export {
  caminoMonotono,
  limitesSerie,
  puntosTramo,
  ticksBonitos,
  tramosContinuos,
  type PuntoXY,
} from './curvas'

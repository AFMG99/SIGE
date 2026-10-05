import type {
  AjustesExistentes,
  EquiposExistentes,
  FacturasExistentes,
  LineaBaseExistente,
  VariablesExistentes,
} from '../existencias'

/**
 * Datos existentes de ejemplo que en producción consulta `page.tsx` vía
 * Prisma. Los ids de equipos cumplen `bloqueIdSchema` (`{16,}`) y las
 * edificaciones/bloques coinciden con `catalogo.ts` para que la segmentación
 * del importador y el panel cuenten la misma historia.
 */

export const facturasExistentesDemo: FacturasExistentes = {
  total: 12,
  consumoTotalKwh: 212994.5,
  costoTotalCop: 202344754,
  ultimoPeriodo: '2024-12',
  filas: [
    { id: 'fac-2024-12', periodo: '2024-12', diasFacturados: 31, consumoKwh: 21450.25, costoCop: 20377714, edificacion: 'Campus Bloque A' },
    { id: 'fac-2024-11', periodo: '2024-11', diasFacturados: 30, consumoKwh: 19870.5, costoCop: 18876975, edificacion: 'Campus Bloque A' },
    { id: 'fac-2024-10', periodo: '2024-10', diasFacturados: 31, consumoKwh: 18240.75, costoCop: 17328713, edificacion: 'Campus Bloque A' },
    { id: 'fac-2024-09', periodo: '2024-09', diasFacturados: 30, consumoKwh: 17950.0, costoCop: 17052500, edificacion: 'Campus Bloque A' },
    { id: 'fac-2024-08', periodo: '2024-08', diasFacturados: 31, consumoKwh: 18500.5, costoCop: 17575475, edificacion: 'Campus Bloque A' },
    { id: 'fac-2024-07', periodo: '2024-07', diasFacturados: 31, consumoKwh: 17620.25, costoCop: 16739238, edificacion: 'Campus Bloque A' },
    { id: 'fac-2024-06', periodo: '2024-06', diasFacturados: 30, consumoKwh: 16980.75, costoCop: 16131713, edificacion: 'Campus Bloque A' },
    { id: 'fac-2024-05', periodo: '2024-05', diasFacturados: 31, consumoKwh: 17340.0, costoCop: 16473000, edificacion: 'Campus Bloque A' },
    { id: 'fac-2024-04', periodo: '2024-04', diasFacturados: 30, consumoKwh: 16550.5, costoCop: 15722975, edificacion: 'Campus Bloque A' },
    { id: 'fac-2024-03', periodo: '2024-03', diasFacturados: 31, consumoKwh: 16120.25, costoCop: 15314238, edificacion: 'Campus Bloque A' },
    { id: 'fac-2024-02', periodo: '2024-02', diasFacturados: 29, consumoKwh: 15480.75, costoCop: 14706713, edificacion: 'Campus Bloque A' },
    { id: 'fac-2024-01', periodo: '2024-01', diasFacturados: 31, consumoKwh: 16890.0, costoCop: 16045500, edificacion: 'Campus Bloque A' },
  ],
}

export const facturasVaciasDemo: FacturasExistentes = {
  total: 0,
  consumoTotalKwh: 0,
  costoTotalCop: 0,
  ultimoPeriodo: null,
  filas: [],
}

export const equiposExistentesDemo: EquiposExistentes = {
  total: 6,
  potenciaTotalKw: 27.9,
  edificacionesConInventario: 2,
  bloquesConInventario: 3,
  filas: [
    {
      id: 'eq-campus-a101-01',
      edificacion: 'Campus Bloque A',
      bloqueCodigo: 'A-101',
      bloqueNombre: 'Ala Norte',
      espacio: 'Aula 101',
      tipo: 'HVAC',
      cantidad: 2,
      potenciaNominal: 3.5,
    },
    {
      id: 'eq-campus-a101-02',
      edificacion: 'Campus Bloque A',
      bloqueCodigo: 'A-101',
      bloqueNombre: 'Ala Norte',
      espacio: 'Aula 102',
      tipo: 'Iluminación LED',
      cantidad: 24,
      potenciaNominal: 0.04,
    },
    {
      id: 'eq-campus-a101-03',
      edificacion: 'Campus Bloque A',
      bloqueCodigo: 'A-101',
      bloqueNombre: 'Ala Norte',
      espacio: 'Aula 101',
      tipo: 'Iluminación LED',
      cantidad: 18,
      potenciaNominal: 0.04,
    },
    {
      id: 'eq-campus-a102-01',
      edificacion: 'Campus Bloque A',
      bloqueCodigo: 'A-102',
      bloqueNombre: 'Ala Sur',
      espacio: 'Laboratorio 201',
      tipo: 'Equipos de laboratorio',
      cantidad: 6,
      potenciaNominal: 1.2,
    },
    {
      id: 'eq-admin-piso1-01',
      edificacion: 'Administración Principal',
      bloqueCodigo: 'ADM-1',
      bloqueNombre: 'Piso 1',
      espacio: 'Oficina 1',
      tipo: 'Ofimática',
      cantidad: 12,
      potenciaNominal: 0.3,
    },
    {
      id: 'eq-admin-piso1-02',
      edificacion: 'Administración Principal',
      bloqueCodigo: 'ADM-1',
      bloqueNombre: 'Piso 1',
      espacio: 'Oficina 1',
      tipo: 'Climatización',
      cantidad: 4,
      potenciaNominal: 2.1,
    },
  ],
}

export const equiposVaciosDemo: EquiposExistentes = {
  total: 0,
  potenciaTotalKw: 0,
  edificacionesConInventario: 0,
  bloquesConInventario: 0,
  filas: [],
}

export const variablesExistentesDemo: VariablesExistentes = {
  total: 6,
  ultimoPeriodo: '2024-12',
  // flotante: 145 + 137 + 158 + 124 + 195 + 81 = 840 → 140
  poblacionFlotantePromedio: 140,
  // GDE: 18.4 + 16.2 + 19.7 + 21.3 + 22.8 + 20.4 = 118.8 → 19.8
  gradesDiaEnfriamientoPromedio: 19.8,
  filas: [
    {
      id: 'var-2024-12-a101',
      periodo: '2024-12',
      bloqueCodigo: 'A-101',
      bloqueNombre: 'Ala Norte',
      poblacionFija: 32,
      poblacionFlotante: 145,
      diasLectivosLaborales: 22,
      gradesDiaEnfriamiento: 18.4,
    },
    {
      id: 'var-2024-11-a101',
      periodo: '2024-11',
      bloqueCodigo: 'A-101',
      bloqueNombre: 'Ala Norte',
      poblacionFija: 32,
      poblacionFlotante: 137,
      diasLectivosLaborales: 21,
      gradesDiaEnfriamiento: 16.2,
    },
    {
      id: 'var-2024-10-a101',
      periodo: '2024-10',
      bloqueCodigo: 'A-101',
      bloqueNombre: 'Ala Norte',
      poblacionFija: 32,
      poblacionFlotante: 158,
      diasLectivosLaborales: 23,
      gradesDiaEnfriamiento: 19.7,
    },
    {
      id: 'var-2024-09-a102',
      periodo: '2024-09',
      bloqueCodigo: 'A-102',
      bloqueNombre: 'Ala Sur',
      poblacionFija: 29,
      poblacionFlotante: 124,
      diasLectivosLaborales: 22,
      gradesDiaEnfriamiento: 21.3,
    },
    {
      id: 'var-2024-08-a102',
      periodo: '2024-08',
      bloqueCodigo: 'A-102',
      bloqueNombre: 'Ala Sur',
      poblacionFija: 29,
      poblacionFlotante: 195,
      diasLectivosLaborales: 21,
      gradesDiaEnfriamiento: 22.8,
    },
    {
      id: 'var-2024-07-adm1',
      periodo: '2024-07',
      bloqueCodigo: 'ADM-1',
      bloqueNombre: 'Piso 1',
      poblacionFija: 30,
      poblacionFlotante: 81,
      diasLectivosLaborales: 23,
      gradesDiaEnfriamiento: 20.4,
    },
  ],
}

export const variablesVaciasDemo: VariablesExistentes = {
  total: 0,
  ultimoPeriodo: null,
  poblacionFlotantePromedio: 0,
  gradesDiaEnfriamientoPromedio: 0,
  filas: [],
}

export const ajustesExistentesDemo: AjustesExistentes = {
  total: 3,
  bloquesConAjustes: 3,
  // 8.5 + (-3.2) + 2.75 = 8.05 → 2.68
  valorAjustePromedio: 2.68,
  rutinarios: 2,
  noRutinarios: 1,
  filas: [
    {
      id: 'aj-2024-09-a101',
      bloqueCodigo: 'A-101',
      bloqueNombre: 'Ala Norte',
      edificacion: 'Campus Bloque A',
      tipo: 'NO_RUTINARIO',
      periodo: '2024-09-01 → 2024-09-30',
      valorAjuste: 8.5,
      observaciones: 'Remodelación del ala norte: +15 % de carga temporal.',
    },
    {
      id: 'aj-2024-06-a102',
      bloqueCodigo: 'A-102',
      bloqueNombre: 'Ala Sur',
      edificacion: 'Campus Bloque A',
      tipo: 'RUTINARIO',
      periodo: '2024-06-01 → 2024-06-30',
      valorAjuste: -3.2,
      observaciones: 'Cierre estacional de posgrados.',
    },
    {
      id: 'aj-2024-03-adm1',
      bloqueCodigo: 'ADM-1',
      bloqueNombre: 'Piso 1',
      edificacion: 'Administración Principal',
      tipo: 'RUTINARIO',
      periodo: '2024-03-01 → 2024-03-31',
      valorAjuste: 2.75,
      observaciones: null,
    },
  ],
}

export const ajustesVaciosDemo: AjustesExistentes = {
  total: 0,
  bloquesConAjustes: 0,
  valorAjustePromedio: 0,
  rutinarios: 0,
  noRutinarios: 0,
  filas: [],
}

export const lineasBaseFilasDemo: LineaBaseExistente[] = [
  {
    id: 'lb-valor-absoluto-a101',
    bloqueCodigo: 'A-101',
    bloqueNombre: 'Ala Norte',
    tipo: 'VALOR_ABSOLUTO',
    r2: 1,
    guardadaEn: '2025-01-15',
  },
  {
    id: 'lb-cociente-a101',
    bloqueCodigo: 'A-101',
    bloqueNombre: 'Ala Norte',
    tipo: 'COCIENTE',
    r2: 0.2448,
    guardadaEn: '2025-01-15',
  },
  {
    id: 'lb-regresion-a102',
    bloqueCodigo: 'A-102',
    bloqueNombre: 'Ala Sur',
    tipo: 'REGRESSION_ESTADISTICA',
    r2: 0.6914,
    guardadaEn: '2025-01-16',
  },
  {
    id: 'lb-confort-adm1',
    bloqueCodigo: 'ADM-1',
    bloqueNombre: 'Piso 1',
    tipo: 'CONFORT_THERMAL',
    r2: null,
    guardadaEn: '2025-01-16',
  },
]

export const lineasBaseFilasVaciasDemo: LineaBaseExistente[] = []

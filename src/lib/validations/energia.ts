// Validación de esquemas Zod para el módulo SIGE-TdeA - Carga Energética
// Arquitecto: Full-Stack SIGE-TdeA
// Fecha: 2026-09-29

import { z } from 'zod';

export const bloqueIdSchema = z
  .string()
  .min(1, 'ID de bloque inválido')
  .regex(/^[A-Za-z0-9_-]{16,}$/, 'ID de bloque inválido');

// ============================================================
// 1. FORMULARIO DE REGISTRO DE FACTURAS DE ENERGÍA
// ============================================================

// Schema para una factura individual - periodo como string YYYY-MM
export const facturaEpmschema = z.object({
  periodo: z.string()
    .regex(/^(\d{4})-(\d{2})$/, 'El periodo debe tener formato YYYY-MM'),
  diasFacturados: z.number().int().positive('Los días facturados deben ser un número positivo'),
  consumoKwh: z.number().nonnegative('El consumo registrado no puede ser negativo'),
  costoCop: z.number().nonnegative('El costo en COP no puede ser negativo'),
});

export type FacturaEpmaInput = z.infer<typeof facturaEpmschema>;

// Función helper para extraer año y mes del periodo
export const extraerAnomesPeriodo = (periodo: string): { ano: number; mes: number } => {
  const match = periodo.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    throw new Error('Formato de periodo inválido: YYYY-MM');
  }
  return { ano: parseInt(match[1], 10), mes: parseInt(match[2], 10) };
};

// Función helper para calcular consumo normalizado a 30 días
// Fórmula: Consumo Normalizado (kWh) = (Consumo Registrado / Días del Periodo) * 30
export const calcularConsumoNormalizado = (
  consumoKwh: number,
  diasPeriodo: number
): number => {
  if (diasPeriodo <= 0 || consumoKwh < 0) {
    throw new Error('Parámetros inválidos para normalización');
  }
  if (consumoKwh === 0) return 0;
  const diasDelMes = new Date(new Date().getFullYear(), (new Date().getMonth() + 1) % 12 + 1, 0).getDate();
  // Note: En producción, se debería pasar el mes/año real, aquí usamos una referencia
  return (consumoKwh / diasPeriodo) * 30;
};

// Type for normalized result
export type ConsumoNormalizadoResult = {
  consumoNormalizado: number;
  diasPeriodo: number;
};

// ============================================================
// 2. FORMULARIO DE INVENTARIO DE EQUIPOS ELÉCTRICOS POR BLOQUE
// ============================================================

export const TIPOS_EQUIPO = ['HVAC', 'ILUMINACION', 'OFICINA', 'MOTORES'] as const;
export const ESTADOS_INDICADOR = ['ACTIVO', 'INACTIVO'] as const;

/**
 * Catálogo de tipos de edificación: única fuente de verdad para UI y servidor.
 * `requiereBloque` gobierna la adaptación dinámica del formulario de importación:
 * true → el usuario debe elegir/crear un Bloque; false → el bloque es automático
 * y el campo no se muestra.
 */
export interface TipoEdificacion {
  codigo: string;
  etiqueta: string;
  requiereBloque: boolean;
}

export const CATALOGO_EDIFICACIONES: TipoEdificacion[] = [
  { codigo: 'RESIDENCIAL_UNIFAMILIAR', etiqueta: 'Vivienda Unifamiliar (No VIS)', requiereBloque: false },
  { codigo: 'EDUCATIVO_CAMPUS', etiqueta: 'Campus Educativo', requiereBloque: true },
  { codigo: 'OFICINA_PUBLICA', etiqueta: 'Oficina Pública', requiereBloque: true },
];

/** Fail-safe: los tipos desconocidos exigen bloque (no se pierde la segmentación). */
export const tipoEdificacionPorCodigo = (codigo: string): TipoEdificacion =>
  CATALOGO_EDIFICACIONES.find((t) => t.codigo === codigo) ?? {
    codigo,
    etiqueta: codigo,
    requiereBloque: true,
  };

/** Normaliza el nombre de un espacio: quita espacios sobrantes para usarlo como clave. */
export const normalizarEspacio = (valor: string): string => valor.trim().replace(/\s+/g, ' ');

export const equipoElectricoschema = z.object({
  /** Obligatorio solo si el tipo de edificación requiere bloque; si no, el servidor resuelve el bloque automático. */
  bloqueId: bloqueIdSchema.optional(),
  espacio: z.string().trim().min(1, 'El espacio es obligatorio').max(100, 'Máximo 100 caracteres'),
  tipo: z.enum(['HVAC', 'ILUMINACION', 'OFICINA', 'MOTORES']),
  cantidad: z.number().int().positive('La cantidad debe ser un número entero positivo'),
  potenciaNominal: z.number().nonnegative('La potencia nominal no puede ser negativa'),
  horasUsoDia: z.number().int().positive('Las horas de uso por día deben ser positivas'),
  diasUsoMes: z.number().int().positive('Los días de uso por mes deben ser positivos'),
  usenIndicador: z.enum(['ACTIVO', 'INACTIVO']),
});

export type EquipoElectricoInput = z.infer<typeof equipoElectricoschema>;

// ============================================================
// 3. FORMULARIO DE VARIABLES OPERATIVAS (POBLACIÓN Y CLIMA)
// ============================================================

export const variableOperativaschema = z.object({
  bloqueId: bloqueIdSchema,
  mes: z.number().int().min(1).max(12, 'El mes debe estar entre 1 y 12'),
  ano: z.number().int().min(2000).max(2100, 'Año inválido'),
  // Población fija total del periodo (docentes + administrativos)
  poblacionFija: z.number().int().nonnegative('La población fija no puede ser negativa'),
  // Población flotante total del periodo (estudiantes + visitantes)
  poblacionFlotante: z.number().int().nonnegative('La población flotante no puede ser negativa'),
  // Días lectivos/laborales
  diasLectivosLaborales: z.number().int().nonnegative('Los días lectivos/laborales no pueden ser negativos'),
  // Grados Día de Enfriamiento - GDE
  gradesDiaEnfriamiento: z.number().nonnegative('Los Grados Día de Enfriamiento no pueden ser negativos'),
});

export type VariableOperativaInput = z.infer<typeof variableOperativaschema>;

// ============================================================
// 4. SCHEMA DE VALIDACIÓN PARA IMPORTACIÓN MASIVA (Excel/CSV)
// ============================================================

/**
 * Convierte el valor crudo (string de CSV/Excel o número) a number.
 * Si no representa un número, devuelve un valor no numérico para que Zod
 * reporte "Debe ser un número" en lugar de un error genérico en inglés.
 */
const aNumero = (valor: unknown): unknown => {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : 'no-numerico'
  }
  if (typeof valor === 'string') {
    const limpio = valor
      .trim()
      .replace(/\s+/g, '')
      .replace(/\.(?=\d{3}(?:\D|$))/g, '') // separador de miles: 18.500 -> 18500
      .replace(',', '.')                    // decimal con coma: 18500,50 -> 18500.50
    if (limpio === '') return 'no-numerico'
    const numero = Number(limpio)
    return Number.isFinite(numero) ? numero : 'no-numerico'
  }
  return valor
}

const numeroEnteroPositivo = z.preprocess(
  aNumero,
  z
    .number({ invalid_type_error: 'Debe ser un número' })
    .int('Debe ser un número entero')
    .positive('Debe ser mayor a 0')
)

const numeroNoNegativo = z.preprocess(
  aNumero,
  z.number({ invalid_type_error: 'Debe ser un número' }).nonnegative('No puede ser negativo')
)

export const filaFacturaEpmschema = z
  .object({
    periodo: z.string().regex(/^(\d{4})-(\d{2})$/, 'Formato de periodo inválido: AAAA-MM'),
    diasFacturados: numeroEnteroPositivo,
    consumoKwh: numeroNoNegativo,
    costoCop: numeroNoNegativo,
  })
  .superRefine((valor, ctx) => {
    const mes = Number(String(valor.periodo).slice(5, 7))
    if (mes < 1 || mes > 12) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['periodo'],
        message: 'El mes debe estar entre 01 y 12',
      })
    }
  })

export type FilaFacturaEpma = z.infer<typeof filaFacturaEpmschema>;

export const filaEquipoElectricoschema = z.object({
  /** Obligatorio solo si el tipo de edificación requiere bloque (lo exige la server action). */
  bloqueId: bloqueIdSchema.optional(),
  espacio: z
    .string({ required_error: 'El espacio es obligatorio en la fila' })
    .trim()
    .min(1, 'El espacio es obligatorio en la fila')
    .max(100, 'Máximo 100 caracteres'),
  tipo: z.enum(['HVAC', 'ILUMINACION', 'OFICINA', 'MOTORES'], {
    errorMap: () => ({ message: 'Tipo de equipo inválido en la fila' }),
  }),
  cantidad: numeroEnteroPositivo,
  potenciaNominal: numeroNoNegativo,
  horasUsoDia: numeroEnteroPositivo,
  diasUsoMes: numeroEnteroPositivo,
  usenIndicador: z.enum(['ACTIVO', 'INACTIVO'], {
    errorMap: () => ({ message: 'Indicador inválido (ACTIVO o INACTIVO)' }),
  }),
});

export type FilaEquipoElectrico = z.infer<typeof filaEquipoElectricoschema>;

/**
 * Fila de variables para importación masiva: acepta números o strings
 * (CSV/Excel) gracias a los preprocessors, igual que `filaEquipoElectrica`.
 * La identidad es la clave única en BD: bloque + mes + año.
 */
const enteroNoNegativoImport = z.preprocess(
  aNumero,
  z
    .number({ invalid_type_error: 'Debe ser un número' })
    .int('Debe ser un número entero')
    .nonnegative('No puede ser negativo')
)

const mesImport = z.preprocess(
  aNumero,
  z
    .number({ invalid_type_error: 'Debe ser un número' })
    .int('Debe ser un número entero')
    .min(1, 'Mes inválido en la fila')
    .max(12, 'Mes inválido en la fila')
)

const anoImport = z.preprocess(
  aNumero,
  z
    .number({ invalid_type_error: 'Debe ser un número' })
    .int('Debe ser un número entero')
    .min(2000, 'Año inválido en la fila')
    .max(2100, 'Año inválido en la fila')
)

const gdeImport = z.preprocess(
  aNumero,
  z.number({ invalid_type_error: 'Debe ser un número' }).nonnegative('GDE inválido en la fila')
)

export const filaVariableOperativaschema = z.object({
  bloqueId: bloqueIdSchema,
  mes: mesImport,
  ano: anoImport,
  poblacionFija: enteroNoNegativoImport,
  poblacionFlotante: enteroNoNegativoImport,
  diasLectivosLaborales: enteroNoNegativoImport,
  gradesDiaEnfriamiento: gdeImport,
});

export type FilaVariableOperativa = z.infer<typeof filaVariableOperativaschema>;

// ============================================================
// 4b. GESTIÓN DE DATOS GUARDADOS (EDICIÓN / ELIMINACIÓN / VACIADO)
// ============================================================

/**
 * Campos editables de una factura de energía desde la pestaña "Gestión".
 * El periodo no viaja: es la identidad del registro (clave única en BD).
 */
export const edicionFacturaSchema = z.object({
  diasFacturados: numeroEnteroPositivo,
  consumoKwh: numeroNoNegativo,
  costoCop: numeroNoNegativo,
});

export type EdicionFactura = z.infer<typeof edicionFacturaSchema>;

/**
 * Campos editables de un equipo eléctrico. La ubicación (bloque/espacio)
 * no se edita aquí: mover un equipo es una operación de reubicación.
 */
export const edicionEquipoSchema = z.object({
  tipo: z
    .string({ required_error: 'El tipo de equipo es obligatorio' })
    .trim()
    .min(1, 'El tipo de equipo es obligatorio')
    .max(60, 'Máximo 60 caracteres'),
  cantidad: numeroEnteroPositivo,
  potenciaNominal: numeroNoNegativo,
});

export type EdicionEquipo = z.infer<typeof edicionEquipoSchema>;

/**
 * Campos editables de una variable operativa desde la pestaña "Gestión".
 * La identidad (bloque + mes + año) no viaja: es la clave única en BD.
 */
export const edicionVariableSchema = z.object({
  poblacionFija: z.number().int().nonnegative('Población fija inválida'),
  poblacionFlotante: z.number().int().nonnegative('Población flotante inválida'),
  diasLectivosLaborales: z.number().int().nonnegative('Días lectivos/laborales inválidos'),
  gradesDiaEnfriamiento: z.number().nonnegative('GDE inválido'),
});

export type EdicionVariable = z.infer<typeof edicionVariableSchema>;

/** Resultado uniforme de las acciones de gestión (editar / eliminar / vaciar). */
export type ResultadoGestion =
  | {
      estado: 'completado';
      mensaje: string;
      /** Filas eliminadas; 0 en ediciones. */
      eliminadas: number;
      /** Líneas base eliminadas junto con las facturas; 0 fuera de ese vaciado. */
      lineasBaseEliminadas: number;
    }
  | { estado: 'error'; mensaje: string };

// ============================================================
// 5. SCHEMA PARA RESULTADO DE PROCESAMIENTO
// ============================================================

export const resultadoImportoschema = z.object({
  totalFilas: z.number().int(),
  procesadas: z.number().int(),
  exitosas: z.number().int(),
  conError: z.number().int(),
  errores: z.array(z.object({
    fila: z.number(),
    razon: z.string(),
  })).optional(),
});

export type ResultadoImporto = z.infer<typeof resultadoImportoschema>;

// ============================================================
// 6. TYPES AUXILIARES PARA REPORTES
// ============================================================

export interface ReporteFila {
  fila: number;
  estado: 'exitosa' | 'error';
  datos?: any;
  error?: string;
}

export interface ReporteImportacion {
  success: boolean;
  totalFilas: number;
  exitosas: number;
  conError: number;
  errores: ReporteFila[];
  mensaje?: string
}

// ============================================================
// 7. TIPOS DEL FLUJO DE IMPORTACIÓN (cliente <-> server action)
// ============================================================

/** Fila enviada desde el cliente hacia la server action de importación. */
export interface FilaEnvioImportacion {
  /** Número de fila original (1-based) para el reporte de errores. */
  fila: number;
  periodo: string;
  diasFacturados: number | string;
  consumoKwh: number | string;
  costoCop: number | string;
}

/** Registro que ya existe en BD para el mismo periodo. */
export interface ConflictoFactura {
  fila: number;
  periodo: string;
  /** Edificación donde está guardada hoy la factura (para el diálogo de reemplazo). */
  edificacion?: string;
}

export type ResultadoImportacionFacturas =
  | {
      estado: 'confirmacion_requerida';
      conflictos: ConflictoFactura[];
      validas: number;
      rechazadas: number;
      errores: { fila: number; razon: string }[];
      mensaje: string;
    }
  | {
      estado: 'completado';
      insertadas: number;
      actualizadas: number;
      rechazadas: number;
      errores: { fila: number; razon: string }[];
      mensaje: string;
    }
  | { estado: 'error'; mensaje: string };

// ============================================================
// 8. TIPOS DEL FLUJO DE IMPORTACIÓN DE EQUIPOS ELÉCTRICOS
// ============================================================

/** Fila de inventario de equipos enviada desde el cliente hacia la server action. */
export interface FilaEnvioEquipos {
  /** Número de fila original (1-based) para el reporte de errores. */
  fila: number;
  /** Solo se envía cuando el tipo de edificación requiere bloque. */
  bloqueId?: string;
  /** Nombre del espacio dentro del bloque (se crea si no existe). */
  espacio: string;
  tipo: 'HVAC' | 'ILUMINACION' | 'OFICINA' | 'MOTORES';
  cantidad: number | string;
  potenciaNominal: number | string;
  horasUsoDia: number | string;
  diasUsoMes: number | string;
  usenIndicador: 'ACTIVO' | 'INACTIVO';
}

/** Equipo que ya existe en BD para la misma clave (bloque + espacio + tipo). */
export interface ConflictoEquipo {
  fila: number;
  bloqueId: string;
  espacio: string;
  tipo: string;
}

export type ResultadoImportacionEquipos =
  | {
      estado: 'confirmacion_requerida';
      conflictos: ConflictoEquipo[];
      validas: number;
      rechazadas: number;
      errores: { fila: number; razon: string }[];
      mensaje: string;
    }
  | {
      estado: 'completado';
      insertadas: number;
      actualizadas: number;
      rechazadas: number;
      espaciosCreados: number;
      errores: { fila: number; razon: string }[];
      mensaje: string;
    }
  | { estado: 'error'; mensaje: string };

// ============================================================
// 9. TIPOS DEL FLUJO DE IMPORTACIÓN DE VARIABLES OPERATIVAS
// ============================================================

/**
 * Fila de variables operativas enviada desde el cliente hacia la server
 * action. El código de la columna "bloque" se resuelve a ID en el navegador
 * (patrón de `ImportadorEquipos`) antes de enviarla.
 */
export interface FilaEnvioVariables {
  /** Número de fila original (1-based) para el reporte de errores. */
  fila: number;
  bloqueId: string;
  mes: number | string;
  ano: number | string;
  poblacionFija: number | string;
  poblacionFlotante: number | string;
  diasLectivosLaborales: number | string;
  gradesDiaEnfriamiento: number | string;
}

/** Variable que ya existe en BD para la misma clave (bloque + mes + año). */
export interface ConflictoVariable {
  fila: number;
  bloqueId: string;
  mes: number;
  ano: number;
}

export type ResultadoImportacionVariables =
  | {
      estado: 'confirmacion_requerida';
      conflictos: ConflictoVariable[];
      validas: number;
      rechazadas: number;
      errores: { fila: number; razon: string }[];
      mensaje: string;
    }
  | {
      estado: 'completado';
      insertadas: number;
      actualizadas: number;
      rechazadas: number;
      errores: { fila: number; razon: string }[];
      mensaje: string;
    }
  | { estado: 'error'; mensaje: string };
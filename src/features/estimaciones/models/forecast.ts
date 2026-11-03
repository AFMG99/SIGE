import { z } from 'zod'

const ordenSchema = z.tuple([
  z.number().int().min(0).max(2),
  z.number().int().min(0).max(2),
  z.number().int().min(0).max(2),
])

export const solicitudProyeccionSchema = z
  .object({
    edificacionId: z.string().min(1, 'Seleccione una edificación.'),
    bloqueId: z.string().min(1).nullable().optional(),
    horizonte: z.number().int().min(1).max(24),
    modelo: z.enum(['AUTO', 'MA', 'SES']).default('AUTO'),
    ventana: z.number().int().min(2).max(12).optional(),
    alpha: z.number().min(0.05).max(0.95).optional(),
    orden: ordenSchema.optional(),
  })
  .strict()

const puntoSerieSchema = z
  .object({
    periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    consumo_observado: z.number().finite(),
    consumo_modelado: z.number().finite(),
    descartado: z.boolean(),
    lben_valor_absoluto: z.number().finite().positive(),
  })
  .strict()

const puntoPronosticoSchema = z
  .object({
    periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    consumo_kwh: z.number().finite(),
    limite_inferior: z.number().finite(),
    limite_superior: z.number().finite(),
    lben_valor_absoluto: z.number().finite().positive().nullable(),
  })
  .strict()

const diagnosticosSchema = z
  .object({
    aic: z.number().finite(),
    mape_entrenamiento: z.number().finite().nullable(),
    media_residuos: z.number().finite().nullable(),
    ljung_box_p_value: z.number().finite().min(0).max(1).nullable(),
  })
  .strict()

export const proyeccionMotorSchema = z.union([
  z
    .object({
      ok: z.literal(true),
      originales: z.number().int().nonnegative(),
      depurados: z.number().int().positive(),
      min_meses: z.literal(36),
      advertencia: z.string().min(1).optional(),
      criterio_depuracion: z.literal('banda_10_pct'),
      ajustes_aplicados: z.number().int().nonnegative(),
      modelo: z.enum(['SARIMA', 'ARIMA', 'ARIMA manual', 'MA', 'SES']),
      parametros_modelo: z.object({ ventana: z.number().int().min(2).max(12).optional(), alpha: z.number().min(0.05).max(0.95).optional() }).nullable().optional(),
      orden: ordenSchema,
      orden_estacional: z
        .tuple([
          z.number().int().min(0).max(1),
          z.number().int().min(0).max(1),
          z.number().int().min(0).max(1),
          z.literal(12),
        ])
        .nullable(),
      pronostico: z.array(puntoPronosticoSchema).min(1).max(24),
        serie: z.array(puntoSerieSchema).min(1),
      diagnosticos: diagnosticosSchema.optional(),
    })
    .strict()
    .superRefine((resultado, contexto) => {
        if (resultado.depurados < resultado.min_meses && !resultado.advertencia) {
          contexto.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['advertencia'],
            message: 'Debe advertirse cuando el histórico depurado sea menor al mínimo recomendado.',
          })
        }
    }),
  z.object({
    ok: z.literal(false),
    error: z.string().min(1),
  }).strict(),
])

export type SolicitudProyeccion = z.infer<typeof solicitudProyeccionSchema>
export type ProyeccionMotor = z.infer<typeof proyeccionMotorSchema>
export type ProyeccionExitosa = Extract<ProyeccionMotor, { ok: true }>

export interface LineaBaseAplicable {
  origen: 'bloque' | 'edificacion' | null
  nombre: string | null
  lbenMensual: (number | null)[] | null
}

export interface ResultadoProyeccion {
  proyeccion: ProyeccionExitosa
  lineaBase: LineaBaseAplicable
  edificacionNombre: string
  bloqueNombre: string | null
}

export type RespuestaProyeccion =
  | { ok: true; resultado: ResultadoProyeccion }
  | { ok: false; error: string }

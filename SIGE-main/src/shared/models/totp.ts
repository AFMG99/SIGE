import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { generateSecret, generate, verify, generateURI } from 'otplib'

// TOTP crypto module — RFC 6238 via otplib v13.
//
// Gotcha (otplib v13): `epochTolerance` is expressed in SECONDS, not in
// time steps. A TOTP period is 30s, so ±1 step = epochTolerance: 30.
// Anything smaller (e.g. 1) only tolerates clock drift of that many seconds
// and will reject codes from the previous step.

const PERIODO_SEGUNDOS = 30
// ±1 time step (30s) covers phone-clock drift without widening the replay window.
const TOLERANCIA_SEGUNDOS = PERIODO_SEGUNDOS

const ALGORITMO = 'aes-256-gcm'
const LONGITUD_IV = 12 // 96-bit IV for GCM
const LONGITUD_CLAVE = 32 // 256-bit key

function claveCifrado(): Buffer {
  const secreto = process.env.TOTP_ENCRYPTION_KEY
  if (!secreto) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'TOTP_ENCRYPTION_KEY no está definido. Configure la variable de entorno en producción.'
      )
    }
    // Dev-only fallback: deterministic key so local TOTP flows work without
    // extra setup. Never use in production (guarded above).
    return Buffer.alloc(LONGITUD_CLAVE, 'dev-totp-key-not-for-prod')
  }
  const clave = Buffer.from(secreto, 'base64')
  if (clave.length !== LONGITUD_CLAVE) {
    throw new Error(
      'TOTP_ENCRYPTION_KEY debe ser una clave base64 de 32 bytes (256 bits).'
    )
  }
  return clave
}

export interface ResultadoVerificacion {
  valido: boolean
  delta: number | null
}

// Generates a fresh Base32 TOTP secret (20 bytes / 160 bits, RFC 4226
// recommendation). Ready to store encrypted via cifrarSecreto().
export async function generarSecreto(): Promise<string> {
  return generateSecret()
}

export function cifrarSecreto(secretoClaro: string): string {
  const iv = randomBytes(LONGITUD_IV)
  const cipher = createCipheriv(ALGORITMO, claveCifrado(), iv)
  const cifrado = Buffer.concat([cipher.update(secretoClaro, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: iv.tag.ciphertext — all base64. Tag authenticates the ciphertext.
  return `${iv.toString('base64')}.${tag.toString('base64')}.${cifrado.toString('base64')}`
}

export function descifrarSecreto(secretoCifrado: string): string {
  const partes = secretoCifrado.split('.')
  if (partes.length !== 3) {
    throw new Error('Formato de secreto TOTP cifrado inválido.')
  }
  const [ivB64, tagB64, cifradoB64] = partes
  const decipher = createDecipheriv(ALGORITMO, claveCifrado(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(cifradoB64, 'base64')), decipher.final()]).toString('utf8')
}

// otpauth:// provisioning URI — what the QR code encodes. `issuer` shows in
// the authenticator app; `label` is usually the email.
export function construirUriProvisionamiento(email: string, secreto: string): string {
  return generateURI({ issuer: 'SIGE', label: email, secret: secreto })
}

export async function generarCodigo(secreto: string): Promise<string> {
  return generate({ secret: secreto })
}

// Verifies a TOTP code with ±1 step drift tolerance.
// Returns `delta` (offset in steps) so callers can enforce replay protection
// by persisting the highest accepted step (see totpLastUsedStep in the schema).
// otplib throws TokenLengthError on malformed tokens instead of returning
// { valid: false }, so the format is checked up front (fail closed).
export async function verificarCodigo(
  secreto: string,
  codigo: string,
  epochActualSegundos?: number
): Promise<ResultadoVerificacion> {
  if (!/^\d{6}$/.test(codigo)) {
    return { valido: false, delta: null }
  }
  const opciones: { secret: string; epochTolerance: number; epoch?: number } = {
    secret: secreto,
    epochTolerance: TOLERANCIA_SEGUNDOS,
  }
  if (epochActualSegundos !== undefined) {
    opciones.epoch = epochActualSegundos
  }
  const resultado = await verify({ ...opciones, token: codigo })
  return {
    valido: resultado.valid,
    delta: resultado.valid ? resultado.delta ?? 0 : null,
  }
}

// Pure helper (no DB): given the current epoch and a delta from verify(),
// computes the time step that must be persisted as totpLastUsedStep.
export function pasoDeTiempo(epochActualSegundos: number, delta: number): number {
  return Math.floor(epochActualSegundos / PERIODO_SEGUNDOS) + delta
}

export { PERIODO_SEGUNDOS }

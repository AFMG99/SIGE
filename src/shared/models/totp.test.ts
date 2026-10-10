import { describe, it, expect, beforeAll } from 'vitest'
import {
  generarSecreto,
  cifrarSecreto,
  descifrarSecreto,
  construirUriProvisionamiento,
  generarCodigo,
  verificarCodigo,
  pasoDeTiempo,
  PERIODO_SEGUNDOS,
} from './totp'

// RFC 6238 Appendix B test vectors: SHA-1, secret = ASCII
// "12345678901234567890" (base32: GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ).
// Vectors are published as 8-digit codes; a 6-digit TOTP is the same value
// mod 10^6 (the LAST 6 digits, not a truncation of the first 6).
const SECRETO_RFC = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

describe('totp', () => {
  beforeAll(() => {
    // Deterministic 32-byte base64 key for encryption tests (dev fallback
    // also works, but an explicit key exercises the real path).
    process.env.TOTP_ENCRYPTION_KEY = Buffer.alloc(32, 't').toString('base64')
  })

  describe('verificarCodigo — RFC 6238 vectors (6-digit)', () => {
    // [epochSeconds, rfc8DigitVector, expected6Digits]
    const vectors: Array<[number, string, string]> = [
      [59, '94287082', '287082'],
      [1111111109, '07081804', '081804'],
      [1111111111, '14050471', '050471'],
      [1234567890, '89005924', '005924'],
      [2000000000, '69279037', '279037'],
      [20000000000, '65353130', '353130'],
    ]

    it.each(vectors)('epoch %i (rfc %s) → %s', async (epoch, rfc8, esperado) => {
      // Cross-check: expected 6-digit code is the RFC vector mod 10^6.
      expect(String(Number(rfc8) % 1_000_000).padStart(6, '0')).toBe(esperado)
      const resultado = await verificarCodigo(SECRETO_RFC, esperado, epoch)
      expect(resultado.valido).toBe(true)
      expect(resultado.delta).toBe(0)
    })
  })

  describe('round-trip generar/verificar', () => {
    it('accepts the current code', async () => {
      const secreto = await generarSecreto()
      const codigo = await generarCodigo(secreto)
      expect(codigo).toMatch(/^\d{6}$/)
      const r = await verificarCodigo(secreto, codigo)
      expect(r.valido).toBe(true)
      expect(r.delta).toBe(0)
    })

    it('rejects a wrong code', async () => {
      const secreto = await generarSecreto()
      const r = await verificarCodigo(secreto, '000000')
      expect(r.valido).toBe(false)
      expect(r.delta).toBeNull()
    })

    it('rejects a non-6-digit code', async () => {
      const secreto = await generarSecreto()
      const r = await verificarCodigo(secreto, '12345')
      expect(r.valido).toBe(false)
    })

    it('tolerates ±1 step (30s) drift but not ±2', async () => {
      const secreto = await generarSecreto()
      const ahora = Math.floor(Date.now() / 1000)
      const pasoAnterior = await generarCodigoEnEpoch(secreto, ahora - PERIODO_SEGUNDOS)
      const r1 = await verificarCodigo(secreto, pasoAnterior, ahora)
      expect(r1.valido).toBe(true)
      expect(r1.delta).toBe(-1)

      const dosPasosAtras = await generarCodigoEnEpoch(secreto, ahora - 2 * PERIODO_SEGUNDOS)
      const r2 = await verificarCodigo(secreto, dosPasosAtras, ahora)
      expect(r2.valido).toBe(false)
    })
  })

  describe('pasoDeTiempo — replay protection helper', () => {
    it('maps current code to current step', async () => {
      const ahora = Math.floor(Date.now() / 1000)
      expect(pasoDeTiempo(ahora, 0)).toBe(Math.floor(ahora / PERIODO_SEGUNDOS))
    })

    it('maps a drifted (delta -1) code to the previous step', async () => {
      const ahora = Math.floor(Date.now() / 1000)
      expect(pasoDeTiempo(ahora, -1)).toBe(Math.floor(ahora / PERIODO_SEGUNDOS) - 1)
    })
  })

  describe('cifrarSecreto / descifrarSecreto', () => {
    it('round-trips a secret', () => {
      const secreto = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
      const cifrado = cifrarSecreto(secreto)
      expect(cifrado).not.toContain(secreto)
      expect(descifrarSecreto(cifrado)).toBe(secreto)
    })

    it('produces a distinct ciphertext per call (random IV)', () => {
      const secreto = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
      expect(cifrarSecreto(secreto)).not.toBe(cifrarSecreto(secreto))
    })

    it('fails on tampered ciphertext', () => {
      const cifrado = cifrarSecreto('secreto')
      const [iv, tag, data] = cifrado.split('.')
      const dataBytes = Buffer.from(data, 'base64')
      dataBytes[0] ^= 0xff
      const tamperado = `${iv}.${tag}.${dataBytes.toString('base64')}`
      expect(() => descifrarSecreto(tamperado)).toThrow()
    })

    it('fails on malformed format', () => {
      expect(() => descifrarSecreto('not-a-valid-format')).toThrow()
    })
  })

  describe('construirUriProvisionamiento', () => {
    it('builds an otpauth:// URI with issuer and label', () => {
      const uri = construirUriProvisionamiento(
        'user@test.com',
        'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
      )
      expect(uri).toMatch(/^otpauth:\/\/totp\//)
      expect(uri).toContain('issuer=SIGE')
      expect(uri).toContain('user%40test.com')
      expect(uri).toContain('secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP')
    })
  })
})

// Local helper: otplib's generarCodigo uses the real clock; for drift tests we
// need a code pinned to a specific epoch.
async function generarCodigoEnEpoch(secreto: string, epoch: number): Promise<string> {
  const { generate } = await import('otplib')
  return generate({ secret: secreto, epoch })
}

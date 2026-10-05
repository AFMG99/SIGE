'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// ==========================================
// Single water-drop button:
//  - spherical refraction (inverted, curved, chromatic) of the university
//  - 3D volume: specular highlights, dome light, bottom caustic, contact shadow
//  - organic edge: irregular blob, gravity-flattened base
//  - press → bursts into particles → disappears (onExploded)
// ==========================================

interface Burst {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  hue: number
}

// lens geometry (texture space)
const LENS_FRAC = 0.8   // r=1 sits at 80% of texture half-size
const DROP_K = 1.16     // drop-space radius covered by the lens
const SRC_MARGIN = 1.5  // scene canvas = T * margin
const LENS_POW = 2.4    // >1 → centre magnified, edges wide-angle
const LENS_REACH = 1.7  // how far toward the scene edge the rim samples

/** Irregular, gravity-flattened blob path centred at (0,0) — NOT a perfect circle. */
function blobPath(ctx: CanvasRenderingContext2D, r: number): void {
  const N = 64
  const pts = new Float64Array(N * 2)
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    // organic wobble (low-frequency noise)
    let rad =
      r *
      (1 +
        0.04 * Math.sin(a * 3 + 1.9) +
        0.028 * Math.sin(a * 5 - 0.7) +
        0.018 * Math.sin(a * 8 + 2.3))
    // gravity: bottom bulges (contact mass)
    const down = Math.max(0, Math.sin(a))
    rad *= 1 + 0.07 * down * down
    let x = Math.cos(a) * rad
    let y = Math.sin(a) * rad
    // flattened contact base
    const floorY = r * 0.9
    if (y > floorY) y = floorY + (y - floorY) * 0.3
    pts[i * 2] = x
    pts[i * 2 + 1] = y
  }
  // smooth closed curve through midpoints
  ctx.beginPath()
  const m0x = (pts[0] + pts[(N - 1) * 2]) / 2
  const m0y = (pts[1] + pts[(N - 1) * 2 + 1]) / 2
  ctx.moveTo(m0x, m0y)
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N
    ctx.quadraticCurveTo(
      pts[i * 2],
      pts[i * 2 + 1],
      (pts[i * 2] + pts[j * 2]) / 2,
      (pts[i * 2 + 1] + pts[j * 2 + 1]) / 2
    )
  }
  ctx.closePath()
}

/** Paint the "scene behind the drop" into a square canvas (source for refraction). */
function paintScene(
  ctx: CanvasRenderingContext2D,
  S: number,
  img: HTMLImageElement | null,
  imgReady: boolean,
  blurPx: number
): void {
  if (imgReady && img && img.naturalWidth > 0) {
    ctx.save()
    if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`
    const sc = Math.max(S / img.naturalWidth, S / img.naturalHeight)
    const dw = img.naturalWidth * sc
    const dh = img.naturalHeight * sc
    ctx.drawImage(img, (S - dw) / 2, (S - dh) / 2, dw, dh)
    ctx.restore()
    // forest tint to match the page ambience
    ctx.fillStyle = 'rgba(8,22,8,0.32)'
    ctx.fillRect(0, 0, S, S)
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, S)
    g.addColorStop(0, '#1e361e')
    g.addColorStop(1, '#0e1c0e')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
    // tiny classic silhouette
    const cx = S / 2
    const base = S * 0.72
    const bw = S * 0.42
    const bh = S * 0.3
    ctx.fillStyle = '#2c3b2c'
    ctx.fillRect(cx - bw / 2, base - bh, bw, bh)
    ctx.beginPath()
    ctx.arc(cx, base - bh - S * 0.05, S * 0.09, Math.PI, 0)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,215,130,0.4)'
    for (let rw = 0; rw < 2; rw++)
      for (let cw = 0; cw < 3; cw++)
        ctx.fillRect(
          cx - bw * 0.34 + cw * bw * 0.28,
          base - bh * 0.75 + rw * bh * 0.4,
          bw * 0.1,
          bh * 0.2
        )
  }

  // scene vignette → becomes the drop's natural dark rim
  const vg = ctx.createRadialGradient(S / 2, S / 2, S * 0.28, S / 2, S / 2, S * 0.72)
  vg.addColorStop(0, 'rgba(6,16,8,0)')
  vg.addColorStop(1, 'rgba(4,12,6,0.85)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, S, S)
}

/**
 * Precompute the refracted texture once:
 * per-pixel spherical-lens mapping with 180° inversion + chromatic aberration.
 */
function buildRefractionTexture(
  T: number,
  img: HTMLImageElement | null,
  imgReady: boolean,
  blurPx: number
): HTMLCanvasElement {
  const S = Math.ceil(T * SRC_MARGIN)
  const src = document.createElement('canvas')
  src.width = S
  src.height = S
  const sctx = src.getContext('2d')!
  paintScene(sctx, S, img, imgReady, blurPx * 0.5)
  const sd = sctx.getImageData(0, 0, S, S).data

  const tex = document.createElement('canvas')
  tex.width = T
  tex.height = T
  const tctx = tex.getContext('2d')!
  const out = tctx.createImageData(T, T)

  const half = T / 2
  const rRef = LENS_FRAC * half // px where lens r = 1
  const he = S / 2
  const edgeSoft = 2 / rRef
  const darkEdge = [6, 16, 9]

  const sample = (dx: number, dy: number, dist: number, ch: number): number => {
    const sx = Math.round(he - dx * dist)
    const sy = Math.round(he - dy * dist)
    if (sx < 0 || sy < 0 || sx >= S || sy >= S) return darkEdge[ch]
    return sd[(sy * S + sx) * 4 + ch]
  }

  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const idx = (y * T + x) * 4
      const nx = (x + 0.5 - half) / rRef
      const ny = (y + 0.5 - half) / rRef
      const r = Math.sqrt(nx * nx + ny * ny)
      if (r >= 1 + edgeSoft) continue // transparent outside lens
      if (r > 0.0001) {
        const dirx = nx / r
        const diry = ny / r
        const rc = Math.min(r, 1)
        const base = Math.pow(rc, LENS_POW) * LENS_REACH * rRef
        // chromatic aberration: channels bend slightly differently
        out.data[idx] = sample(dirx, diry, base * 0.982, 0)
        out.data[idx + 1] = sample(dirx, diry, base, 1)
        out.data[idx + 2] = sample(dirx, diry, base * 1.02, 2)
      } else {
        out.data[idx] = 255
        out.data[idx + 1] = 255
        out.data[idx + 2] = 255
      }
      const a = r >= 1 ? Math.max(0, (1 + edgeSoft - r) / edgeSoft) : 1
      out.data[idx + 3] = Math.round(a * 255)
    }
  }

  tctx.putImageData(out, 0, 0)
  return tex
}

export function SkipDropButton({
  onSkip,
  onExploded,
  universityImage,
  imageBlur = 18,
  label = 'Saltar animación',
  size = 92,
}: {
  onSkip: () => void
  /** Called when the burst fully finished (safe to unmount) */
  onExploded?: () => void
  universityImage?: string
  imageBlur?: number
  label?: string
  size?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>()
  const [exploding, setExploding] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [imgReady, setImgReady] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const texRef = useRef<HTMLCanvasElement | null>(null)
  const burstRef = useRef<Burst[]>([])
  const explodeStartRef = useRef(0)
  const phaseRef = useRef<'idle' | 'burst' | 'gone'>('idle')
  const imgSrcRef = useRef<string | undefined>(undefined)

  // load university image
  useEffect(() => {
    if (!universityImage) return
    imgSrcRef.current = universityImage
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (imgSrcRef.current !== universityImage) return
      imgRef.current = img
      setImgReady(true)
    }
    img.onerror = () => {
      imgRef.current = null
      setImgReady(false)
    }
    img.src = universityImage
    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [universityImage])

  // (re)build refraction texture when image or size changes
  useEffect(() => {
    const T = Math.round(size * 2.2)
    texRef.current = buildRefractionTexture(T, imgRef.current, imgReady, imageBlur)
  }, [imgReady, size, imageBlur, universityImage])

  const spawnBurst = useCallback((w: number, h: number) => {
    const cx = w / 2
    const cy = h / 2
    const parts: Burst[] = []
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2 + Math.random() * 0.4
      const sp = 1.5 + Math.random() * 5.5
      parts.push({
        x: cx, y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.8,
        life: 1,
        maxLife: 45 + Math.random() * 55,
        size: 1.5 + Math.random() * 4,
        hue: 170 + Math.random() * 40,
      })
    }
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 3 + Math.random() * 8
      parts.push({
        x: cx, y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 1.2,
        life: 1,
        maxLife: 25 + Math.random() * 35,
        size: 1 + Math.random() * 3,
        hue: 195 + Math.random() * 20,
      })
    }
    burstRef.current = parts
  }, [])

  const animate = useCallback((ts: number) => {
    const canvas = canvasRef.current
    if (!canvas || phaseRef.current === 'gone') return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    const cx = w / 2
    const cy = h / 2

    ctx.clearRect(0, 0, w, h)

    if (phaseRef.current === 'idle') {
      const baseR = Math.min(w * 0.4, h * 0.34)
      const pulse = 1 + Math.sin(ts * 0.003) * 0.025
      const r = baseR * pulse

      // ---- contact shadow (grounds the drop on a surface) ----
      ctx.save()
      ctx.translate(cx, cy + r * 0.92)
      ctx.scale(1, 0.3)
      const shg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.3)
      shg.addColorStop(0, 'rgba(0,8,4,0.55)')
      shg.addColorStop(0.55, 'rgba(0,8,4,0.28)')
      shg.addColorStop(1, 'rgba(0,8,4,0)')
      ctx.fillStyle = shg
      ctx.beginPath()
      ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(Math.sin(ts * 0.0007) * 0.035) // subtle surface tension sway

      // ---- clip to organic blob ----
      blobPath(ctx, r)
      ctx.save()
      ctx.clip()

      // ---- refracted scene (inverted + curved) ----
      if (texRef.current) {
        const tex = texRef.current
        const dest = (r * DROP_K) / LENS_FRAC * 2
        ctx.save()
        ctx.rotate(Math.sin(ts * 0.0009) * 0.04) // refraction shimmer
        ctx.drawImage(tex, -dest / 2, -dest / 2, dest, dest)
        ctx.restore()
      }

      // ---- VOLUME 1: edge absorption (thickness) ----
      const eg = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.05)
      eg.addColorStop(0, 'rgba(3,14,7,0)')
      eg.addColorStop(0.72, 'rgba(3,14,7,0.14)')
      eg.addColorStop(1, 'rgba(2,10,5,0.55)')
      ctx.fillStyle = eg
      ctx.fillRect(-r * 1.4, -r * 1.4, r * 2.8, r * 2.8)

      // ---- VOLUME 2: dome light from upper-left ----
      const dg = ctx.createRadialGradient(-r * 0.3, -r * 0.38, r * 0.04, -r * 0.3, -r * 0.38, r * 1.1)
      dg.addColorStop(0, 'rgba(255,255,255,0.3)')
      dg.addColorStop(0.4, 'rgba(235,250,255,0.12)')
      dg.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = dg
      ctx.fillRect(-r * 1.4, -r * 1.4, r * 2.8, r * 2.8)

      // ---- VOLUME 3: bottom caustic (light focused through the drop) ----
      const cg = ctx.createRadialGradient(0, r * 0.6, 0, 0, r * 0.6, r * 0.55)
      cg.addColorStop(0, 'rgba(215,255,240,0.5)')
      cg.addColorStop(0.5, 'rgba(190,250,230,0.18)')
      cg.addColorStop(1, 'rgba(190,250,230,0)')
      ctx.fillStyle = cg
      ctx.fillRect(-r * 1.4, -r * 1.4, r * 2.8, r * 2.8)

      ctx.restore() // end clip (blob transform kept)

      // ---- RIM: gradient, not uniform (bright top-left, dark base) ----
      blobPath(ctx, r)
      const rim = ctx.createLinearGradient(-r * 0.8, -r * 0.8, r * 0.7, r * 0.8)
      rim.addColorStop(0, 'rgba(255,255,255,0.85)')
      rim.addColorStop(0.4, 'rgba(230,250,255,0.35)')
      rim.addColorStop(0.75, 'rgba(40,80,70,0.35)')
      rim.addColorStop(1, 'rgba(0,12,6,0.65)')
      ctx.strokeStyle = rim
      ctx.lineWidth = Math.max(1.2, r * 0.05)
      ctx.stroke()

      // ---- SPECULAR: intense main hot-spot (upper-left) ----
      const sx1 = -r * 0.38
      const sy1 = -r * 0.44
      const sp1 = ctx.createRadialGradient(sx1, sy1, 0, sx1, sy1, r * 0.34)
      sp1.addColorStop(0, 'rgba(255,255,255,0.98)')
      sp1.addColorStop(0.35, 'rgba(255,255,255,0.55)')
      sp1.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = sp1
      ctx.beginPath()
      ctx.arc(sx1, sy1, r * 0.34, 0, Math.PI * 2)
      ctx.fill()

      // sharp elliptical core (light source reflection)
      ctx.save()
      ctx.translate(sx1, sy1)
      ctx.rotate(-0.6)
      ctx.scale(1, 0.62)
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.beginPath()
      ctx.arc(0, 0, r * 0.11, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      // secondary dimmer glint (lower-right, bounce light)
      const sx2 = r * 0.34
      const sy2 = r * 0.48
      const sp2 = ctx.createRadialGradient(sx2, sy2, 0, sx2, sy2, r * 0.22)
      sp2.addColorStop(0, 'rgba(235,255,250,0.5)')
      sp2.addColorStop(1, 'rgba(235,255,250,0)')
      ctx.fillStyle = sp2
      ctx.beginPath()
      ctx.arc(sx2, sy2, r * 0.22, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore() // end drop transform

      // ---- label hint ----
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.font = '600 11px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Saltar', cx, cy + r + 16)
    }

    if (phaseRef.current === 'burst') {
      if (!explodeStartRef.current) explodeStartRef.current = ts
      const since = ts - explodeStartRef.current

      // shockwave
      if (since < 450) {
        const sr = (since / 450) * Math.min(w, h) * 0.55
        const alpha = (1 - since / 450) * 0.6
        ctx.beginPath()
        ctx.arc(cx, cy, sr, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(160,235,255,${alpha})`
        ctx.lineWidth = 3
        ctx.stroke()
      }

      // radial white flash (not a square fill)
      if (since < 140) {
        const fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.6)
        fg.addColorStop(0, `rgba(235,252,255,${(1 - since / 140) * 0.85})`)
        fg.addColorStop(1, 'rgba(235,252,255,0)')
        ctx.fillStyle = fg
        ctx.fillRect(0, 0, w, h)
      }

      // particles
      const parts = burstRef.current
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.96
        p.vy = p.vy * 0.96 + 0.05
        p.life -= 1 / p.maxLife
        if (p.life <= 0) {
          parts.splice(i, 1)
          continue
        }
        const a = p.life * 0.9
        const size = p.size * p.life
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 2.2)
        g.addColorStop(0, `hsla(${p.hue}, 90%, 85%, ${a})`)
        g.addColorStop(0.5, `hsla(${p.hue}, 85%, 60%, ${a * 0.5})`)
        g.addColorStop(1, `hsla(${p.hue}, 85%, 55%, 0)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x, p.y, size * 2.2, 0, Math.PI * 2)
        ctx.fill()
      }

      if (parts.length === 0 && since > 500) {
        phaseRef.current = 'gone'
        setHidden(true)
        onExploded?.()
        return
      }
    }

    animRef.current = requestAnimationFrame(animate)
  }, [onExploded])

  // animation loop
  useEffect(() => {
    if (hidden) return
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = size * 2 * dpr
      canvas.height = (size + 70) * dpr
      canvas.style.width = `${size * 2}px`
      canvas.style.height = `${size + 70}px`
      const c = canvas.getContext('2d')
      if (c) c.scale(dpr, dpr)
    }
    resize()
    animRef.current = requestAnimationFrame(animate)

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [animate, hidden, size])

  const handleSkip = useCallback(() => {
    if (phaseRef.current !== 'idle') return
    phaseRef.current = 'burst'
    setExploding(true)
    explodeStartRef.current = 0

    const canvas = canvasRef.current
    if (canvas) {
      const dpr = window.devicePixelRatio || 1
      spawnBurst(canvas.width / dpr, canvas.height / dpr)
    }

    onSkip()
  }, [onSkip, spawnBurst])

  if (hidden) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col items-center select-none"
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={handleSkip}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleSkip()
        }
      }}
      style={{ cursor: exploding ? 'default' : 'pointer' }}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none"
        style={{ width: size * 2, height: size + 70 }}
      />
    </div>
  )
}
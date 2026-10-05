'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  hue: number
}

interface Spark {
  x: number
  y: number
  angle: number
  dist: number
  speed: number
  life: number
  maxLife: number
  size: number
}

export function EnergyLoader({
  duration = 7000,
  onComplete,
  active = true,
}: {
  duration?: number
  onComplete?: () => void
  active?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>()
  const startRef = useRef<number>()
  const firedRef = useRef(false)
  const particlesRef = useRef<Particle[]>([])
  const sparksRef = useRef<Spark[]>([])
  const phaseRef = useRef<'charging' | 'exploding' | 'dispersing' | 'done'>('charging')
  const explodeTimeRef = useRef(0)
  const [hidden, setHidden] = useState(false)

  // Ring geometry
  const getRing = useCallback((w: number, h: number) => {
    const cx = w / 2
    const cy = h / 2
    const radius = Math.min(w, h) * 0.12
    return { cx, cy, radius }
  }, [])

  const spawnExplosion = useCallback((cx: number, cy: number, radius: number) => {
    const particles: Particle[] = []
    const sparks: Spark[] = []

    // radial burst particles
    for (let i = 0; i < 120; i++) {
      const angle = (i / 120) * Math.PI * 2 + Math.random() * 0.3
      const speed = 2 + Math.random() * 7
      particles.push({
        x: cx + Math.cos(angle) * radius * 0.3,
        y: cy + Math.sin(angle) * radius * 0.3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 1,
        maxLife: 60 + Math.random() * 80,
        size: 2 + Math.random() * 5,
        hue: 100 + Math.random() * 40, // phosphorescent green range
      })
    }

    // inner sparks (brighter, faster, shorter)
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 5 + Math.random() * 10
      sparks.push({
        x: cx,
        y: cy,
        angle,
        dist: radius * 0.2,
        speed,
        life: 1,
        maxLife: 30 + Math.random() * 40,
        size: 1 + Math.random() * 3,
      })
    }

    particlesRef.current = particles
    sparksRef.current = sparks
  }, [])

  const animate = useCallback((ts: number) => {
    const canvas = canvasRef.current
    if (!canvas || !active) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr

    if (!startRef.current) startRef.current = ts
    const elapsed = ts - startRef.current
    const { cx, cy, radius } = getRing(w, h)

    ctx.clearRect(0, 0, w, h)

    const phase = phaseRef.current

    // ---- CHARGING PHASE ----
    if (phase === 'charging') {
      const progress = Math.min(elapsed / duration, 1)

      // outer glow ring (faint)
      ctx.beginPath()
      ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(57, 255, 20, ${0.08 + progress * 0.1})`
      ctx.lineWidth = 2
      ctx.stroke()

      // background ring track
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 14
      ctx.stroke()

      // filled arc (clockwise from top)
      const startAngle = -Math.PI / 2
      const endAngle = startAngle + progress * Math.PI * 2

      // glow layers
      ctx.beginPath()
      ctx.arc(cx, cy, radius, startAngle, endAngle)
      ctx.strokeStyle = `rgba(57, 255, 20, 0.25)`
      ctx.lineWidth = 22
      ctx.lineCap = 'round'
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(cx, cy, radius, startAngle, endAngle)
      ctx.strokeStyle = `rgba(57, 255, 20, 0.55)`
      ctx.lineWidth = 14
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(cx, cy, radius, startAngle, endAngle)
      ctx.strokeStyle = `rgba(140, 255, 80, 0.9)`
      ctx.lineWidth = 7
      ctx.stroke()

      // bright head dot at fill edge
      const hx = cx + Math.cos(endAngle) * radius
      const hy = cy + Math.sin(endAngle) * radius
      const headGlow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 14)
      headGlow.addColorStop(0, 'rgba(200, 255, 150, 0.95)')
      headGlow.addColorStop(0.4, 'rgba(100, 255, 50, 0.6)')
      headGlow.addColorStop(1, 'rgba(57, 255, 20, 0)')
      ctx.fillStyle = headGlow
      ctx.beginPath()
      ctx.arc(hx, hy, 14, 0, Math.PI * 2)
      ctx.fill()

      // inner energy core pulsing
      const pulse = 0.6 + 0.4 * Math.sin(ts * 0.005)
      const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.65 * (0.5 + progress * 0.5))
      coreGlow.addColorStop(0, `rgba(57, 255, 20, ${0.15 * progress * pulse})`)
      coreGlow.addColorStop(0.6, `rgba(57, 255, 20, ${0.06 * progress})`)
      coreGlow.addColorStop(1, 'rgba(57, 255, 20, 0)')
      ctx.fillStyle = coreGlow
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fill()

      // percentage text
      const pct = Math.floor(progress * 100)
      ctx.fillStyle = `rgba(140, 255, 80, ${0.5 + progress * 0.5})`
      ctx.font = `bold ${Math.max(18, radius * 0.38)}px "Courier New", monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${pct}%`, cx, cy)

      // small label below
      ctx.fillStyle = `rgba(57, 255, 20, ${0.3 + progress * 0.4})`
      ctx.font = `${Math.max(10, radius * 0.14)}px "Courier New", monospace`
      ctx.fillText('ENERGÍA', cx, cy + radius * 0.35)

      // orbiting energy motes
      const moteCount = 6
      for (let i = 0; i < moteCount; i++) {
        const mAngle = (i / moteCount) * Math.PI * 2 + ts * 0.002
        const mDist = radius + 14 + Math.sin(ts * 0.003 + i * 2) * 6
        const mx = cx + Math.cos(mAngle) * mDist
        const my = cy + Math.sin(mAngle) * mDist
        const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 5)
        mg.addColorStop(0, `rgba(140, 255, 80, ${0.4 + progress * 0.5})`)
        mg.addColorStop(1, 'rgba(57, 255, 20, 0)')
        ctx.fillStyle = mg
        ctx.beginPath()
        ctx.arc(mx, my, 5, 0, Math.PI * 2)
        ctx.fill()
      }

      // completion → explode
      if (progress >= 1 && !firedRef.current) {
        firedRef.current = true
        phaseRef.current = 'exploding'
        explodeTimeRef.current = ts
        spawnExplosion(cx, cy, radius)

        // white flash
        ctx.fillStyle = 'rgba(200, 255, 180, 0.9)'
        ctx.fillRect(0, 0, w, h)
      }
    }

    // ---- EXPLODING / DISPERSING PHASE ----
    if (phase === 'exploding' || phase === 'dispersing') {
      const sinceExplode = ts - explodeTimeRef.current

      // shockwave rings
      for (let ring = 0; ring < 3; ring++) {
        const ringAge = sinceExplode - ring * 80
        if (ringAge > 0 && ringAge < 600) {
          const ringR = (ringAge / 600) * Math.min(w, h) * 0.6
          const ringAlpha = (1 - ringAge / 600) * 0.5
          ctx.beginPath()
          ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(100, 255, 60, ${ringAlpha})`
          ctx.lineWidth = 3 - ring
          ctx.stroke()
        }
      }

      // particles
      const parts = particlesRef.current
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.97
        p.vy = p.vy * 0.97 + 0.03 // slight gravity
        p.life -= 1 / p.maxLife

        if (p.life <= 0) {
          parts.splice(i, 1)
          continue
        }

        const alpha = p.life * 0.9
        const size = p.size * p.life
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 2)
        g.addColorStop(0, `hsla(${p.hue}, 100%, 70%, ${alpha})`)
        g.addColorStop(0.5, `hsla(${p.hue}, 100%, 50%, ${alpha * 0.5})`)
        g.addColorStop(1, `hsla(${p.hue}, 100%, 50%, 0)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x, p.y, size * 2, 0, Math.PI * 2)
        ctx.fill()
      }

      // sparks
      const sprks = sparksRef.current
      for (let i = sprks.length - 1; i >= 0; i--) {
        const s = sprks[i]
        s.dist += s.speed
        s.speed *= 0.94
        s.life -= 1 / s.maxLife

        if (s.life <= 0) {
          sprks.splice(i, 1)
          continue
        }

        const sx = cx + Math.cos(s.angle) * s.dist
        const sy = cy + Math.sin(s.angle) * s.dist
        ctx.fillStyle = `rgba(200, 255, 180, ${s.life})`
        ctx.beginPath()
        ctx.arc(sx, sy, s.size * s.life, 0, Math.PI * 2)
        ctx.fill()
      }

      // when all particles gone → done
      if (phase === 'exploding' && sinceExplode > 400) {
        phaseRef.current = 'dispersing'
      }

      if (phase === 'dispersing' && parts.length === 0 && sprks.length === 0) {
        phaseRef.current = 'done'
        onComplete?.()
        setHidden(true)
        return
      }
    }

    animRef.current = requestAnimationFrame(animate)
  }, [active, duration, onComplete, spawnExplosion, getRing])

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.parentElement?.clientWidth || window.innerWidth
      const h = canvas.parentElement?.clientHeight || window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      const c = canvas.getContext('2d')
      if (c) c.scale(dpr, dpr)
    }

    resize()
    window.addEventListener('resize', resize)
    startRef.current = 0
    animRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', resize)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [active, animate])

  if (!active || hidden) return null

  return (
    <div className="fixed inset-0 z-20 pointer-events-none" aria-hidden="true">
      <canvas ref={canvasRef} className="w-full h-full" style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// ==========================================
// Types
// ==========================================

interface Leaf {
  bx: number       // position along branch (0..1)
  off: number      // perpendicular offset from branch axis
  size: number
  angle: number    // fixed base rotation
  sway: number     // sway phase
  color: string
  delay: number    // when leaf starts growing (0..1 of timeline)
}

interface Branch {
  x0: number
  y0: number
  angle: number
  length: number
  w0: number          // width at base
  w1: number          // width at tip
  delay: number       // start time (0..1)
  dur: number         // duration (0..1)
  growth: number      // current growth 0..1
  leaves: Leaf[]
  children: Branch[]
  shade: number       // -1..1 color variation
  isMain: boolean
}

interface Tree {
  main: Branch
  bark: { main: string; dark: string; light: string }
}

// ==========================================
// Palette
// ==========================================

const GREENS = [
  '#2d7d3a', '#3aa845', '#4ec950', '#1e6b30', '#2a8f38',
  '#3dbd48', '#52d158', '#155225', '#247a2f', '#6fd66b',
  '#1a5c2e', '#45c447', '#2e8b3d', '#48a84f',
]

const BARKS = [
  { main: '#4a3528', dark: '#2e211a', light: '#6b5240' },
  { main: '#3d2b1f', dark: '#251a12', light: '#5d4a3a' },
  { main: '#5c4030', dark: '#3a271c', light: '#7a5c48' },
]

// ==========================================
// Math helpers
// ==========================================

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const smoothstep = (t: number) => t * t * (3 - 2 * t)

function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function darkenColor(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, (((n >> 16) & 0xFF) * (1 - amount)) | 0)
  const g = Math.max(0, (((n >> 8) & 0xFF) * (1 - amount)) | 0)
  const b = Math.max(0, ((n & 0xFF) * (1 - amount)) | 0)
  return `rgb(${r},${g},${b})`
}

// ==========================================
// Branch construction
// ==========================================

function branch(
  x0: number, y0: number, angle: number, length: number,
  w0: number, w1: number, delay: number, dur: number,
  isMain: boolean, seed: number
): Branch {
  return {
    x0, y0, angle, length, w0, w1,
    delay, dur, growth: 0,
    leaves: [], children: [],
    shade: rand(seed) * 2 - 1,
    isMain,
  }
}

function addLeaves(b: Branch, count: number, seed: number, baseDelay: number): void {
  for (let i = 0; i < count; i++) {
    const s = seed + i * 7.31
    const side = i % 2 === 0 ? 1 : -1
    b.leaves.push({
      bx: 0.1 + rand(s) * 0.9,
      off: side * (6 + rand(s + 1) * 22),
      size: 7 + rand(s + 2) * 9,
      angle: (rand(s + 3) - 0.5) * Math.PI * 0.8,
      sway: rand(s + 4) * Math.PI * 2,
      color: GREENS[(rand(s + 5) * GREENS.length) | 0],
      delay: clamp(baseDelay + rand(s + 6) * 0.12, 0, 0.9),
    })
  }
}

/**
 * Creation-of-Adam arm:
 * main horizontal trunk reaching toward centre,
 * sub-branches spreading up/down, sub-sub with leaves.
 */
function createArm(
  startX: number, startY: number,
  dir: 1 | -1,        // 1 = right, -1 = left
  reach: number,       // horizontal reach toward centre
  seed: number
): Branch {
  const bark = BARKS[(rand(seed) * BARKS.length) | 0]

  // main: nearly horizontal, slight upward lean (finger pointing)
  const lean = (rand(seed + 1) - 0.5) * 0.18 - 0.06
  const mainAngle = dir === 1 ? lean : Math.PI - lean

  const main = branch(
    startX, startY, mainAngle, reach,
    16 * (0.85 + rand(seed + 2) * 0.3), 2.5,
    0, 0.42, true, seed
  )

  // sub-branches
  const subN = 5 + ((rand(seed + 3) * 3) | 0)
  for (let i = 0; i < subN; i++) {
    const t = 0.12 + rand(seed + 10 + i) * 0.75
    const spread = dir === 1 ? 1 : -1
    const subAngle = mainAngle + spread * (i % 2 === 0 ? -0.65 : 0.65)
      + (rand(seed + 20 + i) - 0.5) * 0.7
    const subLen = reach * (0.18 + rand(seed + 30 + i) * 0.35)
    const subDelay = 0.22 + t * 0.18

    const bx = startX + Math.cos(mainAngle) * reach * t
    const by = startY + Math.sin(mainAngle) * reach * t

    const sub = branch(
      bx, by, subAngle, subLen,
      5.5 * (1 - t * 0.5), 1.2,
      subDelay, 0.3, false, seed + 40 + i
    )

    // more leaves (first N stay identical to previous version — only adds)
    addLeaves(sub, 14 + ((rand(seed + 50 + i) * 10) | 0), seed + 100 + i * 17, subDelay + 0.1)

    // sub-sub branches
    const ssN = 1 + ((rand(seed + 60 + i) * 3) | 0)
    for (let j = 0; j < ssN; j++) {
      const st = 0.25 + rand(seed + 70 + i * 5 + j) * 0.6
      const ssAngle = subAngle + (rand(seed + 80 + i * 5 + j) - 0.5) * 0.9
      const ssLen = subLen * (0.35 + rand(seed + 90 + i * 5 + j) * 0.35)
      const sbx = bx + Math.cos(subAngle) * subLen * st
      const sby = by + Math.sin(subAngle) * subLen * st
      const ssDelay = subDelay + 0.1 + st * 0.1

      const ss = branch(
        sbx, sby, ssAngle, ssLen,
        2.5, 0.7, ssDelay, 0.25, false, seed + 110 + i * 5 + j
      )
      // extra leaves on sub-sub branches (adds more, keeps previous count)
      addLeaves(ss, 12 + ((rand(seed + 130 + i + j) * 8) | 0), seed + 160 + i * 30 + j * 7, ssDelay + 0.08)
      sub.children.push(ss)
    }

    main.children.push(sub)
  }

  // leaves on the main trunk (original 10 + extra batch for density)
  addLeaves(main, 10, seed + 200, 0.35)
  addLeaves(main, 14, seed + 210, 0.4)

  // extra foliage pass along the whole arm (dense canopy clusters)
  const extraN = 24 + ((rand(seed + 220) * 16) | 0)
  for (let e = 0; e < extraN; e++) {
    const es = seed + 230 + e * 3.17
    const et = 0.05 + rand(es) * 0.92
    const ex = startX + Math.cos(mainAngle) * reach * et
    const ey = startY + Math.sin(mainAngle) * reach * et
    const eSide = e % 2 === 0 ? 1 : -1
    const cluster: Leaf = {
      bx: et,
      off: eSide * (14 + rand(es + 1) * 34),
      size: 8 + rand(es + 2) * 10,
      angle: (rand(es + 3) - 0.5) * Math.PI * 1.2,
      sway: rand(es + 4) * Math.PI * 2,
      color: GREENS[(rand(es + 5) * GREENS.length) | 0],
      delay: clamp(0.3 + rand(es + 6) * 0.35, 0, 0.9),
    }
    main.leaves.push(cluster)

    // small companion leaf for cluster feel
    main.leaves.push({
      ...cluster,
      bx: clamp(et + (rand(es + 7) - 0.5) * 0.06, 0.02, 0.98),
      off: eSide * (10 + rand(es + 8) * 30),
      size: 6 + rand(es + 9) * 8,
      angle: cluster.angle + (rand(es + 10) - 0.5) * 0.9,
      sway: rand(es + 11) * Math.PI * 2,
      color: GREENS[(rand(es + 12) * GREENS.length) | 0],
      delay: clamp(cluster.delay + 0.04, 0, 0.92),
    })
  }

  return main
}

// ==========================================
// Scene setup
// ==========================================

function buildScene(w: number, h: number): Tree[] {
  const trees: Tree[] = []
  const reach = w * 0.46   // reach from edge toward centre

  // LEFT side: 2 arms at different heights
  for (let i = 0; i < 2; i++) {
    const y = h * (0.32 + i * 0.3)
    const bark = BARKS[(rand(i * 31) * BARKS.length) | 0]
    const main = createArm(-70, y, 1, reach * (0.92 + rand(i * 7) * 0.15), i * 500 + 1)
    trees.push({ main, bark })
  }

  // RIGHT side: 2 arms
  for (let i = 0; i < 2; i++) {
    const y = h * (0.28 + i * 0.32)
    const bark = BARKS[(rand(i * 47 + 10) * BARKS.length) | 0]
    const main = createArm(w + 70, y, -1, reach * (0.92 + rand(i * 13 + 5) * 0.15), i * 500 + 250)
    trees.push({ main, bark })
  }

  return trees
}

function eachBranch(root: Branch, fn: (b: Branch) => void): void {
  fn(root)
  for (const c of root.children) eachBranch(c, fn)
}

// ==========================================
// Growth update — THE FIXED FORMULA
// ==========================================

function updateGrowth(trees: Tree[], progress: number): void {
  for (const tree of trees) {
    eachBranch(tree.main, (b) => {
      // Simple, correct: clamp((progress - delay) / dur)
      const raw = (progress - b.delay) / b.dur
      b.growth = smoothstep(clamp(raw, 0, 1))
    })
  }
}

// ==========================================
// Drawing — branches
// ==========================================

function drawBranch(
  ctx: CanvasRenderingContext2D,
  b: Branch,
  bark: Tree['bark'],
  time: number,
  wind: number
): void {
  if (b.growth <= 0.01) return

  const g = b.growth
  const len = b.length * g
  const wNow0 = b.w0 * Math.min(1, g * 2.5)
  const wNow1 = lerp(b.w0 * 0.25, b.w1, g)

  const ca = Math.cos(b.angle)
  const sa = Math.sin(b.angle)

  // wind: tip moves more than base
  const windPhase = time * 0.0005 + b.shade * 6

  const steps = 10
  const top: { x: number; y: number }[] = []
  const bot: { x: number; y: number }[] = []
  const mid: { x: number; y: number }[] = []

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const wx = b.x0 + ca * len * t
    const wy = b.y0 + sa * len * t

    // organic wind sway
    const sway = Math.sin(windPhase + t * 3) * wind * 10 * t * t * g
    const px = wx - sa * sway
    const py = wy + ca * sway

    const hw = lerp(wNow0, wNow1, smoothstep(t)) / 2
    top.push({ x: px - sa * hw, y: py + ca * hw })
    bot.push({ x: px + sa * hw, y: py - ca * hw })
    mid.push({ x: px, y: py })
  }

  // ---- fill tapered shape ----
  ctx.beginPath()
  ctx.moveTo(top[0].x, top[0].y)
  for (let i = 1; i <= steps; i++) ctx.lineTo(top[i].x, top[i].y)
  for (let i = steps; i >= 0; i--) ctx.lineTo(bot[i].x, bot[i].y)
  ctx.closePath()

  // main bark colour with slight shade variation
  ctx.fillStyle = bark.main
  ctx.fill()

  // dark outline
  ctx.strokeStyle = bark.dark
  ctx.lineWidth = 1.2
  ctx.stroke()

  // ---- highlight along upper edge ----
  ctx.beginPath()
  ctx.moveTo(top[0].x, top[0].y)
  for (let i = 1; i <= steps; i++) ctx.lineTo(top[i].x, top[i].y)
  ctx.strokeStyle = bark.light
  ctx.globalAlpha = 0.45
  ctx.lineWidth = Math.max(1, wNow0 * 0.18)
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.globalAlpha = 1

  // ---- bark texture lines ----
  if (wNow0 > 3) {
    ctx.globalAlpha = 0.2
    ctx.strokeStyle = bark.dark
    ctx.lineWidth = 0.7
    const nLines = Math.min(5, Math.floor(wNow0 / 2))
    for (let l = 0; l < nLines; l++) {
      const off = ((l / (nLines - 1 || 1)) - 0.5) * wNow0 * 0.6
      ctx.beginPath()
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const wob = Math.sin(t * 9 + l * 4 + b.shade * 8) * 1.8
        const cx = (top[i].x + bot[i].x) / 2
        const cy = (top[i].y + bot[i].y) / 2
        const tx = cx - sa * (off + wob)
        const ty = cy + ca * (off + wob)
        if (i === 0) ctx.moveTo(tx, ty)
        else ctx.lineTo(tx, ty)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  // ---- leaves ----
  for (const leaf of b.leaves) {
    const raw = (getProgress() - leaf.delay) / 0.22
    const lp = smoothstep(clamp(raw, 0, 1))
    if (lp <= 0.01) continue
    drawLeaf(ctx, leaf, mid, b.angle, lp, time, wind, g)
  }

  // ---- children ----
  for (const child of b.children) {
    drawBranch(ctx, child, bark, time, wind)
  }
}

// Progress tracking (set from animate loop)
let _globalProgress = 0
function getProgress(): number { return _globalProgress }

function drawLeaf(
  ctx: CanvasRenderingContext2D,
  leaf: Leaf,
  midPoints: { x: number; y: number }[],
  branchAngle: number,
  growth: number,
  time: number,
  wind: number,
  branchGrowth: number
): void {
  if (growth <= 0.01) return

  const p = growth
  const size = leaf.size * p
  if (size < 1) return

  // position: interpolate along branch mid-points
  const idx = Math.min(leaf.bx, 0.999) * (midPoints.length - 1)
  const i0 = Math.floor(idx)
  const i1 = Math.min(i0 + 1, midPoints.length - 1)
  const ft = idx - i0
  const bx = lerp(midPoints[i0].x, midPoints[i1].x, ft)
  const by = lerp(midPoints[i0].y, midPoints[i1].y, ft)

  // perpendicular offset
  const sa = Math.sin(branchAngle)
  const ca = Math.cos(branchAngle)

  // sway
  const sway = Math.sin(time * 0.0012 + leaf.sway) * wind * 6 * p
  const lx = bx - sa * leaf.off + (-sa) * sway
  const ly = by + ca * leaf.off + ca * sway

  ctx.save()
  ctx.translate(lx, ly)
  ctx.rotate(leaf.angle + Math.sin(time * 0.0009 + leaf.sway) * 0.12)
  ctx.globalAlpha = Math.min(1, p * 1.8)

  // ---- leaf blade (pointed ellipse) ----
  const s = leaf.size
  ctx.fillStyle = leaf.color
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(s * 0.65, -s * 0.35, s * 0.45, -s * 0.95, 0, -s * 1.15)
  ctx.bezierCurveTo(-s * 0.45, -s * 0.95, -s * 0.65, -s * 0.35, 0, 0)
  ctx.fill()

  // ---- highlight (lighter green on one half) ----
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.beginPath()
  ctx.moveTo(0, -s * 0.1)
  ctx.bezierCurveTo(s * 0.5, -s * 0.4, s * 0.35, -s * 0.9, 0, -s * 1.05)
  ctx.closePath()
  ctx.fill()

  // ---- central vein ----
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 0.7
  ctx.beginPath()
  ctx.moveTo(0, -s * 0.05)
  ctx.lineTo(0, -s * 1.05)
  ctx.stroke()

  // ---- side veins ----
  if (s > 9) {
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.lineWidth = 0.4
    for (let v = 0.25; v < 0.85; v += 0.2) {
      const vy = -s * v
      const vw = s * 0.3 * (1 - v * 0.4)
      ctx.beginPath()
      ctx.moveTo(0, vy)
      ctx.quadraticCurveTo(vw * 0.5, vy - s * 0.08, vw, vy - s * 0.14)
      ctx.moveTo(0, vy)
      ctx.quadraticCurveTo(-vw * 0.5, vy - s * 0.08, -vw, vy - s * 0.14)
      ctx.stroke()
    }
  }

  // ---- petiole (stem) ----
  ctx.strokeStyle = darkenColor(leaf.color, 0.35)
  ctx.lineWidth = 1.2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, s * 0.2)
  ctx.stroke()

  ctx.restore()
}

// ==========================================
// University silhouette (kept from previous, 3 styles)
// ==========================================

function drawUniversity(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  time: number,
  styleIdx: number,
  img?: HTMLImageElement | null,
  imgReady?: boolean,
  blur?: number,
  opacity?: number
): void {
  const cx = w * 0.5
  const cy = h * 0.82
  const s = Math.min(w, h) * 0.38

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#0a150a')
  sky.addColorStop(0.4, '#111f11')
  sky.addColorStop(0.7, '#182a18')
  sky.addColorStop(1, '#0e1a0e')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  // --- IMAGEN DIFUMINADA (si está disponible) ---
  if (imgReady && img && img.naturalWidth > 0) {
    ctx.save()
    // desenfoque
    ctx.filter = `blur(${blur ?? 18}px) brightness(0.7) saturate(0.85)`

    // cover-fit: la imagen llena todo el canvas manteniendo proporción
    const iw = img.naturalWidth
    const ih = img.naturalHeight
    const scale = Math.max(w / iw, h / ih)
    const dw = iw * scale
    const dh = ih * scale
    const dx = (w - dw) / 2
    const dy = (h - dh) / 2

    ctx.globalAlpha = opacity ?? 0.55
    ctx.drawImage(img, dx, dy, dw, dh)
    ctx.globalAlpha = 1
    ctx.filter = 'none'
    ctx.restore()

    // tint verde oscuro para integrarla al ambiente boscoso
    ctx.fillStyle = 'rgba(8, 22, 8, 0.35)'
    ctx.fillRect(0, 0, w, h)
  } else {
    // --- Fallback: silueta procedural original ---
    // glow behind building
    const glow = ctx.createRadialGradient(cx, cy - s * 0.3, 0, cx, cy - s * 0.3, s * 1.8)
    glow.addColorStop(0, 'rgba(50,85,50,0.14)')
    glow.addColorStop(0.5, 'rgba(35,60,35,0.06)')
    glow.addColorStop(1, 'rgba(20,40,20,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)

    // mist
    const mist = ctx.createLinearGradient(0, cy - s * 0.15, 0, cy + s * 0.5)
    mist.addColorStop(0, 'rgba(25,45,25,0)')
    mist.addColorStop(0.5, 'rgba(20,40,20,0.13)')
    mist.addColorStop(1, 'rgba(12,25,12,0.4)')
    ctx.fillStyle = mist
    ctx.fillRect(0, cy - s * 0.15, w, s * 0.7)

    ctx.save()

    // pick style
    if (styleIdx === 1) {
    // --- Modern glass tower ---
    const g1 = ctx.createLinearGradient(cx - s * 0.2, 0, cx + s * 0.2, 0)
    g1.addColorStop(0, 'rgba(28,42,58,0.92)')
    g1.addColorStop(0.5, `rgba(48,78,108,${0.72 + Math.sin(time * 0.002) * 0.05})`)
    g1.addColorStop(1, 'rgba(28,42,58,0.92)')
    ctx.fillStyle = g1
    ctx.beginPath()
    ctx.moveTo(cx - s * 0.22, cy)
    ctx.lineTo(cx - s * 0.22, cy - s * 1.05)
    ctx.lineTo(cx - s * 0.08, cy - s * 1.18)
    ctx.lineTo(cx + s * 0.08, cy - s * 1.18)
    ctx.lineTo(cx + s * 0.22, cy - s * 1.05)
    ctx.lineTo(cx + s * 0.22, cy)
    ctx.fill()
    // glass reflections
    ctx.fillStyle = 'rgba(100,180,255,0.1)'
    for (let r = 0; r < 9; r++) {
      ctx.fillRect(cx - s * 0.19, cy - s * 0.1 - r * s * 0.11, s * 0.38, s * 0.035)
    }
    // side blocks
    ctx.fillStyle = 'rgba(32,48,42,0.88)'
    ctx.fillRect(cx - s * 0.52, cy - s * 0.38, s * 0.24, s * 0.38)
    ctx.fillRect(cx + s * 0.28, cy - s * 0.38, s * 0.24, s * 0.38)
  } else if (styleIdx === 2) {
    // --- Colonial (Salamanca / UNAM) ---
    const g2 = ctx.createLinearGradient(0, cy - s * 0.55, 0, cy)
    g2.addColorStop(0, '#c4b392')
    g2.addColorStop(0.5, '#b5a181')
    g2.addColorStop(1, '#a38d70')
    ctx.fillStyle = g2
    ctx.beginPath()
    ctx.moveTo(cx - s * 0.48, cy)
    ctx.lineTo(cx - s * 0.48, cy - s * 0.5)
    ctx.lineTo(cx - s * 0.14, cy - s * 0.5)
    ctx.lineTo(cx, cy - s * 0.68)
    ctx.lineTo(cx + s * 0.14, cy - s * 0.5)
    ctx.lineTo(cx + s * 0.48, cy - s * 0.5)
    ctx.lineTo(cx + s * 0.48, cy)
    ctx.fill()
    // columns
    ctx.fillStyle = '#cfbf9e'
    for (let c = 0; c < 6; c++) {
      const colX = cx - s * 0.38 + c * s * 0.15
      ctx.fillRect(colX - s * 0.025, cy - s * 0.5, s * 0.05, s * 0.5)
      ctx.fillRect(colX - s * 0.04, cy - s * 0.53, s * 0.08, s * 0.03)
    }
    // arched windows
    ctx.fillStyle = 'rgba(18,28,14,0.75)'
    for (let c = 0; c < 5; c++) {
      const wx = cx - s * 0.3 + c * s * 0.15
      ctx.beginPath()
      ctx.arc(wx, cy - s * 0.38, s * 0.04, Math.PI, 0)
      ctx.rect(wx - s * 0.04, cy - s * 0.38, s * 0.08, s * 0.18)
      ctx.fill()
    }
    // roof
    ctx.fillStyle = '#8b3a2a'
    ctx.beginPath()
    ctx.moveTo(cx - s * 0.5, cy - s * 0.5)
    ctx.lineTo(cx, cy - s * 0.71)
    ctx.lineTo(cx + s * 0.5, cy - s * 0.5)
    ctx.fill()
    // cross
    ctx.strokeStyle = '#c4b392'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx, cy - s * 0.74)
    ctx.lineTo(cx, cy - s * 0.84)
    ctx.moveTo(cx - s * 0.04, cy - s * 0.79)
    ctx.lineTo(cx + s * 0.04, cy - s * 0.79)
    ctx.stroke()
  } else {
    // --- Classic Oxford/Harvard (default) ---
    const g0 = ctx.createLinearGradient(0, cy - s * 0.9, 0, cy)
    g0.addColorStop(0, '#2d3a2d')
    g0.addColorStop(0.5, '#3d4d3d')
    g0.addColorStop(1, '#253525')
    ctx.fillStyle = g0
    ctx.beginPath()
    ctx.moveTo(cx - s * 0.44, cy)
    ctx.lineTo(cx - s * 0.44, cy - s * 0.6)
    ctx.lineTo(cx - s * 0.34, cy - s * 0.6)
    ctx.lineTo(cx - s * 0.34, cy - s * 0.67)
    ctx.lineTo(cx - s * 0.24, cy - s * 0.67)
    ctx.lineTo(cx - s * 0.24, cy - s * 0.6)
    ctx.lineTo(cx - s * 0.11, cy - s * 0.6)
    ctx.lineTo(cx - s * 0.11, cy - s * 0.92)
    ctx.quadraticCurveTo(cx, cy - s * 1.02, cx + s * 0.11, cy - s * 0.92)
    ctx.lineTo(cx + s * 0.11, cy - s * 0.6)
    ctx.lineTo(cx + s * 0.24, cy - s * 0.6)
    ctx.lineTo(cx + s * 0.24, cy - s * 0.67)
    ctx.lineTo(cx + s * 0.34, cy - s * 0.67)
    ctx.lineTo(cx + s * 0.34, cy - s * 0.6)
    ctx.lineTo(cx + s * 0.44, cy - s * 0.6)
    ctx.lineTo(cx + s * 0.44, cy)
    ctx.closePath()
    ctx.fill()
    // warm windows
    ctx.fillStyle = 'rgba(255,215,130,0.16)'
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        ctx.fillRect(cx - s * 0.36 + c * s * 0.17, cy - s * 0.44 + r * s * 0.13, s * 0.055, s * 0.085)
      }
    }
    for (let r = 0; r < 3; r++) {
      ctx.fillRect(cx - s * 0.05, cy - s * 0.84 + r * s * 0.08, s * 0.1, s * 0.05)
    }
    // clock
    ctx.strokeStyle = 'rgba(255,215,130,0.3)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(cx, cy - s * 0.87, s * 0.04, 0, Math.PI * 2)
    ctx.stroke()
  }

    ctx.restore()
  } // fin fallback silueta procedural
}

// ==========================================
// Particles
// ==========================================

function drawParticles(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  time: number, progress: number
): void {
  const count = (35 * progress) | 0
  for (let i = 0; i < count; i++) {
    const s = i * 123.456 + time * 0.00008
    const x = (rand(s * 1.1) * 0.5 + 0.5) * w
    const y = (rand(s * 1.7) * 0.5 + 0.3) * h * 0.9
    const r = (rand(s * 2.3) * 0.5 + 0.5) * 2.2 + 0.5
    const a = (rand(s * 3.1) * 0.5 + 0.5) * 0.3 * progress
    ctx.fillStyle = `rgba(190,240,170,${a})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ==========================================
// Component
// ==========================================

export function TreeCanopyAnimation({
  onComplete,
  duration = 8000,
  universityStyle = 0,
  universityImage,
  imageBlur = 18,
  imageOpacity = 0.58,
}: {
  onComplete: () => void
  duration?: number
  universityStyle?: number
  /** URL de la imagen de la universidad (public/ o remota). Si se provee, reemplaza la silueta procedural. */
  universityImage?: string
  /** Radio de desenfoque en px (0 = nítida) */
  imageBlur?: number
  /** Opacidad de la imagen sobre el fondo (0..1) */
  imageOpacity?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>()
  const startRef = useRef<number>()
  const [done, setDone] = useState(false)
  const doneFiredRef = useRef(false)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const imgLoadedRef = useRef(false)

  const treesRef = useRef<Tree[]>([])
  const wRef = useRef(0)
  const hRef = useRef(0)

  const animate = useCallback((ts: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = wRef.current
    const h = hRef.current
    if (!startRef.current) startRef.current = ts
    const elapsed = ts - startRef.current
    const progress = clamp(elapsed / duration, 0, 1)
    _globalProgress = progress

    ctx.clearRect(0, 0, w, h)

    // 1. background + university (imagen difuminada o silueta procedural)
    drawUniversity(ctx, w, h, ts, universityStyle, imgRef.current, imgLoadedRef.current, imageBlur, imageOpacity)

    // 2. growth (stays at 1.0 after completion)
    updateGrowth(treesRef.current, progress)

    // 3. global wind — continues gently after animation done
    const wind = 0.3 + 0.3 * Math.sin(ts * 0.0004) + 0.2 * Math.sin(ts * 0.0011)

    // 4. draw trees (Creation of Adam: arms reach toward centre)
    for (const tree of treesRef.current) {
      drawBranch(ctx, tree.main, tree.bark, ts, wind)
    }

    // 5. particles (keep at full after completion)
    drawParticles(ctx, w, h, ts, progress)

    // 6. vignette
    const vg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.72)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(1, 'rgba(0,18,0,0.32)')
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, w, h)

    // 7. once done, fire onComplete once but KEEP ANIMATING (wind + leaves sway)
    if (progress >= 1 && elapsed > duration + 600 && !doneFiredRef.current) {
      doneFiredRef.current = true
      setDone(true)
      onComplete()
    }

    // never stop — canvas must remain visible with ambient motion
    animRef.current = requestAnimationFrame(animate)
  }, [duration, onComplete, universityStyle, done, imageBlur, imageOpacity])

  // Load university image (if provided)
  useEffect(() => {
    if (!universityImage) {
      imgLoadedRef.current = false
      imgRef.current = null
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      imgLoadedRef.current = true
    }
    img.onerror = () => {
      // fallback: silueta procedural
      imgRef.current = null
      imgLoadedRef.current = false
    }
    img.src = universityImage
    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [universityImage])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      wRef.current = canvas.parentElement?.clientWidth || window.innerWidth
      hRef.current = canvas.parentElement?.clientHeight || window.innerHeight
      canvas.width = wRef.current * dpr
      canvas.height = hRef.current * dpr
      canvas.style.width = `${wRef.current}px`
      canvas.style.height = `${hRef.current}px`
      const c = canvas.getContext('2d')
      if (c) c.scale(dpr, dpr)
      treesRef.current = buildScene(wRef.current, hRef.current)
    }

    resize()
    window.addEventListener('resize', resize)
    startRef.current = 0
    animRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', resize)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [animate])

  return (
    <div className="fixed inset-0 z-0" aria-hidden="true">
      <canvas ref={canvasRef} className="w-full h-full" style={{ width: '100%', height: '100%' }} />
      {/* Subtle gradient always present */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent pointer-events-none" />
      {/* Darkening overlay fades in when animation is complete, to make login readable */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
        style={{
          opacity: done ? 1 : 0,
          background: 'radial-gradient(ellipse at center, rgba(0,10,0,0.45) 0%, rgba(0,15,0,0.65) 100%)',
        }}
      />
    </div>
  )
}

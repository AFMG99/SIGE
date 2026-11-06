import { describe, expect, it } from 'vitest'
import {
  ALTURA_OJOS_METROS,
  FOV_EXTERIOR,
  FOV_INTERIOR,
  NEAR_EXTERIOR,
  NEAR_INTERIOR,
  Vector3D,
  aEspacioPantalla,
  calcularVistaInterior,
  esEspacioVolumen,
  limitarACaja,
  limitesOrbita,
} from './vistaInterior'

describe('esEspacioVolumen', () => {
  it('reconoce un aula por su nombre sin mirar las dimensiones', () => {
    expect(esEspacioVolumen('Aula 203', [5.5, 2.9, 11])).toBe(true)
    expect(esEspacioVolumen('Aula 210', [6.8, 2.9, 6.9])).toBe(true)
    expect(esEspacioVolumen('Baño piso 2', [3, 2.6, 4])).toBe(true)
  })

  it('reconoce un volumen habitable por geometría aunque el nombre no lo diga', () => {
    expect(esEspacioVolumen('Nodo 42', [6, 3, 8])).toBe(true)
    expect(esEspacioVolumen('Cube', [4.5, 2.8, 5])).toBe(true)
  })

  it('descarta mobiliario y equipos por ser demasiado bajos', () => {
    expect(esEspacioVolumen('P2_Computer Desk.001', [2.3, 0.5, 0.75])).toBe(false)
    expect(esEspacioVolumen('aire_acondicionado.003', [1.07, 0.36, 0.37])).toBe(false)
    expect(esEspacioVolumen('Paños_vidriados_piso_1', [64.65, 1.22, 30.31])).toBe(false)
  })

  it('descarta estructura de edificio completo por altura o huella', () => {
    expect(esEspacioVolumen('Muros_piso_2', [54.66, 6.2, 22.02])).toBe(false)
    expect(esEspacioVolumen('Columnas_piso_1', [66.52, 3.3, 28.4])).toBe(false)
    expect(esEspacioVolumen('Hojas_puertas_piso_1', [60.93, 2.1, 30.12])).toBe(false)
    expect(esEspacioVolumen('Suelo_continuo_piso_1', [68.69, 0.12, 30.33])).toBe(false)
  })

  it('entiende modelos exportados en centímetros y milímetros', () => {
    expect(esEspacioVolumen('Nodo 42', [550, 290, 1100])).toBe(true)
    expect(esEspacioVolumen('Muros', [5466, 620, 2202])).toBe(false)
    expect(esEspacioVolumen('Nodo 7', [4500, 2800, 5000])).toBe(true)
  })
})

describe('calcularVistaInterior', () => {
  const aula = { centro: [50, 4.75, -10] as [number, number, number], dimensiones: [5.5, 2.9, 11] as [number, number, number] }

  it('mantiene la mirada horizontal: cámara y objetivo a la misma altura', () => {
    const { posicion, objetivo } = calcularVistaInterior(aula.centro, aula.dimensiones)
    expect(posicion[1]).toBeCloseTo(objetivo[1], 10)
  })

  it('coloca los ojos a ALTURA_OJOS_METROS sobre el suelo del recinto', () => {
    const { posicion, objetivo } = calcularVistaInterior(aula.centro, aula.dimensiones)
    const pisoY = aula.centro[1] - aula.dimensiones[1] / 2
    expect(posicion[1]).toBeCloseTo(pisoY + ALTURA_OJOS_METROS, 10)
    expect(objetivo[1]).toBeCloseTo(pisoY + ALTURA_OJOS_METROS, 10)
  })

  it('deja la cámara DENTRO del recinto, no fuera de sus paredes', () => {
    const { posicion, objetivo } = calcularVistaInterior(aula.centro, aula.dimensiones)
    for (const eje of [0, 1, 2]) {
      const min = aula.centro[eje] - aula.dimensiones[eje] / 2
      const max = aula.centro[eje] + aula.dimensiones[eje] / 2
      expect(posicion[eje]).toBeGreaterThan(min)
      expect(posicion[eje]).toBeLessThan(max)
      expect(objetivo[eje]).toBeGreaterThanOrEqual(min)
      expect(objetivo[eje]).toBeLessThanOrEqual(max)
    }
  })

  it('mira a lo largo del eje largo del recinto para ver la mayor superficie', () => {
    const { posicion, objetivo } = calcularVistaInterior([0, 1.5, 0], [10, 3, 4])
    expect(posicion[0]).not.toBeCloseTo(objetivo[0], 6)
    expect(posicion[2]).toBeCloseTo(objetivo[2], 10)

    const cruzada = calcularVistaInterior([0, 1.5, 0], [4, 3, 10])
    expect(cruzada.posicion[2]).not.toBeCloseTo(cruzada.objetivo[2], 6)
    expect(cruzada.posicion[0]).toBeCloseTo(cruzada.objetivo[0], 10)
  })

  it('no mete los ojos por encima del techo en recintos bajos', () => {
    const { posicion } = calcularVistaInterior([0, 0.5, 0], [3, 1, 3])
    const techoY = 0.5 + 1 / 2
    expect(posicion[1]).toBeLessThan(techoY)
    expect(posicion[1]).toBeGreaterThan(0.5 - 1 / 2)
  })

  it('usa el factor de unidad correcto en modelos en centímetros', () => {
    const { posicion, objetivo } = calcularVistaInterior([5000, 475, -1000], [550, 290, 1100])
    expect(posicion[1]).toBeCloseTo(330 + 150, 8)
    expect(objetivo[1]).toBe(posicion[1])
    expect(posicion[1]).toBeLessThan(475 + 290 / 2)
  })

  it('no saca la cámara del recinto en pasillos estrechos', () => {
    // Eje largo X (mitad 5.5) pero solo 1 m de medio estrecho: el recorrido
    // debe limitarse al medio estrecho o la cámara quedaría fuera del muro.
    const { posicion, objetivo } = calcularVistaInterior([0, 1.5, 0], [11, 3, 2])
    expect(posicion[0]).toBeCloseTo(-0.8, 10)
    expect(posicion[2]).toBeCloseTo(0, 10)
    expect(Math.abs(posicion[0] - objetivo[0])).toBeLessThanOrEqual(0.8 * 1 + 1e-9)
    expect(posicion[0]).toBeGreaterThan(-11 / 2)
    expect(posicion[0]).toBeLessThan(11 / 2)
  })

  it('devuelve un radio horizontal positivo para acotar la órbita', () => {
    const { radio } = calcularVistaInterior(aula.centro, aula.dimensiones)
    expect(radio).toBeGreaterThan(0)
    expect(radio).toBeCloseTo(Math.hypot(5.5 / 2, 11 / 2), 8)
  })
})

describe('limitesOrbita', () => {
  it('acota la órbita para que el usuario no pueda salir del recinto', () => {
    const radio = 6.149234
    const escala = 0.103448
    const { min, max } = limitesOrbita(radio, escala)
    const distanciaInicial = 3.3 * escala
    expect(max).toBeGreaterThan(0)
    expect(min).toBeGreaterThan(0)
    expect(min).toBeLessThan(distanciaInicial)
    expect(max).toBeGreaterThan(distanciaInicial)
  })

  it('escala con el modelo: un modelo más grande admite más recorrido', () => {
    expect(limitesOrbita(6, 0.1).max).toBeCloseTo(limitesOrbita(6, 0.2).max / 2, 10)
  })

  it('acota la órbita al medio más estrecho del recinto cuando se indica', () => {
    const { max } = limitesOrbita(6.15, 0.1, 2.75)
    expect(max).toBeCloseTo(2.75 * 0.1 * 0.98, 10)
    // sin el límite estrecho, el radio de la esquina permitiría salir del muro
    expect(limitesOrbita(6.15, 0.1).max).toBeGreaterThan(max)
  })
})

describe('limitarACaja', () => {
  const caja = { min: [-1, 0, -2] as Vector3D, max: [1, 2, 2] as Vector3D }

  it('devuelve intacto un punto que ya está dentro', () => {
    expect(limitarACaja([0, 1, 0], caja)).toEqual([0, 1, 0])
  })

  it('recorta a la cara más cercana cuando el punto queda fuera', () => {
    expect(limitarACaja([5, 1, 0], caja)).toEqual([1, 1, 0])
    expect(limitarACaja([0, -3, 0], caja)).toEqual([0, 0, 0])
    expect(limitarACaja([0, 1, -9], caja)).toEqual([0, 1, -2])
  })

  it('respeta un margen para no pegar la cámara al muro', () => {
    expect(limitarACaja([5, 1, 0], caja, 0.1)).toEqual([0.9, 1, 0])
  })

  it('recorta las tres componentes a la vez', () => {
    expect(limitarACaja([9, -9, 9], caja, 0.5)).toEqual([0.5, 0.5, 1.5])
  })
})

describe('aEspacioPantalla', () => {
  it('centra y escala coordenadas del modelo al espacio de la vista', () => {
    const [x, y, z] = aEspacioPantalla([50, 4.75, -10], [50, 3.2, -15], 0.1)
    expect(x).toBeCloseTo(0, 10)
    expect(y).toBeCloseTo(0.155, 10)
    expect(z).toBeCloseTo(0.5, 10)
  })
})

describe('constantes de cámara', () => {
  it('la vista interior abre el encuadre y acerca el plano cercano', () => {
    expect(FOV_INTERIOR).toBeGreaterThan(FOV_EXTERIOR)
    expect(NEAR_INTERIOR).toBeLessThan(NEAR_EXTERIOR)
  })
})

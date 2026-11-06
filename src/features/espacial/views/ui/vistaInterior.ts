export type Vector3D = [number, number, number]

/** Encuadre de la cámara: exterior estrecho, interior más amplio para percibir el recinto. */
export const FOV_EXTERIOR = 45
export const FOV_INTERIOR = 68

/**
 * El visor normaliza el modelo a ~9 unidades, así que una sala de 5 m queda en ~0.5 u.
 * Un plano cercano de 0.1 recortaría la geometría cercana y se verían huecos.
 */
export const NEAR_EXTERIOR = 0.1
export const NEAR_INTERIOR = 0.001
export const FAR_PLANO = 1000

export const ALTURA_OJOS_METROS = 1.5
export const DURACION_TRANSICION_MS = 850

const ALTO_MINIMO_METROS = 1.6
const ALTO_MAXIMO_METROS = 4.5
const HUELLA_MAXIMA_METROS = 30

/** Fracción de la mitad del recinto a la que se sitúa la cámara mirando al centro. */
const DISTANCIA_ENTRADA = 0.6
/** Tope del recorrido sobre el medio MÁS ESTRECHO: evita salir por los muros laterales en pasillos. */
const DISTANCIA_ENTRADA_LATERAL = 0.8
const FRACCION_ORBITA_MINIMA = 0.12
const FRACCION_ORBITA_MAXIMA = 0.98

/** Caja alineada a ejes en un espacio determinado (vista o modelo). */
export interface Caja3D {
  min: Vector3D
  max: Vector3D
}

/** Nombres que identifican un recinto sin depender de la geometría. */
const PATRON_ESPACIO = /aula|oficina|ba[nñ]o|auditorio|laboratorio|pasillo|biblioteca|recepci|sal[oó]n|zona|espacio/i

/**
 * Deduce la unidad del modelo a partir de la altura de un recinto, porque un espacio
 * habitable mide 2-4 unidades en metros, 200-400 en centímetros y 2000-4000 en milímetros.
 */
export function factorUnidad(dimensiones: Vector3D): number {
  const alto = dimensiones[1]
  if (alto > 2000) return 1000
  if (alto > 20) return 100
  return 1
}

/**
 * Distingue un recinto del que tiene sentido entrar de mobiliario, equipos o
 * estructura de edificio completo (muros o columnas de todo un piso).
 */
export function esEspacioVolumen(nombre: string, dimensiones: Vector3D): boolean {
  if (PATRON_ESPACIO.test(nombre)) return true

  const factor = factorUnidad(dimensiones)
  const alto = dimensiones[1] / factor
  if (alto < ALTO_MINIMO_METROS || alto > ALTO_MAXIMO_METROS) return false

  const huella = Math.hypot(dimensiones[0], dimensiones[2]) / factor
  return huella <= HUELLA_MAXIMA_METROS
}

/**
 * Sitúa la cámara a la altura de una persona de pie dentro del recinto, mirando en
 * horizontal a lo largo del eje largo para ver la mayor superficie posible.
 * Todo en coordenadas del modelo; el llamador lo proyecta al espacio de la vista.
 */
export function calcularVistaInterior(
  centro: Vector3D,
  dimensiones: Vector3D,
): { posicion: Vector3D; objetivo: Vector3D; radio: number } {
  const factor = factorUnidad(dimensiones)
  const pisoY = centro[1] - dimensiones[1] / 2
  const alturaOjos = Math.min(ALTURA_OJOS_METROS * factor, dimensiones[1] * 0.6)
  const ojosY = pisoY + alturaOjos

  const mitadX = dimensiones[0] / 2
  const mitadZ = dimensiones[2] / 2
  const ejeLargoEsZ = mitadZ >= mitadX
  const mitadLarga = ejeLargoEsZ ? mitadZ : mitadX
  const mitadEstrecha = ejeLargoEsZ ? mitadX : mitadZ
  const recorrido = Math.min(mitadLarga * DISTANCIA_ENTRADA, mitadEstrecha * DISTANCIA_ENTRADA_LATERAL)

  const posicion: Vector3D = [centro[0], ojosY, centro[2]]
  const objetivo: Vector3D = [centro[0], ojosY, centro[2]]
  if (ejeLargoEsZ) posicion[2] -= recorrido
  else posicion[0] -= recorrido

  return { posicion, objetivo, radio: Math.hypot(mitadX, mitadZ) }
}

/**
 * Órbita acotada al recinto: sin esto el usuario puede salirse arrastrando o haciendo zoom.
 * `distanciaMaxima` limita la salida al medio más estrecho para no atravesar los muros.
 */
export function limitesOrbita(
  radioModelo: number,
  escala: number,
  distanciaMaxima = radioModelo,
): { min: number; max: number } {
  return {
    min: radioModelo * escala * FRACCION_ORBITA_MINIMA,
    max: Math.min(radioModelo, distanciaMaxima) * escala * FRACCION_ORBITA_MAXIMA,
  }
}

/** Mantiene un punto dentro de una caja, opcionalmente con un margen interior. */
export function limitarACaja(punto: Vector3D, caja: Caja3D, margen = 0): Vector3D {
  const limite = (valor: number, min: number, max: number) =>
    Math.min(Math.max(valor, min + margen), max - margen)
  return [
    limite(punto[0], caja.min[0], caja.max[0]),
    limite(punto[1], caja.min[1], caja.max[1]),
    limite(punto[2], caja.min[2], caja.max[2]),
  ]
}

/** Proyecta una coordenada del modelo al espacio centrado y escalado del visor. */
export function aEspacioPantalla(punto: Vector3D, centroEscena: Vector3D, escala: number): Vector3D {
  return [
    (punto[0] - centroEscena[0]) * escala,
    (punto[1] - centroEscena[1]) * escala,
    (punto[2] - centroEscena[2]) * escala,
  ]
}

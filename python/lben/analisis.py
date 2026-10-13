"""
Análisis estadístico del histórico de consumo (Módulo 3, HU-07 / HU-04).

A diferencia del cálculo de LBEn (que depura para modelar), este módulo
usa la MISMA depuración normativa (§7.5.1: ±10 % ec. 3 / ec. 4-5 con
n ≥ 10 por mes) para señalar las épocas de consumo inusual de todo el
histórico facturado, con su explicación estadística y su contexto en el
calendario académico.

Contrato (stdin/stdout JSON, igual que lben.cli):
  entrada:
    {
      "bloque_id": "edificacion-…|global",   # solo identifica la serie
      "registros": [
        {"mes": 1, "ano": 2023, "consumo_kwh": 12480.5,
         "dias_facturados": 30, "dias_lectivos": 21,
         # variables operativas (promedio del periodo, opcionales):
         "poblacion_fija": 70, "poblacion_flotante": 13500, "gde": 5.2}
      ],
      "ajustes": []          # Anexo 4 (opcional): se aplican ANTES del análisis
    }
  salida:
    {
      "ok": true,
      "originales": 48, "depurados": 47,
      "criterio_depuracion": "banda_10_pct", "min_datos_ic": 10,
      "min_valores_por_mes": 3,
      "estadisticos": {"media", "mediana", "desv_est", "coef_variacion",
                        "minimo", "maximo", "n"},
      "tendencia": {"pendiente_kwh_por_mes", "variacion_pct_anual"},
      "bandas": [{mes, n, media, limite_inferior, limite_superior,
                  descartados, estimado} ...],
      "meses_insuficientes": [3, 7],
      "ajustes_aplicados": [...],
      "periodos": [{"mes", "ano", "consumo_kwh", "media_mes", "banda_inf",
                    "banda_sup", "es_atipico" (bool|null), "direccion"
                    ("alza"|"caida"|null), "desviacion_pct", "dias_lectivos",
                    "calendario" ("lectivo"|"vacaciones"|"sin_datos"),
                    "explicacion" (str|null)} ...],
      "modelos": {           # §7.4-7.5 + §8.1: TODOS los modelos en UNA
                             # invocación (el selector TS recalcula al vuelo)
        "valor_absoluto"|"cociente"|"regresion"|"ingenieria"|"confort": {
          "estado": "disponible"|"no_disponible",
          "motivo": str|null,       # por qué no está disponible
          "etiqueta": str,          # «Valor absoluto»
          "formula": str,           # fórmula visible del modelo
          "unidad": str,            # «kWh/mes» | «kWh/persona·mes»
          "n": int,                 # registros usados por el modelo
          "lben_mensual": [12 x (número|null)],   # LBEn por mes calendario
          "validacion": {"n", "min_datos_ic", "criterio", "intervalo_inf",
                         "intervalo_sup", "r2", "mape", "p_value_max"},
          "ahorro": {               # §8.1 ec. 9-12; null si no aplica
            "por_mes": [{"mes", "lben", "mejor", "potencial",
                         "potencial_pct"} ...],
            "potencial_mensual": número,   # «Promedio x Año» del Anexo 1
            "potencial_pct": número        # ec. 12 sobre la media
          } | null,
          "nota": str|null          # aclaración (p. ej. §8.1 no aplica)
        }                           # `ingenieria` siempre no_disponible
      },
      "resumen": {"periodos": 48, "atipicos": 4, "atipicos_alza": 3,
                  "atipicos_caida": 1, "en_lectivo": 3, "en_vacaciones": 1,
                  "sin_calendario": 0, "periodos_con_banda": 48,
                  "ajustes": 0}
    }

El umbral de calendario (UMBRAL_DIAS_LECTIVOS) separa vacaciones de
período lectivo con los días lectivos registrados en variables
operativas: con ≤ 12 días el mes se considera vacacional (recorte típico
de diciembre/enero/julio del calendario académico colombiano).
"""

from __future__ import annotations

import json
import sys
import traceback
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from .bandas import _banda_de_grupo, base_cruda, depurar_con_bandas
from .cli import (
    VARS_REGRESION_DEFECTO,
    _json_default,
    _num,
    _predecir_regresion,  # predict alineado a params (evita el bug de `const`)
)
from .constants import MIN_DATOS_IC, MIN_MESES_BASE, MIN_VALORES_POR_MES
from .exceptions import DataValidationError, ModelSelectionError
from .modelos import (
    ModeloCociente,
    ModeloConfortThermal,
    ModeloRegresion,
    ModeloValorAbsoluto,
)

# Días lectivos ≤ a este umbral ⇒ mes vacacional (calendario TdeA).
UMBRAL_DIAS_LECTIVOS = 12

MESES_ES = (
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
)


def _clasificar_calendario(dias_lectivos: Optional[int]) -> str:
    """lectivo / vacaciones / sin_datos a partir de los días lectivos."""
    if dias_lectivos is None:
        return "sin_datos"
    return "lectivo" if dias_lectivos > UMBRAL_DIAS_LECTIVOS else "vacaciones"


def _fmt_kwh(valor: float) -> str:
    """12480.5 → «12.480,5 kWh» (es-CO: punto de miles, coma decimal)."""
    texto = f"{valor:,.1f}".replace(",", "\x00").replace(".", ",").replace("\x00", ".")
    return f"{texto} kWh"


def _explicacion(
    reg: Dict[str, Any],
    banda: Dict[str, Any],
    direccion: str,
    calendario: str,
) -> str:
    """Frase humana con la explicación estadística del atípico."""
    media = banda.get("media") or 0.0
    li = banda.get("limite_inferior")
    ls = banda.get("limite_superior")
    limite = ls if direccion == "alza" else li
    desvio = abs(reg["desviacion_pct"])
    periodo = f"{MESES_ES[int(reg['mes']) - 1]} de {int(reg['ano'])}"
    criterio = (
        f"ec. 4-5 (±2·DesvEst, n={banda['n']} ≥ {MIN_DATOS_IC})"
        if banda["n"] >= MIN_DATOS_IC
        else f"±10 % (ec. 3, n={banda['n']})"
    )
    if direccion == "alza":
        tramo = (
            f"supera el límite superior de la banda de "
            f"{MESES_ES[int(reg['mes']) - 1]}"
        )
    else:
        tramo = (
            f"queda por debajo del límite inferior de la banda de "
            f"{MESES_ES[int(reg['mes']) - 1]}"
        )
    texto = (
        f"El consumo de {periodo} ({_fmt_kwh(reg['consumo_kwh'])}) {tramo} "
        f"({_fmt_kwh(limite or 0.0)}, media {_fmt_kwh(media)}, {criterio}) "
        f"en un {desvio:.1f} %"
    )
    if calendario == "lectivo":
        texto += f"; el mes fue lectivo ({reg['dias_lectivos']} días clase)"
    elif calendario == "vacaciones":
        texto += (
            f"; el mes fue vacacional ({reg['dias_lectivos']} días clase), "
            "contexto habitual de menor ocupación"
        )
    return texto + "."


def _tendencia(valores: np.ndarray) -> Dict[str, Optional[float]]:
    """
    Pendiente lineal de la serie (kWh/mes) y su variación % anual.

    Regresión OLS y = a·x + b sobre el índice temporal; `variacion_pct_anual`
    expresa la pendiente contra la media de la serie. Con menos de 3 puntos
    no hay tendencia definible.
    """
    if len(valores) < 3:
        return {"pendiente_kwh_por_mes": None, "variacion_pct_anual": None}
    x = np.arange(len(valores), dtype=float)
    pendiente = float(np.polyfit(x, valores, 1)[0])
    media = float(valores.mean())
    pct_anual = (pendiente * 12 / media * 100) if media else None
    return {
        "pendiente_kwh_por_mes": _num(pendiente),
        "variacion_pct_anual": _num(pct_anual),
    }


# ── Sección `modelos` (§7.4-7.5) + ahorro §8.1 (ec. 9-12) ───────────────

# Identidad textual de cada modelo: (etiqueta, fórmula, unidad). El motor es
# la fuente única; la UI solo la reproduce junto a su descripción larga.
MODELOS_TEXTOS: Dict[str, Tuple[str, str, str]] = {
    "valor_absoluto": (
        "Valor absoluto",
        "LBEn_m = promedio simple de los consumos normalizados del mes (ec. 2)",
        "kWh/mes",
    ),
    "cociente": (
        "Cociente de valores medidos",
        "cociente = consumo normalizado ÷ población (ec. 6); "
        "LBEn_m = promedio de los cocientes del mes (ec. 7)",
        "kWh/persona·mes",
    ),
    "regresion": (
        "Regresión estadística",
        "consumo = β0 + β1·población + β2·GDE + … (ec. 8)",
        "kWh/mes",
    ),
    "ingenieria": (
        "Modelo de ingeniería",
        "simulación de cargas de la edificación (§7.4.4)",
        "kWh/mes",
    ),
    "confort": (
        "Confort térmico (ASHRAE 55)",
        "energía base + ΔT · 15 kWh/°C (indicador propio, no es uno de los "
        "cuatro modelos de la Resolución)",
        "kWh/mes",
    ),
}


def _validacion(
    n: int,
    criterio: Optional[str],
    intervalo: Optional[List[float]] = None,
    r2: Optional[float] = None,
    mape: Optional[float] = None,
    p_value_max: Optional[float] = None,
) -> Dict[str, Any]:
    """Chips de validación: objeto fijo con nulls donde el dato no aplica."""
    intervalo_inf = intervalo_sup = None
    if intervalo:
        intervalo_inf, intervalo_sup = _num(intervalo[0]), _num(intervalo[1])
    return {
        "n": int(n),
        "min_datos_ic": MIN_DATOS_IC,
        "criterio": criterio,
        "intervalo_inf": intervalo_inf,
        "intervalo_sup": intervalo_sup,
        "r2": _num(r2),
        "mape": _num(mape),
        "p_value_max": _num(p_value_max),
    }


def _no_disponible(
    clave: str, motivo: str, nota: Optional[str] = None
) -> Dict[str, Any]:
    """Hoja uniforme de un modelo no calculable (la UI la pinta igual)."""
    etiqueta, formula, unidad = MODELOS_TEXTOS[clave]
    return {
        "estado": "no_disponible",
        "motivo": str(motivo)[:400],
        "etiqueta": etiqueta,
        "formula": formula,
        "unidad": unidad,
        "n": 0,
        "lben_mensual": [None] * 12,
        "validacion": _validacion(0, None),
        "ahorro": None,
        "nota": nota,
    }


def _disponible(
    clave: str,
    *,
    n: int,
    lben_mensual: List[Optional[float]],
    validacion: Dict[str, Any],
    ahorro: Optional[Dict[str, Any]],
    nota: Optional[str] = None,
) -> Dict[str, Any]:
    """Hoja uniforme de un modelo calculado con éxito."""
    etiqueta, formula, unidad = MODELOS_TEXTOS[clave]
    return {
        "estado": "disponible",
        "motivo": None,
        "etiqueta": etiqueta,
        "formula": formula,
        "unidad": unidad,
        "n": int(n),
        "lben_mensual": lben_mensual,
        "validacion": validacion,
        "ahorro": ahorro,
        "nota": nota,
    }


def _fallido(clave: str, e: Exception) -> Dict[str, Any]:
    """Un modelo que lanza deja SU hoja en `no_disponible`, nunca el análisis."""
    if isinstance(e, (DataValidationError, ModelSelectionError)):
        motivo = str(e)
    else:
        motivo = f"{type(e).__name__}: {e}"
    return _no_disponible(clave, motivo)


def _calcular_ahorro(
    por_mes: Dict[int, Dict[str, float]],
) -> Optional[Dict[str, Any]]:
    """
    Ahorro por mejor desempeño (§8.1) sobre un mapa {mes: {lben, mejor}}.

    Convenio de signo: potencial = LBEn − mejor ≥ 0. La ec. 9 está redactada
    como «mínimo − LBEn» (nunca positivo: la media siempre ≥ mínimo), pero el
    ejemplo trabajado del Anexo 1 reporta ahorro POSITIVO = promedio − mínimo
    (830 kWh en enero, 7,5 %), así que se sigue ese convenio. La ec. 12 da el
    porcentaje contra la LBEn del mes.

    `potencial_mensual` es el promedio de los potenciales mensuales (fila
    «Promedio x Año» del Anexo 1: 468 kWh ≈ 467,6 en su ejemplo) y
    `potencial_pct` es la ec. 12 evaluada sobre ese promedio contra la LBEn
    media (4,1 % en el Anexo 1). Si LBEn_m es 0 el porcentaje queda en null.
    """
    filas: List[Dict[str, Any]] = []
    for mes in sorted(por_mes):
        lben = float(por_mes[mes]["lben"])
        mejor = float(por_mes[mes]["mejor"])
        potencial = max(lben - mejor, 0.0)
        filas.append(
            {
                "mes": int(mes),
                "lben": _num(lben),
                "mejor": _num(mejor),
                "potencial": _num(potencial),
                "potencial_pct": _num(potencial / lben * 100) if lben else None,
            }
        )
    if not filas:
        return None
    potencial_medio = float(np.mean([f["potencial"] for f in filas]))
    lben_media = float(np.mean([f["lben"] for f in filas]))
    return {
        "por_mes": filas,
        "potencial_mensual": _num(potencial_medio),
        "potencial_pct": (
            _num(potencial_medio / lben_media * 100) if lben_media else None
        ),
    }


def _ahorro_regresion(
    limpio: pd.DataFrame,
    pred: np.ndarray,
    modelo: ModeloRegresion,
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    §8.1 ec. 10-11 para el modelo estadístico.

    ec. 10: dif_i = real_i − pred_i; los mejores desempeños son los que quedan
    POR DEBAJO de la LBEn (dif < 0). Sobre esos puntos se ajusta la recta
    consumo ~ variable más significativa (línea de tendencia del §8.1) y la
    ec. 11 mide cada mes contra lo que esa recta predice con la variable
    relevante de ese mes. Sin al menos 3 mejores desempeños (o sin variación
    de la variable entre ellos) no hay recta: ahorro null con la nota.
    """
    reales = limpio["consumo_normalizado"].to_numpy(dtype=float)
    dif = reales - pred  # ec. 10
    mejores = dif < 0
    n_mejores = int(mejores.sum())
    if n_mejores < 3:
        return None, (
            f"Solo {n_mejores} meses con mejor desempeño (diferencia negativa "
            "en la ec. 10); se requieren al menos 3 para ajustar la línea de "
            "tendencia de la ec. 11."
        )
    if not modelo.p_values:
        return None, "El modelo no conservó variables explicativas significativas."
    variable = min(modelo.p_values, key=lambda v: modelo.p_values[v])
    meses = limpio["mes"].to_numpy()
    x = limpio[variable].to_numpy(dtype=float)
    x_mejor = x[mejores]
    if len(np.unique(x_mejor)) < 2:
        return None, (
            f"La variable «{variable}» no varía entre los mejores desempeños: "
            "no se puede ajustar la recta de tendencia (ec. 11)."
        )
    pendiente, intercepto = (
        float(v) for v in np.polyfit(x_mejor, reales[mejores], 1)
    )
    por_mes: Dict[int, Dict[str, float]] = {}
    for mes in range(1, 13):
        sel = meses == mes
        if not sel.any():
            continue
        por_mes[mes] = {
            "lben": float(np.mean(pred[sel])),
            "mejor": float(intercepto + pendiente * float(np.mean(x[sel]))),
        }
    return _calcular_ahorro(por_mes), None


def _modelos(
    bloque_id: str,
    registros: List[Dict[str, Any]],
    ajustes: Optional[List[Dict[str, Any]]],
    limpio: pd.DataFrame,
    desv_est: Optional[float],
    criterio: str,
) -> Dict[str, Any]:
    """
    Sección `modelos`: los cuatro modelos de §7.4-7.5 + el indicador de
    confort, calculados en UNA sola invocación para que el selector de la UI
    recalcule LBEn, gráfica y ahorros sin round-trips.

    Cada modelo va en su propio try/except: el que falle deja SU hoja en
    `no_disponible` con el motivo y el análisis sigue en pie. El cociente
    usa `poblacion_flotante` —la misma variable que cli.py, el motor que
    calcula las líneas base guardadas— sobre la base cruda de la §7.5.2, y su
    ahorro se mide en espacio de coeficientes (Anexo 2). La regresión exige
    al menos MIN_MESES_BASE registros depurados y variables con variación.
    """
    modelos: Dict[str, Any] = {}

    # ── Valor absoluto (§7.5.1, ec. 2) ─────────────────────────────────
    try:
        resultado = ModeloValorAbsoluto(
            "Valor Absoluto", limpio, desvio_todos=desv_est
        ).ajustar()
        lben = resultado["lben_mensual"]
        minimos = limpio.groupby("mes")["consumo_normalizado"].min()
        por_mes: Dict[int, Dict[str, float]] = {}
        for mes in range(1, 13):
            if lben[mes - 1] is None or mes not in minimos.index:
                continue
            por_mes[mes] = {
                "lben": float(lben[mes - 1]),
                "mejor": float(minimos.loc[mes]),  # ec. 9: mínimo real del mes
            }
        modelos["valor_absoluto"] = _disponible(
            "valor_absoluto",
            n=len(limpio),
            lben_mensual=[_num(v) for v in lben],
            validacion=_validacion(
                len(limpio),
                criterio,
                intervalo=resultado.get("intervalo_confianza"),
                r2=resultado.get("r2"),
                mape=resultado.get("mape"),
            ),
            ahorro=_calcular_ahorro(por_mes),
        )
    except Exception as e:  # noqa: BLE001 — un modelo no tumba el análisis
        modelos["valor_absoluto"] = _fallido("valor_absoluto", e)

    # ── Cociente (§7.5.2, ec. 6-7) sobre SU base cruda ─────────────────
    try:
        crudo = base_cruda({str(bloque_id): registros}, ajustes)
        con_poblacion = crudo[crudo["poblacion_flotante"] > 0]
        if len(con_poblacion) < 3:
            modelos["cociente"] = _no_disponible(
                "cociente",
                "Se requieren al menos 3 registros con población mayor que "
                f"cero (§7.5.2); hay {len(con_poblacion)}.",
            )
        else:
            resultado = ModeloCociente(
                crudo,
                variable_relevante="poblacion_flotante",
                unidad_referencia="persona",
            ).ajustar()
            # Ahorro en espacio de coeficientes (Anexo 2): se repite la
            # depuración del modelo con SU _banda_de_grupo para medir el
            # mínimo sobre exactamente el mismo set que la LBEn.
            datos = con_poblacion.copy()
            datos["cociente"] = (
                datos["consumo_normalizado"] / datos["poblacion_flotante"]
            )
            por_mes = {}
            n_usados = 0
            for mes in sorted(datos["mes"].unique()):
                idx = datos.index[datos["mes"] == mes]
                grupo = datos.loc[idx, "cociente"]
                banda, dentro = _banda_de_grupo(grupo, int(mes))
                conservados = grupo[dentro]
                if conservados.empty:
                    continue
                n_usados += int(len(conservados))
                por_mes[int(mes)] = {
                    "lben": float(banda["media"]),
                    "mejor": float(conservados.min()),
                }
            modelos["cociente"] = _disponible(
                "cociente",
                n=n_usados,
                lben_mensual=[_num(v) for v in resultado["cociente_mensual"]],
                validacion=_validacion(
                    n_usados,
                    criterio,
                    r2=resultado.get("r2"),
                    mape=resultado.get("mape"),
                ),
                ahorro=_calcular_ahorro(por_mes),
            )
    except Exception as e:  # noqa: BLE001
        modelos["cociente"] = _fallido("cociente", e)

    # ── Regresión estadística (§7.5.3, ec. 8 + §8.1 ec. 10-11) ─────────
    try:
        if len(limpio) < MIN_MESES_BASE:
            modelos["regresion"] = _no_disponible(
                "regresion",
                f"Hay {len(limpio)} < {MIN_MESES_BASE} datos depurados: la "
                f"regresión exige al menos {MIN_MESES_BASE} meses (§7.1-7.2).",
            )
        else:
            variables = [
                v
                for v in VARS_REGRESION_DEFECTO
                if v in limpio.columns and limpio[v].nunique() > 1
            ]
            if not variables:
                modelos["regresion"] = _no_disponible(
                    "regresion",
                    "Sin variables operativas con variación en el periodo "
                    "(población, GDE); la regresión no puede ajustarse.",
                )
            else:
                modelo = ModeloRegresion(limpio, variables, desvio_todos=desv_est)
                resultado = modelo.ajustar()
                pred = _predecir_regresion(modelo, limpio)
                meses = limpio["mes"].to_numpy()
                lben_mensual: List[Optional[float]] = [None] * 12
                for mes in range(1, 13):
                    sel = meses == mes
                    if sel.any():
                        lben_mensual[mes - 1] = _num(float(np.mean(pred[sel])))
                ahorro, nota = _ahorro_regresion(limpio, pred, modelo)
                modelos["regresion"] = _disponible(
                    "regresion",
                    n=len(limpio),
                    lben_mensual=lben_mensual,
                    validacion=_validacion(
                        len(limpio),
                        criterio,
                        r2=resultado.get("r2"),
                        mape=resultado.get("mape"),
                        p_value_max=(
                            _num(max(modelo.p_values.values()))
                            if modelo.p_values
                            else None
                        ),
                    ),
                    ahorro=ahorro,
                    nota=nota,
                )
    except Exception as e:  # noqa: BLE001
        modelos["regresion"] = _fallido("regresion", e)

    # ── Ingeniería (§7.4.4): fuera de alcance, siempre no_disponible ───
    modelos["ingenieria"] = _no_disponible(
        "ingenieria",
        "Modelo de ingeniería/simulación (§7.4.4): requiere el modelo físico "
        "de la edificación; fuera de alcance de esta versión.",
    )

    # ── Confort térmico (ASHRAE 55, indicador propio) ──────────────────
    try:
        temp = 25.0
        if "temperatura_promedio" in limpio.columns:
            media_temp = _num(limpio["temperatura_promedio"].mean())
            if media_temp is not None:
                temp = media_temp
        resultado = ModeloConfortThermal(
            limpio, temperatura_promedio=temp
        ).ajustar()
        base = float(resultado["consumo_base_kwh"])
        modelos["confort"] = _disponible(
            "confort",
            n=len(limpio),
            lben_mensual=[_num(base)] * 12,
            validacion=_validacion(len(limpio), criterio),
            ahorro=None,
            nota=(
                "Indicador complementario (ASHRAE 55): su línea base es el "
                "consumo base medio del periodo, sin desglose mensual, y la "
                "§8.1 no define potencial de ahorro para él."
            ),
        )
    except Exception as e:  # noqa: BLE001
        modelos["confort"] = _fallido("confort", e)

    return modelos


def analizar_desde_payload(entrada: dict) -> dict:
    """
    Núcleo del contrato JSON: payload -> análisis, sin I/O.

    Compartido por `python -m lben.analisis` (stdin/stdout) y el endpoint
    FastAPI `/api/analisis` (servicio engine), igual que `calcular_desde_payload`
    para LBEn.
    """
    registros = entrada.get("registros")
    if not isinstance(registros, list) or not registros:
        return {"ok": False, "error": "Falta bloque_id o registros vacios."}
    bloque_id = entrada.get("bloque_id") or "global"
    ajustes = entrada.get("ajustes")  # Anexo 4 (opcional)

    # Índice de calendario académico por periodo (los campos extra no
    # sobreviven al DataFrame del motor, así que se guarda aparte).
    calendario_por_periodo: Dict[tuple, Optional[int]] = {}
    for reg in registros:
        try:
            clave = (int(reg["ano"]), int(reg["mes"]))
        except (KeyError, TypeError, ValueError):
            continue
        dias = reg.get("dias_lectivos")
        calendario_por_periodo[clave] = int(dias) if dias is not None else None

    # ── 1. Misma depuración normativa que LBEn (§7.5.1 + Anexo 4) ────────
    try:
        limpio, bandas, criterio, desv_est, ajustes_aplicados, ajustado = (
            depurar_con_bandas({str(bloque_id): registros}, ajustes)
        )
    except Exception as e:  # noqa: BLE001
        return {
            "ok": False,
            "error": f"Depuracion falló: {e}",
            "originales": len(registros),
        }

    # ── 2. Clasificar cada período contra la banda de su mes ────────────
    banda_por_mes = {int(b["mes"]): b for b in bandas}
    periodos: List[Dict[str, Any]] = []
    for reg in ajustado.itertuples():
        mes = int(reg.mes)
        ano = int(reg.ano)
        banda = banda_por_mes.get(mes, {})
        dias = calendario_por_periodo.get((ano, mes))
        calendario = _clasificar_calendario(dias)
        valor = float(reg.consumo_normalizado)
        media = banda.get("media")
        li = banda.get("limite_inferior")
        ls = banda.get("limite_superior")
        estimado = bool(banda.get("estimado", True))

        es_atipico: Optional[bool] = None
        direccion: Optional[str] = None
        if not estimado and media:
            es_atipico = valor < li or valor > ls
            if es_atipico:
                direccion = "alza" if valor > ls else "caida"
        desviacion = ((valor - media) / media * 100) if media else None

        punto: Dict[str, Any] = {
            "mes": mes,
            "ano": ano,
            "consumo_kwh": _num(valor),
            "media_mes": _num(media),
            "banda_inf": _num(li),
            "banda_sup": _num(ls),
            "es_atipico": es_atipico,
            "direccion": direccion,
            "desviacion_pct": _num(desviacion),
            "dias_lectivos": dias,
            "calendario": calendario,
            "explicacion": None,
        }
        if es_atipico and direccion:
            punto["explicacion"] = _explicacion(punto, banda, direccion, calendario)
        periodos.append(punto)
    periodos.sort(key=lambda p: (p["ano"], p["mes"]))

    # ── 3. Estadísticos globales y tendencia (post-ajuste/pre-descarte) ─
    valores = ajustado["consumo_normalizado"]
    n = len(valores)
    desv_pob = float(valores.std(ddof=0)) if n >= MIN_DATOS_IC else None
    media_global = float(valores.mean())
    estadisticos = {
        "n": int(n),
        "media": _num(media_global),
        "mediana": _num(float(valores.median())),
        "desv_est": _num(desv_pob),
        "coef_variacion": _num(desv_pob / media_global * 100) if (desv_pob and media_global) else None,
        "minimo": _num(float(valores.min())),
        "maximo": _num(float(valores.max())),
    }
    tendencia = _tendencia(valores.to_numpy(dtype=float))

    # ── 4. Resumen ─────────────────────────────────────────────────────
    atipicos = [p for p in periodos if p["es_atipico"]]
    resumen = {
        "periodos": len(periodos),
        "atipicos": len(atipicos),
        "atipicos_alza": sum(1 for p in atipicos if p["direccion"] == "alza"),
        "atipicos_caida": sum(1 for p in atipicos if p["direccion"] == "caida"),
        "en_lectivo": sum(1 for p in atipicos if p["calendario"] == "lectivo"),
        "en_vacaciones": sum(1 for p in atipicos if p["calendario"] == "vacaciones"),
        "sin_calendario": sum(1 for p in atipicos if p["calendario"] == "sin_datos"),
        "periodos_con_banda": sum(1 for p in periodos if p["es_atipico"] is not None),
        "ajustes": len(ajustes_aplicados),
    }

    # ── 5. Modelos del selector + ahorro §8.1 (§7.4-7.5) ────────────────
    # Cada modelo ya tiene su propio try/except; este segundo anillo es la
    # red de seguridad: la sección `modelos` nunca tumba el análisis.
    try:
        modelos = _modelos(
            str(bloque_id), registros, ajustes, limpio, desv_est, criterio
        )
    except Exception as e:  # noqa: BLE001
        modelos = {
            clave: _no_disponible(
                clave, f"Error interno al calcular los modelos: {e}"
            )
            for clave in MODELOS_TEXTOS
        }

    return {
        "ok": True,
        "originales": len(registros),
        "depurados": int(len(limpio)),
        "criterio_depuracion": criterio,
        "min_datos_ic": MIN_DATOS_IC,
        "min_valores_por_mes": MIN_VALORES_POR_MES,
        "umbra_dias_lectivos": UMBRAL_DIAS_LECTIVOS,
        "estadisticos": estadisticos,
        "tendencia": tendencia,
        "bandas": [
            {
                "mes": int(b["mes"]),
                "n": int(b["n"]),
                "media": _num(b.get("media")),
                "limite_inferior": _num(b.get("limite_inferior")),
                "limite_superior": _num(b.get("limite_superior")),
                "descartados": int(b.get("descartados", 0)),
                "estimado": bool(b.get("estimado", False)),
            }
            for b in bandas
        ],
        "meses_insuficientes": [
            int(b["mes"]) for b in bandas if b["estimado"]
        ],
        "ajustes_aplicados": ajustes_aplicados,
        "modelos": modelos,
        "periodos": periodos,
        "resumen": resumen,
    }


def main() -> int:
    try:
        entrada = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        json.dump(
            {"ok": False, "error": f"JSON de entrada invalido: {e}"},
            sys.stdout,
            ensure_ascii=False,
        )
        return 0

    salida = analizar_desde_payload(entrada)
    json.dump(salida, sys.stdout, ensure_ascii=False, default=_json_default)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:  # noqa: BLE001 — fallo inesperado: exit 1 + stderr
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

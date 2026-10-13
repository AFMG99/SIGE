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
         "dias_facturados": 30, "dias_lectivos": 21}
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
from typing import Any, Dict, List, Optional

import numpy as np

from .bandas import depurar_con_bandas
from .cli import _json_default, _num
from .constants import MIN_DATOS_IC, MIN_VALORES_POR_MES

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

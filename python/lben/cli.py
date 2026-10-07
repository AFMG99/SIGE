#!/usr/bin/env python3
"""
CLI de la Linea Base Energetica (LBEn) — envuelve el paquete lben (python/lben).

Contrato:
  stdin  -> JSON:
    {
      "bloque_id": "cuid...",
      "registros": [
        {"mes": 1, "ano": 2023, "consumo_kwh": 12480.5, "dias_facturados": 30,
         "poblacion_fija": 70, "poblacion_flotante": 13500, "gde": 5.2,
         "temperatura_promedio": 25.0}
      ],
      "variables_regresion": ["poblacion_fija", "poblacion_flotante",
                               "grades_dia_enfriamiento"]
    }
  stdout -> JSON:
    {
      "ok": true, "originales": 48, "depurados": 47, "min_meses": 36,
      "min_valores_por_mes": 3,
      "criterio_depuracion": "banda_10_pct", // única ruta: ±10 % (ec. 3)
      "desv_est": 21493.13,                 // §9.2: σ poblacional (ec. 5) de
                                            // TODOS los datos (post-ajuste,
                                            // pre-descarte); null si N < 10
      "k_intervalo": null,                  // el rescate ic_2sigma ya no existe
      "min_datos_ic": 10,                   // umbral n >= 10 POR MES (D1) ec. 4-5
      "bandas": [{"mes", "n", "media", "limite_inferior", "limite_superior",
                  "descartados", "estimado"} ...],   // una por mes calendario
      "meses_insuficientes": [3, 7],
      "variables_regresion_usadas": [...],
      "resultados": {"valor_absoluto": {"ok": true, "resultado": {...}},
                     "regresion": {"ok": false, "error": "..."}, ...},
      "serie": [{"mes", "ano", "real", "descartado",
                 "banda_inf", "banda_sup", "estimado",
                 "pred_va", "pred_coc", "pred_reg", "pred_conf"}]
    }

  bandas/serie implementan la depuracion de la Resolucion 16 de 2024 §7.5.1:
  pase unico con la banda +/-10 % de la ec. 3. La ec. 4-5 se evalua POR MES
  (decision D1): con n >= 10 en el mes, centro +/- k*DesvEst del mes (ec. 5);
  si no, +/-10 % (ec. 3 / ec. 7). Recomputo tras el descarte; <3 valores
  salen estimado. `real` de la serie = consumo_normalizado (ec. 1) con los
  ajustes del Anexo 4 aplicados (pre-descarte), no el kWh crudo.

El cociente NO comparte esa depuracion (§7.5.2): usa su propia base cruda
(ec. 1 + ajustes del Anexo 4, sin filtro de descarte) y la depura con sus
bandas (ec. 4-5 si N >= 10, si no ec. 7).
El consumo YA viene normalizado a 30 dias (accion del servidor, dias=30):
los logs del motor van a stderr; la salida JSON va limpia a stdout.
"""

from __future__ import annotations

import json
import sys
import traceback

import numpy as np
import statsmodels.api as sm

from . import (
    DataValidationError,
    K_INTERVALO,
    MIN_DATOS_IC,
    MIN_MESES_BASE,
    MIN_VALORES_POR_MES,
    ModeloCociente,
    ModeloConfortThermal,
    ModeloRegresion,
    ModeloValorAbsoluto,
    ModelSelectionError,
    base_cruda, depurar_con_bandas,
)

MODELOS = ("valor_absoluto", "cociente", "regresion", "confort")
VARS_REGRESION_DEFECTO = (
    "poblacion_fija",
    "poblacion_flotante",
    "grades_dia_enfriamiento",
)


def _num(valor) -> float | None:
    """float JSON-safe: NaN/inf -> None."""
    if valor is None:
        return None
    try:
        v = float(valor)
    except (TypeError, ValueError):
        return None
    if not np.isfinite(v):
        return None
    return round(v, 4)


def _json_default(obj):
    """Serializa tipos numpy que devuelve el motor."""
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return _num(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return [_num(v) for v in obj.tolist()]
    raise TypeError(f"No serializable: {type(obj)!r}")


def _error(mensaje: str) -> dict:
    return {"ok": False, "error": str(mensaje)[:400]}


def _bandas_json(bandas: list) -> list:
    """Bandas por mes con flotantes JSON-safe."""
    out = []
    for b in bandas:
        out.append(
            {
                "mes": int(b["mes"]),
                "n": int(b["n"]),
                "media": _num(b.get("media")),
                "limite_inferior": _num(b.get("limite_inferior")),
                "limite_superior": _num(b.get("limite_superior")),
                "descartados": int(b.get("descartados", 0)),
                "estimado": bool(b.get("estimado", False)),
            }
        )
    return out


def _predecir_regresion(modelo: ModeloRegresion, df) -> np.ndarray:
    """
    Predict propio para la regresion.

    ModeloRegresion.predecir es defectuoso: arma cols_esperadas como
    ['const'] + params.index (que YA incluye 'const'), selecciona la
    columna 'const' dos veces y statsmodels recibe una matriz (n, k+1)
    contra params (k+1,) -> ValueError de shapes. Aquí se reconstruye X
    alineado exactamente a params.index.
    """
    cols = list(modelo.modelo_ols.params.index)
    X = df[[c for c in cols if c != "const"]].copy()
    if "const" in cols:
        X = sm.add_constant(X, has_constant="add")
    # np.asarray: statsmodels devuelve pd.Series con el indice de df (tiene
    # huecos si la depuracion descarto filas); la serie de salida se alinea
    # posicional.
    return np.round(np.asarray(modelo.modelo_ols.predict(X[cols]), dtype=float), 4)


def _ajustar(modelo, fabrica_pred) -> tuple[dict, np.ndarray | None]:
    """Ajusta un modelo; una excepcion nunca tumba el CLI entero."""
    try:
        resultado = modelo.ajustar()
        pred = fabrica_pred(modelo)
        return {"ok": True, "resultado": resultado}, pred
    except (DataValidationError, ModelSelectionError) as e:
        return _error(str(e)), None
    except Exception as e:  # noqa: BLE001 — un modelo no debe tumbar la salida
        return _error(f"{type(e).__name__}: {e}"), None


def main() -> int:
    try:
        entrada = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        json.dump({"ok": False, "error": f"JSON de entrada invalido: {e}"},
                  sys.stdout, ensure_ascii=False)
        return 0

    bloque_id = entrada.get("bloque_id")
    registros = entrada.get("registros")
    ajustes = entrada.get("ajustes")  # lista de ajustes no rutinarios (Anexo 4)
    if not bloque_id or not isinstance(registros, list) or not registros:
        json.dump({"ok": False, "error": "Falta bloque_id o registros vacios."},
                  sys.stdout, ensure_ascii=False)
        return 0

    vars_reg = entrada.get("variables_regresion") or list(VARS_REGRESION_DEFECTO)

    # ── 1. Depuracion unica para los 4 modelos (§7.5.1, ec. 1-5 + Anexo 4) ─
    try:
        (
            limpio,
            bandas,
            criterio,
            desv_est,
            ajustes_aplicados,
            ajustado,
        ) = depurar_con_bandas({str(bloque_id): registros}, ajustes)
    except Exception as e:  # noqa: BLE001
        json.dump(
            {"ok": False, "error": f"Depuracion falló: {e}",
             "originales": len(registros)},
            sys.stdout, ensure_ascii=False,
        )
        return 0

    resultados: dict[str, dict] = {}
    preds: dict[str, np.ndarray | None] = {}

    # ── 2. Valor Absoluto ──────────────────────────────────────────────
    resultados["valor_absoluto"], preds["valor_absoluto"] = _ajustar(
        ModeloValorAbsoluto("Valor Absoluto", limpio, desvio_todos=desv_est),
        lambda m: m.predecir(limpio),
    )

    # ── 3. Cociente (§7.5.2: base cruda ec. 1 + ajustes Anexo 4, sin
    # descarte; variable: poblacion flotante) ─
    crudo = base_cruda({str(bloque_id): registros}, ajustes)
    resultados["cociente"], preds["cociente"] = _ajustar(
        ModeloCociente(
            crudo,
            variable_relevante="poblacion_flotante",
            unidad_referencia="persona",
        ),
        lambda m: m.predecir(crudo),
    )

    # ── 4. Regresion (solo variables con variacion y grados libres) ────
    vars_disp = [
        v for v in vars_reg
        if v in limpio.columns and limpio[v].nunique() > 1
    ]
    if not vars_disp:
        resultados["regresion"] = _error(
            "Sin variables explicativas con variacion para la regresion."
        )
        preds["regresion"] = None
    elif len(limpio) <= len(vars_disp) + 1:
        resultados["regresion"] = _error(
            f"Pocas observaciones ({len(limpio)}) para {len(vars_disp)} variables."
        )
        preds["regresion"] = None
    else:
        resultados["regresion"], preds["regresion"] = _ajustar(
            ModeloRegresion(limpio, vars_disp, desvio_todos=desv_est),
            lambda m: _predecir_regresion(m, limpio),
        )

    # ── 5. Confort Termico ─────────────────────────────────────────────
    temp = 25.0
    if "temperatura_promedio" in limpio.columns and len(limpio) > 0:
        media_temp = _num(limpio["temperatura_promedio"].mean())
        if media_temp is not None:
            temp = media_temp
    resultados["confort"], _ = _ajustar(
        ModeloConfortThermal(limpio, temperatura_promedio=temp),
        lambda m: None,
    )

    # ── 6. Serie mensual para la grafica (incluye descartados) ─────────
    banda_por_mes = {int(b["mes"]): b for b in bandas}
    index_limpio = {
        (int(r.ano), int(r.mes)): i
        for i, r in enumerate(limpio.itertuples())
    }
    index_crudo = {
        (int(r.ano), int(r.mes)): i
        for i, r in enumerate(crudo.itertuples())
    }
    # `real` post-ajuste (Anexo 4) en la base ec. 1: es lo que el modelo
    # vio antes del descarte, no el kWh crudo de la factura.
    real_ajustado = {
        (int(r.ano), int(r.mes)): float(r.consumo_normalizado)
        for r in ajustado.itertuples()
    }
    virtual = None
    if resultados.get("confort", {}).get("ok"):
        virtual = resultados["confort"]["resultado"].get("energia_virtual_kwh")

    serie = []
    for reg in registros:
        try:
            anio = int(reg["ano"])
            mes = int(reg["mes"])
        except (KeyError, TypeError, ValueError):
            continue
        i = index_limpio.get((anio, mes))
        j = index_crudo.get((anio, mes))
        banda = banda_por_mes.get(mes, {})
        valor_real = real_ajustado.get((anio, mes))
        punto = {
            "mes": mes,
            "ano": anio,
            "real": _num(valor_real) if valor_real is not None else _num(reg.get("consumo_kwh")),
            "descartado": i is None,
            "banda_inf": _num(banda.get("limite_inferior")),
            "banda_sup": _num(banda.get("limite_superior")),
            "estimado": bool(banda.get("estimado", True)),
            "pred_va": None,
            "pred_coc": None,
            "pred_reg": None,
            "pred_conf": None,
        }
        for modelo_id, clave, idx in (
            ("valor_absoluto", "pred_va", i),
            ("cociente", "pred_coc", j),
            ("regresion", "pred_reg", i),
        ):
            arr = preds.get(modelo_id)
            if idx is not None and arr is not None and idx < len(arr):
                punto[clave] = _num(arr[idx])
        if i is not None and virtual is not None:
            punto["pred_conf"] = _num(virtual)
        serie.append(punto)
    serie.sort(key=lambda p: (p["ano"], p["mes"]))

    salida = {
        "ok": True,
        "originales": len(registros),
        "depurados": int(len(limpio)),
        "min_meses": MIN_MESES_BASE,
        "min_valores_por_mes": MIN_VALORES_POR_MES,
        "criterio_depuracion": criterio,
        "desv_est": _num(desv_est),
        "k_intervalo": K_INTERVALO if criterio == "ic_2sigma" else None,
        "min_datos_ic": MIN_DATOS_IC,
        "bandas": _bandas_json(bandas),
        "meses_insuficientes": [
            int(b["mes"]) for b in bandas if b["estimado"]
        ],
        "variables_regresion_usadas": vars_disp,
        "ajustes_aplicados": ajustes_aplicados,
        "resultados": resultados,
        "serie": serie,
    }
    json.dump(salida, sys.stdout, ensure_ascii=False, default=_json_default)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:  # noqa: BLE001 — fallo inesperado: exit 1 + stderr
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

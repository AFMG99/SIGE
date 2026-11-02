"""Proyecciones mensuales ARIMA sobre series depuradas según UPME."""

from __future__ import annotations

import json
import math
import re
import sys
import warnings
from datetime import datetime
from itertools import product
from typing import Any

import numpy as np
import pandas as pd
from statsmodels.stats.diagnostic import acorr_ljungbox
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.statespace.sarimax import SARIMAX

from .bandas import depurar_con_bandas
from .constants import MIN_MESES_BASE

ORDENES_ARIMA = ((0, 1, 1), (1, 0, 0), (1, 0, 1), (1, 1, 0), (1, 1, 1), (0, 1, 0))
ORDENES_ESTACIONALES = (
    (0, 0, 0, 12),
    (1, 0, 0, 12),
    (0, 0, 1, 12),
    (1, 0, 1, 12),
    (0, 1, 0, 12),
)
_PERIODO_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def _error(mensaje: str) -> dict[str, Any]:
    return {"ok": False, "error": mensaje}


def _validar_entrada(entrada: Any) -> tuple[list[dict[str, Any]], int, tuple[int, int, int] | None, list[dict[str, Any]]]:
    if not isinstance(entrada, dict):
        raise ValueError("El cuerpo de la proyección debe ser un objeto JSON.")

    registros = entrada.get("registros")
    if not isinstance(registros, list) or not registros:
        raise ValueError("Debe enviar al menos un registro mensual.")

    horizonte = entrada.get("horizonte")
    if isinstance(horizonte, bool) or not isinstance(horizonte, int) or horizonte not in (1, 2, 3):
        raise ValueError("El horizonte debe ser de 1, 2 o 3 meses.")

    orden_entrada = entrada.get("orden")
    orden: tuple[int, int, int] | None = None
    if orden_entrada is not None:
        if (
            not isinstance(orden_entrada, list)
            or len(orden_entrada) != 3
            or any(
                isinstance(valor, bool)
                or not isinstance(valor, int)
                or valor < 0
                or valor > 2
                for valor in orden_entrada
            )
        ):
            raise ValueError("El orden manual debe ser una lista [p, d, q] con valores entre 0 y 2.")
        orden = tuple(orden_entrada)

    ajustes = entrada.get("ajustes", [])
    if not isinstance(ajustes, list):
        raise ValueError("Los ajustes no rutinarios deben ser una lista.")

    normalizados: list[dict[str, Any]] = []
    periodos: list[str] = []
    for indice, registro in enumerate(registros):
        if not isinstance(registro, dict):
            raise ValueError(f"El registro {indice + 1} no es un objeto válido.")
        periodo = registro.get("periodo")
        if not isinstance(periodo, str) or not _PERIODO_RE.fullmatch(periodo):
            raise ValueError(f"El período del registro {indice + 1} debe tener formato YYYY-MM.")
        consumo = registro.get("consumo_kwh")
        dias = registro.get("dias_facturados")
        if (
            isinstance(consumo, bool)
            or not isinstance(consumo, (int, float))
            or not math.isfinite(float(consumo))
            or consumo <= 0
        ):
            raise ValueError(f"El consumo del período {periodo} debe ser un número mayor que cero.")
        if isinstance(dias, bool) or not isinstance(dias, int) or dias <= 0:
            raise ValueError(f"Los días facturados del período {periodo} deben ser un entero mayor que cero.")
        periodos.append(periodo)
        ano, mes = map(int, periodo.split("-"))
        normalizados.append(
            {
                "ano": ano,
                "mes": mes,
                "consumo_kwh": float(consumo),
                "dias_facturados": dias,
            }
        )

    if periodos != sorted(periodos):
        raise ValueError("Los registros deben estar ordenados cronológicamente.")
    if len(set(periodos)) != len(periodos):
        raise ValueError("No puede haber más de un registro para el mismo período.")
    for anterior, actual in zip(periodos, periodos[1:]):
        fecha_anterior = datetime.strptime(anterior, "%Y-%m")
        fecha_actual = datetime.strptime(actual, "%Y-%m")
        indice_anterior = fecha_anterior.year * 12 + fecha_anterior.month
        indice_actual = fecha_actual.year * 12 + fecha_actual.month
        if indice_actual != indice_anterior + 1:
            raise ValueError("La serie mensual tiene períodos faltantes; complete el histórico antes de proyectar.")
    return normalizados, horizonte, orden, ajustes


def _ajustar_modelo(
    valores: pd.Series,
    orden: tuple[int, int, int],
    orden_estacional: tuple[int, int, int, int] | None,
):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        if orden_estacional is None:
            resultado = ARIMA(
                valores,
                order=orden,
                enforce_stationarity=False,
                enforce_invertibility=False,
            ).fit()
        else:
            resultado = SARIMAX(
                valores,
                order=orden,
                seasonal_order=orden_estacional,
                enforce_stationarity=False,
                enforce_invertibility=False,
            ).fit(disp=False, maxiter=100)
    if not math.isfinite(float(resultado.aic)):
        raise ValueError("El modelo produjo un AIC no finito.")
    if getattr(resultado, "mle_retvals", {}).get("converged") is False:
        raise ValueError("El modelo no convergió.")
    return resultado


def _seleccionar_modelo(
    valores: pd.Series,
    orden_manual: tuple[int, int, int] | None,
):
    if orden_manual is not None:
        return (
            _ajustar_modelo(valores, orden_manual, None),
            "ARIMA manual",
            orden_manual,
            None,
        )

    mejor = None
    for orden, estacional in product(ORDENES_ARIMA, ORDENES_ESTACIONALES):
        try:
            ajustado = _ajustar_modelo(valores, orden, estacional)
        except (ValueError, np.linalg.LinAlgError, RuntimeError, OverflowError):
            continue
        if mejor is None or float(ajustado.aic) < float(mejor[0].aic):
            mejor = (ajustado, orden, estacional)

    if mejor is not None:
        return mejor[0], "SARIMA", mejor[1], mejor[2]

    for orden in ORDENES_ARIMA:
        try:
            ajustado = _ajustar_modelo(valores, orden, None)
        except (ValueError, np.linalg.LinAlgError, RuntimeError, OverflowError):
            continue
        if mejor is None or float(ajustado.aic) < float(mejor[0].aic):
            mejor = (ajustado, orden, None)
    if mejor is None:
        raise ValueError("No fue posible ajustar un modelo SARIMA ni ARIMA con esta serie.")
    return mejor[0], "ARIMA", mejor[1], None


def proyectar_desde_payload(entrada: Any) -> dict[str, Any]:
    """Calcula una proyección bajo demanda; no escribe datos ni modelos."""
    try:
        registros, horizonte, orden_manual, ajustes = _validar_entrada(entrada)
        df_limpio, bandas, criterio, _, ajustes_aplicados, df_ajustado = depurar_con_bandas(
            {"proyeccion": registros}, ajustes
        )
        depurados = len(df_limpio)
        if depurados == 0:
            return _error("La depuración no dejó meses disponibles para estimar.")

        medias_por_mes = df_limpio.groupby("mes")["consumo_normalizado"].mean()
        if medias_por_mes.empty or medias_por_mes.isna().any():
            return _error("No se pudo calcular la LBEn mensual de valor absoluto para imputar atípicos.")

        limpio = {
            (int(fila.ano), int(fila.mes)): float(fila.consumo_normalizado)
            for fila in df_limpio.itertuples()
        }
        original_ajustado = {
            (int(fila.ano), int(fila.mes)): float(fila.consumo_normalizado)
            for fila in df_ajustado.itertuples()
        }
        serie: list[dict[str, Any]] = []
        valores_modelo: list[float] = []
        for registro in registros:
            clave = (registro["ano"], registro["mes"])
            periodo = f'{registro["ano"]:04d}-{registro["mes"]:02d}'
            es_depurado = clave in limpio
            observado = original_ajustado[clave]
            usado = observado if es_depurado else float(medias_por_mes.loc[registro["mes"]])
            valores_modelo.append(usado)
            serie.append(
                {
                    "periodo": periodo,
                    "consumo_observado": round(observado, 4),
                    "consumo_modelado": round(usado, 4),
                    "descartado": not es_depurado,
                    "lben_valor_absoluto": round(float(medias_por_mes.loc[registro["mes"]]), 4),
                }
            )

        indice = pd.date_range(
            start=f'{registros[0]["ano"]:04d}-{registros[0]["mes"]:02d}',
            periods=len(registros),
            freq="MS",
        )
        valores = pd.Series(valores_modelo, index=indice, dtype=float)
        resultado, tipo_modelo, orden, estacional = _seleccionar_modelo(
            valores, orden_manual
        )
        prediccion = resultado.get_forecast(steps=horizonte)
        medias = np.asarray(prediccion.predicted_mean, dtype=float)
        intervalos = np.asarray(prediccion.conf_int(alpha=0.05), dtype=float)
        if not np.isfinite(medias).all() or not np.isfinite(intervalos).all():
            return _error("El modelo produjo valores de proyección no finitos.")

        pronostico = []
        for fecha, media, intervalo in zip(prediccion.predicted_mean.index, medias, intervalos):
            lben_mes = medias_por_mes.get(fecha.month)
            pronostico.append(
                {
                    "periodo": fecha.strftime("%Y-%m"),
                    "consumo_kwh": round(float(media), 4),
                    "limite_inferior": round(float(intervalo[0]), 4),
                    "limite_superior": round(float(intervalo[1]), 4),
                    "lben_valor_absoluto": round(float(lben_mes), 4)
                    if lben_mes is not None
                    else None,
                }
            )

        incluir_diagnosticos = bool(entrada.get("incluir_diagnosticos", False))
        salida: dict[str, Any] = {
            "ok": True,
            "originales": len(registros),
            "depurados": depurados,
            "min_meses": MIN_MESES_BASE,
            "criterio_depuracion": criterio,
            "ajustes_aplicados": len(ajustes_aplicados),
            "modelo": tipo_modelo,
            "orden": list(orden),
            "orden_estacional": list(estacional) if estacional else None,
            "pronostico": pronostico,
            "serie": serie,
        }
        if depurados < MIN_MESES_BASE:
            salida["advertencia"] = (
                f"Se requieren al menos {MIN_MESES_BASE} meses depurados; solo hay {depurados}. "
                "Se continúa con la estimación, pero su confiabilidad puede ser menor."
            )
        if incluir_diagnosticos:
            residuos = np.asarray(resultado.resid, dtype=float)
            residuos = residuos[np.isfinite(residuos)]
            mape = float(
                np.mean(np.abs((np.asarray(valores) - np.asarray(resultado.fittedvalues)) / np.maximum(np.asarray(valores), 1e-9)))
                * 100
            )
            lag = min(12, max(1, len(residuos) // 5))
            p_value = None
            if len(residuos) > lag:
                tabla_ljung = acorr_ljungbox(residuos, lags=[lag], return_df=True)
                candidato = float(tabla_ljung["lb_pvalue"].iloc[-1])
                p_value = round(candidato, 6) if math.isfinite(candidato) else None
            salida["diagnosticos"] = {
                "aic": round(float(resultado.aic), 4),
                "mape_entrenamiento": round(mape, 4) if math.isfinite(mape) else None,
                "media_residuos": round(float(residuos.mean()), 4) if len(residuos) else None,
                "ljung_box_p_value": p_value,
            }
        return salida
    except (ValueError, TypeError, KeyError, np.linalg.LinAlgError, RuntimeError) as error:
        return _error(str(error)[:400] or "No se pudo calcular la proyección.")


def main() -> None:
    try:
        entrada = json.loads(sys.stdin.read())
    except json.JSONDecodeError as error:
        print(json.dumps(_error(f"JSON inválido: {error.msg}"), ensure_ascii=False))
        return
    print(json.dumps(proyectar_desde_payload(entrada), ensure_ascii=False, allow_nan=False))


if __name__ == "__main__":
    main()

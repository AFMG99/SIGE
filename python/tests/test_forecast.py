"""Pruebas del contrato JSON y la depuración del motor de proyecciones."""

from __future__ import annotations

import os
import json
import subprocess
import sys
import math
from types import SimpleNamespace

import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lben.forecast import proyectar_desde_payload  # noqa: E402
from lben import forecast as motor_forecast  # noqa: E402


BASE_POR_MES = {
    mes: 9000.0 + mes * 350.0
    for mes in range(1, 13)
}


def serie_36_meses():
    registros = []
    for ano in (2023, 2024, 2025, 2026):
        for mes in range(1, 13):
            consumo = BASE_POR_MES[mes]
            if (ano, mes) == (2024, 3):
                consumo *= 1.8
            registros.append(
                {
                    "periodo": f"{ano}-{mes:02d}",
                    "consumo_kwh": consumo,
                    "dias_facturados": 30,
                }
            )
    return registros


def test_proyeccion_sarima_depura_e_imputa_atipico():
    salida = proyectar_desde_payload(
        {
            "registros": serie_36_meses(),
            "horizonte": 2,
            "incluir_diagnosticos": True,
        }
    )

    assert salida["ok"] is True, salida
    assert salida["originales"] == 48
    assert salida["depurados"] == 47
    assert "advertencia" not in salida
    assert salida["modelo"] == "SARIMA"
    assert [p["periodo"] for p in salida["pronostico"]] == ["2027-01", "2027-02"]
    assert salida["serie"][14]["descartado"] is True
    assert salida["serie"][14]["consumo_modelado"] == salida["serie"][14]["lben_valor_absoluto"]
    assert math.isfinite(salida["diagnosticos"]["aic"])


def test_proyeccion_manual_arima():
    salida = proyectar_desde_payload(
        {
            "registros": serie_36_meses(),
            "horizonte": 1,
            "orden": [1, 1, 0],
        }
    )

    assert salida["ok"] is True, salida
    assert salida["modelo"] == "ARIMA manual"
    assert salida["orden"] == [1, 1, 0]
    assert salida["orden_estacional"] is None


def test_proyecta_con_advertencia_si_hay_menos_de_36_meses_depurados():
    registros = serie_36_meses()[:36]
    salida = proyectar_desde_payload({"registros": registros, "horizonte": 3})

    assert salida["ok"] is True, salida
    assert salida["depurados"] == 35
    assert salida["advertencia"].startswith(
        "Se requieren al menos 36 meses depurados; solo hay 35."
    )
    assert "Se continúa con la estimación" in salida["advertencia"]


def test_proyecta_historial_corto_sin_lben_para_mes_futuro():
    salida = proyectar_desde_payload(
        {"registros": serie_36_meses()[:11], "horizonte": 1}
    )

    assert salida["ok"] is True, salida
    assert salida["depurados"] == 11
    assert salida["pronostico"][0]["periodo"] == "2023-12"
    assert salida["pronostico"][0]["lben_valor_absoluto"] is None
    assert salida["advertencia"].startswith(
        "Se requieren al menos 36 meses depurados; solo hay 11."
    )


def test_devuelve_error_si_no_se_puede_ajustar_con_serie_corta(monkeypatch):
    def modelo_no_disponible(*_args):
        raise ValueError("No fue posible ajustar un modelo con esta serie.")

    monkeypatch.setattr(motor_forecast, "_seleccionar_modelo", modelo_no_disponible)
    salida = proyectar_desde_payload(
        {"registros": serie_36_meses()[:36], "horizonte": 1}
    )

    assert salida["ok"] is False
    assert "No fue posible ajustar" in salida["error"]


def test_rechaza_huecos_en_serie_mensual():
    registros = serie_36_meses()
    del registros[10]
    salida = proyectar_desde_payload({"registros": registros, "horizonte": 3})

    assert salida["ok"] is False
    assert "períodos faltantes" in salida["error"]


def test_rechaza_orden_manual_fuera_del_rango_permitido():
    salida = proyectar_desde_payload(
        {"registros": serie_36_meses(), "horizonte": 1, "orden": [3, 0, 0]}
    )

    assert salida["ok"] is False
    assert "orden manual" in salida["error"]


def test_fallback_arima_si_no_converge_ningun_candidato_sarima(monkeypatch):
    def ajustar_solo_no_estacional(valores, orden, orden_estacional):
        if orden_estacional is not None:
            raise ValueError("SARIMA de prueba sin convergencia")
        return SimpleNamespace(aic=sum(orden), mle_retvals={"converged": True})

    monkeypatch.setattr(motor_forecast, "_ajustar_modelo", ajustar_solo_no_estacional)
    _, modelo, orden, estacional = motor_forecast._seleccionar_modelo(
        pd.Series(range(36), dtype=float),
        None,
    )

    assert modelo == "ARIMA"
    assert orden in motor_forecast.ORDENES_ARIMA
    assert estacional is None


def test_cli_json_por_stdin_stdout():
    proceso = subprocess.run(
        [sys.executable, "-m", "lben.forecast"],
        input=json.dumps(
            {
                "registros": serie_36_meses(),
                "horizonte": 1,
                "orden": [1, 1, 0],
            }
        ),
        text=True,
        capture_output=True,
        cwd=os.path.join(os.path.dirname(__file__), ".."),
        check=False,
        timeout=30,
    )

    assert proceso.returncode == 0, proceso.stderr
    salida = json.loads(proceso.stdout)
    assert salida["ok"] is True, salida
    assert len(salida["pronostico"]) == 1

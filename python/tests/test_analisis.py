#!/usr/bin/env python3
"""
Golden test del modo análisis (Módulo 3: detección de épocas inusuales).

Serie sintética de 36 meses (3 años) con patrón estacional fijo por mes
calendario (mismo valor en los 3 años ⇒ banda ±10 % exacta por mes) y dos
atípicos plantados:

  - 2024-03: alza +40 % (14.000 vs 10.000 kWh)   → detectado, dirección 'alza'
  - 2023-08: caída −33 % (8.000 vs 12.000 kWh)   → detectado, dirección 'caida'

Calendario académico: enero/julio/diciembre con ≤ 12 días lectivos
(vacaciones); el resto con 21 días (clase). Los dos atípicos plantados caen
en meses lectivos.

Se ejecuta directamente:  python tests/test_analisis.py  (desde python/)
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from lben.analisis import (  # noqa: E402
    UMBRAL_DIAS_LECTIVOS,
    analizar_desde_payload,
)

# Consumo base por mes calendario (kWh, dias_facturados=30 ⇒ normalizado = raw).
BASE_POR_MES = {
    1: 8500.0,   # vacaciones
    2: 10000.0,
    3: 10000.0,
    4: 10000.0,
    5: 10000.0,
    6: 11000.0,
    7: 8000.0,    # vacaciones
    8: 12000.0,
    9: 11500.0,
    10: 11500.0,
    11: 11500.0,
    12: 9000.0,   # vacaciones
}
DIAS_LECTIVOS_POR_MES = {
    1: 8, 2: 21, 3: 21, 4: 21, 5: 21, 6: 20,
    7: 5, 8: 21, 9: 21, 10: 22, 11: 20, 12: 6,
}


def serie_36_meses():
    registros = []
    for ano in (2023, 2024, 2025):
        for mes in range(1, 13):
            consumo = BASE_POR_MES[mes]
            if (ano, mes) == (2024, 3):
                consumo = 14000.0   # atípico: alza
            elif (ano, mes) == (2023, 8):
                consumo = 8000.0    # atípico: caída
            registros.append({
                "mes": mes,
                "ano": ano,
                "consumo_kwh": consumo,
                "dias_facturados": 30,
                "dias_lectivos": DIAS_LECTIVOS_POR_MES[mes],
            })
    return registros


def _periodo(salida, ano, mes):
    for p in salida["periodos"]:
        if p["ano"] == ano and p["mes"] == mes:
            return p
    raise AssertionError(f"Período {ano}-{mes:02d} no encontrado en la salida")


def test_deteccion_de_atipicos():
    salida = analizar_desde_payload({
        "bloque_id": "edificacion-test",
        "registros": serie_36_meses(),
        "ajustes": [],
    })
    assert salida["ok"] is True, salida
    assert salida["originales"] == 36
    assert salida["min_valores_por_mes"] == 3
    assert salida["umbra_dias_lectivos"] == UMBRAL_DIAS_LECTIVOS

    resumen = salida["resumen"]
    assert resumen["periodos"] == 36, resumen
    assert resumen["atipicos"] == 2, resumen
    assert resumen["atipicos_alza"] == 1, resumen
    assert resumen["atipicos_caida"] == 1, resumen
    assert resumen["periodos_con_banda"] == 36, resumen
    assert resumen["ajustes"] == 0, resumen

    # Los dos atípicos caen en meses lectivos (21 días clase).
    assert resumen["en_lectivo"] == 2, resumen
    assert resumen["en_vacaciones"] == 0, resumen
    assert resumen["sin_calendario"] == 0, resumen

    # Ningún mes es `estimado` (n = 3 por mes calendario).
    assert salida["meses_insuficientes"] == [], salida["meses_insuficientes"]


def test_explicacion_y_calendario_del_atipico():
    salida = analizar_desde_payload({
        "bloque_id": "edificacion-test",
        "registros": serie_36_meses(),
    })

    alza = _periodo(salida, 2024, 3)
    assert alza["es_atipico"] is True
    assert alza["direccion"] == "alza"
    assert alza["consumo_kwh"] == 14000.0
    # Banda de marzo construida sobre 10.000 kWh (±10 % ⇒ 9.000–11.000).
    assert abs(alza["banda_inf"] - 9000.0) < 1e-6, alza
    assert abs(alza["banda_sup"] - 11000.0) < 1e-6, alza
    assert abs(alza["desviacion_pct"] - 40.0) < 1e-6, alza
    assert alza["dias_lectivos"] == 21
    assert alza["calendario"] == "lectivo"
    assert alza["explicacion"] is not None
    assert "marzo de 2024" in alza["explicacion"]
    assert "14.000,0 kWh" in alza["explicacion"]
    assert "21 días clase" in alza["explicacion"]

    caida = _periodo(salida, 2023, 8)
    assert caida["es_atipico"] is True
    assert caida["direccion"] == "caida"
    assert caida["consumo_kwh"] == 8000.0
    # Banda de agosto reanclada sobre la mediana (12.000 ⇒ 10.800–13.200).
    assert abs(caida["banda_inf"] - 10800.0) < 1e-6, caida
    assert abs(caida["banda_sup"] - 13200.0) < 1e-6, caida
    assert abs(caida["desviacion_pct"] - (-33.3333)) < 1e-3, caida
    assert caida["calendario"] == "lectivo"
    assert "por debajo" in caida["explicacion"]

    # Un período normal no lleva explicación ni marca de atípico.
    normal = _periodo(salida, 2025, 4)
    assert normal["es_atipico"] is False
    assert normal["direccion"] is None
    assert normal["explicacion"] is None
    assert normal["calendario"] == "lectivo"

    # Mes vacacional clasificado con el umbral (enero: 8 días ≤ 12).
    vacacional = _periodo(salida, 2024, 1)
    assert vacacional["calendario"] == "vacaciones"
    assert vacacional["es_atipico"] is False


def test_estadisticos_y_tendencia():
    salida = analizar_desde_payload({
        "bloque_id": "edificacion-test",
        "registros": serie_36_meses(),
    })
    est = salida["estadisticos"]
    assert est["n"] == 36
    assert est["media"] is not None and est["media"] > 0
    assert est["mediana"] is not None
    assert est["desv_est"] is not None          # n ≥ 10 ⇒ ec. 5 poblacional
    assert est["minimo"] == 8000.0
    assert est["maximo"] == 14000.0

    tendencia = salida["tendencia"]
    assert tendencia["pendiente_kwh_por_mes"] is not None
    assert tendencia["variacion_pct_anual"] is not None

    # Bandas JSON-safe: una por mes calendario presente.
    assert len(salida["bandas"]) == 12
    for b in salida["bandas"]:
        assert b["estimado"] is False
        assert b["limite_inferior"] is not None
        assert b["limite_superior"] is not None


def test_entrada_invalida():
    assert analizar_desde_payload({"registros": []})["ok"] is False
    assert analizar_desde_payload({})["ok"] is False


def test_contrato_json_cli():
    """El modo análisis serializa a JSON sin NaN/Infinity (contrato cli)."""
    salida = analizar_desde_payload({
        "bloque_id": "edificacion-test",
        "registros": serie_36_meses(),
    })
    texto = json.dumps(salida, allow_nan=False)
    assert "NaN" not in texto and "Infinity" not in texto
    recargado = json.loads(texto)
    assert recargado["resumen"]["atipicos"] == 2


def main():
    pruebas = [
        test_deteccion_de_atipicos,
        test_explicacion_y_calendario_del_atipico,
        test_estadisticos_y_tendencia,
        test_entrada_invalida,
        test_contrato_json_cli,
    ]
    for prueba in pruebas:
        prueba()
        print(f"  ✔ {prueba.__name__}")
    print(f"\n✅ {len(pruebas)} pruebas del modo análisis pasaron.")


if __name__ == "__main__":
    main()

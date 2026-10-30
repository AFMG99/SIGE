#!/usr/bin/env python3
"""
Golden test del modo análisis (Módulo 3: detección de épocas inusuales +
sección `modelos` del selector, §7.4-7.5 + ahorro §8.1).

Serie sintética de 36 meses (3 años) con patrón estacional fijo por mes
calendario (mismo valor en los 3 años ⇒ banda ±10 % exacta por mes) y dos
atípicos plantados:

  - 2024-03: alza +40 % (14.000 vs 10.000 kWh)   → detectado, dirección 'alza'
  - 2023-08: caída −33 % (8.000 vs 12.000 kWh)   → detectado, dirección 'caida'

Calendario académico: enero/julio/diciembre con ≤ 12 días lectivos
(vacaciones); el resto con 21 días (clase). Los dos atípicos plantados caen
en meses lectivos.

La sección `modelos` tiene su golden propio: los 36 valores de la tabla del
Anexo 1 (enero 10.204/11.264/11.635 ⇒ LBEn 11.034,33 y ahorro 830,33 ≈ 830
kWh / 7,5 %; «Promedio x Año» 468 kWh / 4,1 %) reproducen la tabla de
potenciales del ejemplo trabajado.

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


# ── Datos y tests de la sección `modelos` (§7.4-7.5 + §8.1) ──────────────

# Los 36 valores de la tabla del Anexo 1 (enero: 10.204 / 11.264 / 11.635).
TABLA_ANEXO_1 = {
    1: (10204.0, 11264.0, 11635.0),
    2: (11112.0, 10886.0, 11158.0),
    3: (11318.0, 11496.0, 11810.0),
    4: (11242.0, 11883.0, 11306.0),
    5: (11277.0, 12486.0, 11839.0),
    6: (11715.0, 11009.0, 11870.0),
    7: (12219.0, 11719.0, 11891.0),
    8: (11146.0, 11637.0, 11784.0),
    9: (10300.0, 12028.0, 11765.0),
    10: (11348.0, 10383.0, 10783.0),
    11: (11434.0, 11435.0, 10639.0),
    12: (11374.0, 11662.0, 10927.0),
}
# «Ahorro» kWh y % por mes según el ejemplo trabajado del Anexo 1.
AHORRO_ANEXO_1 = {
    1: (830, 7.5), 2: (166, 1.5), 3: (223, 1.9), 4: (235, 2.0),
    5: (590, 5.0), 6: (522, 4.5), 7: (224, 1.9), 8: (376, 3.3),
    9: (1064, 9.4), 10: (455, 4.2), 11: (530, 4.7), 12: (394, 3.5),
}


def serie_anexo_1():
    """Los 36 valores del Anexo 1 (dias_facturados=30 ⇒ normalizado = raw)."""
    registros = []
    for i, ano in enumerate((2023, 2024, 2025)):
        for mes, valores in TABLA_ANEXO_1.items():
            registros.append({
                "mes": mes,
                "ano": ano,
                "consumo_kwh": valores[i],
                "dias_facturados": 30,
                "dias_lectivos": DIAS_LECTIVOS_POR_MES[mes],
            })
    return registros


def serie_con_poblacion(poblacion=100.0):
    """serie_36_meses con población flotante (hace viable el cociente)."""
    registros = serie_36_meses()
    for reg in registros:
        reg["poblacion_flotante"] = poblacion
    return registros


def serie_regresion():
    """
    36 meses con población flotante variable y consumo lineal en ella
    (ec. 8: consumo = 9.000 + 15·(pob − 280) + ruido de ±120 kWh, ~1 % MAPE).
    El ruido rota por mes/año para que los tres años de CADA mes entren en la
    banda ±10 % (36 depurados) y para que los mejores desempeños (ec. 10)
    tengan las 12 variables distintas que exige la línea de tendencia.
    """
    registros = []
    ruido = (120.0, -90.0, 45.0)
    for i, ano in enumerate((2023, 2024, 2025)):
        for mes in range(1, 13):
            poblacion = 240 + 8 * ((mes * 7) % 13)
            consumo = 9000.0 + 15.0 * (poblacion - 280) + ruido[(mes + i) % 3]
            registros.append({
                "mes": mes,
                "ano": ano,
                "consumo_kwh": consumo,
                "dias_facturados": 30,
                "dias_lectivos": DIAS_LECTIVOS_POR_MES[mes],
                "poblacion_fija": 0,
                "poblacion_flotante": poblacion,
                "gde": 5.2,
            })
    return registros


def test_modelos_seccion_uniforme():
    """Los 5 modelos comparten la misma hoja; no_disponible es explícito."""
    salida = analizar_desde_payload({
        "bloque_id": "edificacion-test",
        "registros": serie_36_meses(),
    })
    modelos = salida["modelos"]
    assert set(modelos) == {
        "valor_absoluto", "cociente", "regresion", "ingenieria", "confort",
    }, sorted(modelos)
    for clave, hoja in modelos.items():
        assert hoja["estado"] in ("disponible", "no_disponible"), clave
        assert hoja["etiqueta"] and hoja["formula"] and hoja["unidad"], clave
        assert len(hoja["lben_mensual"]) == 12, clave
        validacion = hoja["validacion"]
        assert validacion["n"] >= 0 and validacion["min_datos_ic"] == 10, clave
        if hoja["estado"] == "no_disponible":
            assert hoja["motivo"], clave           # el motivo es obligatorio
            assert hoja["n"] == 0, clave
            assert hoja["ahorro"] is None, clave
            assert hoja["lben_mensual"] == [None] * 12, clave
        else:
            assert hoja["motivo"] is None, clave
            assert any(v is not None for v in hoja["lben_mensual"]), clave

    # La serie plana SIN variables operativas deja tres modelos fuera.
    assert modelos["valor_absoluto"]["estado"] == "disponible"
    assert modelos["confort"]["estado"] == "disponible"
    assert modelos["cociente"]["estado"] == "no_disponible"
    assert modelos["regresion"]["estado"] == "no_disponible"
    assert modelos["ingenieria"]["estado"] == "no_disponible"


def test_valor_absoluto_golden_anexo_1():
    """Golden: los 36 valores del Anexo 1 reproducen su tabla de ahorros."""
    salida = analizar_desde_payload({
        "bloque_id": "edificacion-anexo1",
        "registros": serie_anexo_1(),
    })
    assert salida["depurados"] == 36, salida["depurados"]  # 0 fuera de ±10 %
    va = salida["modelos"]["valor_absoluto"]
    assert va["estado"] == "disponible"
    assert va["n"] == 36
    assert va["unidad"] == "kWh/mes"

    # LBEn_m = promedio simple del mes (ec. 2): enero 11.034,33.
    assert abs(va["lben_mensual"][0] - 11034.3333) < 0.001, va["lben_mensual"][0]
    assert abs(va["lben_mensual"][8] - 11364.3333) < 0.001, va["lben_mensual"][8]

    ahorro = va["ahorro"]
    assert ahorro is not None and len(ahorro["por_mes"]) == 12
    for fila in ahorro["por_mes"]:
        esperado_kwh, esperado_pct = AHORRO_ANEXO_1[fila["mes"]]
        assert fila["potencial"] >= 0, fila                 # convenio Anexo 1
        assert abs(fila["potencial"] - esperado_kwh) <= 0.5, fila
        assert round(fila["potencial_pct"], 1) == esperado_pct, fila
        # «mejor» es el consumo mínimo REAL del mes (ec. 9) y la LBEn su media.
        assert fila["mejor"] == min(TABLA_ANEXO_1[fila["mes"]]), fila
        assert fila["lben"] > fila["mejor"] or esperado_kwh == 0, fila

    # Fila «Promedio x Año» del Anexo 1: 468 kWh y 4,1 %.
    assert round(ahorro["potencial_mensual"]) == 468, ahorro["potencial_mensual"]
    assert round(ahorro["potencial_pct"], 1) == 4.1, ahorro["potencial_pct"]

    validacion = va["validacion"]
    assert validacion["n"] == 36
    assert validacion["criterio"] == "banda_10_pct"
    assert validacion["r2"] is not None and validacion["mape"] is not None
    assert validacion["p_value_max"] is None                # no aplica (ec. 2)
    assert validacion["intervalo_inf"] is None              # n < 10 por mes (D1)


def test_cociente_disponible():
    """Cociente viable: 100 personas ⇒ LBEn = consumo ÷ 100 (ec. 6-7)."""
    salida = analizar_desde_payload({
        "bloque_id": "edificacion-cociente",
        "registros": serie_con_poblacion(),
    })
    coc = salida["modelos"]["cociente"]
    assert coc["estado"] == "disponible", coc
    assert coc["motivo"] is None
    assert coc["unidad"] == "kWh/persona·mes"
    esperado = [BASE_POR_MES[m] / 100.0 for m in range(1, 13)]
    assert coc["lben_mensual"] == esperado, coc["lben_mensual"]

    # SU propia depuración (§7.5.2) descarta los dos atípicos también aquí.
    assert coc["n"] == 34, coc["n"]
    assert coc["validacion"]["r2"] == 1.0                   # predicción exacta
    assert coc["validacion"]["mape"] == 0.0

    # Serie plana por mes ⇒ mínimo == LBEn ⇒ potencial 0 en los 12 meses.
    ahorro = coc["ahorro"]
    assert ahorro is not None and len(ahorro["por_mes"]) == 12
    assert ahorro["potencial_mensual"] == 0.0, ahorro
    assert ahorro["potencial_pct"] == 0.0, ahorro


def test_cociente_sin_poblacion_no_disponible():
    """Sin población > 0 el cociente no existe: motivo claro, sin ahorro."""
    salida = analizar_desde_payload({
        "bloque_id": "edificacion-test",
        "registros": serie_36_meses(),
    })
    coc = salida["modelos"]["cociente"]
    assert coc["estado"] == "no_disponible"
    assert "población" in coc["motivo"], coc["motivo"]
    assert coc["ahorro"] is None
    assert coc["lben_mensual"] == [None] * 12


def test_regresion_disponible():
    """Regresión viable: R² > 0,9, MAPE ≤ 5 % y p-value < 0,05 (§7.5.3)."""
    salida = analizar_desde_payload({
        "bloque_id": "edificacion-regresion",
        "registros": serie_regresion(),
    })
    assert salida["depurados"] == 36, salida["depurados"]
    reg = salida["modelos"]["regresion"]
    assert reg["estado"] == "disponible", reg
    assert reg["motivo"] is None
    assert reg["n"] == 36
    assert all(v is not None for v in reg["lben_mensual"]), reg["lben_mensual"]

    validacion = reg["validacion"]
    assert validacion["r2"] is not None and validacion["r2"] > 0.9, validacion
    assert validacion["mape"] is not None and validacion["mape"] <= 5.0, validacion
    assert validacion["p_value_max"] is not None, validacion
    assert validacion["p_value_max"] < 0.05, validacion

    # §8.1 ec. 10-11: la recta de mejores desempeños da ahorro positivo.
    ahorro = reg["ahorro"]
    assert ahorro is not None, reg.get("nota")
    assert len(ahorro["por_mes"]) == 12
    assert ahorro["potencial_mensual"] > 0, ahorro
    assert ahorro["potencial_pct"] > 0, ahorro
    for fila in ahorro["por_mes"]:
        assert fila["potencial"] >= 0, fila                 # convenio ≥ 0
        assert fila["potencial_pct"] >= 0, fila


def test_regresion_no_disponible_por_datos_insuficientes():
    """2 atípicos depurados ⇒ 34 < 36: la regresión queda fuera con motivo."""
    salida = analizar_desde_payload({
        "bloque_id": "edificacion-test",
        "registros": serie_36_meses(),
    })
    assert salida["depurados"] == 34, salida["depurados"]
    reg = salida["modelos"]["regresion"]
    assert reg["estado"] == "no_disponible"
    assert "34" in reg["motivo"] and "36" in reg["motivo"], reg["motivo"]
    assert reg["ahorro"] is None
    assert reg["nota"] is None


def test_ingenieria_no_disponible_y_confort_sin_ahorro():
    """§7.4.4 siempre fuera de alcance; confort sin §8.1 (documentado)."""
    salida = analizar_desde_payload({
        "bloque_id": "edificacion-test",
        "registros": serie_36_meses(),
    })
    modelos = salida["modelos"]

    ingenieria = modelos["ingenieria"]
    assert ingenieria["estado"] == "no_disponible"
    assert "7.4.4" in ingenieria["motivo"], ingenieria["motivo"]

    confort = modelos["confort"]
    assert confort["estado"] == "disponible"
    assert confort["ahorro"] is None
    assert confort["nota"] is not None and "§8.1" in confort["nota"]
    # Consumo base medio sin estacionalidad: los 12 meses idénticos.
    assert len(set(confort["lben_mensual"])) == 1, confort["lben_mensual"]
    assert confort["validacion"]["n"] == 34


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
        test_modelos_seccion_uniforme,
        test_valor_absoluto_golden_anexo_1,
        test_cociente_disponible,
        test_cociente_sin_poblacion_no_disponible,
        test_regresion_disponible,
        test_regresion_no_disponible_por_datos_insuficientes,
        test_ingenieria_no_disponible_y_confort_sin_ahorro,
    ]
    for prueba in pruebas:
        prueba()
        print(f"  ✔ {prueba.__name__}")
    print(f"\n✅ {len(pruebas)} pruebas del modo análisis pasaron.")


if __name__ == "__main__":
    main()

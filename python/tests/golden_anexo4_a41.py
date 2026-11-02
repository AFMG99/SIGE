#!/usr/bin/env python3
"""
Golden test for Anexo 4 A4.1 (Valor Absoluto).

Data: 36 months (3 years) from Anexo 4 table.
Anomalous months: May-Sep of year 2 (meses 5-9, ano=2) with ~25% reduction.

Expected results (from Anexo 4):
- Sin ajuste: ahorro promedio ~9.35%
- Con ajuste: ahorro promedio ~4.2%

The adjustment procedure (A4.1 steps):
1. Promedio meses normales del año 2 (excluyendo may-sep)
2. Promedio meses anómalos del año 2 (may-sep)
3. Diferencia = normal - anomalo
4. Proporción = diferencia / normal
5. Ajustar mismos meses de años 1 y 3 con esa proporción: ×(1 − Pr).
   Los meses anómalos del año 2 NO se modifican: son la referencia de Pr.

Fuente: Resolución UPME 0016 de 2024, A4.1 paso 5 / A4.2 paso 5
("Se ajustan los valores de los mismos meses de los años 1 y 3 con esta
proporción") y docs/modelos_lben_y_formulas_ahorro-v2.md:338 ("Los consumos
de los meses homólogos en los demás años del período base se multiplican por
(1 − Pr) para recalcular los límites y evitar la sobreestimación del ahorro").
"""

import json
import statistics
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'python'))

from lben.bandas import depurar_con_bandas
from lben.modelos.valor_absoluto import ModeloValorAbsoluto


def load_fixture(path):
    with open(path, 'r') as f:
        return json.load(f)


def test_anexo4_a41():
    print("=== Golden Test Anexo 4 A4.1 (Valor Absoluto) ===\n")
    
    # Load fixture
    fixture = load_fixture(os.path.join(os.path.dirname(__file__), 'fixtures', 'anexo4_a41.json'))
    # Format expected by lben: { bloque_id: [registros...] }
    data = {"bloque_test": fixture}
    
    print(f"Registros cargados: {len(fixture)}")
    
    # 1. Test sin ajustes (baseline)
    print("\n--- SIN AJUSTES ---")
    (
        df_limpio_sin,
        bandas_sin,
        criterio_sin,
        sigma_sin,
        aplicados_sin,
        ajustado_sin,
    ) = depurar_con_bandas(data)

    print(f"Criterio: {criterio_sin}")
    print(f"Registros depurados: {len(df_limpio_sin)}")
    print(f"Descartados totales: {sum(b['descartados'] for b in bandas_sin)}")
    print(f"Ajustes aplicados: {len(aplicados_sin)}")
    print(f"DesvEst pre-descarte (σ): {sigma_sin}")
    print(f"Post-ajuste/pre-descarte (ajustado): {len(ajustado_sin)} registros")

    # ── Golden: depuración sin ajustes (±10 %, ec. 3; sin rescate) ──
    assert criterio_sin == 'banda_10_pct', criterio_sin
    assert len(ajustado_sin) == 36, len(ajustado_sin)
    assert len(df_limpio_sin) == 28, len(df_limpio_sin)
    assert sum(b['descartados'] for b in bandas_sin) == 8
    assert sigma_sin is not None and abs(sigma_sin - 984.8154) < 0.001, sigma_sin

    # Modelo Valor Absoluto
    modelo_sin = ModeloValorAbsoluto(
        "Valor Absoluto", df_limpio_sin, desvio_todos=sigma_sin
    )
    resultado_sin = modelo_sin.ajustar()

    print(f"\nResultado sin ajuste:")
    print(f"  R²: {resultado_sin['r2']}")
    print(f"  MAPE: {resultado_sin['mape']}%")
    print(f"  LBEn mensual: {[round(v, 1) if v else None for v in resultado_sin['lben_mensual']]}")

    # ── Golden: D1 — IC nulo con 3 valores por mes (n < 10 por mes) ──
    assert resultado_sin['intervalo_confianza'] is None, resultado_sin['intervalo_confianza']
    # La DesvEst reportada (§9.2) es la provista por la depuración
    assert resultado_sin['desvio_estandar'] == round(sigma_sin, 4)
    
    # 2. Test CON ajustes (Anexo 4: may-sep año 2, -25%)
    print("\n--- CON AJUSTE ANEXO 4 (may-sep año 2, -25%) ---")
    ajustes = [{
        "periodo_inicio": "2-05",
        "periodo_fin": "2-09",
        "proporcion": 0.25,
        "direccion": "reduccion",
        "descripcion": "Remodelación piso - AC apagado may-sep año 2"
    }]
    
    (
        df_limpio_con,
        bandas_con,
        criterio_con,
        sigma_con,
        aplicados_con,
        ajustado_con,
    ) = depurar_con_bandas(data, ajustes)

    print(f"Criterio: {criterio_con}")
    print(f"Registros depurados: {len(df_limpio_con)}")
    print(f"Descartados totales: {sum(b['descartados'] for b in bandas_con)}")
    print(f"Ajustes aplicados: {len(aplicados_con)}")
    print(f"DesvEst pre-descarte (σ): {sigma_con}")
    for a in aplicados_con:
        print(f"  Año {a['ano']}, Mes {a['mes']}: prop={a['proporcion']:.4f}, dir={a['direccion']}")

    modelo_con = ModeloValorAbsoluto(
        "Valor Absoluto", df_limpio_con, desvio_todos=sigma_con
    )
    resultado_con = modelo_con.ajustar()
    
    print(f"\nResultado con ajuste:")
    print(f"  R²: {resultado_con['r2']}")
    print(f"  MAPE: {resultado_con['mape']}%")
    print(f"  LBEn mensual: {[round(v, 1) if v else None for v in resultado_con['lben_mensual']]}")
    print(f"  Ajustes aplicados: {resultado_con.get('ajustes_aplicados', [])}")

    # ── Golden: con ajustes, la serie sobrevive completa ──
    assert criterio_con == 'banda_10_pct', criterio_con
    assert len(ajustado_con) == 36, len(ajustado_con)
    assert len(df_limpio_con) == 36, len(df_limpio_con)
    assert sum(b['descartados'] for b in bandas_con) == 0
    assert resultado_con['desvio_estandar'] == round(sigma_con, 4)
    # D1: sigue sin haber IC (3 valores por mes < 10)
    assert resultado_con['intervalo_confianza'] is None
    # Los meses 5-9 cambian su LBEn_m (se tocan los homólogos, no los anómalos)
    for m in range(5, 10):
        assert resultado_con['lben_mensual'][m - 1] != resultado_sin['lben_mensual'][m - 1], (
            f"mes {m}: LBEn_m no cambió con el ajuste"
        )
    # ... y el resto de la serie queda idéntico al cálculo sin ajustes
    for m in (1, 2, 3, 4, 10, 11, 12):
        assert resultado_con['lben_mensual'][m - 1] == resultado_sin['lben_mensual'][m - 1], (
            f"mes {m}: LBEn_m cambió sin ser mes homólogo"
        )

    # ── Golden A4.1: el ajuste va a los meses homólogos de los DEMÁS años ──
    ANO_ANOMALO = 2
    MESES_ANOMALOS = {5, 6, 7, 8, 9}
    PROP = 0.25

    assert len(aplicados_con) == 10, len(aplicados_con)

    ajustado_idx = {
        (int(r.ano), int(r.mes)): float(r.consumo_normalizado)
        for r in ajustado_con.itertuples()
    }
    sin_idx = {
        (int(r.ano), int(r.mes)): float(r.consumo_normalizado)
        for r in ajustado_sin.itertuples()
    }
    assert set(ajustado_idx) == set(sin_idx)

    # 1. El periodo registrado es la referencia de Pr y queda intacto
    for mes in sorted(MESES_ANOMALOS):
        assert ajustado_idx[(ANO_ANOMALO, mes)] == sin_idx[(ANO_ANOMALO, mes)], (
            f"año {ANO_ANOMALO} mes {mes}: los meses anómalos no se modifican "
            f"({ajustado_idx[(ANO_ANOMALO, mes)]} != {sin_idx[(ANO_ANOMALO, mes)]})"
        )

    # 2. Los meses homólogos de los demás años se multiplican por (1 − Pr)
    for ano in (1, 3):
        for mes in sorted(MESES_ANOMALOS):
            esperado = round(sin_idx[(ano, mes)] * (1 - PROP), 4)
            assert ajustado_idx[(ano, mes)] == esperado, (
                f"año {ano} mes {mes}: esperado {esperado} (= {sin_idx[(ano, mes)]} × 0.75), "
                f"obtenido {ajustado_idx[(ano, mes)]}"
            )

    # 3. El resto de la serie no cambia
    for clave, original in sin_idx.items():
        if clave[0] == ANO_ANOMALO or clave[1] not in MESES_ANOMALOS:
            assert ajustado_idx[clave] == original, (clave, original, ajustado_idx[clave])

    # 4. `aplicados` reporta los meses homólogos ajustados (años 1 y 3)
    for a in aplicados_con:
        assert a['ano'] in (1, 3), f"Año {a['ano']} no esperado"
        assert a['mes'] in MESES_ANOMALOS, f"Mes {a['mes']} no esperado"
        assert abs(a['proporcion'] - PROP) < 0.001, f"prop {a['proporcion']}"
        assert a['direccion'] == 'reduccion', f"dir {a['direccion']}"

    # 5. Oráculo independiente de la σ (§9.2, ec. 5 ÷N): la regla A4.1
    #    escrita a mano sobre la serie SIN ajustes, sin pasar por bandas.py.
    valores_oraculo = []
    for r in ajustado_sin.itertuples():
        valor = float(r.consumo_normalizado)
        if int(r.ano) != ANO_ANOMALO and int(r.mes) in MESES_ANOMALOS:
            valor = round(valor * (1 - PROP), 4)
        valores_oraculo.append(valor)
    sigma_oraculo = statistics.pstdev(valores_oraculo)
    assert sigma_con is not None and abs(sigma_con - sigma_oraculo) < 1e-6, (
        sigma_con,
        sigma_oraculo,
    )

    print("\n✅ Ajuste aplicado a los meses homólogos (5-9) de los años 1 y 3")

    print("\n=== RESUMEN GOLDEN TEST ===")
    print(f"✅ Criterio único: banda_10_pct (sin rescate ic_2sigma)")
    print(f"✅ Ajustes aplicados: {len(aplicados_con)} (meses 5-9 de los años 1 y 3)")
    print(f"✅ Proporción: 25% (0.25) → meses homólogos × (1 − Pr) = ×0.75")
    print(f"✅ Dirección: reduccion (los meses anómalos del año 2 quedan intactos)")
    print(f"✅ σ post-ajuste/pre-descarte: {sigma_con} (oráculo {sigma_oraculo})")
    print(f"✅ Criterio de banda: banda_10_pct (sin rescate ic_2sigma)")
    
    # The exact 9.35% → 4.2% requires Anexo 1 savings formula which is not
    # implemented in this test. But the adjustment mechanism is verified.
    
    return True


if __name__ == "__main__":
    try:
        test_anexo4_a41()
        print("\n🎉 GOLDEN TEST PASSED")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ GOLDEN TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
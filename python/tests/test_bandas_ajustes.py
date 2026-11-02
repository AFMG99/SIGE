import os
import sys

import pandas as pd
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from lben.bandas import _aplicar_ajustes_no_rutinarios


@pytest.fixture
def serie():
    return pd.DataFrame([
        {"ano": 2022, "mes": 5, "consumo_normalizado": 100.0},
        {"ano": 2023, "mes": 5, "consumo_normalizado": 100.0},
    ])


@pytest.mark.parametrize(
    "ajuste",
    [
        {"direccion": "desconocida", "proporcion": 0.25},
        {"direccion": "reduccion", "proporcion": 0},
        {"direccion": "reduccion", "proporcion": -0.25},
        {"direccion": "reduccion", "proporcion": 1.01},
        {"direccion": "reduccion", "proporcion": float("nan")},
        {"direccion": "reduccion", "proporcion": float("inf")},
        {"direccion": "reduccion", "proporcion": 0.25, "periodo_inicio": "2023-13"},
    ],
)
def test_omite_ajustes_con_datos_invalidos(serie, ajuste):
    datos = {
        "periodo_inicio": "2023-05",
        "periodo_fin": "2023-05",
        "proporcion": 0.25,
        "direccion": "reduccion",
        **ajuste,
    }

    resultado, aplicados = _aplicar_ajustes_no_rutinarios(serie, [datos])

    pd.testing.assert_frame_equal(resultado, serie)
    assert aplicados == []


def test_acepta_reduccion_del_cien_por_ciento(serie):
    ajuste = {
        "periodo_inicio": "2023-05",
        "periodo_fin": "2023-05",
        "proporcion": 1,
        "direccion": "reduccion",
    }

    resultado, aplicados = _aplicar_ajustes_no_rutinarios(serie, [ajuste])

    assert resultado.loc[0, "consumo_normalizado"] == 0
    assert resultado.loc[1, "consumo_normalizado"] == 100
    assert len(aplicados) == 1

"""Armado del DataFrame (ec. 1), normalización a 30 días y validación de estructura."""

from __future__ import annotations

from typing import Any, Dict, List

import pandas as pd

from .exceptions import DataValidationError

class DataCleaner:
    """
    Limpieza de datos energéticos: normalización del consumo a 30 días
    (§7.5, ec. 1). La detección de atípicos vive en la depuración por banda
    de `depurar_datos` (±10 % de la ec. 3 por defecto; rescate con ec. 4-5
    si los depurados quedan por debajo de MIN_MESES_BASE), no aquí.
    """

    @staticmethod
    def normalizar_a_30_dias(
        consumo_kwh: float,
        dias_facturados: int,
    ) -> float:
        """
        Normalizar consumo a 30 días según fórmula UPME.

        Fórmula: Consumo Normalizado = (Consumo Registrado / Días del Periodo) × 30

        Parámetros:
        -----------
        consumo_kwh : float
            Consumo registrado en kWh.
        dias_facturados : int
            Número de días facturados.

        Retorna:
        --------
        float
            Consumo normalizado a 30 días.
        """
        if dias_facturados <= 0:
            raise DataValidationError("Los días facturados deben ser > 0")

        return round((consumo_kwh / dias_facturados) * 30, 4)

def _armar_df(data: Dict[str, List[Dict[str, Any]]]) -> pd.DataFrame:
    """
    DataFrame con el consumo normalizado a 30 días (ec. 1), sin consumos ≤ 0.

    Es la base sobre la que se construyen las bandas y sobre la que ajustan
    los cuatro modelos.
    """
    registros = []
    for bloque, lista_registros in data.items():
        for reg in lista_registros:
            registro = {
                "bloque": bloque,
                "mes": reg.get("mes", 0),
                "ano": reg.get("ano", 0),
                "consumo_kwh": reg.get("consumo_kwh", 0),
                "dias_facturados": reg.get("dias_facturados", 30),
                "poblacion_fija": reg.get("poblacion_fija", 0),
                "poblacion_flotante": reg.get("poblacion_flotante", 0),
                "grades_dia_enfriamiento": reg.get("gde", 0),
                "temperatura_promedio": reg.get("temperatura_promedio", 25.0),
            }
            registros.append(registro)

    df = pd.DataFrame(registros)
    if df.empty:
        raise DataValidationError("No hay datos para depurar")

    df["consumo_normalizado"] = df.apply(
        lambda row: DataCleaner.normalizar_a_30_dias(
            row["consumo_kwh"], row["dias_facturados"]
        ),
        axis=1,
    )
    df = df[df["consumo_normalizado"] > 0]
    if df.empty:
        raise DataValidationError("No hay consumos mayores que cero para depurar")
    return df

def validar_estructura_datos(data: dict) -> bool:
    """
    Validar que el diccionario de datos tenga la estructura mínima requerida.

    Parámetros:
    -----------
    data : dict
        Diccionario de datos a validar.

    Retorna:
    --------
    bool
        True si la estructura es válida, False en caso contrario.
    """
    required_keys = ["consumo_kwh", "mes", "ano"]
    if not isinstance(data, dict):
        return False

    # Verificar que hay al menos algunos registros
    for key in required_keys:
        if key not in data:
            return False

    return True

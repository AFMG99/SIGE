"""Modelo 2: cociente de valores medidos (§7.5.2, ec. 6-7)."""

from __future__ import annotations

import logging
from typing import Any, Dict

import numpy as np
import pandas as pd

from ..bandas import _banda_de_grupo, _sigma_poblacional
from ..constants import MIN_DATOS_IC
from ..exceptions import DataValidationError
from .base import ModeloLBEn

logger = logging.getLogger(__name__)

class ModeloCociente(ModeloLBEn):
    """
    Modelo 2: Cociente de valores medidos (§7.5.2, ec. 6-7)
    cociente_i = consumo_normalizado_i / variable_i (ec. 1 en el numerador);
    la LBEn de cada mes es el promedio simple de los cocientes de ese mes →
    12 valores (kWh/persona·mes, etc.). Depura SU propia base: por mes,
    ec. 4-5 con n ≥ 10 en el mes (D1); si no, ±10 % de la ec. 7, con
    descarte y recomputo.
    """

    def __init__(
        self,
        datos_limpiados: pd.DataFrame,
        variable_relevante: str = "area_util",
        unidad_referencia: str = "m2",
    ):
        super().__init__("Cociente", datos_limpiados)
        self.variable_relevante = variable_relevante
        self.unidad_referencia = unidad_referencia
        self.cociente_mensual: Dict[int, float] = {}

    def ajustar(self) -> Dict[str, Any]:
        """
        Ajustar el modelo de cociente.

        Retorna:
        --------
        Dict con estadísticos del modelo.
        """
        logger.info(f"Ajustando Modelo Cociente ({self.nombre})")

        # Verificar que la variable existe
        if self.variable_relevante not in self.datos.columns:
            raise DataValidationError(
                f"Variable '{self.variable_relevante}' no encontrada en los datos"
            )

        datos = self.datos[self.datos[self.variable_relevante] != 0].copy()
        if datos.empty:
            raise DataValidationError("El valor de la variable referencia es 0")

        # Cociente individual por registro (ec. 6; energía ec. 1, mes i)
        datos["cociente"] = datos["consumo_normalizado"] / datos[self.variable_relevante]

        # BUG-3: DesvEst reportada (§9.3) = σ poblacional de TODOS los
        # cocientes utilizados (pre-descarte, ec. 5 con n ≥ MIN_DATOS_IC).
        desvio_cocientes = _sigma_poblacional(datos["cociente"])

        # Banda sobre los cocientes de cada mes (D1: ec. 4-5 con n ≥ 10 en
        # el mes, si no ec. 7: ±10 %) + recomputo
        conservar = pd.Series(True, index=datos.index)
        cociente_mensual: Dict[int, float] = {}
        for mes in sorted(datos["mes"].unique()):
            idx = datos.index[datos["mes"] == mes]
            grupo = datos.loc[idx, "cociente"]
            banda, dentro = _banda_de_grupo(grupo, int(mes))
            conservar.loc[idx] = dentro
            cociente_mensual[int(mes)] = banda["media"]
        datos = datos[conservar]

        # Predicciones: variable × cociente del mes de cada registro
        reales = datos["consumo_normalizado"].astype(float).values
        pred = (
            datos[self.variable_relevante].astype(float)
            * datos["mes"].astype(int).map(cociente_mensual).astype(float)
        ).values

        sst = float(np.sum((reales - reales.mean()) ** 2))
        sse = float(np.sum((reales - pred) ** 2))
        self.r2 = round(1 - sse / sst, 4) if sst > 0 else 1.0
        self.mape = round(float(np.mean(np.abs((reales - pred) / reales))) * 100, 2)

        var_ref = float(datos[self.variable_relevante].mean())
        consumo_promedio = float(datos["consumo_normalizado"].mean())
        cociente_global = round(
            float(np.mean(list(cociente_mensual.values()))), 6
        )
        self.cociente_mensual = cociente_mensual

        self.coeficientes = {
            "cociente": cociente_global,
            "variable_referencia_promedio": var_ref,
        }

        resultado = {
            "tipo": "COCIENTE",
            "consumo_promedio": consumo_promedio,
            "variable_referencia_promedio": var_ref,
            "cociente_estimado": cociente_global,
            "cociente_mensual": [
                round(cociente_mensual[m], 6) if m in cociente_mensual else None
                for m in range(1, 13)
            ],
            "unidad": self.unidad_referencia,
            "r2": self.r2,
            "mape": self.mape,
            "desvio_estandar": (
                round(desvio_cocientes, 4) if desvio_cocientes is not None else None
            ),
            "observaciones": (
                f"Cociente mensual: promedio de {len(datos)} cocientes "
                f"individuales (ec. 6); depura su propia base por banda "
                f"mensual (ec. 4-5 con n ≥ {MIN_DATOS_IC} en el mes, si no ec. 7)"
            ),
        }

        logger.info(f"Modelo Cociente ajustado: R²={self.r2}, MAPE={self.mape}%")
        return resultado

    def predecir(self, datos_entrada: pd.DataFrame) -> np.ndarray:
        """Predecir con el cociente del mes: variable × cociente_m (ec. 6)."""
        if not self.cociente_mensual:
            raise ValueError("Modelo no ajustado aún")

        meses = datos_entrada["mes"].astype(int)
        cociente = meses.map(self.cociente_mensual)
        variable = datos_entrada[self.variable_relevante].astype(float)
        return np.round((variable * cociente).astype(float).values, 4)

"""Modelo 1: valor absoluto (§7.5.1, ec. 2)."""

from __future__ import annotations

import logging
from typing import Any, Dict

import numpy as np
import pandas as pd

from ..constants import CONFIANZA_INTERVALO, K_INTERVALO, MIN_DATOS_IC
from .base import ModeloLBEn

logger = logging.getLogger(__name__)

class ModeloValorAbsoluto(ModeloLBEn):
    """
    Modelo 1: Valor Absoluto (§7.5.1, ec. 2)
    LBEn = promedio simple de los consumos normalizados de cada mes calendario
    → 12 valores, uno por mes del año. El periodo base se recomienda con 3 años
    (§7.1-7.2).
    """

    def __init__(self, nombre: str, datos_limpiados: pd.DataFrame):
        super().__init__(nombre, datos_limpiados)
        self.lben_mensual: Dict[int, float] = {}

    def _lben_mensual(self) -> Dict[int, float]:
        """LBEn_m por mes calendario (ec. 2): media simple de los registros."""
        medias = self.datos.groupby("mes")["consumo_kwh"].mean()
        return {int(m): float(v) for m, v in medias.items()}

    def ajustar(self) -> Dict[str, Any]:
        """
        Ajustar el modelo de valor absoluto.

        Retorna:
        --------
        Dict con estadísticos del modelo.
        """
        logger.info(f"Ajustando Modelo Valor Absoluto ({self.nombre})")

        # LBEn_m: 12 promedios simples, uno por mes calendario (ec. 2)
        self.lben_mensual = self._lben_mensual()
        lben_vals = list(self.lben_mensual.values())

        consumo_promedio = float(self.datos["consumo_kwh"].mean())
        consumo_mediana = float(self.datos["consumo_kwh"].median())
        # DesvEst de la ec. 5: población (÷N), §9.2 reporta la de todos los
        # datos utilizados.
        desvio_poblacional = float(self.datos["consumo_kwh"].std(ddof=0))

        # Predicción fila a fila: la LBEn del mes de cada registro
        reales = self.datos["consumo_kwh"].astype(float).values
        pred = (
            self.datos["mes"].astype(int).map(self.lben_mensual).astype(float).values
        )

        # R² real (1 − SSE/SST). §7.5.3 no fija tope: un R² bajo no invalida.
        sst = float(np.sum((reales - reales.mean()) ** 2))
        sse = float(np.sum((reales - pred) ** 2))
        self.r2 = round(1 - sse / sst, 4) if sst > 0 else 1.0
        self.mape = round(float(np.mean(np.abs((reales - pred) / pred))) * 100, 2)

        # Envolvente informativa de las 12 bandas ±10 % (la banda real es por mes)
        rango_inferior = round(min(lben_vals) * (1 - CONFIANZA_INTERVALO), 4)
        rango_superior = round(max(lben_vals) * (1 + CONFIANZA_INTERVALO), 4)

        # Intervalo de confianza ec. 4: envolvente de las 12 LBEn_m con el
        # ancho k·DesvEst. Con N < 10 la ec. 4-5 no aplica → null.
        intervalo_confianza = None
        if len(self.datos) >= MIN_DATOS_IC:
            ancho_ic = K_INTERVALO * desvio_poblacional
            intervalo_confianza = [
                round(min(lben_vals) - ancho_ic, 4),
                round(max(lben_vals) + ancho_ic, 4),
            ]

        self.coeficientes = {
            "intercepto": round(consumo_promedio, 4),
        }

        resultado = {
            "tipo": "VALOR_ABSOLUTO",
            "consumo_promedio_mensual": round(consumo_promedio, 4),
            "consumo_mediana": round(consumo_mediana, 4),
            "desvio_estandar": round(desvio_poblacional, 4),
            "lben_mensual": [
                round(self.lben_mensual[m], 4) if m in self.lben_mensual else None
                for m in range(1, 13)
            ],
            "rango_confianza_10_pct": [rango_inferior, rango_superior],
            "intervalo_confianza": intervalo_confianza,
            "coeficientes": self.coeficientes,
            "r2": self.r2,
            "mape": self.mape,
            "observaciones": (
                f"LBEn mensual (12 meses, ec. 2) sobre {len(self.datos)} "
                f"registros del periodo base"
            ),
        }

        logger.info(f"Modelo Valor Absoluto ajustado: R²={self.r2}, MAPE={self.mape}%")
        return resultado

    def predecir(self, datos_entrada: pd.DataFrame) -> np.ndarray:
        """Predecir con la LBEn del mes calendario de cada registro (ec. 2)."""
        lben = self.lben_mensual or self._lben_mensual()
        pred = datos_entrada["mes"].astype(int).map(lben)
        return np.round(
            pred.fillna(self.datos["consumo_kwh"].mean()).astype(float).values, 4
        )

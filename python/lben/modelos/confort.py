"""Indicador complementario de confort térmico ASHRAE 55."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd

from .base import ModeloLBEn

logger = logging.getLogger(__name__)

class ModeloConfortThermal(ModeloLBEn):
    """
    Indicador complementario: confort térmico ASHRAE 55.

    No es uno de los cuatro modelos de la Resolución 16 de 2024 (valor
    absoluto, cociente, estadístico y de ingeniería): es un control de
    operación sobre el rango de confort adaptativo de Medellín (20.2 °C -
    27.6 °C, límite del 80 % de aceptabilidad) de la Tabla 1 del resumen
    ejecutivo CEELA/UPME, con estimación de energía virtual.
    """

    def __init__(
        self,
        datos_limpiados: pd.DataFrame,
        temperatura_promedio: float,
        datos_confort: Optional[pd.DataFrame] = None,
    ):
        super().__init__("Confort_Termal", datos_limpiados)
        self.temperatura_promedio = temperatura_promedio
        self.datos_confort = datos_confort

    def _validar_rango_confort(
        self, temperatura: float
    ) -> bool:
        """
        Validar si la temperatura está en el rango de confort adaptativo
        para Medellín según ASHRAE 55: 20.2°C - 27.6°C (Tabla 1 del resumen
        ejecutivo CEELA/UPME, límite del 80 % de aceptabilidad).

        Parámetros:
        -----------
        temperatura : float
            Temperatura en grados Celsius.

        Retorna:
        --------
        bool
            True si está en rango de confort.
        """
        return 20.2 <= temperatura <= 27.6

    def estimar_energia_virtual(
        self, consumo_base: float, delta_t: float
    ) -> float:
        """
        Estimar energía virtual basándose en desviación de temperatura
        del rango de confort adaptativo.

        Parámetros:
        -----------
        consumo_base : float
            Consumo base en kWh.
        delta_t : float
            Diferencia de temperatura (°C) respecto al rango medio.

        Retorna:
        --------
        float
            Energía virtual ajustada en kWh.
        """
        # Heurística propia del sistema (no es una fórmula de la Resolución):
        # kWh por °C por mes, aproximación para sistemas HVAC en edificios
        # universitarios.
        factor_calor = 15.0

        # Ajuste: si está por encima del rango, incrementar consumo enfriamiento
        # si está por debajo, incrementar consumo calefacción
        ajuste = delta_t * factor_calor

        energia_virtual = round(consumo_base + ajuste, 4)
        return energia_virtual

    def ajustar(self) -> Dict[str, Any]:
        """
        Ajustar el modelo de confort térmico.

        Retorna:
        --------
        Dict con estadísticos del modelo.
        """
        logger.info(f"Ajustando Modelo Confort Thermal ({self.nombre})")

        # Validar temperatura
        en_confort = self._validar_rango_confort(self.temperatura_promedio)

        # Consumo base (usar modelo valor absoluto o el que venga dado)
        # (BUG-1: la base de los modelos es la ec. 1, consumo_normalizado)
        consumo_base = self.datos["consumo_normalizado"].mean() if self.datos is not None else 0

        # Calcular delta temperatura respecto al punto medio del rango
        temp_medio = (20.2 + 27.6) / 2  # 23.9°C
        delta_t = self.temperatura_promedio - temp_medio

        # Energía virtual ajustada
        energia_virtual = self.estimar_energia_virtual(consumo_base, delta_t)

        # Determinar modo: calefacción (abaixo de 20.2) enfriamiento (arriba de 27.6)
        if self.temperatura_promedio < 20.2:
            modo = "CALEFACCION"
        elif self.temperatura_promedio > 27.6:
            modo = "ENFRIAMIENTO"
        else:
            modo = "CONFORT"

        resultado = {
            "tipo": "CONFORT_THERMAL",
            "temperatura_promedio": self.temperatura_promedio,
            "en_rango_confort": en_confort,
            "modo_operacion": modo,
            "consumo_base_kwh": consumo_base,
            "energia_virtual_kwh": energia_virtual,
            "delta_temperatura": round(delta_t, 2),
            "observaciones": f"Rango confort ASHRAE 55 Medellín: 20.2°C - 27.6°C",
        }

        logger.info(
            f"Modelo Confort Thermal: {modo}, Energía virtual: {energia_virtual} kWh"
        )
        return resultado

    def predecir(self, datos_entrada: pd.DataFrame) -> np.ndarray:
        """Predecir ajustando consumo por desviación térmica."""
        if self.datos_confort is not None and len(self.datos_confort) > 0:
            # Lógica compleja omitted por simplicidad
            pass

            # Ajuste simple basado en la desviación
            factor = 0.1  # 10% por desviación estándar
            delta = self.temperatura_promedio - 23.9  # Punto medio
            ajuste = delta * factor
            consumos = self.datos["consumo_normalizado"].values
            return np.round(consumos * (1 + ajuste), 4)

        return np.full(len(datos_entrada), self.datos["consumo_normalizado"].mean())

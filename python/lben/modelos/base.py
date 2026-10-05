"""Clase base de los modelos LBEn."""

from __future__ import annotations

from typing import Any, Dict, Optional

import numpy as np
import pandas as pd

class ModeloLBEn:
    """
    Clase base para los modelos de Línea Base Energética.
    """

    def __init__(self, nombre: str, datos_limpiados: pd.DataFrame):
        self.nombre = nombre
        self.datos = datos_limpiados
        self.coeficientes: Optional[Dict[str, float]] = None
        self.r2: Optional[float] = None
        self.p_values: Optional[Dict[str, float]] = None
        self.mape: Optional[float] = None
        self.modelo_estadistico: Optional[Any] = None

    def ajustar(self) -> None:
        """Método abstracto para ajustar el modelo."""
        raise NotImplementedError("Subclases deben implementar este método")

    def predecir(self, datos_entrada: pd.DataFrame) -> np.ndarray:
        """Método abstracto para hacer predicciones."""
        raise NotImplementedError("Subclases deben implementar este método")

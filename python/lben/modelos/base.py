"""Clase base de los modelos LBEn."""

from __future__ import annotations

from typing import Any, Dict, Optional

import numpy as np
import pandas as pd

class ModeloLBEn:
    """
    Clase base para los modelos de Línea Base Energética.
    """

    def __init__(
        self,
        nombre: str,
        datos_limpiados: pd.DataFrame,
        desvio_todos: Optional[float] = None,
    ):
        self.nombre = nombre
        self.datos = datos_limpiados
        # DesvEst reportada (§9.2-9.4): σ poblacional de TODOS los datos
        # utilizados (post-ajuste, pre-descarte), provista por la depuración.
        self.desvio_todos = desvio_todos
        self.coeficientes: Optional[Dict[str, float]] = None
        self.r2: Optional[float] = None
        self.p_values: Optional[Dict[str, float]] = None
        self.mape: Optional[float] = None
        self.modelo_estadistico: Optional[Any] = None

    def _desvio_reportado(self, columna: str = "consumo_normalizado") -> float:
        """
        DesvEst de la ec. 5 (poblacional, ÷N) para los resultados del modelo.

        Usa la σ provista por la depuración (post-ajuste, pre-descarte,
        §9.2); si el caller no la provée (tests unitarios), la calcula
        sobre los datos propios del modelo.
        """
        if self.desvio_todos is not None:
            return float(self.desvio_todos)
        return float(self.datos[columna].std(ddof=0))

    def ajustar(self) -> None:
        """Método abstracto para ajustar el modelo."""
        raise NotImplementedError("Subclases deben implementar este método")

    def predecir(self, datos_entrada: pd.DataFrame) -> np.ndarray:
        """Método abstracto para hacer predicciones."""
        raise NotImplementedError("Subclases deben implementar este método")

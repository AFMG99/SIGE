"""Modelo 3: regresión estadística con selección de variables (§7.5.3)."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import statsmodels.api as sm
from statsmodels.stats.outliers_influence import variance_inflation_factor

from ..constants import MAPE_MAXIMO, UMbral_P_VALUE
from ..exceptions import ModelSelectionError
from .base import ModeloLBEn

logger = logging.getLogger(__name__)

class ModeloRegresion(ModeloLBEn):
    """
    Modelo 3: Regresión Lineal Simple y Multivariable con statsmodels.
    Y (consumo_normalizado, ec. 1) = β0 + β1*(Población) + β2*(GDE) + ...
    Filtrado de variables: Si p-value > 0.05, descartar variable y re-correr
    (§7.5.3). Retorna coeficientes, R², p-values y error promedio; el umbral
    de MAPE ≤ 5 % es de confiabilidad (ejemplo del Anexo 3), no una cláusula,
    y la Resolución no fija tope de R².
    """

    def __init__(
        self,
        datos_limpiados: pd.DataFrame,
        variables_explicativas: List[str],
        desvio_todos: Optional[float] = None,
    ):
        super().__init__("Regresión", datos_limpiados, desvio_todos)
        self.variables_explicativas = variables_explicativas
        self.modelo_ols: Optional[sm.regression.linear_model.OLSResults] = None

    def _verificar_multicolinealidad(
        self, X: pd.DataFrame
    ) -> Tuple[pd.DataFrame, bool]:
        """
        Verificar y manejarmulticolinealidad usando VIF (Variance Inflation Factor).

        Retorna:
        --------
        Tuple[pd.DataFrame, bool]
            DataFrame limpio y bandera de si haymulticolinealidad (> 5).
        """
        vif_data = pd.DataFrame()
        vif_data["variable"] = X.columns
        vif_data["factor_vif"] = [
            variance_inflation_factor(X.values, i) for i in range(X.shape[1])
        ]
        vif_promedio = vif_data["factor_vif"].mean()
        hay_multicolinealidad = vif_promedio > 5

        if hay_multicolinealidad:
            logger.warning(f"Multicolinealidad detectada (VIF promedio: {vif_promedio:.2f})")
            # Quitar la variable con VIF más alto iterativamente
            while True:
                max_vif = vif_data["factor_vif"].max()
                if max_vif <= 5:
                    break
                var_max = vif_data.loc[vif_data["factor_vif"].idxmax(), "variable"]
                logger.info(f"Eliminando variable con altamulticolinealidad: {var_max}")
                X = X.drop(columns=[var_max])
                if X.shape[1] == 0:
                    break
                vif_data = pd.DataFrame()
                vif_data["variable"] = X.columns
                vif_data["factor_vif"] = [
                    variance_inflation_factor(X.values, i) for i in range(X.shape[1])
                ]
                vif_promedio = vif_data["factor_vif"].mean()

        return X, hay_multicolinealidad

    def ajustar(self) -> Dict[str, Any]:
        """
        Ajustar el modelo de regresión con selección de variables por p-value.

        Algoritmo:
        1. Incluir todas las variables explicativas
        2. Ejecutar regresión OLS
        3. Eliminar variables con p-value > 0.05
        4. Re-correr regresión con variables restantes
        5. Retornar resultados solo si MAPE ≤ 5 % (confiabilidad del ejemplo
           del Anexo 3; criterio del sistema, no cláusula de la Resolución)

        Retorna:
        --------
        Dict con estadísticos del modelo.
        """
        logger.info(f"Ajustando Modelo Regresión ({self.nombre})")

        # Preparar variable dependiente y independiente
        # (BUG-1: la Y de los modelos es la ec. 1, consumo_normalizado)
        y = self.datos["consumo_normalizado"]
        X = self.datos[self.variables_explicativas].copy()

        # Añadir constante
        X = sm.add_constant(X)

        # Verificarmulticolinealidad
        X_limpio, _ = self._verificar_multicolinealidad(X)

        # Bucle de eliminación backwards por p-value
        variables_actuales = list(X_limpio.columns)
        max_iteraciones = len(variables_actuales) + 1

        for iteracion in range(max_iteraciones):
            if len(variables_actuales) == 0:
                logger.error("No quedan variables para el modelo")
                break

            # Ajustar modelo con variables actuales
            try:
                self.modelo_ols = sm.OLS(y, X_limpio[variables_actuales]).fit()
            except Exception as e:
                logger.error(f"Error ajustando modelo: {e}")
                break

            # Verificar p-values
            p_values = self.modelo_ols.pvalues.drop("const")  # Excluir constante

            # Verificar si todas las variables tienen p-value < 0.05
            p_values_excedente = p_values[p_values > UMbral_P_VALUE]

            if p_values_excedente.empty:
                # Todas variables son significativas
                logger.info(
                    f"Todas las variables son significativas (iteración {iteracion + 1})"
                )
                break

            # Eliminar la variable con p-value más alto
            var_eliminar = p_values_excedente.idxmax()
            logger.info(
                f"Eliminando variable '{var_eliminar}' p-value={self.modelo_ols.pvalues[var_eliminar]:.4f}"
            )
            variables_actuales.remove(var_eliminar)

            # Si solo queda la constante, detener
            if len(variables_actuales) <= 1:
                logger.warning("Solo quedó la constante, deteniendo regresión")
                break

        # Si no quedó ninguna variable além de la constante, usar modelo de promedio
        if len(variables_actuales) <= 1 and "const" in variables_actuales:
            logger.warning("Usando modelo de promedio por falta de variables significativas")
            # Mover a modelo de valor absoluto
            raise ModelSelectionError("No se encontraron variables significativas")

        # Calcular estadísticos finales
        y_pred = self.modelo_ols.predict(X_limpio[variables_actuales])
        consumos_actuales = self.datos["consumo_normalizado"]

        # R²
        self.r2 = round(self.modelo_ols.rsquared, 4)

        # P-values
        self.p_values = {
            var: round(self.modelo_ols.pvalues[var], 4)
            for var in self.modelo_ols.params.index
            if var != "const"
        }

        # MAPE
        mape_valor = round(
            np.mean(np.abs((consumos_actuales - y_pred) / consumos_actuales)) * 100, 2
        )
        self.mape = mape_valor

        # Verificar restricción MAPE < 5%
        if self.mape > MAPE_MAXIMO * 100:
            logger.warning(
                f"MAPE ({self.mape}%) > umbral {MAPE_MAXIMO * 100}%, modelo no aceptado"
            )
            raise ModelSelectionError(
                f"MAPE {self.mape}% exceeds el umbral permitido {MAPE_MAXIMO * 100}%"
            )

        self.coeficientes = {
            var: round(self.modelo_ols.params[var], 4)
            for var in self.modelo_ols.params.index
            if var != "const"
        }

        # Grado de libertad y estadístico F
        n = len(y)
        k = len(variables_actuales)
        f_statistic = round(self.modelo_ols.fvalue, 4)

        resultado = {
            "tipo": "REGRESSION_ESTADISTICA",
            "variable_dependiente": "consumo_normalizado",
            "variables_explicativas_usadas": variables_actuales,
            "coeficientes": self.coeficientes,
            "r2": self.r2,
            "r2_ajustado": round(self.modelo_ols.rsquared_adj, 4),
            "p_values": self.p_values,
            "mape": self.mape,
            "f_statistic": f_statistic,
            "desvio_estandar": round(self._desvio_reportado(), 4),
            "observaciones": f"Modelo {self.nombre} con {len(variables_actuales)} variables significativas",
        }

        logger.info(
            f"Modelo Regresión ajustado: R²={self.r2}, MAPE={self.mape}%, "
            f"Variables: {len(variables_actuales)}"
        )
        return resultado

    def predecir(
        self, datos_entrada: pd.DataFrame
    ) -> np.ndarray:
        """Predecir usando el modelo de regresión ajustado."""
        if self.modelo_ols is None:
            raise ValueError("Modelo no ajustado aún")

        # Preparar datos de entrada
        X = datos_entrada.copy()
        X = sm.add_constant(X)

        # Asegurarse de que las columnas están en el orden correcto
        cols_esperadas = ["const"] + list(self.modelo_ols.params.index)
        # Filtrar solo columnas que el modelo espera
        X = X[[col for col in cols_esperadas if col in X.columns]]

        return np.round(self.modelo_ols.predict(X), 4)

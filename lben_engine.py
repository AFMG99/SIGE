"""
Módulo de Motor de Línea Base Energética (LBEn)
Proyecto: SIGE-TdeA - Resolución UPME 0016 de 2024
Autor: Data Scientist & Senior Next.js Developer
Fecha: 2026-09-29

Descripción:
Motor modular para el cálculo de Líneas Base Energéticas según la resolución
UPME 0016 de 2024. Implementa los cuatro modelos del sistema (valor absoluto,
cociente, regresión estadística y confort térmico) más la normalización de
datos para el monitoreo energético universitario.

Dependencias:
- pandas >= 1.5.0
- numpy >= 1.24.0
- statsmodels >= 0.14.0
- scipy >= 1.10.0
"""

from __future__ import annotations
import json
import logging
from typing import Dict, List, Optional, Tuple, Any

import numpy as np
import pandas as pd
from scipy import stats
import statsmodels.api as sm
from statsmodels.formula.api import ols
from statsmodels.stats.outliers_influence import variance_inflation_factor

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# Constantes del cálculo LBEn y su procedencia (Resolución UPME 0016 de 2024):
#   K_INTERVALO: factor k = 2 de la ec. 4 (LBEn_m ± k·DesvEst): intervalo de
#     confianza sugerido §7.5.1 con 10 o más datos. La imagen oficial de la
#     ec. 4 escribe «dos(2)·DesvEst»; la notación «k» es propia del código y
#     no aparece en la Resolución.
#   MIN_DATOS_IC: N mínimo para que la ec. 4-5 sea siquiera elegible
#     (§7.5.1: "con 10 o más datos"); es la guardia del rescate.
#   CONFIANZA_INTERVALO: banda ±10 % (ec. 3 / §7.5.2 ec. 7): criterio POR
#     DEFECTO de la depuración (con rescate ec. 4-5 si < MIN_MESES_BASE);
#     es también lo que aplican los ejemplos de los Anexos (36 datos).
#   UMbral_P_VALUE: significancia de variables al 95 % (§7.5.3).
#   MIN_MESES_BASE: recomendación §7.1-7.2 ("recomendable al menos 3 años de
#     datos"). Regla del sistema para GUARDAR y disparador del rescate ec. 4-5.
#   MIN_VALORES_POR_MES: sugerencia §7.5.1/§7.5.2 ("al menos tres valores del
#     mismo mes"). Meses con menos se calculan igual pero sin banda.
#   MAPE_MAXIMO: umbral de confiabilidad del ejemplo del Anexo 3 (no es una
#     cláusula de la resolución).
# No hay tope de R²: §7.5.3 establece que un R² bajo no invalida el modelo,
# porque la validez la define el p-value.
K_INTERVALO = 2  # ec. 4: LBEn_m ± k·DesvEst (intervalo de confianza)
MIN_DATOS_IC = 10  # §7.5.1: la ec. 4-5 se sugiere con N ≥ 10 (guardia rescate)
CONFIANZA_INTERVALO = 0.10  # ±10 % (ec. 3 / ec. 7): criterio por defecto
UMbral_P_VALUE = 0.05  # significancia al 95 % (§7.5.3)
MIN_MESES_BASE = 36  # recomendación §7.1-7.2; gate de guardado y disparo del rescate
MIN_VALORES_POR_MES = 3  # sugerencia §7.5.1/§7.5.2 (tres valores del mismo mes)
MAPE_MAXIMO = 0.05  # confiabilidad (ejemplo del Anexo 3)


class DataValidationError(Exception):
    """Excepción lanzada cuando los datos de entrada no pasan la validación."""
    pass


class ModelSelectionError(Exception):
    """Excepción lanzada cuando ningún modelo cumple los criterios de calidad."""
    pass


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


class ModeloCociente(ModeloLBEn):
    """
    Modelo 2: Cociente de valores medidos (§7.5.2, ec. 6-7)
    cociente_i = consumo_normalizado_i / variable_i (ec. 1 en el numerador);
    la LBEn de cada mes es el promedio simple de los cocientes de ese mes →
    12 valores (kWh/persona·mes, etc.). Depura SU propia base (ec. 4-5 con
    N ≥ 10; si no, ±10 % de la ec. 7) con descarte y recomputo.
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

        # Banda sobre los cocientes de cada mes (ec. 4-5 con N ≥ 10, si no
        # ec. 7: ±10 %) + recomputo
        sigma_cociente = (
            float(datos["cociente"].std(ddof=0))
            if len(datos) >= MIN_DATOS_IC
            else None
        )
        conservar = pd.Series(True, index=datos.index)
        cociente_mensual: Dict[int, float] = {}
        for mes in sorted(datos["mes"].unique()):
            idx = datos.index[datos["mes"] == mes]
            grupo = datos.loc[idx, "cociente"]
            banda, dentro = _banda_de_grupo(grupo, int(mes), sigma_cociente)
            conservar.loc[idx] = dentro
            cociente_mensual[int(mes)] = banda["media"]
        datos = datos[conservar]

        # Predicciones: variable × cociente del mes de cada registro
        reales = datos["consumo_kwh"].astype(float).values
        pred = (
            datos[self.variable_relevante].astype(float)
            * datos["mes"].astype(int).map(cociente_mensual).astype(float)
        ).values

        sst = float(np.sum((reales - reales.mean()) ** 2))
        sse = float(np.sum((reales - pred) ** 2))
        self.r2 = round(1 - sse / sst, 4) if sst > 0 else 1.0
        self.mape = round(float(np.mean(np.abs((reales - pred) / reales))) * 100, 2)

        var_ref = float(datos[self.variable_relevante].mean())
        consumo_promedio = float(datos["consumo_kwh"].mean())
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
            "desvio_estandar": round(float(datos["consumo_kwh"].std(ddof=0)), 4),
            "observaciones": (
                f"Cociente mensual: promedio de {len(datos)} cocientes "
                f"individuales (ec. 6); depura su propia base por banda "
                f"mensual (ec. 4-5 con N ≥ {MIN_DATOS_IC}, si no ec. 7)"
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


class ModeloRegresion(ModeloLBEn):
    """
    Modelo 3: Regresión Lineal Simple y Multivariable con statsmodels.
    Y (Consumo kWh) = β0 + β1*(Población) + β2*(GDE) + ...
    Filtrado de variables: Si p-value > 0.05, descartar variable y re-correr
    (§7.5.3). Retorna coeficientes, R², p-values y error promedio; el umbral
    de MAPE ≤ 5 % es de confiabilidad (ejemplo del Anexo 3), no una cláusula,
    y la Resolución no fija tope de R².
    """

    def __init__(
        self,
        datos_limpiados: pd.DataFrame,
        variables_explicativas: List[str],
    ):
        super().__init__("Regresión", datos_limpiados)
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
        y = self.datos["consumo_kwh"]
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
        consumos_actuales = self.datos["consumo_kwh"]

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
            "variable_dependiente": "consumo_kwh",
            "variables_explicativas_usadas": variables_actuales,
            "coeficientes": self.coeficientes,
            "r2": self.r2,
            "r2_ajustado": round(self.modelo_ols.rsquared_adj, 4),
            "p_values": self.p_values,
            "mape": self.mape,
            "f_statistic": f_statistic,
            "desvio_estandar": round(float(self.datos["consumo_kwh"].std(ddof=0)), 4),
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
        consumo_base = self.datos["consumo_kwh"].mean() if self.datos is not None else 0

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
            consumos = self.datos["consumo_kwh"].values
            return np.round(consumos * (1 + ajuste), 4)

        return np.full(len(datos_entrada), self.datos["consumo_kwh"].mean())


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


def _banda_de_grupo(
    grupo: pd.Series, mes: int, sigma: Optional[float] = None
) -> Tuple[Dict[str, Any], pd.Series]:
    """
    Banda de confianza de un mes calendario (§7.5.1).

    Con sigma (N ≥ MIN_DATOS_IC): intervalo de la ec. 4-5,
    centro ± k·DesvEst, siendo DesvEst la desviación estándar poblacional
    (÷N, ec. 5) del conjunto de datos pre-depuración.

    Sin sigma (N < MIN_DATOS_IC): banda ±10 % de la ec. 3 / ec. 7.

    Con n < MIN_VALORES_POR_MES no se construye banda: el grupo queda
    marcado como `estimado` y se conserva íntegro (la Resolución sugiere
    tres valores del mismo mes; si no hay, manda el periodo seleccionado
    como base de consumo, §7.5.1).

    Retorna (banda, máscara_de_filas_a_conservar). La banda informa la
    media final ya con el recomputo del descarte; la máscara refleja el
    filtro construido sobre la media inicial.
    """
    n = int(len(grupo))
    media = float(grupo.mean())
    banda: Dict[str, Any] = {
        "mes": int(mes),
        "n": n,
        "media": media,
        "limite_inferior": None,
        "limite_superior": None,
        "descartados": 0,
        "estimado": n < MIN_VALORES_POR_MES,
    }
    if banda["estimado"]:
        return banda, pd.Series(True, index=grupo.index)

    def _limites(centro: float) -> Tuple[float, float]:
        if sigma is not None:
            ancho = K_INTERVALO * sigma  # ec. 4: centro ± k·DesvEst
            return centro - ancho, centro + ancho
        return centro * (1 - CONFIANZA_INTERVALO), centro * (1 + CONFIANZA_INTERVALO)

    li_construccion, ls_construccion = _limites(media)
    dentro = (grupo >= li_construccion) & (grupo <= ls_construccion)
    if not dentro.any():
        # Mes patológico: un atípico arrastra la media y la banda no contiene
        # a ningún valor. Se reancla sobre la mediana para no perder el mes
        # entero; si así tampoco hay sobrevivientes, se conserva la serie
        # completa.
        logger.warning(
            f"Mes {mes}: la banda construida sobre la media no contiene "
            "ningún valor; se reancla sobre la mediana"
        )
        ancla = float(grupo.median())
        li_reancla, ls_reancla = _limites(ancla)
        dentro = (grupo >= li_reancla) & (grupo <= ls_reancla)
        if not dentro.any():
            logger.warning(
                f"Mes {mes}: sin sobrevivientes; se conserva la serie completa"
            )
            dentro = pd.Series(True, index=grupo.index)

    media_final = float(grupo[dentro].mean())
    li_final, ls_final = _limites(media_final)
    banda.update(
        {
            "media": media_final,
            "limite_inferior": li_final,
            "limite_superior": ls_final,
            "descartados": int((~dentro).sum()),
        }
    )
    return banda, dentro


def _bandas_y_mascara(
    df: pd.DataFrame, columna: str, sigma: Optional[float] = None
) -> Tuple[List[Dict[str, Any]], pd.Series]:
    """Bandas de todos los meses presentes y máscara de filas a conservar."""
    bandas: List[Dict[str, Any]] = []
    conservar = pd.Series(True, index=df.index)
    for mes in sorted(df["mes"].unique()):
        idx = df.index[df["mes"] == mes]
        banda, dentro = _banda_de_grupo(df.loc[idx, columna], int(mes), sigma)
        conservar.loc[idx] = dentro
        bandas.append(banda)
    return bandas, conservar


def _sigma_poblacional(
    df: pd.DataFrame, columna: str = "consumo_normalizado"
) -> Optional[float]:
    """
    DesvEst poblacional (ec. 5: ÷N, ddof=0) del conjunto pre-depuración.

    La §7.5.1 solo sugiere la ec. 4-5 con 10 o más datos: por debajo de
    MIN_DATOS_IC retorna None y el rescate no es aplicable.
    """
    if len(df) >= MIN_DATOS_IC:
        return float(df[columna].std(ddof=0))
    return None


def _depurar_df(
    df: pd.DataFrame,
) -> Tuple[pd.DataFrame, List[Dict[str, Any]], str, Optional[float]]:
    """
    Depura un DataFrame ya armado con la regla de dos pases de la §7.5.1:
      1. Pase 1 (criterio por defecto): banda ±10 % de la ec. 3 por mes,
         con recomputo de la media tras el descarte.
      2. Rescate: si tras el pase 1 quedan menos de MIN_MESES_BASE (36)
         registros depurados y N total ≥ MIN_DATOS_IC, se reintenta desde
         los datos crudos con el intervalo de confianza de las ec. 4-5
         (centro ± k·DesvEst con k = K_INTERVALO y DesvEst poblacional
         pre-depuración). El rescate solo se conserva si deja MÁS registros
         que el pase 1; en empate manda el criterio normativo ±10 %.

    Retorna (DataFrame limpio, bandas por mes, criterio aplicado:
    "banda_10_pct" | "ic_2sigma", sigma usada o None si aplica ec. 3).
    """
    sigma = _sigma_poblacional(df)
    bandas, conservar = _bandas_y_mascara(df, "consumo_normalizado", None)
    df_pasada1 = df[conservar].copy()
    if sigma is None or len(df_pasada1) >= MIN_MESES_BASE:
        return df_pasada1, bandas, "banda_10_pct", None

    logger.info(
        f"Rescate: {len(df_pasada1)} depurados < {MIN_MESES_BASE}; "
        "reintentando con el intervalo de confianza de las ec. 4-5"
    )
    bandas_ic, conservar_ic = _bandas_y_mascara(df, "consumo_normalizado", sigma)
    df_rescate = df[conservar_ic].copy()
    if len(df_rescate) > len(df_pasada1):
        logger.info(
            f"Rescate aceptado: {len(df_rescate)} > {len(df_pasada1)} depurados"
        )
        return df_rescate, bandas_ic, "ic_2sigma", sigma
    logger.info(
        "Rescate no mejora el pase ±10 %; se conserva el criterio de la ec. 3"
    )
    return df_pasada1, bandas, "banda_10_pct", None


def depurar_con_bandas(
    data: Dict[str, List[Dict[str, Any]]],
) -> Tuple[pd.DataFrame, List[Dict[str, Any]], str, Optional[float]]:
    """
    Depurar y limpiar el dataset histórico de consumo energético.

    Secuencia (§7.5.1, ec. 1-5):
      1. Normalización a 30 días (ec. 1) y descarte de consumos ≤ 0.
      2. Pase 1 con la banda ±10 % de la ec. 3 (criterio por defecto).
      3. Si los registros depurados quedan por debajo de MIN_MESES_BASE
         (36) y N ≥ MIN_DATOS_IC, rescate con el intervalo de confianza de
         las ec. 4-5 (centro ± k·DesvEst, k = K_INTERVALO, DesvEst
         poblacional ÷N pre-depuración); solo se conserva si mejora el
         recuento de depurados.
      4. Por cada mes calendario con n ≥ MIN_VALORES_POR_MES: banda sobre la
         media inicial, descarte de lo que caiga fuera y recomputo de la
         media (así lo exige §7.5.1 después de la ec. 3). Si la banda
         construida sobre la media no contiene ningún valor (mes patológico),
         se reancla sobre la mediana para no perder el mes entero.
      5. Meses con menos de tres registros se conservan sin banda y quedan
         como `estimado`.

    Retorna:
    --------
    (DataFrame limpio listo para modelado, bandas por mes como en
    `bandas_por_mes`, criterio aplicado: "banda_10_pct" o "ic_2sigma",
    DesvEst poblacional usada para la banda o None si aplica ec. 3).
    """
    df = _armar_df(data)
    logger.info("Depurando datos (pase 1: banda ±10 % (ec. 3), §7.5.1)")
    df, bandas, criterio, sigma = _depurar_df(df)

    descartados = sum(b["descartados"] for b in bandas)
    estimados = sum(1 for b in bandas if b["estimado"])
    logger.info(
        f"Datos depurados: {len(df)} registros (criterio {criterio}: "
        f"{descartados} descartados, {estimados} meses sin "
        f"{MIN_VALORES_POR_MES} valores)"
    )
    return df, bandas, criterio, sigma


def base_cruda(data: Dict[str, List[Dict[str, Any]]]) -> pd.DataFrame:
    """
    Base ec. 1 sin depurar: normalización a 30 días y sanidad de consumos.

    §7.5.2: la ruta del cociente no comparte la depuración de consumo de la
    §7.5.1; recibe esta base cruda y depura sus propios cocientes (ec. 7
    con N < 10 o ec. 4-5 con N ≥ 10, con descarte y recomputo).
    """
    return _armar_df(data)


def depurar_datos(
    data: Dict[str, List[Dict[str, Any]]],
) -> pd.DataFrame:
    """Depurar el dataset; ver `depurar_con_bandas` (mismo flujo, solo DataFrame)."""
    df, _, _, _ = depurar_con_bandas(data)
    return df


def bandas_por_mes(registros: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Bandas por mes calculadas sobre los registros crudos, con la misma
    secuencia y criterio que `depurar_con_bandas` (ec. 1 + regla de dos
    pases: ±10 % por defecto, rescate ec. 4-5 si < MIN_MESES_BASE).
    Pensado para que la capa superior muestre límites, descartes y meses
    `estimado` sin duplicar la fórmula.

    Retorna:
    --------
    Lista con una banda por mes presente:
    {mes, n, media, limite_inferior, limite_superior, descartados, estimado}
    """
    df = _armar_df({"registros": registros})
    _, bandas, _, _ = _depurar_df(df)
    return bandas


def calcular_linea_base(
    data_json: dict,
    modelo_seleccionado: str = "automatico",
    variables_explicativas: Optional[List[str]] = None,
) -> dict:
    """
    Función principal para calcular la Línea Base Energética.

    Parámetros:
    -----------
    data_json : dict
        Dataset histórico en formato JSON con estructura:
        {
            "bloque_A": [
                {"mes": 8, "ano": 2024, "consumo_kwh": 1500, "dias_facturados": 25, ...},
                ...
            ],
            ...
        }
    modelo_seleccionado : str
        Nombre del modelo a utilizar:
        - "valor_absoluto": Modelo 1 (§7.5.1, ec. 2)
        - "cociente": Modelo 2 (§7.5.2, ec. 6-7; base cruda sin filtro de consumo)
        - "regresion": Modelo 3 (§7.5.3)
        - "confort_termal": indicador de confort ASHRAE 55 (Tabla 1 CEELA)
        - "automatico": Seleccionar el mejor modelo automáticamente

    variables_explicativas : List[str], opcional
        Lista de nombres de variables para el modelo de regresión (Modelo 3).
        Ej: ["poblacion_fija", "grades_dia_enfriamiento"]

    Retorna:
    --------
    dict
        Estructura del modelo seleccionado con sus estadísticos y métricas de calidad.
    """
    logger.info("Iniciando cálculo de Línea Base Energética")

    # Validación básica de entrada
    if not data_json or not isinstance(data_json, dict):
        raise DataValidationError("Los datos de entrada deben ser un diccionario no vacío")

    # Depurar datos
    try:
        datos_limpiados = depurar_datos(data_json)
    except DataValidationError as e:
        logger.error(f"Error en la depuración de datos: {e}")
        raise

    # Seleccionar y ejecutar modelo
    if modelo_seleccionado == "automatico":
        # Estrategia automática: probar modelos y seleccionar el mejor
        resultados = {}

        # Intentar Modelo Valor Absoluto
        try:
            modelo_va = ModeloValorAbsoluto("Valor Absoluto", datos_limpiados)
            resultado_va = modelo_va.ajustar()
            resultados["valor_absoluto"] = resultado_va
        except Exception as e:
            logger.warning(f"No se pudo ajustar Modelo Valor Absoluto: {e}")

        # Intentar Modelo Regresión (si hay suficientes datos y variables)
        if len(datos_limpiados) >= MIN_MESES_BASE and variables_explicativas:
            try:
                modelo_reg = ModeloRegresion(datos_limpiados, variables_explicativas)
                resultado_reg = modelo_reg.ajustar()
                resultados["regresion"] = resultado_reg
            except ModelSelectionError:
                logger.warning("Regresión no aceptada (MAPE > 5%)")
            except Exception as e:
                logger.warning(f"No se pudo ajustar Regresión: {e}")

        # Elegir el modelo con mejor calidad (menor MAPE y R² adecuado)
        if not resultados:
            raise ModelSelectionError("Ningún modelo pudo ser ajustado")

        # Seleccionar modelo con menor MAPE
        mejor_modelo = min(resultados.keys(), key=lambda k: resultados[k].get("mape", float("inf")))
        logger.info(f"Modelo seleccionado automáticamente: {mejor_modelo}")

        return resultados[mejor_modelo]

    elif modelo_seleccionado == "valor_absoluto":
        modelo = ModeloValorAbsoluto("Valor Absoluto", datos_limpiados)
        return modelo.ajustar()

    elif modelo_seleccionado == "cociente":
        # §7.5.2: base cruda (ec. 1) sin el filtro de consumo de la §7.5.1
        datos = base_cruda(data_json)
        var_relevante = "area_util" if "area_util" in datos.columns else "poblacion_fija"
        modelo = ModeloCociente(datos, variable_relevante=var_relevante)
        return modelo.ajustar()

    elif modelo_seleccionado == "regresion":
        if variables_explicativas is None or len(variables_explicativas) == 0:
            raise DataValidationError(
                "Se deben proporcionar variables explicativas para el modelo de regresión"
            )
        modelo = ModeloRegresion(datos_limpiados, variables_explicativas)
        return modelo.ajustar()

    elif modelo_seleccionado == "confort_termal":
        # Extraer temperatura promedio de los datos o usar valor por defecto
        temperatura_prom = 25.0  # Valor por defecto para Medellín
        if datos_limpiados is not None and "temperatura_promedio" in datos_limpiados.columns:
            temperatura_prom = float(datos_limpiados["temperatura_promedio"].mean())

        # Buscar datos de confort si están disponibles
        datos_confort = None
        if "datos_confort" in data_json and data_json["datos_confort"] is not None:
            datos_confort = pd.DataFrame(data_json["datos_confort"])

        modelo = ModeloConfortThermal(
            datos_limpiados,
            temperatura_promedio=temperatura_prom,
            datos_confort=datos_confort,
        )
        return modelo.ajustar()

    else:
        raise DataValidationError(f"Modelo '{modelo_seleccionado}' no reconocido")


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


# Ejemplo de uso si el script se ejecuta directamente
if __name__ == "__main__":
    print("=== Motor de Línea Base Energética LBEn ===")
    print("Módulo cargado exitosamente")
    print("Funciones disponibles:")
    print("  - calcular_linea_base(data, modelo)")
    print("  - depurar_con_bandas(data)  # bandas + criterio (±10 % o rescate ec. 4-5)")
    print("  - depurar_datos(data)")
    print("  - bandas_por_mes(registros)")
    print("  - validar_estructura_datos(data)")
    print("\nModelos soportados:")
    print("  1. Valor Absoluto (12 promedios mensuales, ec. 2)")
    print("  2. Cociente (12 cocientes mensuales, ec. 6-7)")
    print("  3. Regresión (statsmodels con selección de variables, §7.5.3)")
    print("  4. Confort (indicador ASHRAE 55, Tabla 1 resumen CEELA/UPME)")
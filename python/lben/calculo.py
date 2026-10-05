"""Función principal de cálculo de la Línea Base Energética."""

from __future__ import annotations

import logging
from typing import List, Optional

import pandas as pd

from .bandas import base_cruda, depurar_datos, depurar_con_bandas
from .constants import MIN_MESES_BASE
from .exceptions import DataValidationError, ModelSelectionError
from .modelos import (
    ModeloConfortThermal,
    ModeloCociente,
    ModeloRegresion,
    ModeloValorAbsoluto,
)

logger = logging.getLogger(__name__)

def calcular_linea_base(
    data_json: dict,
    modelo_seleccionado: str = "automatico",
    variables_explicativas: Optional[List[str]] = None,
    ajustes: Optional[List[Dict[str, Any]]] = None,
) -> dict:
    """
    Función principal para calcular la Línea Base Energética.

    Parámetros:
    -----------
    data_json : dict
        Dataset histórico en formato JSON con estructura:
        {
            "bloque_A": [
                {"mes": 1, "ano": 2023, "consumo_kwh": 1500, "dias_facturados": 25, ...},
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

    ajustes : List[Dict], opcional
        Ajustes no rutinarios (Anexo 4) con estructura:
        [{"periodo_inicio": "2024-05", "periodo_fin": "2024-09",
          "proporcion": 0.25, "direccion": "reduccion",
          "descripcion": "Remodelación piso 3 - AC apagado"}]

    Retorna:
    --------
    dict
        Estructura del modelo seleccionado con sus estadísticos, métricas de calidad
        y lista de ajustes_aplicados.
    """
    logger.info("Iniciando cálculo de Línea Base Energética")

    # Validación básica de entrada
    if not data_json or not isinstance(data_json, dict):
        raise DataValidationError("Los datos de entrada deben ser un diccionario no vacío")

    # Depurar datos con ajustes no rutinarios (Anexo 4) y obtener ajustes aplicados
    try:
        datos_limpiados, _, _, _, ajustes_aplicados = depurar_con_bandas(data_json, ajustes)
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

        resultado = resultados[mejor_modelo]
        resultado["ajustes_aplicados"] = ajustes_aplicados
        return resultado

    elif modelo_seleccionado == "valor_absoluto":
        modelo = ModeloValorAbsoluto("Valor Absoluto", datos_limpiados)
        resultado = modelo.ajustar()
        resultado["ajustes_aplicados"] = ajustes_aplicados
        return resultado

    elif modelo_seleccionado == "cociente":
        # §7.5.2: base cruda (ec. 1) sin el filtro de consumo de la §7.5.1
        datos = base_cruda(data_json)
        var_relevante = "area_util" if "area_util" in datos.columns else "poblacion_fija"
        modelo = ModeloCociente(datos, variable_relevante=var_relevante)
        resultado = modelo.ajustar()
        resultado["ajustes_aplicados"] = ajustes_aplicados
        return resultado

    elif modelo_seleccionado == "regresion":
        if variables_explicativas is None or len(variables_explicativas) == 0:
            raise DataValidationError(
                "Se deben proporcionar variables explicativas para el modelo de regresión"
            )
        modelo = ModeloRegresion(datos_limpiados, variables_explicativas)
        resultado = modelo.ajustar()
        resultado["ajustes_aplicados"] = ajustes_aplicados
        return resultado

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
        resultado = modelo.ajustar()
        resultado["ajustes_aplicados"] = ajustes_aplicados
        return resultado

    else:
        raise DataValidationError(f"Modelo '{modelo_seleccionado}' no reconocido")

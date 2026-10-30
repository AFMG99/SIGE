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

import logging

from .bandas import base_cruda, bandas_por_mes, depurar_con_bandas, depurar_datos
from .calculo import calcular_linea_base
from .constants import (
    CONFIANZA_INTERVALO,
    K_INTERVALO,
    MAPE_MAXIMO,
    MIN_DATOS_IC,
    MIN_MESES_BASE,
    MIN_VALORES_POR_MES,
    UMbral_P_VALUE,
)
from .datos import DataCleaner, validar_estructura_datos
from .exceptions import DataValidationError, ModelSelectionError
from .modelos import (
    ModeloCociente,
    ModeloConfortThermal,
    ModeloLBEn,
    ModeloRegresion,
    ModeloValorAbsoluto,
)

__all__ = [
    "CONFIANZA_INTERVALO",
    "DataCleaner",
    "DataValidationError",
    "K_INTERVALO",
    "MAPE_MAXIMO",
    "MIN_DATOS_IC",
    "MIN_MESES_BASE",
    "MIN_VALORES_POR_MES",
    "ModelSelectionError",
    "ModeloCociente",
    "ModeloConfortThermal",
    "ModeloLBEn",
    "ModeloRegresion",
    "ModeloValorAbsoluto",
    "UMbral_P_VALUE",
    "bandas_por_mes",
    "base_cruda",
    "calcular_linea_base",
    "depurar_con_bandas",
    "depurar_datos",
    "validar_estructura_datos",
]

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

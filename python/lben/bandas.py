"""Depuración por bandas de confianza (§7.5.1, ec. 1-5) y ajustes no rutinarios (Anexo 4)."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from .constants import (
    CONFIANZA_INTERVALO,
    K_INTERVALO,
    MIN_DATOS_IC,
    MIN_MESES_BASE,
    MIN_VALORES_POR_MES,
)
from .datos import _armar_df

logger = logging.getLogger(__name__)


def _aplicar_ajustes_no_rutinarios(
    df: pd.DataFrame,
    ajustes: List[Dict[str, Any]],
) -> Tuple[pd.DataFrame, List[Dict[str, Any]]]:
    """
    Aplica ajustes no rutinarios (Anexo 4) a los consumos anómalos.

    Cada ajuste define un periodo (periodo_inicio/fin como "YYYY-MM") y una
    proporción (0-1) con dirección ('incremento' | 'reduccion'):
    - 'reduccion': consumo bajó anómalamente → normalizar subiendo:
        v_adj = v / (1 - prop)
    - 'incremento': consumo subió anómalamente → normalizar bajando:
        v_adj = v / (1 + prop)

    Retorna (DataFrame con consumos ajustados, lista de ajustes aplicados
    con mes, año, proporcion, direccion, descripcion).
    """
    if not ajustes:
        return df, []

    df_ajustado = df.copy()
    aplicados = []

    for ajuste in ajustes:
        try:
            inicio = ajuste.get("periodo_inicio")
            fin = ajuste.get("periodo_fin")
            prop = float(ajuste.get("proporcion", 0))
            direccion = ajuste.get("direccion", "reduccion")
            descripcion = ajuste.get("descripcion", "")

            if not inicio or not fin or prop <= 0:
                logger.warning(f"Ajuste inválido omitido: {ajuste}")
                continue

            # Parsear periodos "YYYY-MM"
            ai, mi = map(int, inicio.split("-"))
            af, mf = map(int, fin.split("-"))

            mask = pd.Series(False, index=df_ajustado.index)
            for _, row in df_ajustado.iterrows():
                periodo = (int(row["ano"]), int(row["mes"]))
                if (ai, mi) <= periodo <= (af, mf):
                    mask.loc[row.name] = True

            if not mask.any():
                logger.info(f"Ajuste {descripcion}: ningún registro en periodo {inicio}-{fin}")
                continue

            factor = 1 - prop if direccion == "reduccion" else 1 + prop
            if factor <= 0:
                logger.warning(f"Factor inválido ({factor}) en ajuste {descripcion}")
                continue

            df_ajustado.loc[mask, "consumo_normalizado"] = (
                df_ajustado.loc[mask, "consumo_normalizado"] / factor
            ).round(4)

            for _, row in df_ajustado[mask].iterrows():
                aplicados.append({
                    "ano": int(row["ano"]),
                    "mes": int(row["mes"]),
                    "proporcion": prop,
                    "direccion": direccion,
                    "descripcion": descripcion,
                })

            logger.info(
                f"Ajuste aplicado: {descripcion} ({inicio}-{fin}), "
                f"prop={prop:.4f}, dir={direccion}, {mask.sum()} registros"
            )

        except Exception as e:  # noqa: BLE001
            logger.warning(f"Error aplicando ajuste {ajuste}: {e}")

    return df_ajustado, aplicados


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
    ajustes: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[pd.DataFrame, List[Dict[str, Any]], str, Optional[float], List[Dict[str, Any]]]:
    """
    Depura un DataFrame ya armado con la regla de la §7.5.1 + Anexo 4:
      1. Aplicar ajustes no rutinarios registrados (Anexo 4).
      2. Pase único con banda ±10 % de la ec. 3 por mes (criterio por defecto),
         con recomputo de la media tras el descarte.
      3. Meses con n < MIN_VALORES_POR_MES se conservan sin banda (`estimado`).

    El rescate con ec. 4-5 (ic_2sigma) se ELIMINA: la solución normativa
    a valores fuera de banda con causa conocida es el ajuste no rutinario
    (Anexo 4, §7.6.2), no ensanchar la banda.

    Retorna (DataFrame limpio, bandas por mes, criterio aplicado: "banda_10_pct",
    sigma=None, ajustes_aplicados).
    """
    # 1. Aplicar ajustes no rutinarios ANTES de la verificación ec. 3
    df, aplicados = _aplicar_ajustes_no_rutinarios(df, ajustes or [])

    # 2. Pase único con banda ±10 % (ec. 3) — sin rescate
    bandas, conservar = _bandas_y_mascara(df, "consumo_normalizado", None)
    df_limpio = df[conservar].copy()

    logger.info(
        f"Datos depurados (ec. 3 ±10%): {len(df_limpio)} registros, "
        f"{len(df) - len(df_limpio)} descartados, "
        f"{len(aplicados)} ajustes aplicados"
    )
    return df_limpio, bandas, "banda_10_pct", None, aplicados

def depurar_con_bandas(
    data: Dict[str, List[Dict[str, Any]]],
    ajustes: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[pd.DataFrame, List[Dict[str, Any]], str, Optional[float], List[Dict[str, Any]]]:
    """
    Depurar y limpiar el dataset histórico de consumo energético.

    Secuencia (§7.5.1, ec. 1-5 + Anexo 4):
      1. Normalización a 30 días (ec. 1) y descarte de consumos ≤ 0.
      2. Aplicar ajustes no rutinarios registrados (Anexo 4).
      3. Pase único con banda ±10 % de la ec. 3 (criterio por defecto),
         con recomputo de la media tras el descarte.
      4. Por cada mes calendario con n ≥ MIN_VALORES_POR_MES: banda sobre la
         media inicial, descarte de lo que caiga fuera y recomputo de la
         media (así lo exige §7.5.1 después de la ec. 3). Si la banda
         construida sobre la media no contiene ningún valor (mes patológico),
         se reancla sobre la mediana para no perder el mes entero.
      5. Meses con menos de tres registros se conservan sin banda y quedan
         como `estimado`.

    El rescate con ec. 4-5 (ic_2sigma) se ELIMINA: la solución normativa
    a valores fuera de banda con causa conocida es el ajuste no rutinario
    (Anexo 4, §7.6.2), no ensanchar la banda.

    Retorna:
    --------
    (DataFrame limpio listo para modelado, bandas por mes, criterio aplicado:
    "banda_10_pct", DesvEst poblacional usada para la banda (None), ajustes_aplicados).
    """
    df = _armar_df(data)
    logger.info("Depurando datos (ec. 3 ±10% + ajustes Anexo 4, §7.5.1)")
    df, bandas, criterio, sigma, aplicados = _depurar_df(df, ajustes)

    descartados = sum(b["descartados"] for b in bandas)
    estimados = sum(1 for b in bandas if b["estimado"])
    logger.info(
        f"Datos depurados: {len(df)} registros (criterio {criterio}: "
        f"{descartados} descartados, {estimados} meses sin "
        f"{MIN_VALORES_POR_MES} valores, {len(aplicados)} ajustes aplicados)"
    )
    return df, bandas, criterio, sigma, aplicados

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
    ajustes: Optional[List[Dict[str, Any]]] = None,
) -> pd.DataFrame:
    """Depurar el dataset; ver `depurar_con_bandas` (mismo flujo, solo DataFrame)."""
    df, _, _, _, _ = depurar_con_bandas(data, ajustes)
    return df

def bandas_por_mes(
    registros: List[Dict[str, Any]],
    ajustes: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """
    Bandas por mes calculadas sobre los registros crudos, con la secuencia
    ec. 1 + ajustes no rutinarios (Anexo 4) + banda ±10 % (ec. 3).
    Pensado para que la capa superior muestre límites, descartes y meses
    `estimado` sin duplicar la fórmula.

    Retorna:
    --------
    Lista con una banda por mes presente:
    {mes, n, media, limite_inferior, limite_superior, descartados, estimado}
    """
    df = _armar_df({"registros": registros})
    _, bandas, _, _, _ = _depurar_df(df, ajustes)
    return bandas

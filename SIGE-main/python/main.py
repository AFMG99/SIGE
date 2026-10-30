"""
Servicio Python del motor LBEn en Vercel (modo Services, vercel.json).

POST / y POST /api/lben — mismo contrato JSON que python/lben/cli.py
(stdin/stdout), expuesto por el servicio `engine`. El servicio es
INTERNO: no hay rewrite publico, solo lo alcanza la app Next.js via el
binding LBEN_URL. Autenticacion: header obligatorio `x-lben-key` con el
valor de la variable de entorno LBEN_SECRET (segunda barra defensiva).
"""

from __future__ import annotations

import json
import math
import os
import secrets
import sys
from pathlib import Path

import numpy as np
from fastapi import FastAPI, Header, HTTPException

# `lben` es un paquete hermano de este archivo (python/lben). El runtime
# del servicio agrega la raíz al sys.path; este insert defensivo cubre
# ejecuciones manuales desde otras carpetas (uvicorn, pruebas locales).
sys.path.insert(0, str(Path(__file__).resolve().parent))

from lben.analisis import analizar_desde_payload  # noqa: E402
from lben.cli import _json_default, calcular_desde_payload  # noqa: E402

app = FastAPI(title="SIGE motor LBEn", docs_url=None, redoc_url=None)


def _verificar_llave(x_lben_key: str | None) -> None:
    """Segunda barra defensiva: header `x-lben-key` == LBEN_SECRET."""
    esperado = os.environ.get("LBEN_SECRET")
    if not esperado:
        raise HTTPException(
            status_code=503,
            detail="LBEN_SECRET no está configurado en el entorno.",
        )
    if not x_lben_key or not secrets.compare_digest(x_lben_key, esperado):
        raise HTTPException(status_code=403, detail="x-lben-key inválido.")


def _json_safe(obj):
    """
    JSON-safe recursivo: tipos numpy y float no finito -> None.

    `json.dumps(..., default=_json_default)` resuelve los tipos numpy,
    pero un float no finito de Python puro se serializaria como NaN o
    Infinity y Starlette (allow_nan=False) responderia 500; aqui se
    normaliza a None antes de devolver.
    """
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_json_safe(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return [_json_safe(v) for v in obj.tolist()]
    if isinstance(obj, (np.floating, float)):
        valor = float(obj)
        return valor if math.isfinite(valor) else None
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    return obj


# Se registran ambas rutas: `/` es la raiz interna del servicio (la que
# usa el binding LBEN_URL) y `/api/lben` queda por si el montaje cambia.
@app.post("/api/lben")
@app.post("/")
def calcular_linea_base(
    payload: dict,
    x_lben_key: str | None = Header(default=None),
):
    _verificar_llave(x_lben_key)

    salida = calcular_desde_payload(payload)
    return _json_safe(json.loads(json.dumps(salida, default=_json_default)))


@app.post("/api/analisis")
def analizar_consumo(
    payload: dict,
    x_lben_key: str | None = Header(default=None),
):
    """Detección de épocas de consumo inusual (Módulo 3, HU-07/HU-04).

    Mismo contrato estilo cli: payload -> `analizar_desde_payload`, misma
    autenticación `x-lben-key` que /api/lben.
    """
    _verificar_llave(x_lben_key)

    salida = analizar_desde_payload(payload)
    return _json_safe(json.loads(json.dumps(salida, default=_json_default)))

"""
Endpoint HTTP del motor LBEn para Vercel (runtime Python).

POST /api/lben — mismo contrato JSON que python/lben/cli.py (stdin/stdout),
envuelto como funcion serverless. Autenticacion: header obligatorio
`x-lben-key` con el valor de la variable de entorno LBEN_SECRET; sin
secret configurado el endpoint responde 503 para que un despliegue mal
configurado sea ruidoso y no silencioso.
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

# El paquete lben vive en python/lben (monorepo): se anade al path para
# que `lben` sea importable desde api/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "python"))

from lben.cli import _json_default, calcular_desde_payload  # noqa: E402

app = FastAPI(title="SIGE motor LBEn", docs_url=None, redoc_url=None)


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


# Se registran ambas rutas porque el runtime de Vercel puede montar la
# app con el prefijo completo (/api/lben) o con la raiz del archivo (/).
@app.post("/api/lben")
@app.post("/")
def calcular_linea_base(
    payload: dict,
    x_lben_key: str | None = Header(default=None),
):
    esperado = os.environ.get("LBEN_SECRET")
    if not esperado:
        raise HTTPException(
            status_code=503,
            detail="LBEN_SECRET no está configurado en el entorno.",
        )
    if not x_lben_key or not secrets.compare_digest(x_lben_key, esperado):
        raise HTTPException(status_code=403, detail="x-lben-key inválido.")

    salida = calcular_desde_payload(payload)
    return _json_safe(json.loads(json.dumps(salida, default=_json_default)))

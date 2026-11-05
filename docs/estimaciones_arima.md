# Proyecciones de consumo con modelos estadísticos

El módulo `/dashboard/estimaciones` genera proyecciones exploratorias mensuales para una edificación o uno de sus bloques. Cada ejecución solicita entre uno y tres meses, no persiste el resultado y no modifica las líneas base guardadas. Además de la selección automática SARIMA/ARIMA, permite comparar medias móviles (MA) y suavizamiento exponencial simple (SES).

## Preparación de la serie

- Parte de `FacturaEnergia.consumoNormalizado`, calculado al cargar facturas con la ecuación 1 de la Resolución UPME 0016 de 2024.
- Para un bloque, aplica el mismo criterio de participación de consumo usado por LBEn (`facturas_area` o `modelo_ingenieria`).
- Aplica los ajustes no rutinarios del alcance y reutiliza la depuración de §7.5.1 del motor LBEn. Los períodos deben ser mensuales y consecutivos.
- Recomienda al menos 36 meses sobrevivientes a la depuración para una mayor confiabilidad, pero no bloquea la estimación por debajo de ese umbral. El motor devuelve una advertencia con el número de meses depurados y continúa siempre que logre ajustar un modelo ARIMA/SARIMA; si ninguno se ajusta, devuelve un error explícito. Los registros descartados por la banda no se vuelven a introducir: se imputan con el promedio de valor absoluto del mismo mes calendario calculado sobre la serie depurada.
- Si no hay datos depurados para un mes calendario futuro, no se inventa una LBEn mensual para ese mes; la proyección se devuelve con ese valor comparativo nulo.

## Ajuste y salida

El modo automático prueba una cuadrícula acotada de órdenes SARIMA con período estacional 12 y selecciona por AIC; si ninguno converge, prueba ARIMA no estacional. MA utiliza una ventana móvil configurable de 2 a 12 meses (por defecto 3) y SES ajusta el nivel exponencial, con alpha configurable entre 0.05 y 0.95. Para MA y SES los intervalos del 95 % se estiman a partir de los residuos y se amplían con el horizonte; deben interpretarse como bandas aproximadas, no como intervalos exactos de modelos probabilísticos. Los perfiles con permiso `estimates:create` pueden especificar un orden ARIMA manual `[p, d, q]`, con cada componente entre 0 y 2.

La respuesta contiene la serie usada, los consumos proyectados y sus intervalos al 95 %. Los perfiles autorizados para diagnóstico reciben además AIC, MAPE dentro de muestra, media de residuos y p-value de Ljung–Box. El MAPE de entrenamiento es descriptivo y no constituye una validación independiente del pronóstico.

Cuando existe una LBEn de valor absoluto guardada, la vista compara primero la del bloque seleccionado y, si no existe, la de la edificación. La ausencia de una LBEn guardada no bloquea la proyección; se informa que no hay comparación disponible.

## Integración y permisos

La server action carga y valida los datos, comprueba los permisos del módulo `estimates` y llama al CLI `python -m lben.forecast` en local o al endpoint interno `POST /api/forecast` en el servicio `engine`. El endpoint requiere `x-lben-key` con `LBEN_SECRET`; el despliegue enlaza la aplicación con el motor mediante `LBEN_URL`.

Los permisos `create`, `evaluate`, `read` y `view_impact` habilitan la ejecución. Solo `create` y `evaluate` habilitan orden manual y diagnósticos. El endpoint de Python no se publica como una ruta Next.js.

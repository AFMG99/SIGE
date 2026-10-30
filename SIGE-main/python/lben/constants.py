"Constantes del cálculo LBEn (Resolución UPME 0016 de 2024)."

# Constantes del cálculo LBEn y su procedencia (Resolución UPME 0016 de 2024):
#   K_INTERVALO: factor k = 2 de la ec. 4 (LBEn_m ± k·DesvEst): ancho de la
#     banda mensual cuando el mes tiene 10 o más datos (decisión D1) y de la
#     envolvente IC. La imagen oficial de la ec. 4 escribe «dos(2)·DesvEst»;
#     la notación «k» es propia del código y no aparece en la Resolución.
#   MIN_DATOS_IC: n mínimo EN UN MES para que la ec. 4-5 se use en ese mes
#     (§7.5.1: "con 10 o más datos"; decisión D1: el gate es por mes).
#   CONFIANZA_INTERVALO: banda ±10 % (ec. 3 / §7.5.2 ec. 7): criterio único
#     de la depuración; es también lo que aplican los ejemplos de los
#     Anexos (36 datos).
#   UMbral_P_VALUE: significancia de variables al 95 % (§7.5.3).
#   MIN_MESES_BASE: recomendación §7.1-7.2 ("recomendable al menos 3 años de
#     datos"). Regla del sistema para GUARDAR la línea base.
#   MIN_VALORES_POR_MES: sugerencia §7.5.1/§7.5.2 ("al menos tres valores del
#     mismo mes"). Meses con menos se calculan igual pero sin banda.
#   MAPE_MAXIMO: umbral de confiabilidad del ejemplo del Anexo 3 (no es una
#     cláusula de la resolución).
# No hay tope de R²: §7.5.3 establece que un R² bajo no invalida el modelo,
# porque la validez la define el p-value.
K_INTERVALO = 2  # ec. 4: LBEn_m ± k·DesvEst (banda mensual / IC, n ≥ 10 por mes)
MIN_DATOS_IC = 10  # §7.5.1: ec. 4-5 con n ≥ 10 EN EL MES (D1)
CONFIANZA_INTERVALO = 0.10  # ±10 % (ec. 3 / ec. 7): criterio por defecto
UMbral_P_VALUE = 0.05  # significancia al 95 % (§7.5.3)
MIN_MESES_BASE = 36  # recomendación §7.1-7.2; gate de guardado
MIN_VALORES_POR_MES = 3  # sugerencia §7.5.1/§7.5.2 (tres valores del mismo mes)
MAPE_MAXIMO = 0.05  # confiabilidad (ejemplo del Anexo 3)

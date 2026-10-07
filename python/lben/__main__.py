"Demostración al ejecutar `python -m lben`."

# Ejemplo de uso si el script se ejecuta directamente
if __name__ == "__main__":
    print("=== Motor de Línea Base Energética LBEn ===")
    print("Módulo cargado exitosamente")
    print("Funciones disponibles:")
    print("  - calcular_linea_base(data, modelo)")
    print("  - depurar_con_bandas(data)  # bandas ±10 %, DesvEst pre-descarte, serie ajustada")
    print("  - depurar_datos(data)")
    print("  - bandas_por_mes(registros)")
    print("  - validar_estructura_datos(data)")
    print("\nModelos soportados:")
    print("  1. Valor Absoluto (12 promedios mensuales, ec. 2)")
    print("  2. Cociente (12 cocientes mensuales, ec. 6-7)")
    print("  3. Regresión (statsmodels con selección de variables, §7.5.3)")
    print("  4. Confort (indicador ASHRAE 55, Tabla 1 resumen CEELA/UPME)")

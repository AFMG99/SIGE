/**
 * Archivos CSV de ejemplo para las demos. Los encabezados usan sinónimos
 * reconocidos por `autoMapear`, de modo que el asistente llega al paso 2 con
 * las columnas ya mapeadas y el botón "Continuar" habilitado.
 *
 * La última fila de cada archivo es deliberadamente inválida para mostrar el
 * resaltado de errores en la vista previa.
 */

export const facturasCsv = `periodo,diasfacturados,consumokwh,costocop
2024-06,30,18120.4,17100000
2024-07,31,19040.2,18250000
2024-08,31,18500.5,17575000
2024-09,30,17980.75,16990000
2024-10,31,20110.3,19230000
2024-11,30,19455.9,18470000
2024-13,30,15000,12000000
`

export const equiposCsv = `bloque,espacio,tipo,cantidad,potencianominal,horasusodia,diasusomes,usenindicador
A-101,Aula 101,ILUMINACION,12,150,8,22,ACTIVO
A-101,Aula 102,ILUMINACION,10,120,8,22,ACTIVO
A-102,Laboratorio 201,HVAC,3,7500,6,20,ACTIVO
A-102,Sala de Servidores,OFICINA,4,300,12,30,ACTIVO
A-101,Sala de Profesores,MOTORES,2,4500,7,21,INACTIVO
A-102,Almacén,ILUMINACION,8,90,9,22,ACTIVO
A-101,Aula 103,TIPO_INVALIDO,1,100,1,20,ACTIVO
`

export const variablesCsv = `bloque,mes,ano,docentes,administrativos,estudiantes,visitantes,diaslectivos,gde
A-101,1,2025,24,8,112,34,22,18.4
A-101,2,2025,24,8,118,38,20,16.9
A-102,1,2025,22,7,96,28,22,21.3
A-102,2,2025,22,7,101,31,20,19.8
A-101,3,2025,24,8,125,44,22,20.6
A-101,13,2025,24,8,130,45,22,21.2
`

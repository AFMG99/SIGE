# METODOLOGÍA COMPLETA PARA EL CÁLCULO DE LÍNEAS BASE ENERGÉTICAS (LBEn), MODELO CEELA Y ESTIMACIÓN DE AHORROS EN EDIFICACIONES

Este documento reúne de manera exhaustiva y detallada todas las ecuaciones, modelos matemáticos, variables, indicadores y tablas resumen establecidos en la normativa nacional de Colombia y en los estudios de desempeño energético vigentes.

Todas las secciones, fórmulas y explicaciones cuentan con su respectiva **atribución de fuente**, indicando el documento oficial y la sección/numeral de donde fueron extraídos:
- **[UPME 0016/2024]**: *Resolución UPME 0016 de 2024 y su Anexo Técnico (corregido por Auto 444 de 2024)*.
- **[CEELA / UPME 2025]**: *Informe Ejecutivo "Línea base de desempeño energético de Edificaciones Residenciales y de Oficinas de Colombia" (Proyecto CEELA - COSUDE / UPME)*.
- **[SIGE-TdeA]**: *Informe Técnico del Proyecto de Software SIGE-TdeA (Tecnológico de Antioquia, 2026)*.

---

## 1. PREPROCESAMIENTO Y NORMALIZACIÓN DE DATOS DE CONSUMO

### 1.1. Normalización del Consumo Mensual a 30 Días
**[Fuente: UPME 0016/2024, Numeral 7.5 / Ecuación (1)]**

Dado que los períodos de facturación de los servicios públicos varían habitualmente entre 28 y 33 días, es obligatorio normalizar el consumo registrado a un período estándar de 30 días para garantizar la comparabilidad estadística de la serie de datos:

$$\text{Consumo Mensual Normalizado (kWh/mes)} = \frac{\text{Consumo Registrado en Factura (kWh)}}{\text{Días del Período de Facturación}} \times 30$$

---

### 1.2. Intervalos de Confianza y Depuración de Datos Atípicos
**[Fuente: UPME 0016/2024, Numeral 7.5.1 / Ecuaciones (3), (4) y (5)]**

Para verificar la representatividad de la información histórica y descartar anomalías de consumo (fallas de medición, paradas no programadas, obras o eventos atípicos), se aplican filtros de intervalo de confianza antes de construir la LBEn.

#### A. Filtro por Banda Fija ($\pm 10\%$)
**[Fuente: UPME 0016/2024, Numeral 7.5.1 / Ecuación (3)]**
Para muestras de datos de tamaño moderado ($N < 10$ lecturas por mes):

$$\text{Límite Superior} = \text{Promedio Mensual} \times 1.10 = \text{Promedio} + 10\%$$

$$\text{Límite Inferior} = \text{Promedio Mensual} \times 0.90 = \text{Promedio} - 10\%$$

Cualquier registro individual que caiga por fuera del rango $[\text{Límite Inferior}, \text{Límite Superior}]$ se elimina de la base de datos antes de recalcular los promedios definitivos.

#### B. Filtro por Desviación Estándar ($N \ge 10$)
**[Fuente: UPME 0016/2024, Numeral 7.5.1 / Ecuaciones (4) y (5)]**
Cuando se cuenta con una muestra significativa ($10$ o más registros mensuales por mes de análisis), se establece la banda de confianza en función de la Desviación Estándar ($DesvEst$):

$$\text{Intervalo de Confianza} = \mu \pm k \cdot DesvEst$$

Donde la **Desviación Estándar Poblacional ($DesvEst$)** se calcula mediante la fórmula matemática:

$$DesvEst = \sqrt{\frac{\sum_{i=1}^{N} |x_i - \mu|^2}{N}}$$

*Donde:*
- $x_i$: Valor individual del consumo energético en el mes $i$ [kWh/mes].
- $\mu$: Media aritmética (promedio) de los datos de consumo del conjunto.
- $N$: Número total de observaciones registradas para dicho mes.

---

## 2. MODELOS PARA EL ESTABLECIMIENTO DE LA LÍNEA BASE ENERGÉTICA (LBEn)

La normativa colombiana (Resolución UPME 0016 de 2024) e internacionales (ISO 50006 e IPMVP) establecen **cuatro modelos principales** para la formulación de la LBEn:

---

### 2.1. MODELO 1: VALOR ABSOLUTO DE ENERGÍA
**[Fuente: UPME 0016/2024, Numeral 7.4.1 y 7.5.1 / Ecuación (2)]**

* **Aplicación:** Se utiliza cuando la edificación no dispone de registros de variables independientes (población, clima, actividad) que expliquen las variaciones del consumo, o cuando la operación de la edificación es altamente estable e independiente de factores externos.
* **Fórmula de la LBEn:**

$$LBEn_m = \frac{\sum_{i=1}^{m} \text{Consumo Mensual Normalizado}_i}{m}$$

*Donde:*
- $LBEn_m$: Línea base de consumo energético para el mes $m$ (1 a 12) [kWh/mes].
- $Consumo Mensual Normalizado_i$: Consumo de energía del mes $m$ en el año $i$ [kWh/mes].
- $m$: Número de años del período base evaluados (se recomienda un mínimo de 3 años / 36 meses de registros).

---

### 2.2. MODELO 2: COCIENTE DE VALORES MEDIDOS (RELACIÓN SIMPLE / CONSUMO ESPECÍFICO)
**[Fuente: UPME 0016/2024, Numeral 7.4.2 y 7.5.2 / Ecuación (6) y (7)]**

* **Aplicación:** Se aplica cuando el consumo energético varía en proporción directa con una única variable relevante de actividad no controlable (ej. área ocupada en $m^2$, número de usuarios o personas atendidas).
* **Fórmula del Cociente o Índice de Consumo:**

$$\text{Cociente}_i = \frac{\text{Consumo Mensual Normalizado}_i}{\text{Variable Relevante}_i} \quad \left[\frac{\text{kWh}}{\text{unidad}}\right]$$

* **Fórmula de la LBEn:**

$$LBEn_m = \frac{\sum_{i=1}^{m} \text{Cociente}_i}{m}$$

*Donde $LBEn_m$ es el cociente promedio de referencia para el mes $m$ (ej. $kWh/persona\cdot mes$ o $kWh/m^2\cdot mes$).*

---

### 2.3. MODELO 3: MODELO ESTADÍSTICO (REGRESIÓN LINEAL SIMPLE Y MULTIVARIABLE)
**[Fuente: UPME 0016/2024, Numeral 7.4.3 y 7.5.3 / Ecuación (8)]**

* **Aplicación:** Se utiliza cuando el consumo energético es función de una o múltiples variables independientes operativas o climáticas.
* **Ecuación General de la LBEn:**

$$\text{Consumo Energético } (Y) = \sum_{n=1}^{k} \left( \text{Coeficiente}_{X_n} \times X_n \right) + \text{Intercepción}$$

$$\text{En forma explícita: } Y = \beta_0 + \beta_1 X_1 + \beta_2 X_2 + \dots + \beta_k X_k$$

*Donde:*
- $Y$: Consumo energético mensual estimado por la línea base [kWh/mes].
- $\beta_0$: Coeficiente de intercepción (consumo fijo basal cuando todas las variables son cero) [kWh/mes].
- $\beta_n$: Pendiente o coeficiente de regresión de la $n$-ésima variable independiente (representa la tasa de cambio del consumo por unidad de variación de $X_n$).
- $X_n$: Valor mensual de la $n$-ésima variable relevante (población flotante, días lectivos, $GDE$, etc.).

#### A. Fórmula de los Grados Día de Enfriamiento (GDE)
**[Fuente: UPME 0016/2024, Anexo 3 / Numeral 7.5.3]**
Los $GDE$ cuantifican el rigor térmico del clima exterior que exige el encendido de los sistemas de aire acondicionado/climatización:

$$GDE = \sum_{i=1}^{n} (T_p - T_b)_i \cdot X_e \quad \left[\frac{^\circ\text{C}}{\text{mes}}\right]$$

*Donde:*
- $T_p$: Temperatura promedio diaria exterior, calculada hora a hora durante el horario laboral:

$$T_p = \frac{\sum_{j=1}^{H} T_j}{H}$$

- $T_j$: Temperatura ambiente medida en la hora $j$ [$^\circ\text{C}$].
- $H$: Número de horas de operación o trabajo diario de la edificación.
- $T_b$: Temperatura base de climatización ($20^\circ\text{C}, 23^\circ\text{C}, 25^\circ\text{C}$), asumida típicamente $3^\circ\text{C}$ por debajo de la temperatura de confort interior para considerar las ganancias térmicas internas.
- $X_e$: Coeficiente lógico condicional:
  $$X_e = \begin{cases} 1 & \text{si } T_p > T_b \\ 0 & \text{si } T_p \le T_b \end{cases}$$
- $n$: Número de días del mes ($30$ días). Si $T_p$ se mantiene constante en el mes: $GDE = (T_p - T_b) \cdot X_e \cdot 30$.

#### B. Estadísticos Obligatorios de Validación de la Regresión
**[Fuente: UPME 0016/2024, Numeral 7.4.3, 7.5.3 y Notas de Fin de Documento]**

1. **Significancia Estadística de Variables ($p\text{-value}$ / Probabilidad):**
   - Evaluado al 95% de nivel de confianza ($\alpha = 0.05$).
   - Si el $p\text{-value} > 0.05$, la variable **NO es estadísticamente significativa** y **debe eliminarse**, reejecutando la regresión sin ella.
2. **Coeficiente de Determinación ($R^2$):**
   - Mide la proporción de la varianza del consumo explicada por las variables del modelo. Un $R^2$ bajo no invalida el modelo si el $p\text{-value} < 0.05$, sino que demuestra que existe un alto potencial de ahorro atribuible a hábitos operacionales y mantenimiento.
3. **Error Porcentual Relativo por Observación y Error Promedio:**
   - Para cada mes de la serie histórica se calcula el porcentaje de error respecto a la línea base:

$$\%\text{Error}_i = \frac{\text{Consumo Medido}_i - \text{Consumo LBEn}_i}{\text{Consumo LBEn}_i} \times 100$$

   - El modelo se considera altamente confiable cuando el **Error Promedio $\le 5\%$** (umbral de ejemplo del Anexo 3 de la Resolución 16 de 2024).

---

### 2.4. MODELO 4: MODELO DE INGENIERÍA O SIMULACIÓN COMPUTACIONAL
**[Fuente: UPME 0016/2024, Numeral 7.4.4; CEELA / UPME 2025, Numeral 2.1 - 2.4]**

* **Aplicación:** Se aplica en edificaciones nuevas (sin histórico de facturación), en etapas de diseño, o en inmuebles complejos donde existen variables interdependientes (geometría, materialidad, porcentaje ventana-pared, sistemas HVAC centralizados vs. distribuidos).
* **Fundamento:** Resuelve las ecuaciones diferenciales del balance térmico dinámico hora a hora utilizando software especializado (EnergyPlus, OpenStudio, DesignBuilder) bajo estándares internacionales (**ASHRAE 90.1 Apéndice G** y **ASHRAE 55**).

---

## 3. METODOLOGÍA CEELA: LÍNEA BASE DE DESEMPEÑO ENERGÉTICO EN EDIFICACIONES RESIDENCIALES Y OFICINAS DE COLOMBIA
**[Fuente: CEELA / UPME 2025, Informe Ejecutivo]**

El estudio desarrollado por la UPME en cooperación con la Agencia Suiza COSUDE (Proyecto CEELA - consorcio EBP, Carbon Trust y Colbún) establece la línea base de desempeño energético para el sector edificador en Colombia.

### 3.1. Las Cuatro Fases Metodológicas del Proyecto CEELA
**[Fuente: CEELA / UPME 2025, Numeral 1 y 2.1 - 2.4]**

1. **Fase 1 - Diagnóstico y Alcance Técnico:** Revisión del estado del arte internacional (Perú, Chile, España, México, Brasil) y definición del enfoque de modelado energético para 5 tipologías de edificaciones en 4 zonas climáticas principales (representadas por Bogotá, Barranquilla, Cali, Medellín y Neiva como caso cálido-seco).
2. **Fase 2 - Características Comunes y Confort Adaptativo:** Análisis de licencias de construcción (2016-2024) y selección de 20 edificaciones representativas postuladas por constructoras. Establecimiento de los rangos de temperatura operativa del estándar **ASHRAE 55**.
3. **Fase 3 - Caracterización Energética y Calibración:** Recopilación de facturación real del Sistema Único de Información (SUI de la Superservicios, 2021-2024) y calibración de los modelos de simulación sin climatización artificial con un **error menor al 8%**.
4. **Fase 4 - Línea Base y Energía Virtual:** Simulación energéticamente acoplada para garantizar confort térmico al 100% en todas las estancias mediante sistemas de climatización estándar (PTHP para vivienda y sistemas centralizados para oficinas). Se introduce el concepto de **"Energía Virtual"**, definida como *la estimación del consumo energético real que requeriría una edificación para alcanzar las condiciones de confort adaptativo sin haber consumido físicamente esa energía*.

---

### 3.2. Tabla 1: Límites de Confort Adaptativo según Estándar ASHRAE 55 por Ciudad
**[Fuente: CEELA / UPME 2025, Tabla 1, p. 5]**

Rango de temperatura operativa interior ($^\circ C$) evaluado hora a hora para un año tipo (límite del 80% de aceptabilidad):

| Ciudad | Zona Climática | Temperatura Operativa Mínima (Confort Bajo) [$^\circ C$] | Temperatura Operativa Máxima (Confort Alto) [$^\circ C$] |
| :--- | :--- | :---: | :---: |
| **Barranquilla** | Cálido Húmedo | 22.7 | 30.2 |
| **Bogotá** | Frío | 18.6 | 25.9 |
| **Cali** | Cálido Seco | 21.3 | 28.7 |
| **Medellín** | Templado | 20.2 | 27.6 |

---

### 3.3. Tablas de Resumen de Resultados CEELA

Los indicadores clave resultantes se miden en:
- **Demanda térmica de calefacción y refrigeración:** $[kWh/m^2\cdot año]$
- **Consumo eléctrico de climatización:** $[kWh/m^2\cdot año]$
- **Consumo eléctrico total:** $[kWh/m^2\cdot año]$
- **Porcentaje de energía dedicada a climatización:** $[\%]$
- **Emisiones anuales de $CO_2$:** $[kgCO_2/m^2\cdot año]$
- **Horas de disconfort térmico:** $[h/año]$

#### TABLA 2. Consumo de Climatización por Tipología y Clima ($kWh/m^2\cdot año$)
**[Fuente: CEELA / UPME 2025, Tabla 2, pp. 7-8]**

| Tipología | Clima | Edificio Representativo [$kWh/m^2\cdot año$] | Promedio Estudio de Sensibilidad [$kWh/m^2\cdot año$] | Cambio en Adyacencia [$kWh/m^2\cdot año$] |
| :--- | :--- | :---: | :---: | :---: |
| **Unifamiliar VIS** | Frío | 49 | 52 | 52 |
| | Cálido Húmedo | 107 | 136 | 97 |
| | Cálido Seco - Cali | 25 | 18 | 22 |
| | Cálido Seco - Neiva | 84 | 96 | 73 |
| | Templado | 14 | 19 | 25 |
| **Unifamiliar NO VIS** | Frío | 57 | 112 | 56 |
| | Cálido Húmedo | 77 | 95 | 52 |
| | Cálido Seco - Cali | 32 | 27 | 30 |
| | Cálido Seco - Neiva | 96 | 100 | 94 |
| | Templado | 28 | 33 | 28 |
| **Multifamiliar VIS** | Frío | 20 | 11 | 18 |
| | Cálido Húmedo | 90 | 79 | 68 |
| | Cálido Seco - Cali | 23 | 84 | 22 |
| | Cálido Seco - Neiva | 71 | 69 | 67 |
| | Templado | 8 | 14 | 7 |
| **Multifamiliar NO VIS**| Frío | 39 | 31 | 40 |
| | Cálido Húmedo | 64 | 51 | 60 |
| | Cálido Seco - Cali | 12 | 14 | 12 |
| | Cálido Seco - Neiva | 47 | 46 | 48 |
| | Templado | 12 | 6 | 12 |
| **Oficinas** | Frío | 30 | 17 | N.A. |
| | Cálido Húmedo | 24 | 40 | N.A. |
| | Cálido Seco - Cali | 20 | 42 | N.A. |
| | Cálido Seco - Neiva | 32 | 53 | N.A. |
| | Templado | 5 | 11 | N.A. |

---

#### TABLA 3. Consumo Eléctrico Total por Tipología y Clima ($kWh/m^2\cdot año$)
**[Fuente: CEELA / UPME 2025, Tabla 3, pp. 9-10]**

| Tipología | Clima | Edificio Representativo [$kWh/m^2\cdot año$] | Promedio Estudio de Sensibilidad [$kWh/m^2\cdot año$] | Cambio en Adyacencia [$kWh/m^2\cdot año$] |
| :--- | :--- | :---: | :---: | :---: |
| **Unifamiliar VIS** | Frío | 76 | 78 | 76 |
| | Cálido Húmedo | 177 | 205 | 166 |
| | Cálido Seco - Cali | 54 | 46 | 50 |
| | Cálido Seco - Neiva | 113 | 124 | 101 |
| | Templado | 49 | 53 | 66 |
| **Unifamiliar NO VIS** | Frío | 77 | 129 | 76 |
| | Cálido Húmedo | 110 | 127 | 106 |
| | Cálido Seco - Cali | 58 | 52 | 56 |
| | Cálido Seco - Neiva | 121 | 123 | 119 |
| | Templado | 47 | 53 | 44 |
| **Multifamiliar VIS** | Frío | 64 | 52 | 62 |
| | Cálido Húmedo | 134 | 124 | 112 |
| | Cálido Seco - Cali | 56 | 118 | 55 |
| | Cálido Seco - Neiva | 106 | 104 | 102 |
| | Templado | 41 | 52 | 40 |
| **Multifamiliar NO VIS**| Frío | 64 | 58 | 65 |
| | Cálido Húmedo | 97 | 82 | 94 |
| | Cálido Seco - Cali | 34 | 34 | 33 |
| | Cálido Seco - Neiva | 69 | 68 | 70 |
| | Templado | 45 | 44 | 44 |
| **Oficinas** | Frío | 66 | 59 | N.A. |
| | Cálido Húmedo | 73 | 89 | N.A. |
| | Cálido Seco - Cali | 87 | 90 | N.A. |
| | Cálido Seco - Neiva | 99 | 100 | N.A. |
| | Templado | 63 | 84 | N.A. |

---

#### TABLA 4. Porcentaje de Energía Consumida Dedicada a Climatización respecto al Consumo Total (%)
**[Fuente: CEELA / UPME 2025, Tabla 4, pp. 10-11]**

| Tipología | Clima | Edificio Representativo | Promedio Estudio de Sensibilidad | Cambio en Adyacencia |
| :--- | :--- | :---: | :---: | :---: |
| **Unifamiliar VIS** | Frío | 64% | 67% | 68% |
| | Cálido Húmedo | 60% | 66% | 58% |
| | Cálido Seco - Cali | 46% | 39% | 44% |
| | Cálido Seco - Neiva | 74% | 77% | 72% |
| | Templado | 29% | 36% | 38% |
| **Unifamiliar NO VIS** | Frío | 74% | 87% | 74% |
| | Cálido Húmedo | 70% | 75% | 49% |
| | Cálido Seco - Cali | 55% | 52% | 54% |
| | Cálido Seco - Neiva | 79% | 81% | 79% |
| | Templado | 60% | 62% | 64% |
| **Multifamiliar VIS** | Frío | 31% | 21% | 29% |
| | Cálido Húmedo | 67% | 64% | 61% |
| | Cálido Seco - Cali | 41% | 71% | 40% |
| | Cálido Seco - Neiva | 67% | 66% | 66% |
| | Templado | 20% | 27% | 18% |
| **Multifamiliar NO VIS**| Frío | 61% | 53% | 62% |
| | Cálido Húmedo | 66% | 62% | 64% |
| | Cálido Seco - Cali | 35% | 41% | 36% |
| | Cálido Seco - Neiva | 68% | 68% | 69% |
| | Templado | 27% | 14% | 27% |
| **Oficinas** | Frío | 45% | 29% | N.A. |
| | Cálido Húmedo | 33% | 45% | N.A. |
| | Cálido Seco - Cali | 23% | 47% | N.A. |
| | Cálido Seco - Neiva | 32% | 53% | N.A. |
| | Templado | 8% | 13% | N.A. |

---

## 4. FÓRMULAS PARA EL CÁLCULO Y ESTIMACIÓN DE AHORROS ENERGÉTICOS

### 4.1. Ahorro por Mejor Desempeño Operativo (Línea Meta)
**[Fuente: UPME 0016/2024, Numeral 8.1 / Ecuaciones (9), (10), (11) y (12)]**

El mejor desempeño operativo cuantifica la reducción de energía alcanzable si la edificación opera bajo las condiciones de mayor eficiencia registradas en su propio histórico.

#### A. Para Modelos Absoluto y Cociente
**[Fuente: UPME 0016/2024, Numeral 8.1 / Anexo 1 y Anexo 2]**
Se toma para cada mes la diferencia entre el promedio de la LBEn y el consumo mínimo histórico conocido:

$$\text{Potencial Ahorro}_m = LBEn_m - \text{Consumo Mínimo}_m$$

#### B. Para Modelo Estadístico
**[Fuente: UPME 0016/2024, Numeral 8.1 y Anexo 3 / Ecuación (11)]**
1. Se calculan las diferencias individuales en el período base: $\Delta_i = \text{Consumo Real}_i - \text{Consumo LBEn}_i$.
2. Se filtran las observaciones donde $\Delta_i < 0$ (los mejores desempeños energéticos).
3. Se corre una nueva regresión lineal sobre este subconjunto respecto a la variable independiente, obteniendo la **Ecuación de la Línea Meta**:

$$Y_{\text{Meta}} = \beta_{0,\text{Meta}} + \beta_{1,\text{Meta}} X_1$$

4. El potencial de ahorro mensual se calcula como la brecha entre la LBEn y la Línea Meta:

$$\text{Potencial Ahorro}_m = LBEn_m - Y_{\text{Meta}, m}$$

#### C. Expresión Porcentual del Ahorro
**[Fuente: UPME 0016/2024, Numeral 8.1 / Ecuación (12)]**

$$\%\text{Ahorro}_m = \frac{\text{Potencial de Ahorro en el mes } m}{\text{Consumo según LBEn en el mes } m} \times 100$$

---

### 4.2. Medición y Verificación (M&V) con Ajustes Rutinarios y No Rutinarios
**[Fuente: UPME 0016/2024, Numeral 7.6.2; IPMVP / ISO 50015]**

En la etapa de reporte posterior a las intervenciones, el ahorro real verificado ($Ahorro_{\text{Medido}}$) se calcula mediante la ecuación general de M&V:

$$Ahorro = \left( Consumo_{\text{LBEn}} - Consumo_{\text{Reporte}} \right) \pm \text{Ajustes Rutinarios} \pm \text{Ajustes No Rutinarios}$$

#### A. Ajustes Rutinarios
Fluctuaciones esperadas en variables independientes (ej. clima, ocupación). En el **Modelo Estadístico**, estos ajustes se incluyen **automáticamente** al ingresar los nuevos valores de $X_n$ en la ecuación de la LBEn.

#### B. Ajustes No Rutinarios
Modificaciones imprevistas en los factores estáticos dentro de la frontera (ej. remodelación de un piso, parada por mantenimiento mayor o cambio de uso de instalaciones).
* **Método de la Proporción de Ajuste ($Pr$):**
  **[Fuente: UPME 0016/2024, Anexo 4]**

$$Pr = \frac{Consumo_{\text{Promedio Normal}} - Consumo_{\text{Promedio Anómalo}}}{Consumo_{\text{Promedio Normal}}}$$

Los consumos de los meses homólogos en los demás años del período base se multiplican por $(1 - Pr)$ para recalcular los límites y evitar la sobreestimación del ahorro.

---

### 4.3. Oportunidades de Mejora por Medidas de Eficiencia Energética (EE)
**[Fuente: UPME 0016/2024, Numeral 8.2 y Anexo 5]**

El ahorro total estimado de una institución combina el mejor desempeño operativo con la implementación de proyectos de eficiencia energética:

$$\text{Ahorro Total Estimado (\%)} = \%\text{Ahorro}_{\text{Mejor Desempeño}} + \sum \%\text{Ahorro}_{\text{Medidas EE}}$$

#### Clasificación y Potenciales de Ahorro Típicos (Anexo 5):
1. **Buenas Prácticas Operacionales (BPO):**
   - Apagado automático de equipos e iluminación fuera de horario.
   - Ajuste de termostatos de climatización.
   - Ahorro estimado típico: **$1.5\% - 4.0\%$**.
2. **Medidas Pasivas (Arquitectura Bioclimática):**
   - Películas de control solar en ventanas: **$0.94\%$**.
   - Pintura reflectiva en techos y cubiertas: **$13.57\%$**.
   - Aislamiento térmico en muros y cubiertas.
3. **Reconversión Tecnológica (Medidas Activas):**
   - Sustitución de iluminación fluorescente/sodio a tecnología LED: **$3.68\%$**.
   - Reemplazo de aires acondicionados por sistemas de volumen de refrigerante variable (VRF): **$23.55\%$**.
   - Motores eléctricos IE3/IE4 con variadores de frecuencia (VFD).

---

## 5. CONTEXTO DE APLICACIÓN INSTITUCIONAL EN EL PROYECTO SIGE-TdeA
**[Fuente: Plantilla_TDG_Desarrollo_SW_InformeTecnico.docx; Ley 2294 de 2023]**

### 5.1. Marco Legal del Sector Público en Colombia
- **Art. 237 de la Ley 2294 de 2023 (Plan Nacional de Desarrollo) / Art. 30 Ley 1715 de 2014:** Obliga a todas las entidades públicas a realizar auditorías energéticas cada 4 años y alcanzar un **ahorro energético mínimo del 15%** en el año posterior a la auditoría respecto al consumo del año anterior.

### 5.2. Módulos del Sistema SIGE-TdeA (Tecnológico de Antioquia)
**[Fuente: SIGE-TdeA, Ficha Técnica y Secciones 2.1 - 2.6]**
El software **SIGE-TdeA** automatiza este marco regulatorio en 6 módulos funcionales:
1. **Carga y Gestión de Datos:** Ingesta de facturas EPM e inventario de equipos por bloque.
2. **Dashboard de Visualización:** KPIs de consumo en kWh, costo en COP, variaciones y correlación con el calendario académico.
3. **Análisis Estadístico y Patrones:** Implementación de algoritmos en Python (`pandas`, `statsmodels`) para cálculo de la LBEn, normalización a 30 días, filtros del $\pm 10\%$ e identificación de anomalías.
4. **Alertas de Consumo Inusual:** Notificaciones automáticas cuando el consumo supera los umbrales históricos esperados.
5. **Estimaciones Predictivas:** Modelado de series de tiempo para proyecciones de demanda a 1-3 meses.
6. **Reportes Institucionales:** Exportación de informes técnicos en PDF y Excel formateados para presentación ante directivas y reporte anual a la UPME.

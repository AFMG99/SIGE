# Manual de usuario — SIGE-TdeA

**Sistema de Información para la Gestión Energética del Tecnológico de Antioquia**  
**Versión:** 1.0  
**Fecha:** 4 de noviembre de 2026  
**Idioma de la interfaz:** Español (Colombia)  
**Repositorio:** [AFMG99/SIGE](https://github.com/AFMG99/SIGE)

---

## Control del documento

| Campo | Descripción |
|---|---|
| Nombre | Manual de usuario de SIGE-TdeA |
| Audiencia | Administrador TI, gestor energético, coordinador de infraestructura, directivo y comunidad universitaria |
| Plataforma | Aplicación web Next.js desplegada en Vercel |
| Persistencia | PostgreSQL en Neon mediante Prisma ORM |
| Estado | Primera versión basada en la implementación encontrada en el repositorio |
| Convención | Las opciones visibles dependen del rol y de los permisos asignados |

## 1. Introducción

SIGE-TdeA es una plataforma web para centralizar información relacionada con la gestión energética institucional. Permite organizar edificaciones y su infraestructura, registrar facturas de energía, inventariar equipos eléctricos, almacenar variables operativas, configurar calendarios y horarios, calcular líneas base energéticas, analizar consumos, consultar alertas, generar estimaciones y producir reportes.

Este manual explica cómo navegar y utilizar los módulos identificados en el código fuente. Debido a que SIGE aplica permisos por rol, es posible que una persona no vea todas las opciones descritas. La ausencia de un menú no significa necesariamente que exista un error: puede ser una restricción de acceso.

### 1.1. Objetivos del manual

- Orientar el ingreso y la navegación por la plataforma.
- Explicar los procedimientos habituales de registro, consulta, cálculo y gestión.
- Describir los datos requeridos y los resultados que genera cada módulo.
- Prevenir errores de importación y modificaciones accidentales.
- Aclarar las diferencias entre calcular, guardar, editar y eliminar información.

### 1.2. Requisitos de uso

- Navegador actualizado (Chrome, Edge, Firefox u otro navegador moderno).
- Conexión a Internet.
- Cuenta de usuario activa.
- Credenciales de acceso.
- Aplicación disponible en la URL institucional de SIGE.

No se debe compartir la contraseña, los códigos TOTP ni los códigos de respaldo con otras personas.

## 2. Acceso a la plataforma

### 2.1. Iniciar sesión

1. Abra la URL de SIGE proporcionada por el administrador.
2. En la pantalla de inicio de sesión, introduzca su correo electrónico y contraseña.
3. Seleccione la opción para ingresar.
4. Si su cuenta tiene segundo factor habilitado u obligatorio, introduzca el código temporal generado por la aplicación autenticadora.
5. Espere a que el sistema valide sus credenciales y cargue el dashboard.

Si las credenciales no son válidas, compruebe que el correo esté escrito correctamente y que el teclado no tenga activado Bloq Mayús. Si la cuenta está pendiente, inactiva o bloqueada por intentos fallidos de segundo factor, contacte al administrador TI.

### 2.2. Verificación en dos pasos (2FA)

El repositorio implementa autenticación TOTP. La política exige 2FA para los roles Administrador TI y Gestor Energético; para los demás roles puede ser opcional.

- Use una aplicación autenticadora compatible con TOTP.
- Introduzca el código vigente, no uno que ya haya expirado.
- Guarde los códigos de respaldo en un lugar seguro cuando el sistema los proporcione.
- Cada código de respaldo debe tratarse como de un solo uso.
- No envíe capturas del QR, secretos TOTP o códigos por correo o mensajería.

Si pierde el dispositivo autenticador, solicite al administrador el procedimiento de recuperación autorizado.

### 2.3. Cerrar sesión

Utilice la opción de cierre de sesión disponible en el menú de cuenta. En equipos compartidos, cierre siempre la sesión y cierre la ventana del navegador.

## 3. Navegación general

Después de autenticarse, la plataforma presenta el dashboard y una navegación cuyos elementos dependen del rol.

Los módulos identificados en la navegación son:

| Módulo | Ruta de referencia | Finalidad |
|---|---|---|
| Dashboard | `/dashboard` | Resumen general e indicadores disponibles para el usuario. |
| Gestión de datos | `/dashboard/datos` | Facturas, equipos, variables operativas, ajustes, líneas base y catálogo de edificaciones. |
| Análisis estadístico | `/dashboard/analisis` | Análisis de consumo y detección de patrones/periodos inusuales. |
| Alertas | `/dashboard/alertas` | Evaluación y seguimiento de alertas de consumo. |
| Estimaciones | `/dashboard/estimaciones` | Proyecciones de consumo y visualización de impacto. |
| Reportes | `/dashboard/reportes` | Preparación y generación de informes. |
| Representación espacial | `/dashboard/espacial` | Visualización de bloques y espacios. |
| Usuarios y acceso | `/dashboard/users` | Administración de cuentas, roles y permisos. |

En Gestión de datos hay navegación interna por secciones. Los controles Carga, Visualización y Gestión cambian el contenido dentro del módulo; no necesariamente cambian la dirección del navegador. La sección Facturas incluye además Edificaciones para administrar el catálogo de infraestructura.

### 3.1. Recomendaciones de navegación

- Revise el nombre de la sección antes de registrar o modificar datos.
- Utilice los filtros y buscadores antes de crear registros que podrían existir.
- Verifique la edificación, bloque, espacio y periodo seleccionados.
- Espere el mensaje de confirmación antes de cerrar o cambiar de módulo.
- Si un botón está deshabilitado o una sección no aparece, revise sus permisos con el administrador.

## 4. Roles y permisos

SIGE define cinco roles. La matriz del repositorio determina qué módulos se muestran y qué acciones se permiten. El administrador puede disponer de excepciones de permisos cuando la configuración lo contempla; la validación se realiza en el servidor.

| Módulo / acción | Administrador TI | Gestor energético | Coordinador infraestructura | Directivo | Comunidad universitaria |
|---|---|---|---|---|---|
| Usuarios | Crear / editar | Sin acceso | Sin acceso | Sin acceso | Sin acceso |
| Gestión de datos / consumo | Configurar origen | Cargar / analizar / descargar | Solo lectura | Solo lectura | Sin acceso |
| Estimaciones | Sin acceso | Crear / evaluar | Solo lectura | Solo lectura | Ver impacto |
| Planos / representación espacial | Solo lectura | Solo lectura | Cargar / modificar | Solo lectura | Oculto |
| Inventario | Sin acceso | Solo lectura | Registrar / actualizar | Solo lectura | Oculto |
| Reportes | Sin acceso | Diseñar / generar | Solo lectura | Descargar informes | Sin acceso |
| Alertas | Leer / configurar | Leer / evaluar / configurar | Solo lectura | Solo lectura | Oculto |

**Importante:** esta tabla refleja la matriz estática identificada en `src/shared/models/permissions.ts`. Los permisos efectivos pueden incluir excepciones temporales o permanentes asignadas en la plataforma. La matriz vigente en pantalla y las autorizaciones del servidor prevalecen sobre este resumen.

## 5. Dashboard

El dashboard es la vista de resumen de la plataforma.

### 5.1. Información disponible

Según los permisos del usuario y los datos existentes, puede mostrar indicadores relacionados con:

- Cantidad de facturas registradas.
- Último periodo de facturación disponible.
- Edificaciones y bloques.
- Consumo normalizado y costo.
- Evolución histórica del consumo.
- Líneas base energéticas disponibles.
- Conteos de variables operativas y usuarios activos, cuando corresponda.
- Accesos a los módulos habilitados.

### 5.2. Cómo interpretar la información

- Compruebe el periodo al que corresponde cada indicador.
- Un indicador vacío o igual a cero puede significar que aún no hay datos registrados para ese concepto.
- Los datos visibles se limitan a los permisos del usuario.
- El dashboard es una vista de consulta; para corregir registros debe ingresar al módulo correspondiente de Gestión de datos.

## 6. Gestión de datos

Este módulo concentra la información que alimenta los cálculos energéticos. Está organizado en secciones y modos de trabajo.

### 6.1. Edificaciones y bloques

La sección Edificaciones administra el catálogo de infraestructura.

**Crear una edificación**

1. Abra Gestión de datos.
2. Entre en Facturas de energía y seleccione el modo Edificaciones.
3. Utilice la acción para crear una edificación.
4. Registre el nombre y el tipo de edificación solicitado.
5. Si dispone de la información, complete el área y la ubicación.
6. Guarde y compruebe que aparezca en el listado.

Los tipos de edificación se basan en el catálogo definido por el sistema. Algunos formularios cambian según el tipo seleccionado.

**Crear un bloque**

1. Seleccione la edificación correspondiente.
2. Abra la administración de bloques.
3. Registre el código y nombre del bloque.
4. Complete el área útil y el factor de infraestructura; añada dimensiones cuando estén disponibles.
5. Guarde y verifique que el bloque quede asociado a la edificación correcta.

**Gestionar espacios**

Los espacios pertenecen a un bloque. Registre el nombre, piso y dimensiones cuando la interfaz lo solicite. La combinación bloque, piso y nombre debe ser única.

**Eliminar infraestructura**

El sistema puede impedir la eliminación cuando existen registros dependientes. Siga el mensaje de validación y resuelva las dependencias desde los módulos correspondientes. No intente eliminar registros directamente desde la base de datos.

### 6.2. Facturas de energía

Las facturas constituyen la fuente histórica de consumo y costo.

**Importar facturas**

1. Abra Gestión de datos → Facturas de energía → Carga.
2. Seleccione obligatoriamente la edificación de destino.
3. Cargue un archivo CSV o XLSX compatible.
4. Revise el reconocimiento de encabezados y realice el mapeo de columnas si se solicita.
5. Compruebe la vista previa: periodo, días facturados, consumo en kWh y costo en pesos colombianos.
6. Corrija los valores inválidos antes de continuar.
7. Si hay periodos duplicados, revise el conflicto y decida si corresponde sobrescribir.
8. Confirme la importación y espere el resumen del resultado.

La clave de unicidad de factura es edificación + periodo. Por ello, un mismo periodo puede existir para edificaciones diferentes, pero no debe duplicarse dentro de la misma edificación.

**Datos importantes**

- Periodo: mes y año de la factura, normalmente en formato `YYYY-MM`.
- Días facturados: número de días del periodo facturado.
- Consumo: energía medida en kWh.
- Costo: valor facturado en COP.

El sistema calcula el consumo normalizado según la regla `(consumo / días facturados) × 30`. No confunda el consumo original con el normalizado.

**Consultar facturas**

- Abra Visualización para consultar el resumen, los gráficos y las filas guardadas.
- Utilice la búsqueda para localizar periodos.
- Abra Gestión para editar los campos permitidos o eliminar una factura.
- El periodo y la edificación identifican el registro y no se editan como campos ordinarios.

**Vaciar facturas**

La acción Vaciar base de datos solicita confirmación y elimina las facturas y las líneas base asociadas. Las variables operativas se conservan. Utilícela únicamente cuando sea necesario reiniciar ese conjunto de información y haya verificado las consecuencias.

### 6.3. Inventario de equipos eléctricos

El inventario organiza los equipos por edificación, bloque y espacio.

**Importar equipos**

1. Entre en Gestión de datos → Equipos eléctricos → Carga.
2. Seleccione la edificación.
3. Cargue el archivo compatible.
4. Mapee los campos disponibles: bloque, espacio, tipo, cantidad, potencia nominal e indicador, además de los datos de uso cuando estén incluidos.
5. Revise la vista previa y corrija filas que tengan ubicaciones inexistentes o datos inválidos.
6. En el paso Cálculos opcionales, decida si desea calcular horas y días de uso desde el calendario o conservar los valores suministrados.
7. Revise los cambios propuestos antes de aplicarlos a las filas.
8. Confirme la importación y revise el resumen final.

Los cálculos opcionales del asistente modifican la información preparada en memoria; los registros se escriben en la base de datos cuando se confirma la importación.

**Registrar o gestionar equipos**

Un equipo se asocia a un bloque y a un espacio. Los campos principales incluyen tipo, cantidad, potencia nominal, horas de uso por día y días de uso al mes. La combinación bloque + espacio + tipo se utiliza como clave de unicidad.

En Visualización consulte los registros y resúmenes. En Gestión puede editar los campos permitidos, eliminar filas o vaciar los registros de equipos. Vaciar equipos no elimina edificaciones, bloques ni espacios.

### 6.4. Variables operativas

Las variables operativas complementan las facturas para explicar el comportamiento del consumo.

Entre los campos principales están:

- Bloque.
- Mes y año.
- Población fija.
- Población flotante.
- Días lectivos/laborales.
- Grados-día de enfriamiento (GDE).

**Importar variables**

1. Abra Gestión de datos → Variables operativas → Carga.
2. Seleccione la edificación.
3. Cargue el archivo CSV/XLSX o utilice la plantilla CSV cuando esté disponible.
4. Mapee las columnas requeridas.
5. Verifique que el código de cada bloque exista y pertenezca a la edificación seleccionada.
6. Revise mes, año, población, días y GDE.
7. Atienda los errores por fila y los duplicados. Si se propone sobrescribir, confirme únicamente cuando el registro nuevo sea el correcto.
8. En Cálculos opcionales, revise las operaciones disponibles para días lectivos/laborales o GDE y decida si las aplica.
9. Confirme la importación.

El sistema admite normalización de meses escritos en español y compatibilidad con ciertos archivos legados de población. Aun así, se recomienda utilizar la plantilla actual para evitar ambigüedades.

**Consultar y gestionar variables**

- Visualización permite revisar los datos y sus agregados.
- Gestión permite editar los campos numéricos, eliminar registros o vaciar variables.
- Vaciar variables no elimina facturas, líneas base ni el catálogo de bloques.

### 6.5. Ajustes energéticos

Los ajustes documentan cambios que deben considerarse al analizar el comportamiento energético, incluidos ajustes rutinarios y no rutinarios.

1. Ingrese a la sección Ajustes.
2. Revise el bloque y el periodo al que corresponde el ajuste.
3. Registre el tipo, modelo cuando aplique, descripción, fechas de inicio y fin, valor, dirección y observaciones que solicite el formulario.
4. Guarde y verifique el registro.
5. Consulte los ajustes en Visualización o elimínelos desde Gestión si cuenta con autorización.

Documente el motivo del ajuste con suficiente claridad para que otro usuario pueda comprenderlo y verificarlo. Los ajustes pueden influir en el análisis y en la interpretación de las líneas base.

## 7. Edificaciones: calendario, horarios y eventos

El apartado de Edificaciones incorpora información operativa que sirve para caracterizar la actividad de cada inmueble y el uso de sus equipos.

### 7.1. Ubicación y calendario operativo

1. Seleccione una edificación.
2. Abra su configuración de calendario operativo.
3. Seleccione la ciudad o zona mediante el mecanismo de ubicación disponible.
4. Revise el nombre de ubicación y los datos geográficos que se resuelven mediante geocodificación.
5. Configure la hora de inicio de operación, las horas de operación al día y la temperatura base, según los datos institucionales.
6. Guarde la configuración.

No introduzca coordenadas aproximadas si la interfaz permite seleccionar la ciudad. Verifique que la ubicación corresponda a la edificación seleccionada.

### 7.2. Rangos de calendario

Los rangos permiten definir tipos de día y periodos operativos. Registre las fechas de inicio y fin, el tipo de día y el nombre o descripción cuando corresponda. Revise que los rangos no se contradigan y que cubran los periodos que se quieren caracterizar.

### 7.3. Festivos y eventos

El calendario permite consultar festivos oficiales de Colombia y administrar eventos. Las vistas documentadas incluyen año, mes, semana y agenda, con selector de año y resumen de días lectivos, festivos y eventos.

Para registrar un evento:

1. Abra el calendario de la edificación.
2. Seleccione la fecha o rango de fechas.
3. Registre tipo, nombre y descripción.
4. Asocie el evento a la edificación y, cuando corresponda, a un bloque, espacio o equipo.
5. Guarde y verifique su aparición en el calendario.

Los eventos pueden heredarse a través de la jerarquía de la edificación. Compruebe el ámbito seleccionado antes de guardar.

### 7.4. Horarios de uso de equipos

Los horarios pueden asociarse a distintos niveles de la jerarquía: edificación, bloque, espacio o equipo. Configure:

- Días de la semana.
- Hora de inicio y hora de fin.
- Ámbito al que aplica.
- Vigencia desde/hasta cuando corresponda.

El sistema aplica una precedencia documentada de espacio sobre bloque y bloque sobre edificación, con fallback por nivel completo. También controla conflictos y vigencias.

Los interruptores de domingos operativos y festivos operativos influyen en la determinación de días de uso. Revise sus valores antes de calcular horas de uso, porque modificarlos puede cambiar los resultados de periodos futuros o recalculados.

### 7.5. GDE y variable Xe

La GDE se calcula desde Variables Operativas y utiliza la configuración climática/operativa de la edificación. La pantalla presenta los insumos y la fórmula sustituida para facilitar la trazabilidad.

La opción «Usar horarios como Xe» determina si el cálculo utiliza los horarios vigentes por día como origen de Xe. Cuando está apagada, se conserva el cálculo legado. Cuando está encendida, se toman los horarios aplicables conforme a la jerarquía y vigencia. No confunda GDE con horas de uso de equipos: son cálculos distintos.

### 7.6. Cálculo de uso de equipos

El cálculo de uso determina horas por día y días por mes para equipos, utilizando los horarios efectivos y la política operativa. Puede ejecutarse desde los cálculos opcionales del importador o desde la herramienta de cálculo de uso en Edificaciones.

El cálculo masivo:

- Trabaja con los meses del intervalo seleccionado, incluidos meses sin factura.
- Conserva los periodos que ya tienen resultado y calcula los pendientes, salvo que se seleccione expresamente un recálculo destructivo donde esté disponible.
- Muestra progreso, resultados y advertencias.
- Permite detener una ejecución cuando la interfaz lo ofrece.

Revise los equipos marcados para revisión. Un periodo sin días operativos u horarios válidos puede no producir horas de uso.

## 8. Líneas base energéticas (LBEn)

Las líneas base permiten establecer una referencia cuantitativa del consumo energético para comparar el comportamiento real y analizar el desempeño.

### 8.1. Preparar los datos

Antes de calcular, verifique:

- Facturas de energía completas y correctamente asociadas a la edificación.
- Bloques y áreas registrados.
- Equipos y variables operativas actualizados.
- Ajustes energéticos documentados.
- Periodos y unidades consistentes.

El repositorio documenta criterios regulatorios como un mínimo de 36 meses de información, depuración por bandas ±10 %, nivel de significancia de referencia 0,05 y MAPE ≤ 5 %. El cumplimiento depende de la calidad y cantidad real de los datos; una advertencia no debe interpretarse como certificación automática.

### 8.2. Ejecutar un cálculo

1. Abra Gestión de datos → Líneas base.
2. Seleccione el alcance disponible: global, bloque o espacio.
3. Seleccione el bloque o espacio cuando el alcance lo requiera.
4. Solicite el cálculo.
5. Espere la respuesta del motor estadístico.
6. Revise la preparación de la serie, los datos originales/depurados, los meses insuficientes, las bandas y las advertencias.
7. Compare los resultados de los modelos disponibles.
8. Seleccione el resultado que corresponda al análisis técnico.
9. Guarde explícitamente la línea base si desea conservarla.

El cálculo y el guardado son acciones diferentes: el cálculo previo no implica que la línea base haya quedado persistida.

### 8.3. Modelos disponibles

El repositorio define cuatro modelos:

- **Valor absoluto:** referencia basada en el comportamiento histórico del consumo.
- **Cociente:** relaciona el consumo con una variable explicativa.
- **Regresión estadística:** estima la relación entre consumo y variables operativas.
- **Confort térmico:** incorpora variables asociadas al comportamiento térmico.

Los resultados pueden incluir indicadores de ajuste como R², p-value, rangos de confianza y métricas de error, según el modelo y la disponibilidad de datos.

### 8.4. Consultar o eliminar líneas base

Las líneas base guardadas aparecen en las vistas de gestión correspondientes. Compruebe el alcance, el modelo y la fecha antes de eliminar un registro. Vaciar las líneas base no equivale a borrar las facturas.

## 9. Análisis estadístico

El módulo Análisis estadístico permite estudiar la evolución del consumo y detectar periodos que se apartan del comportamiento esperado.

1. Abra Análisis estadístico.
2. Seleccione la edificación y los filtros que ofrezca la pantalla.
3. Ejecute el análisis.
4. Revise los indicadores, periodos y resultados por nivel.
5. Consulte las advertencias sobre datos insuficientes o variables faltantes.
6. Interprete los periodos atípicos junto con los ajustes energéticos y los eventos operativos documentados.

El análisis se ejecuta bajo demanda. El controlador documenta que no persiste por sí mismo los resultados del análisis. Una variación estadística no demuestra automáticamente una falla: debe contrastarse con facturas, cambios de ocupación, calendario, clima, horarios y ajustes.

## 10. Alertas de consumo

El módulo de Alertas cuenta con persistencia de alertas, configuración de umbrales y evaluación por edificación.

### 10.1. Consultar la bandeja

1. Abra Alertas.
2. Revise el listado ordenado por periodo.
3. Identifique la edificación, periodo, consumo, banda inferior/superior, desviación, dirección y severidad.
4. Utilice los filtros disponibles para localizar los registros.
5. Abra o seleccione una alerta para revisar su información.

Los estados de una alerta son:

- **Nueva:** aún no se ha gestionado.
- **Leída:** el usuario la revisó.
- **Descartada:** se determinó que no requiere seguimiento desde la bandeja.

La acción de cambiar el estado puede estar sujeta a permisos y controles de la interfaz.

### 10.2. Configurar umbrales

Si cuenta con permiso de configuración:

1. Seleccione la edificación.
2. Abra la configuración de alertas.
3. Revise el porcentaje de umbral y el parámetro estadístico disponible.
4. Active o desactive la evaluación automática/manual según el control presentado.
5. Guarde y compruebe la configuración.

Desactivar una configuración impide generar nuevas alertas según la regla del sistema; no elimina las alertas que ya existen.

### 10.3. Evaluar alertas

Si cuenta con permiso de evaluación:

1. Seleccione la edificación que desea evaluar.
2. Revise si la evaluación está desactualizada.
3. Ejecute la evaluación.
4. Espere la respuesta del motor estadístico.
5. Revise cuántos periodos fueron evaluables y cuáles no contaban con información suficiente.
6. Consulte las alertas generadas o actualizadas.

Una evaluación puede no producir alertas si los periodos están dentro de las bandas o si no existe información suficiente. La bandeja no equivale a un servicio de notificaciones por correo o push; esos canales no se deben asumir habilitados.

## 11. Estimaciones y modelos

El módulo de Estimaciones realiza proyecciones de consumo mediante el motor Python y el modelo ARIMA.

1. Abra Estimaciones.
2. Seleccione la edificación y los datos históricos disponibles.
3. Configure el horizonte permitido (1, 2 o 3 meses, según el formulario).
4. Revise los ajustes que deban considerarse.
5. Ejecute la proyección.
6. Revise los valores proyectados y los diagnósticos disponibles.
7. Interprete el resultado como estimación, no como consumo medido.

La disponibilidad de opciones depende de los permisos: el gestor energético puede crear/evaluar; coordinador y directivo tienen consulta; comunidad universitaria puede disponer de visualización de impacto. La proyección requiere datos históricos suficientes y puede fallar si el motor no está disponible o excede el tiempo límite.

## 12. Reportes

El módulo de Reportes reúne información de facturas, variables operativas, líneas base, ajustes e inventario para preparar informes.

### 12.1. Preparar un reporte

1. Abra Reportes.
2. Seleccione la edificación.
3. Seleccione un bloque cuando el reporte deba limitarse a ese nivel.
4. Defina la periodicidad disponible: mensual, semestral o anual.
5. Indique el periodo inicial y final cuando corresponda.
6. Seleccione el modelo de línea base cuando el formulario lo solicite.
7. Revise los filtros y genere el reporte.

### 12.2. Exportar y consultar

El proyecto documenta generación de documentos PDF y DOCX. Utilice la acción de descarga que presente la interfaz y guarde el archivo con un nombre que identifique edificación, periodo y versión.

La exportación a Excel aparece como trabajo pendiente en la documentación de alcance consultada; no se debe asumir que está disponible. Los formatos concretos habilitados pueden variar según el módulo y el permiso del usuario.

### 12.3. Interpretación

Compruebe que el documento generado corresponde a la edificación, bloque, periodo y modelo elegidos. Si un dato no aparece, verifique primero que exista en Gestión de datos y que el usuario tenga acceso a la información.

## 13. Representación espacial

El módulo de Representación espacial permite visualizar la infraestructura de bloques y espacios mediante una representación gráfica.

Según la documentación del proyecto, la funcionalidad incluye layouts 2D paramétricos, canvas interactivo, inspector de propiedades, nodos de bloque y elementos paramétricos. El proyecto también contempla importación de planos CAD en formato DXF.

Flujo general:

1. Abra Representación espacial.
2. Seleccione la edificación o el conjunto de infraestructura disponible.
3. Cargue o seleccione el plano cuando tenga permiso de modificación.
4. Revise los bloques, pisos y espacios identificados.
5. Seleccione un elemento para consultar sus propiedades.
6. Ajuste la distribución o los atributos únicamente si su rol tiene permiso.
7. Guarde los cambios cuando la interfaz lo permita.

La geometría del plano debe validarse contra la infraestructura real. Una visualización espacial no reemplaza los planos arquitectónicos oficiales ni constituye por sí sola una medición certificada.

## 14. Gestión de usuarios y acceso

Este módulo está restringido a los perfiles autorizados.

### 14.1. Consultar usuarios

1. Abra Usuarios y acceso.
2. Busque por correo o nombre.
3. Revise el estado, rol y datos disponibles.
4. Seleccione el usuario para consultar su detalle.

### 14.2. Crear un usuario

1. Seleccione la opción de creación.
2. Complete los datos solicitados, especialmente correo y nombre.
3. Asigne el rol que corresponda a las funciones institucionales.
4. Configure los datos adicionales permitidos.
5. Guarde y compruebe el estado del usuario.

El registro público, si está habilitado, no debe utilizarse para asignar privilegios administrativos. El código documenta que el registro público queda forzado al rol Comunidad Universitaria.

### 14.3. Editar, suspender o reactivar

- Edite únicamente los campos autorizados.
- Verifique el correo y el rol antes de guardar.
- Suspenda una cuenta cuando deba impedirse su acceso sin eliminar su historial.
- No comparta credenciales entre usuarios.

### 14.4. Permisos excepcionales

La plataforma contempla excepciones de permisos por usuario, módulo y acción, con vencimiento opcional y registro de quién las concede. Estas excepciones no reemplazan la matriz de roles y no están permitidas para el módulo de usuarios. Deben asignarse solo por necesidad institucional y con trazabilidad.

## 15. Buenas prácticas para la calidad de los datos

- Mantenga una convención única para códigos de edificaciones, bloques y espacios.
- Use periodos `YYYY-MM` y unidades consistentes.
- Verifique que las facturas pertenezcan a la edificación correcta.
- Evite duplicar la combinación bloque + espacio + tipo de equipo.
- Registre población fija y flotante de acuerdo con las definiciones institucionales.
- Diferencie días lectivos/laborales, GDE y horas de uso de equipos.
- Mantenga los horarios y eventos actualizados.
- Documente los ajustes energéticos con su justificación.
- Antes de ejecutar cálculos, revise que los datos de entrada estén completos.
- Antes de vaciar una tabla, lea el diálogo de confirmación y sus efectos sobre los datos relacionados.
- No modifique directamente la base de datos para corregir registros operativos.

## 16. Solución de problemas frecuentes

| Situación | Posible causa | Acción recomendada |
|---|---|---|
| No puedo iniciar sesión | Credenciales incorrectas, cuenta inactiva o pendiente | Verifique correo y contraseña; contacte al administrador. |
| El código 2FA no funciona | Código expirado, hora del dispositivo desincronizada o bloqueo temporal | Genere un nuevo código, sincronice la hora y use recuperación autorizada. |
| No veo un módulo | El rol no tiene acceso o no existe una excepción vigente | Consulte la matriz de permisos con el administrador. |
| No puedo cargar datos | Permiso de carga ausente o formulario incompleto | Revise rol, selección de edificación y campos requeridos. |
| Una fila de importación aparece con error | Bloque inexistente, periodo inválido, columna mal mapeada o dato no numérico | Corrija el archivo o el mapeo y vuelva a revisar la vista previa. |
| Se detectó un duplicado | Ya existe el mismo periodo/clave natural | Compare los datos y confirme sobrescritura solo si corresponde. |
| No se puede eliminar una edificación o bloque | Existen registros dependientes | Revise el mensaje y gestione las dependencias desde la plataforma. |
| El motor de cálculo no responde | Servicio interno no disponible, secreto/configuración ausente o timeout | Intente más tarde y reporte el mensaje al soporte técnico. |
| No aparece una línea base | El cálculo no se guardó o el alcance/modelo no coincide | Ejecute el cálculo y use la acción explícita de guardar. |
| No se generan alertas | Periodos no evaluables, datos insuficientes o umbral/configuración | Revise la configuración y la cantidad/calidad de datos históricos. |
| La estimación falla | Historia insuficiente o motor no disponible | Revise los periodos de facturación e intente nuevamente. |
| Un reporte está incompleto | Faltan facturas, variables, línea base o inventario | Complete los datos fuente y genere de nuevo el informe. |
| La información parece desactualizada | Se modificaron datos operativos o el navegador conserva una vista anterior | Actualice la página y vuelva a consultar. |

Cuando reporte un problema, incluya el módulo, la acción realizada, el periodo y el mensaje de error. No adjunte contraseñas, tokens, secretos ni códigos de autenticación.

## 17. Glosario

| Término | Significado |
|---|---|
| EPM | Empresa prestadora del servicio de energía y fuente de las facturas utilizadas por el sistema. |
| kWh | Kilovatio-hora, unidad de energía consumida. |
| COP | Pesos colombianos. |
| Consumo normalizado | Consumo ajustado a un periodo estándar de 30 días según la regla usada por SIGE. |
| LBEn | Línea Base Energética, referencia de consumo para evaluar el desempeño energético. |
| GDE | Grados-día de enfriamiento, variable climática usada en el análisis energético. |
| Xe | Variable de operación/horarios utilizada en el cálculo conforme a la configuración de la edificación. |
| ARIMA | Modelo estadístico de series temporales utilizado para proyectar consumo. |
| TOTP | Código temporal de un solo uso para autenticación en dos pasos. |
| Prisma ORM | Herramienta que permite a la aplicación consultar y modificar PostgreSQL mediante modelos tipados. |
| Neon | Servicio de PostgreSQL utilizado como base de datos del proyecto. |
| Vercel | Plataforma donde se despliegan los servicios web de SIGE. |

## 18. Alcance y limitaciones de esta versión

Este manual se elaboró a partir del código fuente y documentación disponibles en el repositorio el 4 de noviembre de 2026. No se tuvo acceso a una sesión real de la aplicación ni a las credenciales de un usuario de cada rol; por tanto:

- Los nombres de botones y el orden exacto de algunos formularios pueden variar con la versión desplegada.
- No se incluyeron capturas de pantalla porque no se encontraron imágenes verificables de la interfaz en esta revisión.
- Las opciones exactas de cada usuario dependen de la matriz efectiva de permisos y de los overrides.
- La exportación Excel se documenta como pendiente en el informe del proyecto.
- Las notificaciones por correo o push no deben considerarse disponibles solo por existir una bandeja de alertas.
- Los datos de demostración, nombres de edificaciones y resultados de cálculo dependen de la base de datos activa.

Se recomienda realizar una validación guiada con al menos un usuario de cada rol, incorporar capturas actuales de cada módulo y confirmar los nombres de acciones en el entorno productivo antes de publicar una edición final institucional.

## 19. Referencias internas

- [README del proyecto](../README.md)
- [Guía operativa del repositorio](../AGENTS.md)
- [Esquema Prisma](../prisma/schema.prisma)
- [Matriz de roles y permisos](../src/shared/models/permissions.ts)
- [Catálogo del módulo de datos](../src/features/datos/views/__docs__/Catalogo.mdx)
- [Configuración de despliegue](../vercel.json)
- [Servicio Python](../python/main.py)
- [Diagrama de despliegue](./diagrama_despliegue_sige.md)

---
**Fin del manual de usuario.**

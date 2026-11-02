**SISTEMA EFICIENTE DE LA ENERGÍA**

Andrés Felipe Mosquera García

Esteban Ramirez Montoya

**Director:**

Santiago Horacio Hoyos Velázquez

**Codirector (si aplica):**

Joan Sebastián Ruiz Zapata

Tecnológico de Antioquia - Institución Universitaria

Ingeniería en Software

Medellín, Colombia.

2026

# FICHA TÉCNICA DEL PROYECTO

| **FICHA TÉCNICA — PROYECTO DE SOFTWARE** |  |  |
| --- | --- | --- |
| **Nombre del sistema:** | SIGE-TdeA (Sistema de Información para la Gestión Energética del Tecnológico de Antioquia) |  |
| **Problema que resuelve:** | El TdeA carece de una infraestructura tecnológica que permita monitorear, analizar y gestionar de manera sistemática y basada en datos su consumo energético, lo que dificulta el cumplimiento de la Resolución UPME 016 de 2024 (auditorías cada cuatro años y ahorro mínimo del 15%) y limita su participación futura en comunidades energéticas. |  |
| **Descripción corta del software:** | Sistema web que integra en una sola plataforma la captura, almacenamiento, análisis y visualización de los datos de consumo energético del TdeA, mediante seis módulos: carga de datos, dashboard, análisis estadístico y detección de patrones, alertas de consumo inusual, estimaciones y reportes. |  |
| **Organización / contexto de despliegue:** | Tecnológico de Antioquia – Institución Universitaria (TdeA), institución pública de educación superior, sede principal Calle 78B No. 72A-220, barrio Robledo, Medellín, Colombia. |  |
| **Tipo de sistema:** | ☒ Web    ☐ Móvil    ☐ Escritorio   ☐ API/Servicio    ☐ Otro: _____________ |  |
| **Stack tecnológico (TDG I: propuesto - TDG II: implementado):** | **Frontend:** *tecnología o framework de interfaz de usuario + versión. Si no hay frontend (API pura), escribir "N/A — sistema de backend/API".* | Next.js 14.2 (React 18.3) con Tailwind CSS 4 y framer-motion 11 |
|  | **Backend:** *lenguaje + framework + versión. Si la lógica está en el mismo frontend (SPA con Firebase, por ejemplo), indicarlo.* | Next.js 14.2 (Server Actions y Route Handlers); motor de análisis en Python 3.12 (numpy, pandas, scipy, statsmodels) invocado como CLI JSON |
|  | **Base de datos:** *sistema de gestión + versión + tipo. Si hay más de una (SQL + caché, por ejemplo), listar ambas.* | PostgreSQL (relacional) con Prisma ORM 5.22 |
|  | **Infraestructura/despliegue:** *dónde corre el sistema y cómo se despliega. En TDG I puede ser "propuesto" con opciones; en TDG II debe ser el entorno real donde funciona.* | Ejecución en desarrollo local (Node.js + `npm run dev`) con base de datos PostgreSQL accesible por variable de entorno `DATABASE_URL`; el despliegue en producción y su URL se documentan en la sección 11. |
| **Enlace de acceso al sistema (Sólo TDG II):** | *\[https:// o “ver manual de instalación"]* | *\[Pendiente de despliegue en producción — ver sección 11.4 “Manual de instalación” para ejecutar el sistema localmente]* |
| **Metodología o Marco de Trabajo ágil utilizado:** | ☒ Scrum    ☐ Kanban    ☐ XP    ☐ Otro: _____________ |  |
| **Número de sprints:** | 2 sprints de 2 semanas, dentro de la fase de diseño y desarrollo del sistema (semanas 9–12 del cronograma) |  |
| **Resumen del análisis:** | Procesamiento de los datos de consumo con Python (numpy, pandas, scipy, statsmodels): cálculo de indicadores estadísticos, depuración de atípicos por banda de confianza por mes —±10 % (ec. 3) por defecto; rescate IC ec. 4-5 (±2·DesvEst) con N ≥ 10 si los depurados quedan < 36— (§7.5.1 de la Resolución 16 de 2024), caracterización de la evolución del consumo y estimación de líneas base energéticas (enfoque CRISP-DM). |  |
| **Resumen del diseño:** | Arquitectura web monolito MVC sobre Next.js App Router (vista en React, controlador en Server Actions/Route Handlers, modelo en PostgreSQL vía Prisma) con seis módulos funcionales: carga y gestión de datos, dashboard de visualización, análisis estadístico y detección de patrones, alertas de consumo inusual, estimaciones y reportes; seguridad por roles (5 roles × 6 módulos). |  |
| **Resumen de la implementación:** | Sistema web funcional: autenticación JWT con cookie httpOnly y gestión de usuarios (5 roles × 6 módulos de acceso con permisos temporales/permanentes auditados); módulo de gestión de datos con 6 secciones (Resumen, Facturas EPM, Equipos, Variables Operativas, Líneas Base y Ajustes) y 3 modos (Carga, Visualización, Gestión), con tres asistentes de importación Excel/CSV de 4 pasos; motor de líneas base energéticas con los 4 modelos de la Resolución UPME 0016 de 2024, gráfica SVG interactiva y tablas de transparencia; análisis estadístico con detección de épocas de consumo inusual y estimaciones ARIMA exploratorias a 1–3 meses sobre series UPME depuradas; y módulo espacial con campus 3D, consulta por piso e importación local validada de medidas desde DXF, con selección visual de contornos soportados en un visor 2D. Alertas y reportes continúan en construcción. |  |
| **Resumen de la validación:** | 18 historias de Storybook (95 pruebas) ejecutadas con Vitest en navegador (Chromium/Playwright) más revisión de accesibilidad (addon a11y); validación de datos con Zod en cliente y servidor; lint y verificación de tipos en verde. Las pruebas de usabilidad con usuarios reales se encuentran pendientes (sección 10.2). |  |
| **Versión del documento:** | ☒ v1.0 (TDG I)   ☐ v2.0 (correcciones)  ☐ v3.0 (TDG II — Entrega final) |  |

- **DECLARACIÓN DE USO DE INTELIGENCIA ARTIFICIAL**

|  |
| --- |
| **⚠ IMPORTANTE:**  *Esta sección es OBLIGATORIA. El uso no declarado de IA tiene consecuencias disciplinarias.*<br>Declarar uso de IA no penaliza la nota. El uso no declarado SÍ tiene consecuencias disciplinarias. |

| **DECLARACIÓN DE AUTORÍA Y USO DE IA GENERATIVA** |
| --- |
| ☐ No se utilizaron herramientas de IA generativa en ninguna sección de este trabajo.<br>☐ Se utilizaron herramientas de IA generativa. Detalle a continuación: |

| **Herramienta** | **Sección(es) del documento** | **Propósito** | **Acción de verificación realizada** |
| --- | --- | --- | --- |
| Ej: Claude | Marco conceptual | Borrador de definiciones | Verificación de fuentes y reescritura sustancial |

*Los autores declaramos que todo el contenido de este informe fue verificado, comprendido y puede sustentarse en su totalidad.*

Firma Estudiante 1: _______________________________     Firma Estudiante 2: _______________________________

**DEDICATORIA**

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Sección opcional. Si se incluye, redactar máximo media página. Eliminar si no aplica.* |

*\[Texto de dedicatoria]*

# AGRADECIMIENTOS

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Sección opcional. Reconocimiento a personas e instituciones que aportaron al trabajo. Máximo una página. Eliminar si no aplica.* |

\[Texto de agradecimientos]

# RESUMEN

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Entre 200 y 300 palabras. Estructura: (1) contexto y problema, (2) objetivo general, (3) metodología ágil y número de sprints, (4) resultado principal del sistema, (5) conclusión breve. Redactar en tiempo pasado. Sin citas. Sin mencionar tecnologías que no están en el producto. El resumen de un informe técnico es operativo, no narrativo. Evitar frases como "el presente trabajo tiene como objetivo".* |

El consumo energético en varias instituciones de educación superior colombianas carece de un sistema tecnológico que ayude a monitorizar, analizar e identificar patrones basados en datos históricos. Esto limita la capacidad de las instituciones para cumplir con la Resolución 16 de 2024 de UPME, que exige auditorias energéticas cada cuatro años y un ahorro mínimo del 15%. Este trabajo propone el desarrollo de SIGE-TdeA (un sistema de gestión energética para el Tecnológico de Antioquia) mediante caracterización estadística, análisis de datos e identificación de patrones de consumo energético. Para lograrlo, como se trata de un proyecto de desarrollo de software, la metodología Scrum es adoptada en sprints de dos semanas, combinada con CRISP-DM para el componente analítico, procesando dos años de facturas de servicios EPM y realizando un inventario de equipos eléctricos.

El sistema utiliza una arquitectura web por capas, con seis módulos funcionales: carga de datos, panel interactivo, análisis estadístico, alertas de consumo inusual, estimaciones predictivas e informes. Se realizarán pruebas funcionales y de usabilidad con el personal administrativo de la institución para validar la capacidad del sistema para identificar patrones estacionales correlacionados con el calendario académico, detectar anomalías de consumo con umbrales configurables y generar proyecciones con información confiable.

Se espera que SIGE-TdeA mejore el uso de los recursos energéticos, reduzca significativamente el tiempo dedicado a consolidar la información energética de la institución, transforme los datos de facturación en conocimiento aplicable para la toma de decisiones de eficiencia energética y establezca la base tecnológica para la integración del TdeA en las comunidades energéticas reguladas por el Decreto 2236 de 2023 como mecanismo académico de aporte de la institución de educación pública a la transición energética, mitigación del cambio climático y desarrollo sostenible.

**Palabras clave:** Eficiencia energética, Análisis de patrones de consumo, Gestión de la energía

# ABSTRACT

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Traducción fiel del resumen al inglés. Misma extensión y estructura. Verificar coherencia con la versión en español antes de entregar.* |

Energy consumption in several Colombian higher education institutions lacks a technological system that helps monitor, analyse, and identify patterns based on historical data. This limits the ability of institutions to comply with UPME's Resolution 16 of 2024, which requires energy audits every four years and a minimum savings of 15%. This work proposes the development of SIGE-TdeA (an energy management system for Tecnológico de Antioquia) through statistical characterization, data analysis and identification of energy consumption patterns. To achieve this, as it is a software development project, the Scrum methodology is adopted in two-week sprints, combined with CRISP-DM for the analytical component, processing two years of EPM utility invoices and performing an inventory of electrical equipment.

The system uses a layered web architecture, with six functional modules: data loading, interactive dashboard, statistical analysis, unusual consumption alerts, predictive estimates and reports. Functional and usability tests will be carried out with the administrative staff of the institution to validate the system's ability to identify seasonal patterns correlated with the academic calendar, detect consumption anomalies with configurable thresholds and generate projections with reliable information.

It is expected that the SIGE-TdeA will improve the use of energy resources, significantly reduce the time spent consolidating the institution's energy information, transform billing data into applicable knowledge for energy efficiency decision-making and establish the technological basis for the integration of TdeA in the energy communities regulated by Decree 2236 of 2023 as an academic mechanism for the contribution of the public education institution to the energy transition, climate change mitigation and sustainable development.

**Keywords:** Energy Efficiency, Consumption Pattern Analysis, Energy Management

# TABLA DE CONTENIDO

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Generar automáticamente usando la función de Tabla de contenido del procesador de texto (Referencias → Tabla de contenido). Actualizar antes de cada entrega. Incluir hasta nivel 3.* |

[FICHA TÉCNICA DEL PROYECTO 2](#ficha-técnica-del-proyecto)

[AGRADECIMIENTOS 5](#agradecimientos)

[RESUMEN 6](#resumen)

[ABSTRACT 6](#abstract)

[TABLA DE CONTENIDO 8](#tabla-de-contenido)

[ÍNDICE DE FIGURAS 10](#índice-de-figuras)

[ÍNDICE DE TABLAS 11](#índice-de-tablas)

[LISTA DE ABREVIATURAS Y SIGLAS 12](#lista-de-abreviaturas-y-siglas)

[1\. INTRODUCCIÓN 13](#1-introducción)

[2\. CONTEXTO DEL PROBLEMA 14](#2-contexto-del-problema)

[2.1. Definición del problema 14](#21-definición-del-problema)

[2.2. Descripción del negocio y del proceso a intervenir 15](#22-descripción-del-negocio-y-del-proceso-a-intervenir)

[2.3. Actores y roles del sistema 16](#23-actores-y-roles-del-sistema)

[2.4. Justificación técnica 17](#24-justificación-técnica)

[3.1. Antecedentes técnicos 19](#31-antecedentes-técnicos)

[3.2. Marco técnico 20](#32-marco-técnico)

[*3.2.1. Conceptos del dominio del problema* 20](#321-conceptos-del-dominio-del-problema)

[*3.2.2. Conceptos tecnológicos* 21](#322-conceptos-tecnológicos)

[4\. REGISTRO DE DECISIONES TÉCNICAS (ADR) 22](#4-registro-de-decisiones-técnicas-adr)

[5\. OBJETIVOS 23](#5-objetivos)

[5.1. Objetivo general 23](#51-objetivo-general)

[5.2. Objetivos específicos 23](#52-objetivos-específicos)

[6\. DISEÑO DEL PROYECTO 24](#6-diseño-del-proyecto)

[6.1. Metodología y equipo 24](#61-metodología-y-equipo)

[6.2. Alcance del sistema 24](#62-alcance-del-sistema)

[6.3. Plan de sprints y cronograma 25](#63-plan-de-sprints-y-cronograma)

[7\. REQUERIMIENTOS DEL SISTEMA 27](#7-requerimientos-del-sistema)

[7.1. Visión de la solución 27](#71-visión-de-la-solución)

[7.2. Product backlog 31](#72-product-backlog)

[8\. PLANIFICACIÓN DE LOS SPRINT 34](#8-planificación-de-los-sprint)

[8.1. Sprint 1 34](#81-sprint-1)

[*8.1.1. Historias de usuario del Sprint 1* 34](#811-historias-de-usuario-del-sprint-1)

[*8.1.2. Revisión del Sprint 1* 35](#812-revisión-del-sprint-1)

[*8.1.3. Evidencias del Sprint 1* 36](#813-evidencias-del-sprint-1)

[8.2. Sprint 2 37](#82-sprint-2)

[*8.2.1. Historias de usuario del Sprint 2* 37](#821-historias-de-usuario-del-sprint-2)

[*8.2.2. Revisión del Sprint 2* 40](#822-revisión-del-sprint-2)

[*8.2.3. Evidencias del Sprint 2* 41](#823-evidencias-del-sprint-2)

[9\. ARQUITECTURA IMPLEMENTADA 37](#9-arquitectura-implementada)

[9.1. Diagrama de arquitectura 37](#91-diagrama-de-arquitectura)

[9.2. Diagrama de clases o estructura de componentes 37](#92-diagrama-de-clases-o-estructura-de-componentes)

[9.3. Modelo de datos 37](#93-modelo-de-datos)

[10\. CALIDAD Y PRUEBAS 38](#10-calidad-y-pruebas)

[10.1. Pruebas funcionales 38](#101-pruebas-funcionales)

[10.2. Pruebas de usabilidad 38](#102-pruebas-de-usabilidad)

[11\. DESPLIEGUE DEL SISTEMA 40](#11-despliegue-del-sistema)

[11.1. Diagrama de despliegue 40](#111-diagrama-de-despliegue)

[11.2. Requisitos de instalación y ejecución 40](#112-requisitos-de-instalación-y-ejecución)

[11.3. Manual de usuario 40](#113-manual-de-usuario)

[11.4. Manual de instalación 41](#114-manual-de-instalación)

[11.5. Resumen técnico del software 41](#115-resumen-técnico-del-software)

[12\. CIERRE DEL PROYECTO 42](#12-cierre-del-proyecto)

[12.1. Resultados por objetivo 42](#121-resultados-por-objetivo)

[12.2. Retrospectiva del proceso 42](#122-retrospectiva-del-proceso)

[12.3. Conclusiones 42](#123-conclusiones)

[12.4. Trabajo futuro 43](#124-trabajo-futuro)

[13\. REFERENCIAS 44](#13-referencias)

[ANEXOS 45](#anexos)

[Anexo A — Manual de usuario 45](#anexo-a--manual-de-usuario)

[Anexo B — Manual de instalación 45](#anexo-b--manual-de-instalación)

[Anexo C — \[Nombre del anexo adicional\] 45](#anexo-c--nombre-del-anexo-adicional)

# ÍNDICE DE FIGURAS

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Generar automáticamente. Incluir si hay 3 o más figuras. Cada figura en el documento debe tener número, título y fuente en la nota inferior. Formato de cada figura en el cuerpo: Figura N. Título. Nota. Elaboración propia (año).* |

[fig 1. Diagrama Causa Efecto. Nota. Elaboración propia (2026).](#_toc239076990)

[fig 2. Diagrama BPMN - proceso AS-IS de gestión de la información de consumo energético en el TdeA. Nota. Elaboración propia (2026)](#_toc239076991)

[fig 3. Diagrama BPMN — proceso TO-BE de gestión de la información de consumo energético en el TdeA con el sistema. Nota. Elaboración propia (2026).](#_fig03)

[fig 4. Módulo de carga de datos. Nota. Elaboración propia (2026).](#_toc239076992)

[fig 5. Módulo de Dashboard. Nota. Elaboración propia (2026).](#_toc239076993)

[fig 6. Módulo de análisis estadístico. Nota. Elaboración propia (2026).](#_toc239076994)

[fig 7. Módulo de Alertas. Nota. Elaboración propia (2026).](#_toc239076995)

[fig 8. Módulo de Estimaciones. Nota. Elaboración propia (2026).](#_toc239076996)

[fig 9. Módulo de Reportes. Nota. Elaboración propia (2026).](#_toc239076997)

[fig 10. Arquitectura propuesta — monolito MVC en capas (vista de alto nivel). Nota. Elaboración propia (2026).](#_toc239076998)

[fig 11. Módulo de autenticación — pantalla de inicio de sesión con el árbol de bienvenida y el control de tema. Nota. Elaboración propia (2026).](#_fig11)

[fig 12. Gestión de usuarios — listado de usuarios con sus roles y ficha de detalle del administrador de TI. Nota. Elaboración propia (2026).](#_fig12)

[fig 13. Asistente de importación de Facturas EPM — paso 2 «Mapeo» con detección automática de encabezados. Nota. Elaboración propia (2026).](#_fig13)

[fig 14. Asistente de importación de Equipos — segmentación por edificación, bloque y espacio con creación inline de catálogo. Nota. Elaboración propia (2026).](#_fig14)

[fig 15. Pestaña Gestión — edición en línea de una factura y diálogo de confirmación de borrado. Nota. Elaboración propia (2026).](#_fig15)

[fig 16. Líneas Base — selección de los cuatro modelos UPME y resultado del cálculo con persistencia habilitada. Nota. Elaboración propia (2026).](#_fig16)

[fig 17. Gráfica de línea base interactiva — banda de confianza, meses descartados en ámbar, residuos y leyenda conmutable. Nota. Elaboración propia (2026).](#_fig17)

[fig 18. Tablas de transparencia — preparación de datos (crudo → normalizado a 30 días → decisión de banda: ±10 % por defecto o rescate IC ec. 4-5) y jerarquía factura → bloque → espacio. Nota. Elaboración propia (2026).](#_fig18)

[fig 19. Drawer «Asignar permiso» — permiso temporal con duración y advertencia para la excepción permanente fuera de la matriz. Nota. Elaboración propia (2026).](#_fig19)

[fig 20. Sección Resumen — tarjetas de indicadores navegables y guía animada «Cómo funciona». Nota. Elaboración propia (2026).](#_fig20)

[fig 21. Diagrama de arquitectura del sistema (capas MVC y flujo de una petición). Nota. Elaboración propia (2026).](#_fig21)

[fig 22. Diagrama de componentes del sistema. Nota. Elaboración propia (2026).](#_fig22)

[fig 23. Diagrama de clases del sistema. Nota. Elaboración propia (2026).](#_fig23)

[fig 24. Modelo de datos relacional (esquema Prisma sobre PostgreSQL). Nota. Elaboración propia (2026).](#_fig24)

[fig 25. Diagrama de despliegue del sistema. Nota. Elaboración propia (2026).](#_fig25)

# ÍNDICE DE TABLAS

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Generar automáticamente. Formato: Tabla N. Título. Nota. Elaboración propia (año).* |

[Tabla 1. Declaración de actores y roles. Nota. Elaboración propia (2026) 17](#_toc239076981)

[*Tabla 2. Antecedentes del proyecto. Nota. Elaboración propia (2026)* 20](#_toc239076982)

[*Tabla 3. Registro de decisiones técnicas. Nota. Elaboración propia (2026)* 22](#_toc239076983)

[*Tabla 4. Roles del equipo. Nota. Elaboración propia (2026)* 24](#_toc239076984)

[*Tabla 5. Definición del alcance. Nota. Elaboración propia (2026)* 25](#_toc239076985)

[Tabla 6. Plan de sprints. Nota. Elaboración propia (2026) 26](#_toc239076986)

Tabla 7. Estado de implementación de los módulos. Nota. Elaboración propia (2026) 32

[*Tabla 8. Product backlog. Nota. Elaboración propia (2026)* 33](#_toc239076987)

Tabla 9. Historia de Usuario HU-01. Nota. Elaboración propia (2026) 34

Tabla 10. Historia de Usuario HU-02. Nota. Elaboración propia (2026) 34

Tabla 11. Historia de Usuario HU-03. Nota. Elaboración propia (2026) 34

Tabla 12. Historia de Usuario HU-15. Nota. Elaboración propia (2026) 35

Tabla 13. Historia de Usuario HU-18. Nota. Elaboración propia (2026) 35

Tabla 14. Historia de Usuario HU-19. Nota. Elaboración propia (2026) 35

Tabla 15. Historia de Usuario HU-21. Nota. Elaboración propia (2026) 35

Tabla 16. Revisión y Retrospectiva del Sprint 1. Nota. Elaboración propia (2026) 36

Tabla 17. Historia de Usuario HU-04. Nota. Elaboración propia (2026) 37

Tabla 18. Historia de Usuario HU-05. Nota. Elaboración propia (2026) 37

Tabla 19. Historia de Usuario HU-07. Nota. Elaboración propia (2026) 38

Tabla 20. Historia de Usuario HU-16. Nota. Elaboración propia (2026) 38

Tabla 21. Historia de Usuario HU-17. Nota. Elaboración propia (2026) 39

Tabla 22. Historia de Usuario HU-20. Nota. Elaboración propia (2026) 40

Tabla 23. Revisión y Retrospectiva del Sprint 2. Nota. Elaboración propia (2026) 40

Tabla 24. Pruebas funcionales. Nota. Elaboración propia (2026) 46

Tabla 25. Requisitos de instalación. Nota. Elaboración propia (2026) 48

Tabla 26. Resumen técnico del software. Nota. Elaboración propia (2026) 49

# LISTA DE ABREVIATURAS Y SIGLAS

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Incluir en orden alfabético todas las siglas y abreviaturas usadas en el documento.* |

| **Abreviatura / Sigla** | **Definición** |
| --- | --- |
| API | Application Programming Interface |
| ADR | Architecture Decision Record |
| BPMN | Business Process Model and Notation |
| CRISP-DM | Cross-Industry Standard Process for Data Mining |
| DoD | Definition of Done — Definición de Terminado |
| EPM | Empresas Públicas de Medellín |
| FNCER | Fuentes No Convencionales de Energía Renovable |
| HU | Historia de Usuario |
| JWT | JSON Web Token |
| KPI | Key Performance Indicator (Indicador Clave de Desempeño) |
| kWh | Kilovatio-hora |
| LBEn | Línea Base Energética |
| MME | Ministerio de Minas y Energía |
| OAS | OpenAPI Specification |
| ODS | Objetivos de Desarrollo Sostenible |
| ORM | Object-Relational Mapping |
| PEN | Plan Energético Nacional |
| PJ | Petajoule |
| SGE | Sistema de Gestión Energética |
| TdeA | Tecnológico de Antioquia |
| UPME | Unidad de Planeación Minero Energética |

|  |  |
| --- | --- |
| **TDG I** | **Secciones 1–6: entregadas en Trabajo de Grado I**<br>*El documento se entrega hasta la sección (backlog). El asesor aprueba antes de iniciar TDG II. Las observaciones del jurado deben estar respondidas en el historial de la ficha técnica.* |

# 1. INTRODUCCIÓN

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Máximo 2 páginas. Presentar: contexto general del problema, motivación del proyecto, síntesis de la solución propuesta y organización del documento. No repetir el resumen. Incluir mínimo 3 citas en el texto.* |
| **👁 ASESOR — verificar:**  *Verificar que la introducción no supera 2 páginas, incluye citas y no repite el resumen.* |

La gestión eficiente de la energía se ha convertido en una cuestión muy importante para la adopción de estrategias en las instituciones públicas en Colombia, debido al contexto global de la transición energética, las comunidades energéticas y las obligaciones normativas impuestas por la UPME a través de la Resolución 016 de 2024. El TdeA, como institución de educación superior, enfrenta el reto de optimizar su consumo energético, esto sin contar con las herramientas tecnológicas necesarias que ayuden a monitorear, analizar y gestionar dicho consumo de una manera más practica y sistemática donde las decisiones que se tomen al respecto estén basadas en datos.

El presente trabajo de grado propone el desarrollo de un sistema de software para la gestión eficiente de la energía en el TdeA, basado en la caracterización estadística, el análisis de datos históricos de consumo y la identificación de patrones; permitiendo a los administradores visualizar el comportamiento del consumo energético a lo largo del tiempo, recibir alertas ante alteraciones inusuales en el consumo energético y contar con estimaciones de tendencias, todo ello a partir de las facturas de energía emitidas por EPM y del inventario de equipos eléctricos presentes en cada bloque de la sede principal.

El desarrollo se enmarca en la metodología ágil Scrum, organizada en sprints de dos semanas, y se complementa con el proceso CRISP-DM para realizar el proceso analítico de los datos de consumo. La investigación tiene un enfoque mixto: cuantitativo en el análisis estadístico y cualitativo en la elicitación de requisitos con los actores del TdeA involucrados en la gestión de la infraestructura energética.

El alcance del proyecto comprende el levantamiento del inventario energético, la recopilación y análisis de hasta dos años de historia de facturación, el desarrollo del sistema con módulos funcionales de carga de datos, dashboard, reportes, alertas y estimaciones de consumo, y la validación del sistema mediante pruebas funcionales y de usabilidad. Quedan excluidos la instalación de hardware de medición y la integración del TdeA en una comunidad energética, aunque el sistema sienta las bases tecnológicas para que dicha integración sea viable en el futuro.

# 2. CONTEXTO DEL PROBLEMA

|  |
| --- |
| **✎ INSTRUCCIÓN:**  Objetivo: que cualquier ingeniero que lea el informe entienda el problema en menos de 3 páginas.<br>No incluir aquí antecedentes bibliográficos generales esos van en la sección 3. |

## 2.1. Definición del problema

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Describir el problema con evidencia de su existencia (datos, informes, situaciones documentadas en la organización). Delimitar a un contexto específico: quién lo padece, dónde, con qué impacto. Incluir obligatoriamente un diagrama causa efecto o diagrama de pescado que responda al problema identificado.* |

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Figura N. Diagrama Causa Efecto. Nota. Elaboración propia (año). — Insertar aquí* |

En los últimos años, la transición energética ha sido impulsada por el cambio en el sistema energético mundial que ha surgido por la urgencia de reducir los gases de efecto invernadero, disminuir los efectos del cambio climático y garantizar que la energía llegue a todas partes. Según Campetrol (2020) a partir de lo anterior surgieron diferentes movimientos ambientalistas y acuerdos internacionales como el Acuerdo de París y los Objetivos de Desarrollo Sostenible (ODS) que están encaminados a definir estrategias de mitigación a problemáticas ambientales, sociales y económicas.

En Colombia, la transformación energética se ha impulsado debido a diversas políticas públicas establecidas en el Plan Nacional de Desarrollo 2022-2026 que buscan promover el uso de fuentes no convencionales de energía renovable (FNCER), su generación y comercialización, de esta forma, se apuesta por una transición energética justa impulsando programas que van dirigidos a sustituir fuentes de energía basados en biomasa y fomentar la creación de Comunidades Energéticas (MME, 2024).

De acuerdo con la UPME (2025), la eficiencia energética aporta de forma directa a la competitividad y la industrialización, al reducir costos directos de los procesos productivos y promover nuevas industrias sostenibles. Pese a ello, muchas instituciones aún no cuentan con sistemas que integren el monitoreo del consumo de la energía y tampoco el análisis de datos que ayuden a mejorar la eficiencia energética.

Además, la falta de sistemas que incorporen funcionalidades de gestión energética que preparen a las instituciones para la transacción de energía con comunidades energéticas hacen que no se adopten modelos innovadores de gestión energética. Como consecuencia, no se aprovechan los beneficios que el gobierno colombiano ha dispuesto para este tipo de iniciativas. En este sentido, la UPME (2024), a través de la resolución 16 de 2024, establece que: “Las entidades públicas que implementen medidas de eficiencia energética, así como proyectos de autogeneración con Fuentes No Convencionales de Energía Renovable (FNCER), podrán utilizar los ahorros producto de dichos proyectos para pagar las inversiones realizadas y nuevas inversiones.”

En el caso del TdeA, esta problemática es evidente debido a la carencia de una infraestructura tecnológica necesaria que permita una participación activa en los modelos de comunidades energéticas impulsados y regulados por la normativa colombiana. Así mismo, la falta de herramientas que permitan gestionar de manera eficiente el consumo de energía mediante el análisis de patrones genera que la institución tenga perdidas no solo en materia económica, sino también en la oportunidad de posicionarse como un actor clave en la transición energética del país. En este contexto, según la UPME (2024), los objetivos del Plan Energético Nacional de Colombia, se fundamentan en adoptar nuevas tecnologías, buenas prácticas en la operación, y hábitos que permitan optimizar los recursos energéticos.

En consecuencia, nace la necesidad de desarrollar un sistema que permita gestionar de forma eficiente la energía a través de la detección de patrones, facilitando la adopción futura de modelos de gestión energética más avanzados.

A partir de lo anterior se plantea la siguiente pregunta problémica:

¿Cómo puede un sistema para la gestión eficiente de la energía, basado en el análisis de patrones de consumo, contribuir a la mejora del uso energético en el Tecnológico de Antioquia?

![](figuras/out/fig01.png)

<a id="_toc239076990"></a>*fig 1. Diagrama Causa Efecto. Nota. Elaboración propia (2026).*

## 2.2. Descripción del negocio y del proceso a intervenir

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Describir la organización y el proceso específico que el sistema va a soportar o automatizar.*<br>Incluir obligatoriamente un diagrama BPMN (AS-IS: proceso actual). Si hay proceso TO-BE (mejorado con el sistema), incluirlo también.<br>El diagrama debe tener número, título y nota de fuente. |
| **👁 ASESOR — verificar:**  *Verificar que el diagrama BPMN refleja un proceso real, no un flujo genérico. Que los actores del BPMN coinciden con los actores de 1.3.* |

El TdeA es una institución pública de educación superior adscrita al Departamento de Antioquia, con su sede principal ubicada en la Calle 78B No. 72A-220, en el barrio Robledo, municipio de Medellín. La institución cumple el propósito de capacitar talento humano integral mediante distintos programas académicos tanto en modalidad presencial y virtual, por lo tanto, la institución cuenta con múltiples bloques académicos y administrativos en su sede principal, donde el consumo de energía eléctrica representa una de las mayores cuentas en el gasto operativo y su manejo se realiza actualmente de manera reactiva, sin contar con herramientas tecnológicas que ayuden a monitorear y analizar dicho consumo de forma sistemática, por lo tanto, el sistema a desarrollar interviene directamente en este contexto, para ofrecer una plataforma de información que transforme los datos históricos de facturación en conocimiento útil para la toma de decisiones energéticas institucionales.

El proyecto interviene el proceso de gestión del consumo energético de la Dirección Administrativa y Financiera del TdeA, específicamente en los subprocesos de:

- Recopilación y registro de información de consumo a partir de facturas de EPM
- Levantamiento y mantenimiento del inventario de equipos eléctricos por bloque
- Monitoreo y seguimiento del comportamiento histórico del consumo
- Generación de reportes para la toma de decisiones orientadas a la eficiencia energética.

Estos subprocesos, que en la actualidad se gestionan de manera manual y desarticulada, serán integrados y automatizados a través de los módulos funcionales del sistema propuesto.

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Figura N. Diagrama BPMN — proceso AS-IS de \[nombre del proceso]. Nota. Elaboración propia (año). — Insertar aquí* |

![](figuras/out/fig02.png)

<a id="_toc239076991"></a>*fig 2. Diagrama BPMN - proceso AS-IS de gestión de la información de consumo energético en el TdeA. Nota. Elaboración propia (2026)*

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Figura N. Diagrama BPMN — proceso TO-BE con el sistema (si aplica). Nota. Elaboración propia (año). — Insertar aquí* |

![](figuras/out/fig03.png)

<a id="_fig03"></a>*fig 3. Diagrama BPMN — proceso TO-BE de gestión de la información de consumo energético en el TdeA con el sistema. Nota. Elaboración propia (2026).*

## 2.3. Actores y roles del sistema

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Describir cada tipo de usuario del sistema: responsabilidades, permisos y acciones principales dentro del software.* Esta tabla debe ser coherente con el backlog: cada HU debe asociarse a uno de estos roles. |
| **👁 ASESOR — verificar:**  *Verificar que los roles de esta tabla aparecen en las historias de usuario del backlog.* |

| **Actor / Rol** | **Descripción** | **Permisos y acciones principales en el sistema** |
| --- | --- | --- |
| Administrador | Responsable de la operación de las instalaciones energéticas del TdeA. | Recibe y archiva las facturas de EPM, carga los datos de facturación y el inventario de equipos, consulta los reportes generados, gestiona usuarios y actualiza el inventario energético. |
| Usuario final | Administrativo y/o Financiero: actor estratégico que utiliza la información del sistema para la toma de decisiones de gasto energético, asignación de presupuesto y formulación de políticas de eficiencia energética. | Accede al dashboard y a los reportes consolidados del sistema. |
| Personal docente y administrativo por bloque | Usuarios indirectos cuyo comportamiento de consumo energético es capturado a través del inventario de equipos eléctricos; no interactúan directamente con el sistema. | Son sujeto de las políticas de ahorro energético que se deriven de los análisis realizados por el sistema. |

<a id="_toc239076981"></a>*Tabla 1. Declaración de actores y roles. Nota. Elaboración propia (2026)*

## 2.4. Justificación técnica

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *3–4 párrafos que argumenten: (1) por qué la solución debe ser software, (2) qué impacto tiene en el proceso identificado, (3) por qué la tecnología propuesta es adecuada para este contexto.*<br>No es una justificación social genérica: es una justificación de ingeniería. |

El desarrollo de un sistema de gestión de la energía para el TdeA nace por la necesidad de mejorar el uso que se les da a los recursos energéticos dentro de las instituciones y al hecho de tener que adaptarse a los cambios que se están produciendo en el sector energético a nivel mundial.

La transición energética está haciendo que cada vez más instituciones adopten modelos más sostenibles para la generación y consumo de energía, en los cuales los usuarios no solo consumen energía, sino que también pueden ayudar a generarla, gestionarla e incluso participar activamente en transacciones de energía como comunidades energéticas. En este contexto, los procesos de digitalización se convierten en una herramienta fundamental para apoyar los procesos de eficiencia energética, acompañándolos de otros servicios como carga flexible, y programas específicos de respuesta de la demanda, la digitalización facilita el cambio hacia un usuario informado y hacia un prosumidor (UPME, 2025).

El desarrollo de un sistema de gestión de la energía para el TdeA responde a la necesidad de que la institución cuente con una herramienta de software que se capaz de ayudar de forma sistémica en la captura, el almacenamiento y el análisis de datos de consumo energético, ya que un proceso manual y desarticulado, provoca que no se logren identificar patrones de consumo ni generar alertas oportunas en cuanto a las alteraciones en el consumo energético de la institución; solo una solución a través del software puede hacer que se integre adecuadamente los datos que aportan las facturas de EPM y el inventario de equipos, y aplicar técnicas de análisis estadístico sobre estos datos. Esto permite que el TdeA cumpla con la Resolución UPME 016 de 2024 (auditorías cada cuatro años y ahorro mínimo del 15%) y que cuente con la base tecnológica necesaria para una eventual integración en comunidades energéticas.

Por lo tanto, el desarrollo de un sistema de gestión eficiente de la energía para el TdeA permitirá que la capacidad energética en la institución aumente, debido a que, el monitoreo y análisis de datos en tiempo real, ayudaran a mejorar el uso que se le da a la energía y la toma de mejores decisiones basadas en información confiable. Además, el desarrollo de este sistema contribuye a que se fortalezcan las capacidades del TdeA a la hora de asumir retos relacionados con la transición energética.

Este proyecto tiene un componente innovador ya que combina la gestión energética con el análisis de datos y detección de patrones, que le permitirán a la institución prepararse para adoptar tecnologías que le faciliten el intercambio de información y recursos con las comunidades energéticas. Esto es esencial, teniendo en cuenta que, a diferencia de las soluciones que se hallan en el mercado, esta propuesta se adapta a las necesidades específicas de la institución.

Teniendo en cuenta lo anterior, El desarrollo de este sistema le permitirá al TdeA tener una gestión energética más eficiente que contribuya a la reducción de costos, un menor impacto ambiental, el uso responsable de recursos limitados, mejorar el rendimiento energético y posicionarse como un referente en el desarrollo de soluciones tecnológicas orientadas a la sostenibilidad energética.

3. **ESTADO DEL ARTE Y MARCO TÉCNICO**

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Esta sección* NO es una enciclopedia de tecnologías. Es la evidencia de que el equipo investigó antes de diseñar.<br>Importante: incluir solo conceptos o tecnologías que se usarán realmente en el desarrollo. |

## 3.1. Antecedentes técnicos

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Mínimo 4 trabajos previos (proyectos, artículos, sistemas similares) relacionados con el problema o la solución.*<br>Para cada uno: título, autores, año, fuente, qué resolvieron y qué aporta a este proyecto.<br>Priorizar fuentes de los últimos 5 años. Citar en APA 7. |

| **Referencia (APA)** | **Solución propuesta** | **Tecnologías usadas** | **Aporte a este proyecto** |
| --- | --- | --- | --- |
| Rockwell Automation (2024). FactoryTalk Energy Manager. | Monitoreo y optimización energética en entornos industriales mediante tableros preconstruidos que contextualizan datos de energía con variables de producción | IoT, DataOps, analítica avanzada | Evidencia la aplicación de IoT y analítica en gestión energética; SIGE-TdeA adapta este enfoque sin depender de hardware, para el contexto de una institución educativa |
| Valora Analitik (2024). Modelo “Energía 4.0” de Azimut Energía — plataforma CIRA (Control Inteligente y Remoto de Activos). | Gestión energética 4.0 (compra, uso, sustitución tecnológica y generación distribuida) mediante hardware propietario, IA y nube | Hardware propietario, inteligencia artificial, nube | Muestra un modelo integral de gestión energética; a diferencia de CIRA, SIGE-TdeA opera sobre los datos de facturas existentes sin requerir infraestructura física adicional |
| EPM (2024). Programa de eficiencia energética — Telenergy. | Asesoría técnica, financiamiento y telemetría para monitoreo en tiempo real de activos eléctricos | Telemetría, medición inteligente | Referente del prestador de servicios públicos local; SIGE-TdeA se enfoca en el análisis de los datos de facturación de EPM, no en la telemetría de campo |
| Franco et al. (2024). Sistemas de gestión energética (SGE). | Plataformas de software que integran captura, almacenamiento, procesamiento y visualización de datos de consumo, con módulos de alertas y proyecciones | Módulos de alertas, proyecciones y reportes | Fundamenta la estructura modular de SIGE-TdeA, que añade un módulo de inventario energético para correlacionar consumo real y teórico |
| Ahmed, M. A., Chavez, S. A., Eltamaly, A. M., Garces, H. O., Rojas, A. J., & Kim, Y.-C. (2022). Toward an intelligent campus: IoT platform for remote monitoring and control of smart buildings. Sensors, 22(23), 9045. https://doi.org/10.3390/s22239045 | Plataforma IoT para monitoreo y control remoto de edificios universitarios inteligentes con dashboard web accesible a distintos actores institucionales | IoT, dashboards web, gestión de roles de usuario, KPI energéticos | Fundamenta la gestión de roles de usuario y la visualización de indicadores de desempeño energético en SIGE-TdeA; demuestra que centralizar la información energética en un dashboard facilita la toma de decisiones institucionales |
| Unidad de Planeación Minero-Energética. (2024, 17 de enero). Resolución 0016 de 2024: Por la cual se adopta la metodología de la línea base de consumo y el ahorro estimado. https://gestornormativo.creg.gov.co/gestor/entorno/docs/resolucion_upme_0016_2024.htm | Marco normativo colombiano que establece la obligación de auditorías energéticas cada cuatro años y un ahorro mínimo del 15 % para entidades públicas que implementen medidas de eficiencia energética | Normativa de eficiencia energética, metodología de línea base de consumo y cálculo de ahorro | Constituye la justificación normativa central de SIGE-TdeA: el TdeA, como entidad pública, está obligado a gestionar y reportar su consumo energético de forma sistemática, lo cual es precisamente el problema que el sistema resuelve |

<a id="_toc239076982"></a>*Tabla 2. Antecedentes del proyecto. Nota. Elaboración propia (2026)*

## 3.2. Marco técnico

|  |
| --- |
| ✎ **INSTRUCCIÓN:**  *Definir únicamente los conceptos técnicos del dominio del problema (negocio, proceso, normativa aplicable) y las tecnologías que se usarán en el sistema (frameworks, lenguajes, arquitecturas, patrones de diseño). Ambos deben estar respaldados con citas. Solo incluir tecnologías que se usarán realmente en el desarrollo.*<br>Formato recomendado: subsecciones breves no más de 1 párrafo por concepto.<br>No copiar definiciones de Wikipedia. Citar fuentes técnicas primarias (documentación oficial, papers, RFC). |
| **👁 ASESOR — verificar:**  *Verificar que todos los conceptos de esta sección aparecen efectivamente en el producto entregado. Si hay tecnologías aquí que no están en el sistema real, deben eliminarse.* |

## 3.2.1. *Conceptos del dominio del problema*

Eficiencia energética: práctica orientada a reducir la cantidad de energía necesaria para satisfacer las necesidades de servicios energéticos, sin afectar el bienestar de la organización (MME, 2024).

Fuentes No Convencionales de Energía Renovable (FNCER): fuentes de energía renovable no consideradas convencionales en el país, cuya promoción hace parte de la política de transición energética establecida en el Plan Nacional de Desarrollo 2022-2026 (MME, 2024).

Comunidades energéticas: modelos de organización en los que un grupo de usuarios gestiona de forma colectiva la generación, el consumo o el intercambio de energía, promovidos y regulados por la normativa colombiana (UPME, 2025).

Resolución UPME 016 de 2024: normativa que establece que las entidades públicas que implementen medidas de eficiencia energética deben realizar auditorías energéticas cada cuatro años y alcanzar un ahorro mínimo del 15% respecto del año anterior (UPME, 2024).

Sistema de Gestión Energética (SGE): plataforma de software que integra la captura, el almacenamiento, el procesamiento y la visualización de datos de consumo energético, con módulos de alertas y proyecciones, para apoyar la toma de decisiones (Franco et al., 2024).

## 3.2.2. *Conceptos tecnológicos*

Metodología Scrum: marco ágil de trabajo iterativo e incremental, organizado en sprints, utilizado para gestionar el desarrollo del sistema (Schwaber y Sutherland, 2020).

CRISP-DM (Cross-Industry Standard Process for Data Mining): proceso estándar para proyectos de minería y análisis de datos, adoptado para estructurar el análisis estadístico de los datos de consumo energético del TdeA (Mishra y Singh, 2023).

Arquitectura por capas: patrón arquitectónico que separa la interfaz de usuario, la lógica de servidor y la lógica de acceso a datos en capas diferenciadas. En el sistema se implementa sobre el modelo de programación del App Router de Next.js, donde los componentes de React consumen datos en el servidor a través de Server Components, Server Actions y Route Handlers.

Python (numpy, pandas, scipy, statsmodels): lenguaje y librerías utilizados para la depuración de datos, el análisis estadístico y el modelado de las líneas base energéticas; se ejecutan fuera del proceso de Node.js mediante un interfaz de línea de comandos que recibe y devuelve JSON.

Next.js: framework de React elegido para el desarrollo del sistema web, que integra la lógica de servidor y de cliente.

Prisma: ORM (Object-Relational Mapping) para TypeScript utilizado como única capa de acceso a la base de datos, con esquema declarativo, migraciones y cliente con tipos generados.

PostgreSQL: sistema de gestión de bases de datos relacional seleccionado para el almacenamiento de los datos de facturación, inventario y análisis del sistema.

Dashboard: panel de visualización interactiva que permite a los usuarios del sistema consultar de forma gráfica el comportamiento del consumo energético.

# 4. REGISTRO DE DECISIONES TÉCNICAS (ADR)

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *ADR = Architecture Decision Record. Es el artefacto de ingeniería más importante de este informe.*<br>Documenta las decisiones de diseño relevantes que tomó el equipo, por qué las tomó y qué alternativas descartó.<br>Mínimo 3 ADR. Un ADR por cada decisión que el equipo no pueda cambiar fácilmente más adelante.<br>Esta sección diferencia un informe técnico real de un informe burocrático. |
| **👁 ASESOR — verificar:**  *Verificar que los ADR documentan decisiones reales del proyecto, no decisiones evidentes ("elegimos usar HTML porque el sistema es web"). Cada ADR debe reflejar una deliberación genuina del equipo.* |

|  |
| --- |
| **🔧 DECISIÓN TÉCNICA:**  *Ejemplo de decisión ADR-01: "Usar React en lugar de Vue para el frontend". Contexto: el equipo evaluó ambos frameworks para el módulo de gestión de pedidos. Alternativas: Vue 3 (más ligero), Svelte (mejor rendimiento). Justificación: React tiene mayor ecosistema de librerías de componentes UI que se necesitan para el panel de administración. Consecuencias: bundle size mayor, pero permite integración con librería de tablas que simplifica los reportes.* |

| **#** | **Decisión** | **Alternativas consideradas** | **Justificación técnica** | **Compromisos / Deuda** |
| --- | --- | --- | --- | --- |
| ADR-01 | React para frontend | Angular, Vue, Svelte | Se selecciona por la experiencia del equipo, el ecosistema, las librerías y la amplia cantidad de documentación existente para el desarrollo. | Se debe tener en cuenta el tamaño del bundle y controlarlo |
| ADR-02 | Python con numpy, pandas, scipy y statsmodels para el análisis estadístico | R (lenguaje estadístico), Julia, herramientas de BI (Power BI, Tableau), portar los cálculos a TypeScript | Python permite realizar la depuración, el análisis estadístico y el modelado con un solo lenguaje y con librerías maduras (OLS, VIF y pruebas de hipótesis de scipy/statsmodels). Además, facilita su integración con el backend mediante un interfaz de línea de comandos y existe experiencia previa del equipo. | Requiere una instalación de Python en el servidor y hay curva de aprendizaje en el diagnóstico de regresión de statsmodels. El motor no genera imágenes: las gráficas se construyen en la capa web (SVG). |
| ADR-03 | PostgreSQL como único sistema de almacenamiento (sin separar base relacional y base de series de tiempo) | PostgreSQL + TimescaleDB (extensión para series de tiempo), MySQL, MongoDB | El volumen de datos históricos del proyecto es moderado y PostgreSQL permite manejar los datos del sistema desde una sola plataforma. | Si posteriormente se incorporan sensores IoT, se puede evaluar TimescaleDB o InfluxDB. |
| ADR-04 | Next.js para frontend y backend | React + FastAPI, Vue + Django, Angular + Express | Next.js permite desarrollar la interfaz y la lógica del servidor en un mismo proyecto. | Los procesos estadísticos se ejecutan en Python fuera del proceso de Node.js. Si aumentan su complejidad, podrían separarse como un servicio independiente. |
| ADR-05 | Prisma ORM como única capa de acceso a la base de datos | Drizzle ORM, SQL crudo con pool de conexiones, TypeORM | El esquema declarativo (`schema.prisma`) genera un cliente tipado de TypeScript, lo que elimina las discrepancias entre el modelo de datos y el código; las migraciones versionadas y el empuje directo del esquema facilitan el trabajo incremental del equipo. | `drizzle-kit` quedó instalado como dependencia sin uso y debe retirarse. Actualizar la versión mayor de Prisma puede requerir regenerar migraciones. |
| ADR-06 | Autenticación propia con JWT (jose) y bcrypt, con tabla de sesiones persistida | NextAuth/Auth.js, sesiones de servidor en cookies firmadas, OAuth de terceros | Da control total del ciclo de vida de la sesión: cookie `httpOnly`/`sameSite=lax`, hash bcrypt con costo 12 y cada sesión registrada en base de datos para poder listarla y revocarla. El rol del usuario se relee de la base de datos en cada petición y nunca se confía en el contenido del token. | No se integra con proveedores OAuth ni hay rotación de tokens de refresco. La verificación en dos factores (TOTP) se implementó en una fase posterior, con enrolamiento obligatorio para ADMIN_TI y GESTOR_ENERGETICO y opcional para el resto de roles. |
| ADR-07 | Matriz de permisos estática en el código, con excepciones (overrides) temporales o permanentes en la base de datos | RBAC 100% dinámico en base de datos, ACL por recurso, librerías de autorización (CASL, rbac) | La matriz rol × módulo (5 roles × 6 módulos) es estable y se evalúa en memoria sin consultar la base de datos, lo que evita fallos si la BD no responde y permite revisarla junto con el código fuente. Las excepciones puntuales sí viven en la BD, con fecha de expiración, quién las otorgó y traza de auditoría. El módulo de usuarios nunca acepta excepciones (defensa en profundidad). | Modificar un permiso base exige una nueva versión del sistema. El efecto de los overrides depende de la limpieza de los registros expirados. |
| ADR-08 | Motor de línea base en Python invocado como proceso CLI que intercambia JSON | Microservicio REST propio, portar los modelos a TypeScript (librerías de regresión), notebooks embebidos | Reutiliza el ecosistema estadístico (statsmodels OLS, VIF, scipy) sin reimplementarlo en JavaScript. La interfaz stdin/stdout con JSON es suficiente para el volumen de datos y no exige mantener un servidor HTTP adicional; el motor queda independiente y testeable por separado. | Cada cálculo genera un proceso Python (la carga de librerías añade segundos y se aplica un tiempo límite). Se requiere Python 3.10+ con pandas/numpy/scipy/statsmodels en el servidor y falta empaquetado reproducible (`requirements.txt`). |
| ADR-09 | Gráficas SVG construidas a mano en lugar de una librería de charts | Recharts, Chart.js, Nivo, ApexCharts | Permite controlar el diseño específico de la gráfica de línea base (banda de confianza por mes, residuos, meses descartados fuera de la banda, línea de referencia) y construir la accesibilidad completa (role="slider", navegación con teclado, `aria-live`) sin adaptar la API de una librería. Evita dependencias pesadas en el bundle. | El equipo mantiene escalas, ejes y detección de posición; cualquier tipo de gráfico nuevo debe codificarse a mano. |
| ADR-10 | Storybook con Vitest en navegador y mock de Server Actions como estrategia de pruebas | Vitest/Jest unitario con jsdom, pruebas end-to-end con Playwright o Cypress | Prueba los componentes reales en el navegador con datos deterministas: el build de Storybook sustituye los módulos de Server Actions por dobles, de modo que los flujos de importación, visualización y gestión se validan sin base de datos. El addon de a11y añade revisión de accesibilidad. | Sin pruebas unitarias aisladas del núcleo de dominio ni pruebas end-to-end; `npm run test` cubre las historias de Storybook con Vitest en navegador, sin umbrales de cobertura configurados. |

<a id="_toc239076983"></a>*Tabla 3. Registro de decisiones técnicas. Nota. Elaboración propia (2026)*

# 5. OBJETIVOS

## 5.1. Objetivo general

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Usar verbo en infinitivo concreto y medible: Desarrollar, Implementar, Construir, Diseñar. El objetivo debe poder verificarse directamente con el producto entregado.* <br>Debe verificarse directamente con el sistema entregado en TDG II.<br>No usar: Conocer, Explorar, Analizar como verbo principal de un trabajo de desarrollo. |

Desarrollar un sistema que permita la gestión eficiente de la energía en el TdeA para la toma de decisiones basadas en datos de patrones de consumo energético.

## 5.2. Objetivos específicos

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Entre 3 y 5 objetivos. Cada uno debe mapearse a un resultado verificable. Se sugiere un objetivo por cada ciclo de vida del software.*<br>Deben poder responderse con evidencia concreta: un módulo funcional, un diagrama, un resultado de prueba, etc. |
| **👁 ASESOR — verificar:**  *Verificar que cada objetivo tiene un resultado medible asociado y puede ser verificado con evidencia concreta al final del trabajo (sprint, diagrama, prueba, módulo funcional). Si no puede verificarse con el producto, el objetivo debe reformularse.* |

Identificar requerimientos funcionales y no funcionales haciendo elicitación de requisitos con los actores involucrados en la gestión de la energía en el TdeA.

Diseñar la arquitectura y funcionalidades clave del sistema que permitan una gestión eficiente de la energía.

Codificar el sistema plasmando los componentes definidos en el diseño, utilizando herramientas y lenguajes de programación adecuados.

Evaluar la funcionalidad del sistema diseñado a través de pruebas funcionales y/o de usabilidad, considerando su eficiencia en la gestión de la energía en el TdeA.

# 6. DISEÑO DEL PROYECTO

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *En un proyecto ágil, el diseño del proyecto es la decisión de cómo se va a construir: metodología, alcance y plan.* |

## 6.1. Metodología y equipo

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Indicar la metodología ágil o su equivalente elegida y justificar por qué es adecuada para este proyecto (tamaño del equipo, tipo de sistema, tiempo disponible). Explicar cómo se aplicará: número de sprints, duración, roles del equipo (Product Owner, Scrum Master, Dev Team).* Describir los roles del equipo (Product Owner, Scrum Master, Developer) y quién los ocupa. NO copiar la definición de Scrum o la metodología seleccionada, explicar cómo se aplicará concretamente. |

En el proyecto se adopta la metodología ágil Scrum como marco para el desarrollo de software, debido a que brinda la capacidad de construir el sistema de forma iterativa e incremental, permitiendo que los requisitos se definan de manera progresiva a partir de la interacción continua con los actores institucionales del TdeA. Esta metodología permite que se hagan avances y entregas de valor de forma temprana y es flexible ante la adaptación de cambios en los requisitos planteados inicialmente.

El desarrollo del proyecto se realizará mediante sprints de dos semanas. Al finalizar cada sprint se espera contar con una parte funcional del sistema, la cual será revisada y validada. Durante este proceso se realizarán las principales reuniones de Scrum: Sprint Planning, donde se seleccionan y estiman las historias de usuario; Daily Standup, para revisar diariamente el avance del equipo; Sprint Review, en la que se presenta lo desarrollado; y Sprint Retrospective, donde se identifican aspectos por mejorar para el siguiente sprint.

Adicionalmente, para las actividades de análisis de datos y detección de patrones de consumo energético, se adopta como guía metodológica complementaria el proceso CRISP-DM.

| **Rol en el equipo** | **Integrante** | **Responsabilidades principales** |
| --- | --- | --- |
| Product Owner | Docente asesor del trabajo de grado, en colaboración con un representante institucional del área de infraestructura del TdeA | Priorizar el backlog del producto y validar los criterios de aceptación de cada historia de usuario |
| Scrum Master | Uno de los integrantes del equipo de desarrollo | Facilitar las ceremonias Scrum y eliminar los impedimentos que puedan surgir durante la ejecución del proyecto |
| Developer | Andrés Felipe Mosquera García y Esteban Ramirez Montoya (equipo de desarrollo) | Diseño, codificación, pruebas y despliegue del sistema |

<a id="_toc239076984"></a>*Tabla 4. Roles del equipo. Nota. Elaboración propia (2026)*

## 6.2. Alcance del sistema

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Dos columnas: qué incluye y qué excluye explícitamente el sistema.*<br>Describir con precisión qué incluye y qué NO incluye el sistema. Usar listas diferenciadas. El alcance debe ser coherente con los objetivos específicos y con el backlog, así mismo debe ser realizable en el tiempo disponible del semestre. |
| **👁 ASESOR — verificar:**  *Verificar que el alcance es realista para un semestre. Si el backlog tiene más de 15 HU para un equipo de 2 personas, probablemente está sobredimensionado.* |

| **Dentro del alcance** | **Fuera del alcance** |
| --- | --- |
| Levantamiento de un inventario energético: se hará un registro de los equipos eléctricos presentes en cada bloque del TdeA (tipo de equipo, cantidad y potencia) | Instalación de hardware de medición energética en la infraestructura eléctrica del TdeA (los datos de consumo provienen de las facturas de EPM). |
| Recopilación de los datos de consumo: se organizarán las facturas emitidas por EPM del último año y se estructurará en tablas para facilitar su análisis. | Modificaciones a la infraestructura física o energética de la institución, ni adquisición de equipos para las instalaciones. |
| Análisis del consumo histórico: se realizará una caracterización estadística que permita la construcción de gráficas y establecer una correlación con el calendario académico del TdeA. | La inclusión del TdeA como parte de una comunidad energética; el proyecto solo construye la base tecnológica para que dicha integración sea viable en el futuro. |
| Desarrollo del sistema con módulos funcionales: carga de datos, dashboard de visualización, reportes y gráficas estadísticas, alertas de consumo inusuales, estimaciones de tendencias de consumo y reportes. |  |
| Pruebas funcionales del sistema y documentación técnica: plan de pruebas unitarias e integración, manual de usuario y manual técnico del sistema. |  |

<a id="_toc239076985"></a>*Tabla 5. Definición del alcance. Nota. Elaboración propia (2026)*

## 6.3. Plan de sprints y cronograma

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Tabla de sprints con semanas y entregables verificables. Debe coincidir con el número de sprints del backlog.*<br>El cronograma no es de horas: es de semanas académicas e hitos de entrega. |

| **Sprint** | **Semanas del semestre** | **Objetivo del sprint** | **Entregable verificable** |
| --- | --- | --- | --- |
| S1 | 1–4 | Recopilar y organizar la información base para el análisis: solicitud y organización de las facturas de EPM, y levantamiento del inventario de equipos eléctricos por bloque del TdeA. | Inventario energético por bloque y facturas de EPM organizadas. |
| S2 | 5–8 | Procesar y analizar estadísticamente los datos de consumo: limpieza de datos con Python y caracterización estadística para la identificación de patrones de consumo. | Caracterización estadística del consumo histórico con identificación de patrones. |
| S3 — Sprint 1 (desarrollo) | 9–10 | Elicitar los requisitos del sistema, diseñar la arquitectura y desarrollar la autenticación, la gestión de usuarios y la carga/gestión de datos (facturas, equipos y variables). | Sistema autenticado con roles y primeros asistentes de importación operativos. |
| S3 — Sprint 2 (desarrollo) | 11–12 | Desarrollar el cálculo de líneas base energéticas, los permisos por módulo y la visualización de datos (sección 8.2). | Motores de línea base, asignación de permisos y vistas de visualización funcionales. |
| Diseño e ingeniería | 13–14 | Documentar el diseño arquitectónico del sistema. | Diagramas de arquitectura |
| Pruebas y cierre | 15–16 | Ejecutar las pruebas funcionales y de usabilidad, y elaborar los manuales técnicos y de usuario. | Plan de pruebas ejecutado |

<a id="_toc239076986"></a>*Tabla 6. Plan de sprints. Nota. Elaboración propia (2026)*

# 7. REQUERIMIENTOS DEL SISTEMA

|  |
| --- |
| **✎ INSTRUCCIÓN:**  Estructura en dos niveles: visión de la solución (qué hace el sistema) y backlog (cómo se construye iterativamente). |

## 7.1. Visión de la solución

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Describir en 2–3 párrafos qué hace el sistema, para quién y cómo resuelve el problema de 1.2.*<br>Incluir una visión general de la arquitectura propuesta (no el diagrama de detalle — ese va en la sección 9).<br>Si hay un prototipo o mockup de pantallas clave, incluirlo aquí con número y título de figura. |

SIGE-TdeA (Sistema de Información para la Gestión Energética del Tecnológico de Antioquia) es un sistema web desarrollado para el TdeA que integra en una sola plataforma los procesos de captura, almacenamiento, análisis y visualización de los datos de consumo energético de la institución. Está dirigido a los perfiles definidos en la sección 2.3: el gestor energético y el coordinador de infraestructura cargan y mantienen los datos, el directivo y el personal administrativo los consultan para tomar decisiones de gasto y ahorro, y el administrador de TI opera la seguridad del sistema. Al centralizar las facturas de EPM, el inventario de equipos y las variables operativas, y al calcular las líneas base energéticas exigidas por la Resolución UPME 0016 de 2024, el sistema sustituye el proceso manual y desarticulado descrito en la sección 2.2 por un flujo trazable y auditable.

La arquitectura implementada es un monolito por capas con patrón MVC sobre Next.js 14 (App Router): la capa de presentación (vista) está compuesta por componentes de React con Tailwind CSS; la lógica de servidor (controlador) se ejecuta en Server Components, Server Actions y Route Handlers, protegidos por guards de sesión en los layouts y páginas de servidor; la capa de datos (modelo) se implementa con Prisma sobre PostgreSQL; y el análisis estadístico corre en un proceso Python independiente que se invoca como interfaz de línea de comandos que intercambia JSON (ADR-04, ADR-05, ADR-08). El control de acceso combina una cookie JWT `httpOnly` con una matriz de 5 roles × 6 módulos evaluada en servidor, más excepciones temporales o permanentes registradas en base de datos y en la bitácora de auditoría (ADR-06, ADR-07). El detalle de la arquitectura se documenta en la sección 9.

El sistema se organiza en los siguientes módulos funcionales, cuyo estado de implementación se resume al final de esta sección:

Módulo 1 (Carga y gestión de datos) — **implementado**: registra y almacena las facturas de energía de EPM y el inventario de equipos eléctricos por bloque, junto con las variables operativas (población, días lectivos, grados de enfriamiento) y los ajustes energéticos. Opera en la ruta `/dashboard/datos` con seis secciones (Resumen, Facturas EPM, Equipos Eléctricos, Variables Operativas, Líneas Base y Ajustes) y tres modos de trabajo (Carga, Visualización y Gestión); los tres asistentes de importación procesan archivos Excel o CSV en cuatro pasos (carga, mapeo, vista previa e importación) con validación en cliente y servidor.

![](figuras/out/fig04.png)

<a id="_toc239076992"></a>*fig 4. Módulo de carga de datos. Nota. Elaboración propia (2026).*

Módulo 2 (Dashboard de visualización) — **parcialmente implementado**: la sección Resumen presenta tarjetas de indicadores (facturas, equipos, variables y líneas base registradas) y una guía animada del flujo de datos; el dashboard con KPIs de consumo (kWh, costo, variación interperiodual) se entregó con el rediseño del overview (PR #91, 14 de octubre de 2026) y su correlación con el calendario académico sigue pendiente (HU-06); la HU-05 permanece «En progreso» hasta la prueba funcional aprobada.

![](figuras/out/fig05.png)

<a id="_toc239076993"></a>*fig 5. Módulo de Dashboard. Nota. Elaboración propia (2026).*

Módulo 3 (Análisis estadístico y detección de patrones) — **implementado, pendiente de validación (HU-04 y HU-07)**: el motor de Python (numpy, pandas, scipy, statsmodels) depura los atípicos por banda de confianza (±10 % por defecto; rescate IC ec. 4-5 con N ≥ 10 si quedan < 36 depurados) con recomputo de la media por mes y calcula las líneas base con los cuatro modelos de la Resolución UPME 0016 de 2024, señalando los meses descartados en la gráfica y en las tablas de transparencia. El módulo de análisis independiente (`/dashboard/analisis`, entregado el 12 de octubre de 2026) evalúa cada período del histórico de facturas contra la banda de su mes calendario, explica cada período inusual en español, lo clasifica según el calendario académico (días lectivos de Variables Operativas) y lo presenta con tarjetas de resumen, una gráfica SVG con los atípicos en ámbar y el sombreado de vacaciones, y una tabla con la explicación estadística de cada señal.

![](figuras/out/fig06.png)

<a id="_toc239076994"></a>*fig 6. Módulo de análisis estadístico. Nota. Elaboración propia (2026).*

Módulo 4 (Alertas de consumo inusual) — **en construcción**: generará notificaciones automáticas cuando el consumo supere los umbrales definidos a partir del histórico, permitiendo una respuesta oportuna del personal responsable (HU-08).

![](figuras/out/fig07.png)

<a id="_toc239076995"></a>*fig 7. Módulo de Alertas. Nota. Elaboración propia (2026).*

Módulo 5 (Estimaciones) — **implementado**: genera proyecciones exploratorias de 1–3 meses con ARIMA/SARIMA sobre el histórico normalizado y depurado según UPME; compara con la LBEn guardada aplicable cuando existe y no la reemplaza (HU-09).

![](figuras/out/fig08.png)

<a id="_toc239076996"></a>*fig 8. Módulo de Estimaciones. Nota. Elaboración propia (2026).*

Módulo 6 (Reportes) — **implementado**: genera informes técnicos de gestión energética bajo la Resolución UPME 0016 de 2024 descargables en formatos PDF y Word (.docx), con desglose de identificación (§9.1), inventario de equipos y USEs (§7.1), histórico depurado con atípicos (§7.2–7.3), parámetros del modelo LBEn (§9.2–9.4), balance de potenciales de ahorro y medidas eficientes (§8, Anexo 5) y bitácora de ajustes no rutinarios (§7.5, Anexo 4), incorporando agregación temporal mensual, semestral o anual (HU-10, HU-11 y HU-12).

![](figuras/out/fig09.png)

<a id="_toc239076997"></a>*fig 9. Módulo de Reportes. Nota. Elaboración propia (2026).*

De forma transversal, el sistema incorpora la **gestión de usuarios, roles y permisos** — **implementada** en la ruta `/dashboard/users`: autenticación con registro e inicio de sesión, administración de usuarios y sesiones para el rol administrador, matriz de permisos por módulo y asignación de permisos temporales o permanentes con auditoría (HU-15 y HU-16). El módulo de representación espacial de la infraestructura (`/dashboard/espacial`) quedó entregado con generación de layouts paramétricos 2D (HU-22).

| **Módulo / componente** | **Estado actual** | **HU asociadas** |
| --- | --- | --- |
| Módulo 1 — Carga y gestión de datos | Implementado | HU-01, HU-02, HU-03, HU-18, HU-19, HU-21 |
| Líneas base energéticas (LBEn) — componente del Módulo 1 | Implementado | HU-17 |
| Gestión de usuarios, roles y permisos (capa transversal) | Implementado | HU-15, HU-16 |
| Módulo 2 — Dashboard de visualización | Implementado (Resumen operativo, home con KPIs y carrusel de módulos; correlación con el calendario académico pendiente HU-06) | HU-05, HU-06, HU-20 |
| Módulo 3 — Análisis estadístico y detección de patrones | Implementado (motor LBEn + módulo de análisis con detección de períodos inusuales, entregado el 12/10/2026) | HU-04, HU-07 |
| Módulo 4 — Alertas de consumo inusual | En construcción | HU-08 |
| Módulo 5 — Estimaciones | Implementado (proyección ARIMA/SARIMA bajo demanda) | HU-09 |
| Módulo 6 — Reportes | Implementado (informes con datos registrados en PDF/Word y agregación mensual/semestral/anual; Excel pendiente y sin certificación regulatoria) | HU-10, HU-12 |
| Representación espacial | Implementado (generación de layouts 2D paramétricos, canvas interactivo, inspector y leyenda) | HU-22 |

*Tabla 7. Estado de implementación de los módulos. Nota. Elaboración propia (2026)*

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Figura N. Arquitectura propuesta (vista de alto nivel). Nota. Elaboración propia (año). — Insertar aquí* |

![](figuras/out/fig10.png)

<a id="_toc239076998"></a>*fig 10. Arquitectura propuesta — monolito MVC en capas (vista de alto nivel). Nota. Elaboración propia (2026).*

## 7.2. Product backlog

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Lista priorizada de todas las HU del proyecto. Story points en lugar de horas.*<br>Estado: Pendiente / En progreso / Completado. Actualizar en cada entrega. |
| **👁 ASESOR — verificar:**  *En TDG II: verificar que el el backlog refleja lo que realmente se construyó y son suficientes para el alcance declarado. Si hay HU "Completado" sin evidencia en los sprints, el estado es incorrecto.* |

| **ID HU** | **Nombre de la historia de usuario** | **Sprint** | **Prioridad** | **Storypoints** | **Estado** | **Criterio de aceptación (resumen)** |
| --- | --- | --- | --- | --- | --- | --- |
| HU-01 | Como administrador, quiero registrar el inventario de equipos eléctricos por bloque. | Sprint 1 | Alta | 5 | Completado | Asistente segmentado por edificación → bloque → espacio; alta/edición de equipo con tipo, cantidad y potencia; clave única (bloque, espacio, tipo) y listado filtrable. |
| HU-02 | Como administrador, quiero cargar las facturas históricas de EPM al sistema, para centralizar los datos de consumo real. | Sprint 1 | Alta | 5 | Completado | Asistente de 4 pasos; valida periodo, días facturados, kWh y costo con Zod; calcula el consumo normalizado a 30 días en el servidor y exige periodo único. |
| HU-03 | Como administrador, quiero importar facturas o inventario de forma masiva vía Excel/CSV. | Sprint 1 | Media | 5 | Completado | Los tres asistentes aceptan .xlsx/.csv, detectan encabezados, permiten mapeo manual, vista previa editable y resumen de importación con confirmación de sobrescritura. |
| HU-04 | Como administrador, quiero ver el consumo histórico para identificar patrones de consumo. | Sprint 2 | Alta | 8 | Completado | La visualización muestra la serie histórica con gráfica de barras y tabla paginada; el módulo de análisis independiente (`/dashboard/analisis`) quedó entregado el 12/10/2026 con detección de períodos inusuales contra la banda de su mes y contexto del calendario académico; paso opcional de cálculo de uso añadido en los importadores (PR #146). |
| HU-05 | Como administrativo y/o financiero, quiero ver un dashboard con KPIs de consumo, para apoyar decisiones de gasto energético. | Sprint 2 | Alta | 8 | Completado | La sección Resumen muestra tarjetas de indicadores con datos reales; el dashboard con KPIs de kWh, costo y variación interperiodual se entregó con el rediseño del overview (PR #91) y el home incorpora un banner con carrusel de módulos y estadísticas reales por módulo (PR #93). |
| HU-06 | Como usuario del sistema, quiero ver la correlación del consumo con el calendario académico en el dashboard, para entender picos y valles de consumo. | Por planificar | Media | 5 | Pendiente | El gráfico superpondría períodos académicos sobre la serie de consumo (los días lectivos ya se registran en Variables Operativas). |
| HU-07 | Como sistema, quiero ejecutar el módulo de análisis estadístico y detección de patrones sobre los datos cargados, para identificar épocas de consumo inusual. | Sprint 2 | Alta | 8 | Completado | El motor LBEn depura atípicos por banda de confianza (±10 % por defecto; rescate IC ec. 4-5 con N ≥ 10 si quedan < 36 depurados) y los señala en la gráfica y las tablas; la detección de épocas inusuales sobre facturas quedó entregada el 12/10/2026 (sub-issue #73); corrección de horizonte de cálculo en importadores y jerarquía de horarios (PR #146, commits `03b1252`, `6af96f1`). |
| HU-08 | Como administrador, quiero recibir una alerta cuando el consumo de un mes supere el umbral definido, para actuar oportunamente. | Por planificar | Alta | 5 | Pendiente | Al superar el umbral configurado, el sistema generaría una notificación visible en el dashboard. |
| HU-09 | Como administrativo y/o financiero, quiero ver una proyección del consumo energético futuro. | Posterior al Sprint 2 | Media | 8 | Completado | Proyección mensual exploratoria a 1–3 meses con SARIMA automático (fallback ARIMA), advertencia de menor confiabilidad bajo 36 meses depurados según UPME sin bloquear el cálculo si el modelo ajusta, imputación de atípicos con valor absoluto mensual, comparación con LBEn guardada aplicable y ejecución sin persistencia. |
| HU-10 | Como administrador, quiero exportar reportes de consumo en PDF, para presentarlos ante las directivas institucionales. | Posterior al Sprint 2 | Media | 5 | Completado | Exporta en PDF y Word (.docx) las generalidades, inventario, facturas, datos de una LBEn guardada y ajustes registrados. Los datos no disponibles se indican como tales; no se inventan cifras de área, ocupación o ahorro ni se certifica cumplimiento regulatorio. |
| HU-11 | Como administrador, quiero exportar reportes de consumo en Excel, para hacer análisis adicionales fuera del sistema. | Por planificar | Baja | 3 | Pendiente | El archivo .xlsx contendría las mismas cifras mostradas en el dashboard para el período elegido. |
| HU-12 | Como administrador, quiero elegir la granularidad temporal del reporte (mensual/semestral/anual). | Posterior al Sprint 2 | Baja | 3 | Completado | El selector agrupa consumos facturados y normalizados, días, costos y clasificación por período mensual, semestral o anual; la comparación con LBEn se limita a la vista mensual para conservar escalas compatibles. |
| HU-13 | Como equipo de desarrollo, quiero documentar el diseño arquitectónico del sistema, para dejar trazabilidad de las decisiones técnicas. | Diseño e ingeniería | Alta | 3 | En progreso | Registro de decisiones técnicas (sección 4) y descripción de la arquitectura implementada (sección 9) en este informe. |
| HU-14 | Como equipo de desarrollo, quiero ejecutar pruebas funcionales sobre los 6 módulos, para validar que cumplen sus criterios de aceptación. | Pruebas y cierre | Alta | 5 | En progreso | 18 historias de Storybook (95 pruebas) en verde con Vitest en navegador; quedan las pruebas de los módulos en construcción y las de usabilidad. |
| HU-15 | Como administrador, quiero autenticar a los usuarios y administrar sus cuentas y roles, para controlar quién accede al sistema. | Sprint 1 | Alta | 8 | Completado | Login/registro/logout con JWT en cookie httpOnly y bcrypt; CRUD de usuarios y cierre de sesiones para ADMIN_TI; registro de último acceso y auditoría. |
| HU-16 | Como administrador, quiero asignar permisos temporales o permanentes por módulo a los usuarios, para excepcionar la matriz de roles con trazabilidad. | Sprint 2 | Alta | 8 | Completado | Drawer «Asignar permiso» con duración (1–720 h) o permanente con advertencia; revocación desde la ficha del usuario; cada concesión queda en la bitácora de auditoría; el módulo de usuarios no acepta excepciones. |
| HU-17 | Como gestor energético, quiero calcular y guardar la línea base energética de un bloque con los modelos de la Resolución UPME 0016 de 2024. | Sprint 2 | Alta | 13 | Completado | Cuatro modelos (valor absoluto, cociente, regresión y confort térmico) calculados por el motor Python; gráfica SVG interactiva con banda de confianza, residuos y meses descartados; tablas de preparación y jerarquía; guardado solo tras un cálculo exitoso. |
| HU-18 | Como gestor energético, quiero registrar las variables operativas (población y días) por bloque, mes y año, para alimentar los modelos de ingeniería. | Sprint 1 | Media | 5 | Completado | Asistente de 4 pasos con identidad (bloque, mes, año); registro de población fija/flotante, días lectivos y grados de enfriamiento; validación con Zod. |
| HU-19 | Como administrador, quiero editar, eliminar y vaciar los registros guardados de facturas, equipos, variables, ajustes y líneas base, para corregir errores y reiniciar el almacén. | Sprint 1 | Media | 5 | Completado | Pestaña Gestión en cada sección con edición inline, borrado con confirmación y «vaciar» con advertencia de datos dependientes (vaciar facturas elimina las líneas base asociadas). |
| HU-20 | Como usuario del sistema, quiero ver una sección de resumen con tarjetas de indicadores y una guía del flujo de datos, para ubicarme rápidamente en la plataforma. | Sprint 2 | Baja | 3 | Completado | Cuatro tarjetas navegables (facturas, equipos, variables, líneas base) y guía animada «Cómo funciona» con los flujos de Facturas, Equipos y Líneas Base. |
| HU-21 | Como administrador, quiero crear y eliminar edificaciones y bloques durante la carga, para mantener el catálogo sin salir del asistente. | Sprint 1 | Media | 3 | Completado | Drawers de nueva edificación/bloque dentro del paso 1; el borrado se bloquea con un mensaje que indica qué datos vaciar primero si el catálogo tiene registros asociados. |
| HU-22 | Como coordinador de infraestructura, quiero ver una representación espacial de los bloques de la sede, para localizar la infraestructura asociada al consumo. | Sprint 3 | Baja | 5 | Completado | Feature `espacial` en `src/features/espacial/`: generación de layouts 2D paramétricos, canvas interactivo con React Flow, inspector de propiedades, leyenda, nodos `ModelBlock`/`ParametricBlock`, controladores `getDatosEspaciales`/`actualizarBloque`, generador de layouts con tests. Schema Prisma extendido para entidades espaciales. |
| HU-23 | Como gestor energético, quiero gestionar la infraestructura energética de cada edificación (campos UPME, calendario operativo con GDE, horarios de equipos y calendario de festivos), para alimentar la línea base con los datos operativos que exige la Resolución UPME 0016/2024. | Sprint 2 | Alta | 8 | Completado | Sección propia «Edificaciones» con área en m² y CRUD de bloques/espacios; calendario operativo configurable por edificación con plantilla TdeA y GDE calculada con Open-Meteo mostrando la fórmula sustituida; horarios de equipos con ámbito jerárquico (edificación/bloque/espacio/equipo), vigencia y rechazo de conflictos; vista mensual «Calendario» con los 19 festivos oficiales de Colombia 2026. |
| HU-24 | Como gestor energético, quiero gestionar el calendario completo de la edificación (rangos, festivos y eventos), elegir la ubicación por ciudad y calcular la GDE desde Variables Operativas usando los horarios de los equipos, para que la información operativa sea trazable y visible en un solo lugar. | Sprint 3 | Alta | 8 | Completado | Evolución Fase 6: ubicación por ciudad con geocoding de Open-Meteo; cálculo de la GDE en «Variables Operativas» con fórmula e insumos visibles y origen del Xe opt-in por edificación (apagado = cálculo legado idéntico; encendido = horarios vigentes por día); trazabilidad de horarios y horas de uso en «Equipos Eléctricos»; calendario con selector de año, vistas año/mes/semana/agenda y resumen de días lectivos, festivos y eventos; módulo de eventos con alta/baja auditada y herencia por el árbol de la edificación. |

<a id="_toc239076987"></a>*Tabla 8. Product backlog. Nota. Elaboración propia (2026)*

|  |
| --- |
| **⚠ IMPORTANTE:**  *ENTREGA TDG I: el documento se entrega hasta esta sección (6.2). Todo el contenido anterior debe estar completo, revisado y aprobado por el asesor antes de entregarlo al jurado.* |

|  |  |
| --- | --- |
| **TDG II** | **Secciones 7–12: desarrolladas en Trabajo de Grado II**<br>*Al iniciar TDG II el historial de la ficha técnica debe registrar las correcciones de las observaciones del jurado de TDG I. El jurado de TDG II evaluará el documento completo incluyendo el sistema funcional.* |

# 8. PLANIFICACIÓN DE LOS SPRINT

|  |
| --- |
| **✎ INSTRUCCIÓN:**  Documentar cada sprint con la estructura completa: historias de usuario con DoD, revisión narrativa del sprint y tareas ejecutadas con evidencias. Repetir esta estructura para cada sprint planificado. La evidencia técnica (capturas, fragmentos de código relevantes, diagramas parciales) se integra naturalmente en esta sección. Repetir la estructura 8.1 para cada sprint (8.2, 8.3, …). |

## 8.1. Sprint 1

**Sprint 1 (semanas 9–10 del semestre).** Objetivo: construir la base de acceso al sistema y el flujo de ingesta de datos: autenticación con roles, administración de usuarios y los asistentes de importación de Facturas EPM, Equipos Eléctricos y Variables Operativas con su pestaña de gestión. HU planificadas: 7 (36 story points).

## 8.1.1. *Historias de usuario del Sprint 1*

|  |
| --- |
| ✎ **INSTRUCCIÓN:**  *Las historias de usuario son descripciones cortas de una funcionalidad redactadas desde la perspectiva del cliente. Una tabla HU por cada historia del sprint. El DoD (Definition of Done) debe estar completado (marcado) antes de dar la HU por terminada. Criterios de aceptación mínimo 2 escenarios Cuando/Espero.*<br>No copiar el formato del sprint anterior con diferentes nombres. Cada HU debe documentar sus dos escenarios de aceptación verificables. |

**Tabla 9**

*Historia de Usuario HU-01*

|  |  |
| --- | --- |
| **HISTORIA DE USUARIO — HU-01** |  |
| **Nombre:** | Registro del inventario de equipos eléctricos por bloque |
| **Puntos de historia (story points):** | 5 |
| **Como (rol):** | Administrador (gestor energético / coordinador de infraestructura) |
| **Quiero (funcionalidad):** | Registrar el inventario de equipos eléctricos por bloque |
| **Para (beneficio):** | Disponer del inventario eléctrico de la sede para comparar el consumo real con la carga instalada |
| **CRITERIOS DE ACEPTACIÓN** |  |
| **Escenario 1 — Cuando:** | Cargo un archivo de equipos en el paso 1 del asistente seleccionando edificación, bloque y espacio |
| **Espero:** | El asistente segmenta el catálogo, permite crear el bloque si no existe y muestra la vista previa con las filas válidas y las inválidas resaltadas antes de importar |
| **Escenario 2 — Cuando:** | Intento importar dos equipos con el mismo tipo en el mismo espacio |
| **Espero:** | El sistema detecta la colisión con la clave única (bloque, espacio, tipo) y ofrece sobrescribir la fila existente tras confirmación |
| **DEFINICIÓN DE TERMINADO (DoD)** |  |
| ☒ Código revisado y aprobado por el equipo (code review)<br>☒ Prueba funcional ejecutada y aprobada (caso de prueba documentado)<br>☒ Evidencia visual integrada en el diario de sprint<br>☒ Criterios de aceptación verificados y marcados<br>☐ Sin deuda técnica conocida asociada a esta HU | Historia cubierta por la historia de Storybook *ImportadorEquipos*; deuda pendiente: `drizzle-kit` sin uso en el repositorio. |

*Nota. Elaboración propia (2026).*

**Tabla 10**

*Historia de Usuario HU-02*

|  |  |
| --- | --- |
| **HISTORIA DE USUARIO — HU-02** |  |
| **Nombre:** | Carga de las facturas históricas de EPM |
| **Puntos de historia (story points):** | 5 |
| **Como (rol):** | Administrador (gestor energético) |
| **Quiero (funcionalidad):** | Cargar las facturas históricas de EPM al sistema, para centralizar los datos de consumo real |
| **Para (beneficio):** | Contar con una única fuente de verdad del consumo facturado de la sede |
| **CRITERIOS DE ACEPTACIÓN** |  |
| **Escenario 1 — Cuando:** | Importo un archivo con periodos mensuales de facturación en los 4 pasos del asistente |
| **Espero:** | Cada fila se valida con Zod (periodo, días facturados, kWh y costo), se calcula el consumo normalizado a 30 días en el servidor y el resumen final informa las filas importadas |
| **Escenario 2 — Cuando:** | Importo un archivo que contiene un periodo ya existente en la base de datos |
| **Espero:** | El asistente advierte la colisión de la clave única (periodo) y solo sobrescribe tras la confirmación explícita del usuario |
| **DEFINICIÓN DE TERMINADO (DoD)** |  |
| ☒ Código revisado y aprobado por el equipo (code review)<br>☒ Prueba funcional ejecutada y aprobada (caso de prueba documentado)<br>☒ Evidencia visual integrada en el diario de sprint<br>☒ Criterios de aceptación verificados y marcados<br>☒ Sin deuda técnica conocida asociada a esta HU |  |

*Nota. Elaboración propia (2026).*

**Tabla 11**

*Historia de Usuario HU-03*

|  |  |
| --- | --- |
| **HISTORIA DE USUARIO — HU-03** |  |
| **Nombre:** | Importación masiva vía Excel/CSV |
| **Puntos de historia (story points):** | 5 |
| **Como (rol):** | Administrador (gestor energético) |
| **Quiero (funcionalidad):** | Importar facturas, equipos o variables de forma masiva vía Excel/CSV |
| **Para (beneficio):** | Evitar la digitación manual de cientos de registros históricos |
| **CRITERIOS DE ACEPTACIÓN** |  |
| **Escenario 1 — Cuando:** | Subo un archivo .xlsx con varias hojas o un .csv a cualquiera de los tres asistentes |
| **Espero:** | El sistema detecta hoja y encabezados, permite reasignar columnas manualmente y muestra las primeras 50 filas en la vista previa con edición en línea |
| **Escenario 2 — Cuando:** | El archivo contiene columnas faltantes o valores fuera de formato |
| **Espero:** | El paso de vista previa marca las filas inválidas en rojo con el motivo y bloquea la importación hasta corregirlas o excluirlas |
| **DEFINICIÓN DE TERMINADO (DoD)** |  |
| ☒ Código revisado y aprobado por el equipo (code review)<br>☒ Prueba funcional ejecutada y aprobada (caso de prueba documentado)<br>☒ Evidencia visual integrada en el diario de sprint<br>☒ Criterios de aceptación verificados y marcados<br>☒ Sin deuda técnica conocida asociada a esta HU | Lectura con `xlsx` (SheetJS) y `papaparse`; plantilla CSV descargable desde el asistente. |

*Nota. Elaboración propia (2026).*

**Tabla 12**

*Historia de Usuario HU-15*

|  |  |
| --- | --- |
| **HISTORIA DE USUARIO — HU-15** |  |
| **Nombre:** | Autenticación y administración de usuarios y roles |
| **Puntos de historia (story points):** | 8 |
| **Como (rol):** | Administrador (rol ADMIN_TI) |
| **Quiero (funcionalidad):** | Autenticar a los usuarios y administrar sus cuentas y roles |
| **Para (beneficio):** | Controlar quién accede al sistema y con qué nivel de responsabilidad |
| **CRITERIOS DE ACEPTACIÓN** |  |
| **Escenario 1 — Cuando:** | Un usuario se autentica con credenciales válidas |
| **Espero:** | El servidor verifica la contraseña con bcrypt, emite un JWT en una cookie httpOnly, registra la sesión en base de datos y redirige al panel; el rol se relee de la base de datos en cada petición |
| **Escenario 2 — Cuando:** | El administrador crea o edita un usuario y cierra una sesión activa desde la ficha del usuario |
| **Espero:** | El cambio de rol queda persistido con validación Zod, la sesión revocada deja de ser válida en la siguiente petición y ambas acciones quedan en la bitácora de auditoría |
| **DEFINICIÓN DE TERMINADO (DoD)** |  |
| ☒ Código revisado y aprobado por el equipo (code review)<br>☒ Prueba funcional ejecutada y aprobada (caso de prueba documentado)<br>☒ Evidencia visual integrada en el diario de sprint<br>☒ Criterios de aceptación verificados y marcados<br>☒ Sin deuda técnica conocida asociada a esta HU | La deuda del banderón de dos factores quedó cerrada con la implementación de 2FA posterior al sprint (nota de revisión en 8.1.2). |

*Nota. Elaboración propia (2026).*

**Tabla 13**

*Historia de Usuario HU-18*

|  |  |
| --- | --- |
| **HISTORIA DE USUARIO — HU-18** |  |
| **Nombre:** | Registro de variables operativas por bloque, mes y año |
| **Puntos de historia (story points):** | 5 |
| **Como (rol):** | Gestor energético |
| **Quiero (funcionalidad):** | Registrar las variables operativas (población y días) por bloque, mes y año |
| **Para (beneficio):** | Alimentar los modelos de ingeniería de la línea base con las variables de uso real de la infraestructura |
| **CRITERIOS DE ACEPTACIÓN** |  |
| **Escenario 1 — Cuando:** | Importo el archivo de variables operativas seleccionando la edificación y el bloque en el paso 1 |
| **Espero:** | Cada fila se valida contra la identidad (bloque, mes, año), registra población fija y flotante, días lectivos y laborales, y grados de enfriamiento del día |
| **Escenario 2 — Cuando:** | Existe una variable para el mismo bloque, mes y año |
| **Espero:** | El asistente advierte la colisión y ofrece sobrescribir el registro existente tras confirmación |
| **DEFINICIÓN DE TERMINADO (DoD)** |  |
| ☒ Código revisado y aprobado por el equipo (code review)<br>☒ Prueba funcional ejecutada y aprobada (caso de prueba documentado)<br>☒ Evidencia visual integrada en el diario de sprint<br>☒ Criterios de aceptación verificados y marcados<br>☒ Sin deuda técnica conocida asociada a esta HU |  |

*Nota. Elaboración propia (2026).*

**Tabla 14**

*Historia de Usuario HU-19*

|  |  |
| --- | --- |
| **HISTORIA DE USUARIO — HU-19** |  |
| **Nombre:** | Gestión de los registros guardados (edición, borrado y vaciado) |
| **Puntos de historia (story points):** | 5 |
| **Como (rol):** | Administrador (gestor energético) |
| **Quiero (funcionalidad):** | Editar, eliminar y vaciar los registros guardados de facturas, equipos, variables, ajustes y líneas base |
| **Para (beneficio):** | Corregir errores de carga y poder reiniciar el almacén desde cero |
| **CRITERIOS DE ACEPTACIÓN** |  |
| **Escenario 1 — Cuando:** | Edito el consumo de una factura guardada en la pestaña Gestión |
| **Espero:** | El valor se actualiza en base de datos (el periodo es inmutable por ser la identidad del registro) y la visualización refleja el cambio |
| **Escenario 2 — Cuando:** | Pulso «Vaciar facturas» con líneas base existentes |
| **Espero:** | Un diálogo advierte que el vaciado eliminará también las líneas base asociadas y la operación solo se ejecuta tras confirmación explícita |
| **DEFINICIÓN DE TERMINADO (DoD)** |  |
| ☒ Código revisado y aprobado por el equipo (code review)<br>☒ Prueba funcional ejecutada y aprobada (caso de prueba documentado)<br>☒ Evidencia visual integrada en el diario de sprint<br>☒ Criterios de aceptación verificados y marcados<br>☒ Sin deuda técnica conocida asociada a esta HU |  |

*Nota. Elaboración propia (2026).*

**Tabla 15**

*Historia de Usuario HU-21*

|  |  |
| --- | --- |
| **HISTORIA DE USUARIO — HU-21** |  |
| **Nombre:** | Gestión del catálogo de edificaciones y bloques desde la carga |
| **Puntos de historia (story points):** | 3 |
| **Como (rol):** | Administrador (coordinador de infraestructura) |
| **Quiero (funcionalidad):** | Crear y eliminar edificaciones y bloques durante la carga |
| **Para (beneficio):** | Mantener el catálogo de la sede sin salir del asistente de importación |
| **CRITERIOS DE ACEPTACIÓN** |  |
| **Escenario 1 — Cuando:** | El bloque que necesito no existe en el paso 1 del asistente de equipos o variables |
| **Espero:** | Abro el drawer de nuevo bloque, lo creo con código, nombre, área útil y factor de infraestructura, y queda seleccionado para la importación |
| **Escenario 2 — Cuando:** | Intento eliminar una edificación o un bloque que tiene datos registrados |
| **Espero:** | El sistema impide el borrado y muestra un mensaje que indica exactamente qué secciones deben vaciarse primero |
| **DEFINICIÓN DE TERMINADO (DoD)** |  |
| ☒ Código revisado y aprobado por el equipo (code review)<br>☒ Prueba funcional ejecutada y aprobada (caso de prueba documentado)<br>☒ Evidencia visual integrada en el diario de sprint<br>☒ Criterios de aceptación verificados y marcados<br>☒ Sin deuda técnica conocida asociada a esta HU |  |

*Nota. Elaboración propia (2026).*

## 8.1.2. *Revisión del Sprint 1*

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Mínimo 200 palabras. Describir: qué se completó y qué no, causa de los pendientes, ajustes al backlog, velocidad alcanzada y observaciones del asesor. Incluir firma de aprobación del sprint por el asesor.*<br>El asesor firma la aprobación del sprint en esta tabla antes de continuar al siguiente. |
| **👁 ASESOR — verificar:**  *Verificar que la revisión describe con honestidad lo completado y lo pendiente, y que la velocidad es coherente con los puntos del backlog.* |

**Tabla 16**

*Revisión y Retrospectiva del Sprint 1*

En el Sprint 1 se completó el objetivo pactado: el sistema quedó protegido por autenticación y con el flujo completo de ingesta de datos operativo. Se entregaron las rutas de inicio de sesión, registro y cierre de sesión con JWT en cookie httpOnly y hash bcrypt, la administración de usuarios para el rol administrador (creación, edición, cierre de sesiones activas y registro del último acceso) y los tres asistentes de importación de cuatro pasos —Facturas EPM, Equipos Eléctricos y Variables Operativas— junto con sus pestañas de visualización y de gestión (edición, borrado y vaciado). El trabajo adicional más representativo fue el catálogo de edificaciones y bloques dentro de los propios asistentes (HU-21), porque los importadores no podían operar sobre una sede sin estructura previa; el borrado de catálogo se condicionó a que no existan datos asociados, con un mensaje que indica qué secciones deben vaciarse primero.

El problema técnico principal fue la colisión de claves únicas al reimportar archivos: las facturas son únicas por periodo, los equipos por (bloque, espacio, tipo) y las variables por (bloque, mes, año), de modo que una segunda carga del mismo archivo podía sobrescribir datos sin aviso. Se resolvió con un paso explícito de confirmación de sobrescritura en los tres asistentes y validación Zod tanto en el cliente como en el servidor. Además se corrigió un aviso de hidratación de React provocado por el script de tema que se ejecuta antes del pintado de la página, añadiendo `suppressHydrationWarning` en la etiqueta raíz.

El backlog se ajustó durante el sprint: se incorporaron las HU-15, HU-18, HU-19 y HU-21 (autenticación, variables operativas, gestión de registros y catálogos), que no estaban en el diseño inicial porque emergieron de las necesidades reales de operación. La velocidad alcanzada fue de 36 story points sobre 36 planificadas (100 %), sin HU pendientes.

**Nota de revisión (10 de octubre de 2026).** Con posterioridad al cierre del sprint se añadieron funcionalidades y se corrigieron incidencias sobre HU ya completadas, sin variar su alcance, sus puntos ni su estado. A la HU-15 se le incorporó la verificación en dos factores (2FA) con TOTP: enrolamiento con código QR y códigos de respaldo, inicio de sesión en dos fases con token temporal de corta vigencia, límite de cinco intentos con bloqueo de quince minutos persistido en base de datos y una política que exige 2FA a los roles ADMIN_TI y GESTOR_ENERGETICO mientras el resto de roles puede activarlo de forma opcional; con esta entrega se cierra la deuda anotada en el DoD de la HU-15 (el banderón de dos factores existía en el modelo de datos pero no estaba implementado). Sobre la sección de ajustes energéticos asociada a la HU-19 se corrigieron cuatro incidencias posteriores a su marca de completado: la creación de ajustes respondía 404 por una ruta inexistente, el interruptor Carga/Visualización/Gestión no estaba cableado al estado global, se añadieron los campos de modelo y dirección con su seed y se repararon dos historias de Storybook (issues #52–#55, cerrados el 7 de octubre de 2026). Finalmente, también sobre la HU-15, se añadió la posibilidad de que el administrador exija 2FA a usuarios con roles de 2FA opcional mediante un interruptor por usuario (issue #59, commit `1699be9`, 10 de octubre de 2026): el nuevo indicador por usuario `twoFactorRequired` alimenta la política de 2FA junto al rol, de modo que el inicio de sesión y el guardián del panel redirigen al enrolamiento pendiente igual que en los roles obligatorios; se creó el endpoint `POST /api/users/[id]/2fa/require` (solo administrador, con auditoría) y el interruptor en la pestaña Seguridad de la ficha de usuario, y se corrigió el enlace «Configurar 2FA» que en cuentas ajenas enrolaba la sesión del administrador en lugar de la del usuario objetivo.

| **Aspecto** | **Detalle** |
| --- | --- |
| Sprint 1 — objetivo pactado | Construir la base de acceso al sistema (autenticación y administración de usuarios con roles) y el flujo de carga y gestión de datos: importadores de Facturas EPM, Equipos y Variables Operativas con visualización y gestión. |
| Duración | Semana 9 a semana 10 del semestre |
| HU planificadas (pts) | 7 HU — HU-01 (5), HU-02 (5), HU-03 (5), HU-15 (8), HU-18 (5), HU-19 (5), HU-21 (3) = 36 pts |
| HU completadas (pts / %) | 7 HU / 36 pts / 100 % |
| HU no completadas (y causa) | Ninguna |
| Problema técnico principal encontrado | Colisión de claves únicas al reimportar archivos (facturas por periodo; equipos por bloque, espacio y tipo; variables por bloque, mes y año), con riesgo de sobrescritura silenciosa. |
| Cómo se resolvió | Paso de confirmación de sobrescritura en los tres asistentes + validación Zod en cliente y servidor. De forma paralela, se corrigió el aviso de hidratación del tema oscuro con `suppressHydrationWarning` en la etiqueta raíz. |
| Decisión técnica relevante tomada en este sprint | ADR-06 (autenticación propia con JWT, bcrypt y tabla de sesiones) y consolidación del patrón de asistente de 4 pasos con validación compartida, reutilizado por los tres importadores. |
| Ajuste al backlog | Se añadieron HU-15, HU-18, HU-19 y HU-21, ausentes del diseño inicial; HU-03 se amplió para cubrir los tres asistentes. |
| Correcciones y adiciones posteriores al cierre | 2FA TOTP en la HU-15 (10/10/2026, cierra la deuda del DoD), interruptor administrativo «Exigir 2FA» por usuario (issue #59, 10/10/2026) y cuatro correcciones de la sección de ajustes en la HU-19 (issues #52–#55, 07/10/2026). Detalle en la nota de revisión anterior; sin cambio de estado ni de puntos. |
| Aprobado por asesor — fecha | ☐ Sí    Fecha: |

*Nota. Elaboración propia (2026).*

## 8.1.3. *Evidencias del Sprint 1*

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Incluir las capturas de pantalla o fragmentos de código más representativos del sprint. Cada evidencia debe tener número de figura, título descriptivo y nota de fuente.*<br>No incluir capturas de "Hello World" ni pantallas sin contexto. Cada evidencia debe vincularse a una HU específica. |

Las evidencias del Sprint 1 corresponden a las HU-15, HU-01, HU-02, HU-03, HU-19 y HU-21. En el repositorio, cada flujo está respaldado por una historia de Storybook que ejercita el componente completo con datos deterministas (los módulos de Server Actions se sustituyen por dobles en el build de Storybook, ADR-10), lo que permite reproducir la evidencia sin una base de datos de pruebas.

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Figura N. \[Descripción concreta: "Módulo de autenticación — pantalla de inicio de sesión"]. Nota. Elaboración propia (año). — Insertar aquí* |

![](figuras/out/fig11.png)

<a id="_fig11"></a>*fig 11. Módulo de autenticación — pantalla de inicio de sesión con el árbol de bienvenida y el control de tema. Nota. Elaboración propia (2026).*

![](figuras/out/fig12.png)

<a id="_fig12"></a>*fig 12. Gestión de usuarios — listado de usuarios con sus roles y ficha de detalle del administrador de TI. Nota. Elaboración propia (2026).*

![](figuras/out/fig13.png)

<a id="_fig13"></a>*fig 13. Asistente de importación de Facturas EPM — paso 2 «Mapeo» con detección automática de encabezados. Nota. Elaboración propia (2026).*

![](figuras/out/fig14.png)

<a id="_fig14"></a>*fig 14. Asistente de importación de Equipos — segmentación por edificación, bloque y espacio con creación inline de catálogo. Nota. Elaboración propia (2026).*

![](figuras/out/fig15.png)

<a id="_fig15"></a>*fig 15. Pestaña Gestión — edición en línea de una factura y diálogo de confirmación de borrado. Nota. Elaboración propia (2026).*

|  |
| --- |
| **⚠ IMPORTANTE:**  *Repetir la estructura 8.1 (HU + Revisión + Evidencias) para cada sprint adicional (8.2 Sprint 2, 8.3 Sprint 3, etc.).* |

## 8.2. Sprint 2

**Sprint 2 (semanas 11–12 del semestre).** Objetivo: desarrollar el componente analítico y el control de acceso fino: cálculo de líneas base energéticas con los modelos de la Resolución UPME 0016 de 2024, asignación de permisos por módulo y visualización de datos. HU planificadas: 6 (46 story points).

## 8.2.1. *Historias de usuario del Sprint 2*

**Tabla 17**

*Historia de Usuario HU-04*

|  |  |
| --- | --- |
| **HISTORIA DE USUARIO — HU-04** |  |
| **Nombre:** | Visualización del consumo histórico |
| **Puntos de historia (story points):** | 8 |
| **Como (rol):** | Administrador (gestor energético) |
| **Quiero (funcionalidad):** | Ver el consumo histórico para identificar patrones de consumo |
| **Para (beneficio):** | Observar la evolución del consumo cargado antes de extraer conclusiones |
| **CRITERIOS DE ACEPTACIÓN** |  |
| **Escenario 1 — Cuando:** | Abro la pestaña Visualización de Facturas EPM con datos importados |
| **Espero:** | Veo los indicadores del período, la gráfica de barras animada y la tabla paginada con búsqueda insensible a acentos |
| **Escenario 2 — Cuando:** | Se complete el módulo de análisis estadístico | 
| **Espero:** | El sistema identifica automáticamente los períodos con patrones atípicos sobre la serie histórica y los relaciona con el calendario académico |
| **DEFINICIÓN DE TERMINADO (DoD)** |  |
| ☒ Código revisado y aprobado por el equipo (code review)<br>☐ Prueba funcional ejecutada y aprobada (caso de prueba documentado)<br>☒ Evidencia visual integrada en el diario de sprint<br>☐ Criterios de aceptación verificados y marcados<br>☐ Sin deuda técnica conocida asociada a esta HU | HU en progreso: el escenario 1 está operativo; el escenario 2 quedó implementado el 12/10/2026 (módulo `/dashboard/analisis`, sub-issue #73) y pendiente de prueba funcional aprobada. |

*Nota. Elaboración propia (2026).*

**Tabla 18**

*Historia de Usuario HU-05*

|  |  |
| --- | --- |
| **HISTORIA DE USUARIO — HU-05** |  |
| **Nombre:** | Dashboard con KPIs de consumo |
| **Puntos de historia (story points):** | 8 |
| **Como (rol):** | Administrativo y/o financiero (directivo) |
| **Quiero (funcionalidad):** | Ver un dashboard con KPIs de consumo, para apoyar decisiones de gasto energético |
| **Para (beneficio):** | Disponer de una vista consolidada del estado energético de la sede |
| **CRITERIOS DE ACEPTACIÓN** |  |
| **Escenario 1 — Cuando:** | Ingreso a la sección Resumen de Gestión de datos |
| **Espero:** | Veo cuatro tarjetas de indicadores (facturas, equipos, variables y líneas base) con datos reales que navegan a cada sección, más la guía animada «Cómo funciona» |
| **Escenario 2 — Cuando:** | Se complete el dashboard principal con los KPIs de consumo |
| **Espero:** | El panel muestra kWh, costo y variación interperiodual con datos reales que se actualizan al cargar nuevas facturas |
| **DEFINICIÓN DE TERMINADO (DoD)** |  |
| ☒ Código revisado y aprobado por el equipo (code review)<br>☐ Prueba funcional ejecutada y aprobada (caso de prueba documentado)<br>☒ Evidencia visual integrada en el diario de sprint<br>☐ Criterios de aceptación verificados y marcados<br>☐ Sin deuda técnica conocida asociada a esta HU | HU en progreso: el escenario 1 está operativo; el dashboard principal con KPIs de consumo sigue pendiente. |

*Nota. Elaboración propia (2026).*

**Tabla 19**

*Historia de Usuario HU-07*

|                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HISTORIA DE USUARIO — HU-07**                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                    |
| **Nombre:**                                                                                                                                                                                                                                                                                    | Análisis estadístico y detección de patrones                                                                                                                                                                                                                                                       |
| **Puntos de historia (story points):**                                                                                                                                                                                                                                                         | 8                                                                                                                                                                                                                                                                                                  |
| **Como (rol):**                                                                                                                                                                                                                                                                                | Sistema                                                                                                                                                                                                                                                                                            |
| **Quiero (funcionalidad):**                                                                                                                                                                                                                                                                    | Ejecutar el análisis estadístico y la detección de patrones sobre los datos cargados, para identificar épocas de consumo inusual                                                                                                                                                                   |
| **Para (beneficio):**                                                                                                                                                                                                                                                                          | Señalar automáticamente los meses que se desvían del comportamiento histórico esperado                                                                                                                                                                                                             |
| **CRITERIOS DE ACEPTACIÓN**                                                                                                                                                                                                                                                                    |                                                                                                                                                                                                                                                                                                    |
| **Escenario 1 — Cuando:**                                                                                                                                                                                                                                                                      | El motor de línea base depura la serie de consumo de un bloque                                                                                                                                                                                                                                     |
| **Espero:**                                                                                                                                                                                                                                                                                    | Los meses atípicos se identifican por la banda de confianza de su mes (±10 % por defecto; rescate IC ec. 4-5 con N ≥ 10 si quedan < 36 —con recomputo de la media tras el descarte—) y se marcan en color ámbar en la gráfica y en la tabla de preparación, con la decisión registrada fila a fila |
| **Escenario 2 — Cuando:**                                                                                                                                                                                                                                                                      | Se complete el módulo de análisis sobre facturas                                                                                                                                                                                                                                                   |
| **Espero:**                                                                                                                                                                                                                                                                                    | El sistema señala las épocas de consumo inusual del histórico completo (no solo de la línea base) con su explicación estadística                                                                                                                                                                   |
| **DEFINICIÓN DE TERMINADO (DoD)**                                                                                                                                                                                                                                                              |                                                                                                                                                                                                                                                                                                    |
| ☒ Código revisado y aprobado por el equipo (code review)<br>☐ Prueba funcional ejecutada y aprobada (caso de prueba documentado)<br>☒ Evidencia visual integrada en el diario de sprint<br>☐ Criterios de aceptación verificados y marcados<br>☐ Sin deuda técnica conocida asociada a esta HU | HU en progreso: el escenario 1 está operativo dentro de LBEn; el escenario 2 quedó implementado el 12/10/2026 (sub-issue #73) y pendiente de prueba funcional aprobada.                                                                                                                                                                       |

*Nota. Elaboración propia (2026).*

**Tabla 20**

*Historia de Usuario HU-16*

|  |  |
| --- | --- |
| **HISTORIA DE USUARIO — HU-16** |  |
| **Nombre:** | Asignación de permisos temporales y permanentes por módulo |
| **Puntos de historia (story points):** | 8 |
| **Como (rol):** | Administrador (rol ADMIN_TI) |
| **Quiero (funcionalidad):** | Asignar permisos temporales o permanentes por módulo a los usuarios, para excepcionar la matriz de roles con trazabilidad |
| **Para (beneficio):** | Cubrir necesidades puntuales de acceso sin modificar los roles base |
| **CRITERIOS DE ACEPTACIÓN** |  |
| **Escenario 1 — Cuando:** | Abro el drawer «Asignar permiso» desde la ficha de un usuario y elijo un permiso temporal con duración de 24 horas |
| **Espero:** | El sistema guarda la excepción con su fecha de expiración, el usuario accede al módulo y el permiso deja de aplicar al vencer; la concesión queda en la bitácora de auditoría |
| **Escenario 2 — Cuando:** | Intento conceder una excepción permanente para un módulo fuera de la matriz de roles, o sobre el módulo de usuarios |
| **Espero:** | El sistema muestra una advertencia explícita sobre la excepción permanente y exige reconocimiento; en el módulo de usuarios la excepción nunca se aplica (defensa en profundidad) |
| **DEFINICIÓN DE TERMINADO (DoD)** |  |
| ☒ Código revisado y aprobado por el equipo (code review)<br>☒ Prueba funcional ejecutada y aprobada (caso de prueba documentado)<br>☒ Evidencia visual integrada en el diario de sprint<br>☒ Criterios de aceptación verificados y marcados<br>☐ Sin deuda técnica conocida asociada a esta HU | Deuda pendiente: los registros de excepciones vencidas no se depuran de forma automática. |

*Nota. Elaboración propia (2026).*

**Tabla 21**

*Historia de Usuario HU-17*

|  |  |
| --- | --- |
| **HISTORIA DE USUARIO — HU-17** |  |
| **Nombre:** | Cálculo y persistencia de la línea base energética (LBEn) |
| **Puntos de historia (story points):** | 13 |
| **Como (rol):** | Gestor energético |
| **Quiero (funcionalidad):** | Calcular y guardar la línea base energética de un bloque con los modelos de la Resolución UPME 0016 de 2024 |
| **Para (beneficio):** | Contar con la línea base normativa para estimar ahorros y reportar a la UPME |
| **CRITERIOS DE ACEPTACIÓN** |  |
| **Escenario 1 — Cuando:** | Selecciono un bloque, elijo uno de los cuatro modelos (valor absoluto, cociente, regresión o confort térmico) y ejecuto el cálculo |
| **Espero:** | El motor Python recibe la serie por JSON, depura los atípicos, calcula los coeficientes con su R², valor p y rangos de confianza (IC ec. 4-5 y ±10 %), y devuelve el resultado al navegador dentro del tiempo límite definido |
| **Escenario 2 — Cuando:** | Reviso el resultado antes y después de guardarlo, o intento guardar sin cálculo previo |
| **Espero:** | La gráfica SVG interactiva (banda de confianza, residuos, meses descartados con teclado y leyenda), la tabla de preparación y la tabla jerárquica reflejan el cálculo; el guardado solo está habilitado tras un cálculo exitoso y guarda por clave (bloque, tipo) |
| **DEFINICIÓN DE TERMINADO (DoD)** |  |
| ☒ Código revisado y aprobado por el equipo (code review)<br>☒ Prueba funcional ejecutada y aprobada (caso de prueba documentado)<br>☒ Evidencia visual integrada en el diario de sprint<br>☒ Criterios de aceptación verificados y marcados<br>☐ Sin deuda técnica conocida asociada a esta HU | Deuda pendiente: falta `requirements.txt` reproducible para el motor Python y el arranque del proceso añade segundos a cada cálculo (ADR-08). |

*Nota. Elaboración propia (2026).*

**Tabla 22**

*Historia de Usuario HU-20*

|  |  |
| --- | --- |
| **HISTORIA DE USUARIO — HU-20** |  |
| **Nombre:** | Sección Resumen con tarjetas de indicadores y guía del flujo |
| **Puntos de historia (story points):** | 3 |
| **Como (rol):** | Usuario del sistema |
| **Quiero (funcionalidad):** | Ver una sección de resumen con tarjetas de indicadores y una guía del flujo de datos |
| **Para (beneficio):** | Ubicarse rápidamente en la plataforma y entender cómo se alimenta cada sección |
| **CRITERIOS DE ACEPTACIÓN** |  |
| **Escenario 1 — Cuando:** | Ingreso a la sección Resumen |
| **Espero:** | Veo cuatro tarjetas con los conteos reales de facturas, equipos, variables y líneas base, y cada tarjeta navega a su sección |
| **Escenario 2 — Cuando:** | Observo la guía «Cómo funciona» |
| **Espero:** | La línea de tiempo reproduce los flujos de Facturas, Equipos y Líneas Base con maquetas animadas y respeta la preferencia de movimiento reducido |
| **DEFINICIÓN DE TERMINADO (DoD)** |  |
| ☒ Código revisado y aprobado por el equipo (code review)<br>☒ Prueba funcional ejecutada y aprobada (caso de prueba documentado)<br>☒ Evidencia visual integrada en el diario de sprint<br>☒ Criterios de aceptación verificados y marcados<br>☒ Sin deuda técnica conocida asociada a esta HU |  |

*Nota. Elaboración propia (2026).*

## 8.2.2. *Revisión del Sprint 2*

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Mínimo 200 palabras. Describir: qué se completó y qué no, causa de los pendientes, ajustes al backlog, velocidad alcanzada y observaciones del asesor. Incluir firma de aprobación del sprint por el asesor.*<br>El asesor firma la aprobación del sprint en esta tabla antes de continuar al siguiente. |
| **👁 ASESOR — verificar:**  *Verificar que la revisión describe con honestidad lo completado y lo pendiente, y que la velocidad es coherente con los puntos del backlog.* |

**Tabla 23**

*Revisión y Retrospectiva del Sprint 2*

**Nota de revisión (27 de octubre de 2026 — HU-09, issue #147).** Como trabajo posterior al Sprint 2 se completó el módulo de estimaciones: motor `python -m lben.forecast` con depuración UPME y mínimo de 36 meses depurados, SARIMA estacional de período 12 seleccionado por AIC y fallback ARIMA, endpoint interno `POST /api/forecast`, contratos Zod, permisos server-side, comparación con LBEn guardada y vista responsive sin persistencia. La proyección admite 1–3 meses; si no hay LBEn guardada, se muestra sin comparación. `estimates:create` habilita orden manual y `create`/`evaluate` habilitan diagnósticos. HU-09 pasa a «Completado» con 8 puntos; al ser una entrega posterior, no modifica la velocidad ni los puntos planificados del Sprint 2.

**Nota de revisión (27 de octubre de 2026 — corrección posterior de HU-09).** Se ajustó el umbral de estimación: los 36 meses depurados se presentan como recomendación de confiabilidad y, si el histórico tiene menos, se advierte con el conteo real y se intenta calcular; solo se informa error cuando ningún modelo logra ajustarse. La LBEn regulatoria conserva sus propias reglas y no se modifica.

**Nota de revisión (28 de octubre de 2026 — evolución geométrica de HU-22, issue #150).** Se amplió el catálogo espacial sin reemplazar el layout paramétrico existente: los espacios pueden asociarse a una etiqueta de piso y tener largo, ancho y altura opcional; los bloques admiten las mismas dimensiones y su área de huella calculada se conserva aparte de `areaUtil`, que mantiene su significado energético. La gestión permite registrar y actualizar estos datos como opciones avanzadas, y el inspector espacial recibe piso, medidas y áreas; el layout usa dimensiones medidas cuando existen y conserva el cálculo anterior como respaldo. El importador de equipos admite una columna opcional de piso y advierte si un nombre repetido no se puede resolver. El `db push` verificó que el esquema ya estaba sincronizado con Neon. La generación local del cliente Prisma sigue pendiente por un bloqueo de archivo de Windows; no altera el estado de sincronización de la base.

**Nota de revisión (28 de octubre de 2026 — consulta espacial por niveles, issue #150).** Se añadió la vista «Espacios por piso» junto al campus 3D existente. Permite filtrar niveles, agrupar los espacios por bloque y consultar únicamente las áreas, dimensiones y equipos registrados; un acceso desde cada bloque retorna a su visualización 3D. La interfaz aclara que no representa posiciones reales en planta, pues estas requieren geometría validada. En esa entrega, la conversión/importación CAD seguía como alcance separado (issue #151); su primera iteración posterior se documenta a continuación. HU-22 conserva su estado y alcance original.

**Nota de revisión (28 de octubre de 2026 — primera iteración de Planos CAD, issue #151).** Se incorporó una tercera pestaña al Módulo Espacial sin sustituir «Campus 3D» ni «Espacios por piso». La lectura ocurre localmente en el navegador con `dxf-parser` 1.1.2 (MIT; paquete publicado de 192.691 bytes sin descomprimir; última versión publicada el 12 de noviembre de 2021, por lo que se limita explícitamente el subconjunto y se registra riesgo de mantenimiento), restringida a polilíneas `LWPOLYLINE` cerradas y planas, sin segmentos curvos ni autointersecciones, dibujadas en capas cuyo nombre comience por `SIGE_ESPACIOS_`; se admiten recintos poligonales irregulares de hasta 128 vértices, con dimensiones obtenidas de su caja envolvente y área calculada sobre el polígono. Se reconocen etiquetas `TEXT`/`MTEXT` y `$INSUNITS`. Las unidades ambiguas deben elegirse manualmente. PDF y WebP solo se previsualizan; DWG requiere exportación previa a DXF vectorial o PDF. El flujo permite asociar y corregir piso y dimensiones antes de confirmar, y actualiza exclusivamente espacios existentes del bloque elegido con permiso `plans:modify`, validación server-side, transacción y auditoría. El esquema actual no almacena polígonos, por lo que solo persiste piso, largo, ancho y área poligonal calculada; no se crean modelos geométricos duplicados. El archivo temporal se conserva solo en el navegador durante la sesión: no se envía, convierte ni almacena en Vercel o PostgreSQL. Se comparó esta opción con persistir binarios en la base de datos, que implicaría almacenamiento, copias de seguridad y política de retención sin beneficio requerido en esta fase; se difiere hasta decisión explícita. HU-22 conserva alcance y puntos.

**Nota de revisión (29 de octubre de 2026 — selección visual en Planos CAD, issue #151).** El visor local muestra contexto DXF de entidades `LINE`, `LWPOLYLINE`, `POLYLINE`, `CIRCLE`, `ARC`, `TEXT` y `MTEXT`, detrás de los contornos importables. Se puede seleccionar un contorno en el dibujo o en la lista: el visor enfoca su ubicación y la fila queda resaltada; desde el contorno seleccionado se puede vincular el registro de SIGE, y la asociación se refleja también en la lista y la etiqueta del plano. El fondo es referencia visual; arcos se aproximan mediante segmentos, polilíneas con bulges y `SPLINE` no se dibujan. No se crean espacios nuevos ni se persiste geometría CAD. Se validó el DXF real `5-Xref Arq Bloque 5.dxf` (3,71 MB, versión AC1032, unidades en metros): contiene 2.554 entidades (2.359 `LWPOLYLINE` y 195 `SPLINE`), sin entidades `TEXT`/`MTEXT`. Una exploración inicial halló 49 rectángulos en capas constructivas (`COLUMNA` y `Puerta`), no los 42 recintos habitables; por seguridad, esos rectángulos no se ofrecen para importar. La importación ahora acepta únicamente polilíneas `LWPOLYLINE` cerradas, planas, sin segmentos curvos, en capas cuyo nombre comience por `SIGE_ESPACIOS_`; las dimensiones guardadas son las extensiones del contorno y el área se calcula por el polígono, no por su caja envolvente. Para probar tres recintos, se deben dibujar sus perímetros en una capa como `SIGE_ESPACIOS_PISO_1`, agregar textos identificadores dentro de cada perímetro y exportar nuevamente a DXF. La prueba real de esos recintos permanece pendiente de dicho archivo editado.

**Nota de revisión (2 de noviembre de 2026 — HU-10, issue #21, y HU-12, issue #23).** La consulta de reportes ahora agrega las facturas según la granularidad seleccionada y utiliza únicamente datos de la edificación, variables operativas y LBEn guardada para el alcance. Las facturas solo se clasifican frente a una banda mensual disponible; sin ella se muestra «Sin clasificación». Se retiraron cifras de relleno y porcentajes de ahorro no calculados, y los valores ausentes se presentan como no disponibles. PDF y Word quedan como informes de gestión con referencia técnica UPME, no como certificación de cumplimiento. La comparación gráfica contra LBEn se limita a la granularidad mensual para no comparar magnitudes de escalas distintas. HU-11 (Excel) permanece pendiente.

El Sprint 2 se concentró en el componente analítico y en el control de acceso fino. Se completaron la HU-17 (cálculo de las cuatro líneas base de la Resolución UPME 0016 de 2024 con gráfica SVG interactiva y tablas de transparencia), la HU-16 (permisos temporales y permanentes por módulo con auditoría y revocación) y la HU-20 (sección Resumen con tarjetas de indicadores y guía animada). El problema técnico principal fue integrar el motor de Python en el flujo del servidor: se definió una interfaz de línea de comandos que intercambia JSON por stdin/stdout, con tiempo límite de ejecución, sanitización de los valores NaN/Infinity antes de serializar y mensajes accionables cuando el servidor no tiene Python instalado (ADR-08).

Durante la validación con datos históricos se detectó un error real de dominio: la potencia nominal de los equipos se calculaba como cantidad por potencia, lo que duplicaba la carga instalada (el total del campus aparecía como 1.872,72 kW en lugar de 54,36 kW). La corrección consistió en almacenar la potencia por unidad y multiplicar por la cantidad solo al aggregar. Para la gráfica se decidió construirla en SVG sin librería de charts (ADR-09), lo que permitió añadir banda de confianza, residuos, meses descartados por la banda de su mes, tooltip con mouse y teclado, y `aria-live`; se aprendió que las aserciones sobre toasts y diálogos animados en las historias de Storybook requieren `waitFor` con tiempo de espera, porque las animaciones arrancan en opacidad cero (ADR-10).

Quedaron sin completar la HU-04, la HU-05 y la HU-07 (22 pts): su causa común es que el alcance del motor de línea base resultó mayor que el previsto (cuatro modelos, diagnóstico estadístico con VIF y depuración) y absorbieron la capacidad del sprint; avanzaron a estado «En progreso» y se planean para las semanas 13–16. La velocidad fue de 24 de 46 puntos planificados (52 %), sin ajustes de alcance sobre las HU completadas.

**Nota de revisión (10 de octubre de 2026).** Tras completarse la HU-17 se corrigieron seis incidencias del motor y de los ajustes Anexo 4 (issues #46–#51, cerrados el 7 de octubre de 2026), sin variar su alcance, sus puntos ni su estado: los ajustes Anexo 4 no llegaban a los cuatro modelos de línea base (tampoco a la serie base del modelo cociente), el sigma de los cocientes se calculaba después del descarte de atípicos, el desvío estándar de la ec. 5 no reproducía el valor de referencia sobre 44 facturas, la dirección del ajuste siempre aparecía como incremento por un problema de precedencia de operador, se reemplazó el criterio de depuración `ic_2sigma` por la banda del ±10 % con tarjetas de sigma visibles en la interfaz, y la base cruda dejó de ignorar los ajustes. Estas correcciones quedan reflejadas en los criterios de aceptación de las HU-07 y HU-17.

**Nota de revisión (12 de octubre de 2026).** Se entregó la sub-issue #73 de la HU-07 (con impacto en la HU-04): el módulo de análisis estadístico y detección de patrones que quedó pendiente de este sprint para las semanas 13–16. Se añadió un modo independiente al motor Python (`python -m lben.analisis`, JSON por stdin/stdout) que reutiliza la depuración normativa de la §7.5.1 para evaluar cada período del histórico contra la banda de su mes calendario (±10 %, ec. 3; ±2·DesvEst, ec. 4-5 cuando hay 10 o más muestras del mes), con explicación estadística en español, estadísticos globales, tendencia por mínimos cuadrados y contexto del calendario académico (días lectivos de Variables Operativas con umbral 12; los ajustes no rutinarios del Anexo 4 se aplican antes del análisis), expuesto en el endpoint `POST /api/analisis` con la misma autenticación `x-lben-key` que `/api/lben`. La página `/dashboard/analisis` exige la visibilidad de `consumption` y la ejecución vuelve a verificar en el servidor el permiso «Analizar consumo»; la vista ofrece selector de edificación, tarjetas de resumen, gráfica SVG con los atípicos en ámbar y el sombreado de vacaciones, y una tabla con la explicación de cada señal. El alcance se resolvió a nivel de edificación y no de bloque —la factura es el dato medido y la detección por mes calendario es invariante a la escala— y el análisis se ejecuta bajo demanda sin persistencia. Las HU-04 y HU-07 permanecen «En progreso» hasta la prueba funcional aprobada; sin cambio de puntos.

**Nota de revisión (12 de octubre de 2026 — rediseño visual, issue #74).** Se mejoró la presentación del módulo sin alterar datos, contratos ni permisos: la página adoptó el contenedor estándar del panel (`main` con `max-w-7xl` y padding responsive) que faltaba y dejaba el contenido pegado a los bordes del viewport; las tarjetas de resumen pasaron de chips compactos a tarjetas `ui-card-stat` con chip de icono, cifras grandes en `tabular-nums` y el ámbar reservado exclusivamente a las anomalías; se amplió el padding interno de los paneles (`p-5 sm:p-6`), se agruparon los avisos de cobertura con ritmo `space-y-3`, se alinearon los encabezados de sección sobre una línea base común y se tiñó el icono del estado vacío con el color de marca. Historia de usuario, alcance y puntos sin cambio (commit `647b165`, issue #74 cerrada).

**Nota de revisión (12 de octubre de 2026 — KPIs de gestión, issue #75).** Se añadió al módulo de análisis el panel «Ahorro y consumo elevado» con KPIs a tres niveles de granularidad: ahorro frente a la línea base guardada (`LineaBaseEnergia` por bloque, prioridad Cociente > Valor absoluto > Confort, con nota honesta cuando la única línea base es de regresión —no persiste kWh/mes— o cuando la cobertura de bloques es parcial), consumo elevado (períodos por encima de la banda superior del mes, máximo histórico y tendencia interanual) y períodos inusuales con sus kWh ya escalados al nivel. La edificación se analiza con dato exacto (facturas medidas) y habilita el ahorro solo con cobertura completa de líneas base; bloques y espacios se estiman por share con etiqueta de precisión visible en la cabecera del panel. La matemática de reparto se extrajo a `features/datos/models/shares.ts` como fuente única compartida con el motor de líneas base, evitando duplicar la regla de negocio (70 tests unitarios del módulo datos y 19 del análisis, más stories y responsive, en verde). Historia de usuario, alcance y puntos sin cambio (commit `b6d32ed`, issue #75 cerrada).

**Nota de revisión (13 de octubre de 2026 — integración de la API XM, issue #76).** Se añadió al módulo de análisis el benchmark «Comparación respecto al sistema (datos XM)»: dos series nacionales de XM —`DemaSIN` (diaria) y `DemaComeNoReg` (horaria)— agregadas a 13 meses con una consulta por mes calendario (ventana ≤31 días), índice base 100, variación interanual y sparkline por serie; una tarjeta de comparación interna entre las edificaciones de SIGE (promedio mensual de los últimos 12 meses vs los 12 previos, mínimo 6 facturas por ventana, con la edificación actual resaltada); y la sección «Datos y documentos XM» con el catálogo oficial de las métricas consultadas (nombre, descripción oficial, unidades, cruce, endpoint, límite de consulta y fecha de consulta) y enlaces a la documentación oficial, como fuente citable para el informe. El cliente es server-side con cache de 6 h, timeouts de 6 s, tope de concurrencia, espejos Zod y degradación elegante (callout de advertencia sin romper el análisis), bajo el mismo permiso `consumption/analyze`. Los pares por sector CIIU quedaron fuera del alcance tras verificarse en vivo que XM ignora el filtro y un mes horario completo pesa 6,8 MB / 12,3 s; la UI lo declara junto con la nota de que el benchmark describe comportamiento (tendencia y estacionalidad), no magnitud. Historia de usuario, alcance y puntos sin cambio (commit `87cb149`, issue #76 cerrada).

**Nota de revisión (13 de octubre de 2026 — línea base del análisis y ahorros §8.1).** Se amplió el módulo con la sección «Línea base del análisis»: un selector de modelo de línea base conforme al orden de la §7.4 que recalcula al vuelo —sin persistencia y sin salir del cliente— la LBEn por mes calendario del modelo elegido, más un selector de periodicidad (mes/año) que agrega la serie de la gráfica y la tabla de ahorros. El motor Python devolvió una nueva sección `modelos` con cinco hojas homólogas —`lben_mensual` de 12 posiciones, etiqueta, fórmula, unidad, criterio y métricas de validación (n, R², MAPE, p-valor máximo e intervalo de confianza)— exponiendo el motivo cuando un modelo no puede ajustarse: el cociente exige al menos 3 registros con población mayor que cero y la regresión al menos 36 meses depurados con variables operativas (§7.5.2-7.5.3); el modelo de ingeniería (§7.4.4) permanece fuera de alcance y el confort es un indicador complementario ASHRAE 55 sin potencial de ahorro definido en la Resolución. La vista muestra el modelo activo con su fórmula, sus chips de validación y la lista de modelos no disponibles con su motivo, traza la LBEn como línea punteada de referencia en la gráfica y añade tres indicadores —LBEn en kWh/mes (la unidad del dominio no cambia con la periodicidad), potencial de ahorro (ec. 9-11) y su porcentaje sobre la LBEn (ec. 12)— seguidos de la tabla §8.1 con el potencial por mes calendario contra el mejor desempeño del periodo base, o su total anual en modo año. El ejemplo trabajado del Anexo 1 quedó fijado como golden en la historia «Ahorro §8.1 (golden Anexo 1)» (enero: 830,3 kWh = 7,5 % de la LBEn; promedio anual: 467,6 kWh/mes = 4,1 %). Las periodicidades diaria y semanal figuran deshabilitadas con su motivo —requieren datos diarios, pendiente en el módulo de carga— y la ausencia de la sección `modelos` (motor desplegado en versión anterior) degrada a un callout sin tocar el análisis de períodos inusuales. Historia de usuario, alcance y puntos sin cambio (issue #77).

**Nota de revisión (13 de octubre de 2026 — submódulos y navegación lateral, issue #78).** Se dividió la vista del módulo de análisis en cuatro submódulos —Resumen, Comparativo, Patrones de consumo y Ahorros— extrayendo cada uno a un panel *props-driven* en `views/panels/` (más `comunes.tsx` con las piezas compartidas), de modo que el shell conserva el selector de edificación, el botón «Ejecutar análisis», la cabecera del resultado y el estado (cargando, error, benchmark XM) que gobiernan a los cuatro. La navegación entre submódulos adoptó la misma mecánica que el módulo de carga: un `SidebarNav` lateral con las cuatro secciones e iconos propios cuando la cabecera va arriba (offset `lg:ml-64`/`lg:ml-14`), el árbol de secciones embebido en `ModuleNav` cuando la cabecera está anclada a un costado y el cajón móvil por debajo de `lg`, en lugar de la tira de pestañas horizontal que se entregó primero en este mismo issue (commit `1b953f6`) y se retiró; las primitivas `.ui-tabs`/`.ui-tab` se eliminaron de `globals.css` al quedar sin uso. Como los módulos de datos y de análisis comparten un único `SubNavContext`, ambos suman un fallback que cae a «Resumen» cuando el identificador activo pertenece al otro módulo, evitando contenido vacío al cambiar de ruta. La página `/dashboard/analisis` pasó a poseer su propio layout a sangre (sin el contenedor `main` con `max-w-7xl`), igual que `/dashboard/datos`. Sin cambios en controllers, modelos, permisos (`consumption/analyze`), motor Python, alcance ni puntos (issue #78).

**Nota de revisión (13 de octubre de 2026 — simulador de umbral y presentación, issue #79).** Se añadió al panel Resumen un **simulador de umbral exploratorio** que permite responder al vuelo «¿qué pasaría si estrecho o aflojo el umbral?» sin ejecutar de nuevo el análisis ni tocar la detección normativa: la σ mensual se recupera de los propios límites del motor (σ = (sup − inf)/(2·K_INTERVALO_MOTOR), con K = 2 verificada en `python/lben/bandas.py`), y cada mes se evalúa con `media ± k·σ` cuando tiene n ≥ 10 muestras (ec. 4-5) o con `media ± pct %` cuando no (ec. 3); los controles cubren pct 5–30 (por defecto 10, igual que el normativo) y k 1–3 en pasos de 0,5 (por defecto 2). El análisis normativo (±10 % / ±2·DesvEst) sigue siendo el que produce los KPIs, la tabla de períodos inusuales y los atípicos en ámbar; la simulación se superpone opcionalmente a la gráfica en violeta con anillo punteado para los períodos que «entrarían», y la tarjeta muestra siempre la cifra normativa junto a la simulada con el aviso de que es una exploración no normativa. En presentación, la página ganó jerarquía (h1 a `text-3xl`, nombre de la edificación prominente con chip de estado, rango y fecha de cálculo), la gráfica subió a 320 px con marcas de eje «bonitas» y leyenda que incluye la banda normativa y la simulada, los controles avanzados de modelo, periodicidad y nivel se agruparon en una sección «Configuración del análisis» del shell —los submódulos Ahorros y Patrones perdieron sus selectores locales—, la explicación de cada período inusual pasó a una fila expandible por botón con `aria-expanded`/`aria-controls` (resaltado discreto de la fila con borde ámbar en vez de fondo completo) y el contexto XM del Comparativo se reordenó para que la tendencia interna de SIGE sea lo primero, la referencia externa XM quede como sección secundaria y su catálogo citable se colapse en un `<details>` conservando los enlaces de fuente visibles. Todo en la capa de vistas más helpers puros en `models/` (`simularUmbral` con 5 tests unitarios): sin cambios en controllers, esquemas del contrato, permisos (`consumption/analyze`) ni motor Python, y sin librerías nuevas (issue #79, commit `cb02fbe`).

**Nota de revisión (15 de octubre de 2026 — home con carrusel de módulos y LBEn flexible, issues #90 y #92).** Sobre el rediseño del overview con KPIs reales, gráficos SVG propios y paneles de análisis (PR #91, issue #90, fusionado el 14 de octubre de 2026), la issue #92 (PR #93) retiró la tarjeta «Vista de inicio» del home —la identificación del usuario permanece en el shell superior— y convirtió la sección de módulos en un banner con carrusel animado (framer-motion) que muestra una estadística real por módulo: usuarios activos, facturas registradas y variables operativas registradas; las cifras se consultan en el servidor solo para los módulos visibles del rol dentro del gate de permisos y se omiten —nunca se inventan— cuando no existen. El carrusel avanza solo hasta la primera interacción del usuario, pausa en hover o foco, ofrece controles y puntos con targets táctiles ≥40px en móvil, se vuelve manual sin animación con `useReducedMotion` y marca «Módulo en construcción» sin cifras para los módulos aún no implementados. En líneas base, `guardarLineaBase` acepta modelos con menos de 36 meses depurados: se persisten y se devuelve una advertencia que sugiere cargar más meses para cumplir la Resolución UPME 0016 de 2024, visible al calcular y tras guardar, con el formulario habilitado para «Guardar modelo» y el marcador «Línea base no conforme (UPME)». Se amplió el alcance de persistencia a la edificación completa — `LineaBaseEnergia` acepta `bloqueId` o `edificacionId` con exclusión mutua e índices únicos por par, con la migración aplicada a Neon — y la precedencia «el bloque primero» hace que cada bloque resuelva su propia LBEn con respaldo de la de su edificación, que las edificaciones sin bloques coticen como unidad propia en el resumen del tablero y en los KPIs de gestión del análisis agrupando por el mejor R² de cada bloque (se corrigió además un doble conteo preexistente en la suma global de consumo). Alcance, puntos y estado sin cambio: HU-05 y HU-07 permanecen «En progreso» hasta la prueba funcional aprobada y HU-17 permanece «Completado» (issues #90 y #92; PR #91 y PR #93).

**Nota de revisión (15 de octubre de 2026 — HU-23, infraestructura energética de las edificaciones, issues #94–#99).** Se entregó de forma retroactiva la HU-23 sobre el módulo de carga de datos (rama `feature/carga-edificaciones-upme`, un PR por fase): (1) sección propia «Edificaciones» de primer nivel con campos UPME —área en m²— y CRUD de bloques y espacios, desacoplando la gestión del catálogo de la carga de facturas (issues #94 y #95, commit `4a85737`); (2) calendario operativo configurable por edificación con rangos de tipo de día, plantilla inicial del TdeA editable y cálculo de la GDE con temperatura de Open-Meteo (ERA5) mostrando la fórmula sustituida junto al resultado, de modo que la GDE dejó de ser solo captura manual (issue #96, commit `2467dc3`); (3) horarios de funcionamiento de equipos por edificación con días de la semana y franja diaria sin cruce de medianoche (issue #97, commit `54b4870`); (4) vista mensual «Calendario» con los 19 festivos oficiales de Colombia de 2026 en un catálogo determinista —fechas fijas, móviles por Pascua, traslado a lunes de la Ley Emiliani y Chiquinquirá desde 2026 por la Ley 2578— con test golden verificado contra el calendario oficial del MinHacienda (issue #98, commit `36364a4`); y (5) horarios jerárquicos con ámbito edificación → bloque → espacio → equipo, vigencia desde/hasta y rechazo server-side de los horarios que comparten ámbito, días, franja y vigencia (issue #99, commit `0d88170`). Todos los cambios de schema fueron aditivos (`db push` sobre Neon, sin migración de datos) y la validación se reforzó en el servidor con Zod. La HU-23 se incorpora al backlog con 8 puntos (XL) y estado «Completado»; la HU-21 conserva su estado y puntos, pues su alcance (catálogo dentro de los asistentes) queda cubierto y superado por el apartado propio.

**Nota de revisión (16 de octubre de 2026 — HU-24, calendario completo, eventos y trazabilidad de la GDE, issues #106–#109).** Se entregó de forma retroactiva la HU-24 como evolución (Fase 6) de la infraestructura energética, sobre la rama `feat/fase6-calendario-eventos-gde` con tres PRs encadenados, a partir de una re-evaluación de la experiencia del módulo «Calendario y GDE»: (1) la ubicación de la edificación pasó de latitud/longitud manual a selección de ciudad o zona con el geocoding de Open-Meteo (mismo proveedor del clima, sin clave de API), guardando el nombre visible en `Edificacion.ubicacionNombre`; (2) el cálculo de la GDE se movió del cajón lateral a «Variables Operativas», con un panel que muestra la fórmula visible `GDE = Σ (Tp − Tb) · Xe`, los insumos efectivos y el origen del Xe antes de guardar, y el cajón quedó como «Calendario operativo»; (3) se añadió por edificación el interruptor «Usar horarios como Xe», apagado por defecto: con él apagado, Xe = H conserva el resultado legado idéntico bit a bit (cubierto por test de paridad), y con él encendido, Xe = horas de uso de los horarios vigentes por día (unión de franjas sin doble conteo, tope 24 h) —solo cálculos nuevos: la escritura ocurre únicamente mediante el botón explícito del mes elegido y los resultados históricos quedan intactos—; (4) «Equipos Eléctricos» muestra los horarios aplicables por equipo con insignia por nivel y vigencia visible, más las «horas de uso · esta semana» derivadas de la misma función `horasDeUsoEnFecha` que consume el cálculo (issue #106, commits `954a9ea`–`7adc818`); (5) el calendario ganó selector de año, vista anual con los doce meses y vistas Mes, Semana y Agenda con helpers puros de fecha (issue #107, commit `01e21ce`); y (6) se creó el módulo de eventos —tabla `Evento` con `Restrict` en las cuatro claves foráneas, tipos institucional, académico, mantenimiento y excepción, alta y baja con auditoría, y herencia visible en la descendencia del árbol de la edificación— y el calendario relacionó todo: insignias de tipo de día en las celdas, puntos de eventos, nombres de eventos y horas en la vista semanal, agenda mixta y resumen de días lectivos, festivos y eventos (issue #108, commits `dd49775` y `82a4e8b`). Los cambios de schema fueron aditivos sobre Neon (`ubicacionNombre`, `usarHorariosXe`, tabla `eventos`) sin migración de datos; la fórmula GDE y el módulo de análisis quedaron intactos, y los días lectivos se muestran solo como derivación, sin tocar la fuente de `RegistroCli`. La HU-24 se incorpora al backlog con 8 puntos (XL) y estado «Completado».

**Nota de revisión (19 de octubre de 2026 — modelo de horas/días de uso y política de operatividad, issue #131).** Se entregó como sub-issue de la HU-07 el modelo de uso del asistente de importación de Equipos, en cadena de cuatro PRs (#132 → #133 → #134 → #135, un PR por work-unit con las cuatro comprobaciones de CI en cada uno): (1) política de operatividad por edificación mediante dos interruptores —«Domingos operativos» y «Festivos operativos», encendidos por defecto— que solo restringen: un día es operativo si su tipo es lectivo o hábil, y cae en domingo o festivo únicamente cuando su interruptor correspondiente está encendido, sobre el catálogo de festivos de Colombia (Ley 51/1983, regla Emiliani y móviles, con Chiquinquirá desde 2026 por la Ley 2578); (2) horario efectivo por ámbito con precedencia espacio > bloque > edificación y *fallback* por nivel completo: el nivel más específico con al menos un horario vigente ese mes manda para todos los días de ese mes, uniendo sus franjas sin sumar entre niveles y sin aplicar el nivel «equipo» antes de la importación; (3) con el interruptor «Usar horarios como Xe» encendido, los días de uso del mes pasan a ser la intersección de los días operativos con los días en que corre el horario efectivo —un mes sin días de uso no recibe Xe de horarios en lugar de forzar un 0—, y con él apagado el cálculo permanece idéntico bit a bit; y (4) al cambiar los interruptores con una línea base ya calculada, el guardado devuelve un aviso que invita a recalcular las LBEn afectadas, contando ambos alcances de `LineaBaseEnergia` (los modelos por bloque y los de edificación completa, con exclusión mutua). La fórmula de la GDE y el módulo de análisis quedaron intactos: solo cambió la fuente de Xe. Las dos columnas nuevas de `CalendarioOperativo` se aplicaron a Neon mediante `db push` (aditivas, sin migración de datos). Alcance, puntos y estado sin cambio: la HU-07 permanece «En progreso».

| **Aspecto**                                                  | **Detalle**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sprint 2 — objetivo pactado                                  | Desarrollar el componente analítico (líneas base con los 4 modelos UPME) y el control de acceso fino (permisos por módulo), más la visualización de datos (sección Resumen).                                                                                                                                                                                                                                                                                                                                   |
| Duración                                                     | Semana 11 a semana 12 del semestre                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| HU planificadas (pts)                                        | 8 HU — HU-04 (8), HU-05 (8), HU-07 (8), HU-16 (8), HU-17 (13), HU-20 (3), HU-23 (8), HU-24 (8) = 62 pts                                                                                                                                                                                                                                                                                                                                                                                                                          |
| HU completadas (pts / %)                                     | 7 HU / 54 pts / 87 %                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| HU no completadas (y causa)                                  | HU-06 (5 pts): correlación con calendario académico en dashboard; pendiente de planificación posterior.                                                                                                                                                                                                                                                                                                                                                                                                       |
| Problema técnico principal encontrado                        | Integración del motor Python (proceso externo) en las Server Actions: tiempos de arranque, valores no serializables (NaN/Infinity) y falta de Python en el entorno.                                                                                                                                                                                                                                                                                                                                            |
| Cómo se resolvió                                             | Interfaz CLI JSON con tiempo límite, sanitización de valores no finitos y mensajes de error accionables. Además se corrigió el doble conteo de potencia nominal en el inventario (1.872,72 kW → 54,36 kW).                                                                                                                                                                                                                                                                                                     |
| Decisión técnica relevante tomada en este sprint             | ADR-08 (motor Python por CLI), ADR-09 (gráficas SVG propias) y ADR-07 (matriz de permisos estática con excepciones auditadas en BD).                                                                                                                                                                                                                                                                                                                                                                           |
| Ajuste al backlog                                            | HU-04, HU-05 y HU-07 pasan a «Completado»; se incorporaron HU-23 (8 pts) y HU-24 (8 pts) con estado «Completado»; HU-22 pasa a «Completado» con la feature `espacial`.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Correcciones posteriores a la HU-17                          | Seis incidencias del motor y de los ajustes Anexo 4 (issues #46–#51, 07/10/2026): ajustes que no llegaban a los modelos, sigma post-descarte, DesvEst de la ec. 5, base cruda sin ajustes, dirección del ajuste y criterio `banda_10_pct`. Detalle en la nota de revisión anterior; sin cambio de estado ni de puntos.                                                                                                                                                                                         |
| Avance posterior al sprint — módulo de análisis (12/10/2026) | Sub-issue #73 de la HU-07 (impacto en la HU-04): motor `python -m lben.analisis` + endpoint `POST /api/analisis`, página `/dashboard/analisis` con gráfica SVG, sombreado de vacaciones y tabla de períodos inusuales, guard server-side del permiso «Analizar consumo» y sin persistencia. HU-04 y HU-07: Completadas.                                                                                                                                                               |
| Rediseño visual del módulo de análisis (12/10/2026)          | Sub-issue #74 de la HU-07 (impacto en la HU-04): contenedor de página con padding responsive, tarjetas KPI `ui-card-stat` con iconos y `tabular-nums`, respiración de espaciados en paneles y avisos agrupados. Detalle en la nota de revisión; sin cambio de datos, contratos, estado ni puntos (commit `647b165`).                                                                                                                                                                                           |
| KPIs de gestión a 3 niveles (12/10/2026)                     | Sub-issue #75 de la HU-07 (impacto en la HU-04): panel «Ahorro y consumo elevado» con selector de nivel (edificación exacto · bloque y espacio estimados por share con etiqueta de precisión), ahorro vs línea base guardada, consumo elevado y períodos inusuales escalados; la matemática de shares se extrajo a `models/shares.ts` como fuente única compartida con LBEn. Detalle en la nota de revisión; sin cambio de alcance, estado ni puntos (commit `b6d32ed`).                                       |
| Integración API XM y benchmark (13/10/2026)                  | Sub-issue #76 de la HU-07 (impacto en la HU-04): benchmark con series nacionales de XM (índice base 100 e interanual), comparación interna entre edificaciones SIGE y sección «Datos y documentos XM» con catálogo oficial citable; cliente server-side con cache, timeouts, espejos Zod y degradación elegante. Los pares por sector CIIU se descartaron por límites verificados de la API (sin filtro factible). Detalle en la nota de revisión; sin cambio de alcance, estado ni puntos (commit `87cb149`). |
| Correcciones posteriores a la HU-07                          | Simulador de umbral exploratorio y rediseño de presentación (issue #79, 13/10/2026): simulador de umbral al vuelo en cliente, jerarquía visual, gráfica protagonista, controles agrupados, tabla de períodos inusuales con explicación en fila expandible y contexto XM secundario. Detalle en la nota de revisión; sin cambio de alcance ni de puntos (commit `cb02fbe`).                                                                                                                                     |
| Home con carrusel de módulos (15/10/2026)                    | Se retiró la tarjeta «Vista de inicio» y la sección de módulos se convirtió en un banner con carrusel animado (framer-motion) con una estadística real por módulo, consultada en el servidor solo para los módulos visibles del rol (issue #92, PR #93); complementa el rediseño del overview con KPIs reales (issue #90, PR #91, 14/10/2026). HU-05: Completada.                                                                                                                          |
| LBEn flexible y alcance de edificación (15/10/2026)          | Guardado de modelos con menos de 36 meses mediante advertencia y sugerencia de ajustes, persistencia a nivel de edificación completa (columnas anulables con índices únicos, aplicadas a Neon) y precedencia «el bloque primero» con respaldo de la edificación en tablero y análisis (issue #92, PR #93). HU-17 Completada y HU-07: Completada.                                                                                                                                                            |
| HU-23 — infraestructura de las edificaciones (15/10/2026)    | Nueva HU incorporada al backlog con 8 puntos (XL) y estado «Completado»: sección propia «Edificaciones» con campos UPME (área m²) y CRUD de bloques/espacios; calendario operativo configurable con plantilla TdeA y GDE calculada con Open-Meteo (fórmula visible junto al resultado); horarios de funcionamiento de equipos; vista mensual con los festivos oficiales de Colombia; y horarios jerárquicos con vigencia y rechazo de conflictos (issues #94–#99, commits `4a85737`–`0d88170`, un PR por fase). Schema aditivo sobre Neon; sin migración de datos. |
| HU-24 — calendario completo, eventos y trazabilidad de la GDE (16/10/2026) | Nueva HU incorporada al backlog con 8 puntos (XL) y estado «Completado»: ubicación por ciudad o zona con geocoding de Open-Meteo; GDE calculada desde «Variables Operativas» con fórmula e insumos visibles y origen del Xe opt-in por edificación (apagado = cálculo legado idéntico; encendido = horarios vigentes por día); trazabilidad de horarios y horas de uso en «Equipos Eléctricos»; calendario con selector de año, vistas año/mes/semana/agenda y resumen de días lectivos, festivos y eventos; módulo de eventos con herencia por el árbol de la edificación (issues #106–#109, commits `954a9ea`–`82a4e8b`, tres PRs encadenados #112 → #113 → #111). Schema aditivo sobre Neon; sin migración de datos; sin cambios en la fórmula GDE ni en el módulo de análisis. |
| Horario efectivo por ámbito y política de operatividad (19/10/2026) | Sub-issue #131 de la HU-07: interruptores «Domingos operativos» y «Festivos operativos» por edificación (encendidos por defecto = cálculo legado bit a bit; solo restringen), horario efectivo con precedencia espacio > bloque > edificación y *fallback* por nivel completo, días de uso = intersección de días operativos con días con horario (un mes sin días de uso no recibe Xe) y aviso de recálculo de LBEn al cambiar los interruptores, contando ambos alcances de `LineaBaseEnergia` (cadena de cuatro PRs #132–#135; schema aditivo aplicado a Neon; fórmula GDE intacta). HU-07: Completada. |
| Paso opcional de cálculo de uso en importadores (23/10/2026) | PR #146 (sub-issue #145 de #137): componente reutilizable `CalculoUsoOpcional` que reutiliza `useCalculoMasivo` para ofrecer vista previa, ejecución por lotes con progreso y «Detener», y resumen al cierre de los importadores de Equipos y Variables. La edificación viene fijada por la importación y solo se escriben periodos sin resultado; el recálculo destructivo permanece en Edificaciones › Cálculo de uso. Se eliminó la rama muerta `activeId === 'calculo-uso'` en `DatosContent`, se actualizó `Catalogo.mdx` y se retiró el import sin uso `IconCalculo`. HU-04 y HU-05: Completadas. |
| Representación espacial — layouts 2D paramétricos (23/10/2026) | Nueva feature `espacial` en `src/features/espacial/`: controladores `getDatosEspaciales` y `actualizarBloque`, modelo de tipos y generador de layouts con tests, vistas `EspacialCanvas`, `EspacialDashboard`, nodos `ModelBlock`/`ParametricBlock`, inspector y leyenda interactiva. Schema Prisma extendido para entidades espaciales. HU-22: Completada. |
| Correcciones posteriores — modelo geométrico espacial (28/10/2026) | Issue #150: cada espacio puede tener piso/nivel, dimensiones en metros y área calculada; bloques guardan dimensiones y área de huella separada del área útil. Gestión avanzada y Módulo Espacial consumen estos datos, con fallback paramétrico para registros antiguos; la vista espacial puede filtrar y agrupar por piso, y el importador de equipos distingue nombres repetidos por nivel. `db push` confirmó que el esquema ya estaba sincronizado con Neon. HU-22 conserva estado y puntos. |
| Correcciones posteriores — primera iteración de Planos CAD (28/10/2026) | Issue #151: tercera pestaña espacial con análisis DXF local para rectángulos soportados, referencia visual PDF/WebP y rechazo informativo de DWG directo. La confirmación autorizada y auditada actualiza únicamente piso, largo, ancho y área calculada de espacios existentes; no conserva el archivo ni polígonos. |
| Correcciones posteriores — selección visual CAD (29/10/2026) | Issue #151: selección y resaltado sincronizados entre plano y lista, asociación desde el visor, capa de importación dedicada `SIGE_ESPACIOS_*` y cálculo de área de polígono. El DXF original no aporta recintos identificables; sus polígonos cerrados de capas constructivas quedan excluidos. Pendiente probar tres perímetros de habitación dibujados y etiquetados en CAD; no se crean espacios nuevos ni se persiste geometría. |
| Corrección de horizonte de horas semanales (23/10/2026) | Commit `6af96f1` (ref #137): la visualización de «Horas de uso (Xe)» en `HorariosEquipos` y `CalendarioFestivos` ahora deriva del nivel ganador (equipo → espacio → bloque → edificación) filtrando por vigencia semanal, en lugar de la unión de todos los niveles. Coherente con el motor `calcularPeriodo` (`calculoUso.ts:406`). Tests unitarios y storybook actualizados. HU-07: Completada. |
| Proyección ARIMA — HU-09 (27/10/2026) | Entrega posterior al Sprint 2 (issue #147): proyección de 1–3 meses sobre facturas normalizadas, depuración §7.5.1 e imputación de descartes con la media mensual de valor absoluto; 36 meses depurados son recomendados para confiabilidad, con advertencia pero sin bloquear el cálculo si se logra ajustar ARIMA/SARIMA; intervalos al 95 %, comparación con LBEn de bloque con respaldo de edificación, diagnósticos restringidos por permiso y sin persistencia. La entrega no altera la velocidad original del Sprint 2. |
| Correcciones posteriores — estimaciones ARIMA (27/10/2026) | HU-09: el umbral de 36 meses pasó a recomendación y ya no bloquea la estimación; el motor advierte cuántos meses depurados hay y continúa cuando puede ajustar el modelo. Si no hay media de valor absoluto para un mes futuro sin historial, la comparación mensual queda vacía. Se actualizaron contratos, vista y pruebas; no se cambia la regla de LBEn ni se persisten resultados. |
| Correcciones posteriores — reportes y granularidad (02/11/2026) | Issues #21 y #23: agregación mensual/semestral/anual efectiva; datos de generalidades y métricas tomados de registros reales; ausencia de estimaciones no calculadas y de certificación regulatoria explícita. HU-11 (Excel) no se cierra. |
| Aprobado por asesor — fecha                                  | ☐ Sí    Fecha:                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

*Nota. Elaboración propia (2026).*

## 8.2.3. *Evidencias del Sprint 2*

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Incluir las capturas de pantalla o fragmentos de código más representativos del sprint. Cada evidencia debe tener número de figura, título descriptivo y nota de fuente.*<br>No incluir capturas de "Hello World" ni pantallas sin contexto. Cada evidencia debe vincularse a una HU específica. |

Las evidencias del Sprint 2 corresponden a las HU-17, HU-16, HU-20, HU-04 y HU-07. Al igual que en el Sprint 1, cada flujo está respaldado por una historia de Storybook ejecutable con Vitest en navegador.

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Figura N. \[Descripción concreta]. Nota. Elaboración propia (año). — Insertar aquí* |

![](figuras/out/fig16.png)

<a id="_fig16"></a>*fig 16. Líneas Base — selección de los cuatro modelos UPME y resultado del cálculo con persistencia habilitada. Nota. Elaboración propia (2026).*

![](figuras/out/fig17.png)

<a id="_fig17"></a>*fig 17. Gráfica de línea base interactiva — banda de confianza, meses descartados en ámbar, residuos y leyenda conmutable. Nota. Elaboración propia (2026).*

![](figuras/out/fig18.png)

<a id="_fig18"></a>*fig 18. Tablas de transparencia — preparación de datos (crudo → normalizado a 30 días → decisión de banda: ±10 % por defecto o rescate IC ec. 4-5) y jerarquía factura → bloque → espacio. Nota. Elaboración propia (2026).*

![](figuras/out/fig19.png)

<a id="_fig19"></a>*fig 19. Drawer «Asignar permiso» — permiso temporal con duración y advertencia para la excepción permanente fuera de la matriz. Nota. Elaboración propia (2026).*

![](figuras/out/fig20.png)

<a id="_fig20"></a>*fig 20. Sección Resumen — tarjetas de indicadores navegables y guía animada «Cómo funciona». Nota. Elaboración propia (2026).*

# 9. ARQUITECTURA IMPLEMENTADA

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Esta sección documenta el sistema como fue construido el software, no como fue diseñado originalmente.*<br>Si la arquitectura cambió durante los sprints, documentar la versión final con una nota que indique qué cambió y por qué.<br>Los tres artefactos son obligatorios. El modelo de datos se adapta al tipo de almacenamiento real del sistema. |
| **👁 ASESOR — verificar:**  *Verificar que los tres artefactos (arquitectura, clases/componentes, datos) son coherentes entre sí y con el código del repositorio.* |

## 9.1. Diagrama de arquitectura

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Presentar un diagrama de arquitectura (capas, componentes, microservicios u otra vista relevante) con descripción de cada componente y sus relaciones. Justificar las decisiones arquitectónicas principales.*<br>Para sistemas web: frontend / backend / base de datos / servicios externos.<br>Para otros paradigmas: adaptar la vista a la arquitectura real (microservicios, event-driven, etc.). |

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Figura N. Diagrama de arquitectura del sistema. Nota. Elaboración propia (año). — Insertar aquí* |

![](figuras/out/fig21.png)

<a id="_fig21"></a>*fig 21. Diagrama de arquitectura del sistema (capas MVC y flujo de una petición). Nota. Elaboración propia (2026).*

El sistema se construyó como un monolito con arquitectura MVC sobre Next.js 14 (App Router), sin cambio de arquitectura respecto del diseño: la vista son componentes de React, el controlador vive en la lógica de servidor (guards de servidor, Server Actions y Route Handlers) y el modelo concentra el acceso a datos con Prisma, coherente con el paradigma del framework (ADR-04). Los componentes y sus relaciones son:

1. **Capa de presentación (vista).** Componentes de React con Tailwind CSS 4: el shell del panel (`DashboardShell`, `DashboardHeader` arrastrable y `ModuleNav` con tres variantes de navegación) y, dentro de `/dashboard/datos`, el orquestador `DatosContent`, que combina las seis secciones con los tres modos (Carga, Visualización, Gestión) y bloquea los modos de carga cuando el rol solo tiene acceso de lectura. Los asistentes de importación son componentes cliente de cuatro pasos; las visualizaciones son componentes de servidor que consumen los *view models* construidos con los datos de la base.
2. **Capa de lógica de servidor (controlador).** Tres mecanismos con responsabilidades distintas: (a) el layout de `/dashboard` valida la sesión con `jose` y redirige al login si no hay cookie vigente, y deriva a `/twofa/setup` a los usuarios cuyo rol exige 2FA aún sin enrolar; además, cada página aplica el guard de módulo `requireModuleAccess()`; (b) los Route Handlers de `src/app/api` atienden autenticación, administración de usuarios y excepciones de permisos, siempre tras los guards `requireAdmin()`/`requireModuleAccess()` de `src/shared/models/authz.ts`, que releen el rol desde la base de datos; (c) las Server Actions de `src/features/datos/controllers` encapsulan las mutaciones de datos de energía (importar, editar, eliminar, vaciar, calcular líneas base) con validación Zod en el servidor.
3. **Capa de datos (modelo).** Un único cliente Prisma (`src/shared/models/prisma.ts`) contra PostgreSQL; el esquema vive en `prisma/schema.prisma` y las operaciones de catálogo y auditoría se centralizan en `src/features/datos/controllers/edificaciones.ts` y `src/shared/models/audit.ts`.
4. **Servicio de análisis externo.** `src/features/datos/controllers/lineasBase.ts` invoca el paquete `python/lben` (`python -m lben.cli`) mediante `spawn` con la serie en JSON por stdin, devuelve el resultado por stdout dentro de un tiempo límite y delega en `calculo.py` el cálculo estadístico (ADR-08).

El flujo típico de una petición es: navegador → layout de servidor (sesión) → página de servidor (guard de módulo) → Server Action o Route Handler (validación Zod + permisos) → Prisma → PostgreSQL; cuando la operación es un cálculo de línea base, la Server Action se intercala con el proceso Python antes de persistir el resultado.

## 9.2. Diagrama de clases o estructura de componentes

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Para sistemas OOP: diagrama de clases con atributos y métodos principales. Para o*tros *paradigmas (funcional, microservicios, componentes React, módulos GDScript, etc.): diagrama de componentes o módulos equivalente.*<br>*El diagrama debe reflejar el código entregado, no un diseño ideal.* |

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Figura N. Diagrama de clases / componentes. Nota. Elaboración propia (año). — Insertar aquí* |

![](figuras/out/fig22.png)

<a id="_fig22"></a>*fig 22. Diagrama de componentes del sistema. Nota. Elaboración propia (2026).*

![](figuras/out/fig23.png)

<a id="_fig23"></a>*fig 23. Diagrama de clases del sistema. Nota. Elaboración propia (2026).*

La estructura de código entregada (reflejo del diagrama) se organiza así:

- `src/app/` — rutas del App Router: `login/` (pública), `dashboard/` (shell protegido con `layout.tsx`, que resuelve el usuario y los módulos efectivos) y sus secciones `users/`, `datos/`, `analisis/`, `alertas/`, `estimaciones/`, `reportes/` y `espacial/`, más `api/` con los Route Handlers de autenticación y administración de usuarios.
- `src/features/datos/` — módulo de datos (archivos en `views/`): `DatosContent.tsx` (orquestador secciones × modos), `nav.tsx`, `ImportadorFacturas|Equipos|Variables.tsx` (asistentes de 4 pasos), `GestionFacturas|Equipos|Variables|Ajustes.tsx` (CRUD y vaciado), `VistaDatos.tsx`, `existencias.ts` (*view models*), `LineasBase.tsx` y sus composiciones `LineaBaseChart.tsx` (gráfica SVG interactiva), `LineasBaseTablas.tsx` (tablas de transparencia) y `LineasBasePreguntas.tsx` (preguntas frecuentes con referencias al código).
- `src/shared/views/` — componentes transversales: `DashboardShell.tsx`, `DashboardHeader.tsx`, `ModuleNav.tsx`, `ModulePlaceholder.tsx`, `EnergyLoader.tsx` y el subárbol `ui/`; `src/features/users/views/` — `LoginForm.tsx`, `UserManagement.tsx`, `UserDrawer.tsx`, `UserTable.tsx`, `PermissionMatrixModal.tsx`, `PermissionGrantDrawer.tsx` (drawer «Asignar permiso»), `detail/RolesPermissionsTab.tsx` y demás pestañas de la ficha de usuario.
- `src/features/datos/controllers/` — Server Actions ('use server'): `facturas.ts`, `equipos.ts`, `variables.ts`, `edificaciones.ts`, `lineasBase.ts` y `ajustes.ts`.
- `src/shared/models/` — núcleo de dominio y seguridad: `permissions.ts` (matriz rol × módulo), `authz.ts` (guards y excepciones), `auth.ts` (JWT/bcrypt/sesiones), `audit.ts` (bitácora) y `prisma.ts` (cliente único); `src/features/*/models/` — `lineasBase.ts` (modelos, constantes UPME y tipos) y `validations.ts` (esquemas Zod por dominio).
- `prisma/` — `schema.prisma`, `seed.ts` y scripts de migración/datos.
- `src/features/datos/views/__stories__/` y `src/features/datos/views/__mocks__/` — historias de Storybook y dobles deterministas de las Server Actions usados por la estrategia de pruebas (ADR-10); `src/shared/views/` aporta las historias de `ModuleNav` y `SidebarNav`.

Las relaciones principales de composición son: `DatosContent` → secciones (a su vez → pestañas Carga/Visualización/Gestión); los tres importadores comparten el patrón de asistente de 4 pasos y los esquemas Zod de `src/features/datos/models/validations.ts`; `LineasBase` compone la gráfica, las tablas y el panel de preguntas, y consume `calcularModelosLineaBase`/`guardarLineaBase` de `src/features/datos/controllers/lineasBase.ts`; los módulos de usuarios dependen de `src/shared/models/permissions.ts` y `authz.ts` como única fuente de verdad del control de acceso.

## 9.3. Modelo de datos

|                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **✎ INSTRUCCIÓN:**  *BD relacional: diagrama modelo relacional (tablas con atributos y relaciones).*<br>Para BD NoSQL / documentos / grafos: esquema de colecciones, documentos clave y sus relaciones.<br>Sin BD tradicional (archivos JSON, localStorage, etc.): esquema de la estructura de datos con descripción.<br>Este artefacto es obligatorio independientemente del tipo de almacenamiento. |

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Figura N. Modelo de datos / esquema de almacenamiento. Nota. Elaboración propia (año). — Insertar aquí* |

![](figuras/out/fig24.png)

<a id="_fig24"></a>*fig 24. Modelo de datos relacional (esquema Prisma sobre PostgreSQL). Nota. Elaboración propia (2026).*

El almacenamiento es una base de datos PostgreSQL con doce tablas, definidas en `prisma/schema.prisma`:

| **Tabla**                   | **Atributos clave**                                                                                                                                                                                      | **Relaciones y restricciones**                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `users`                     | email (único), passwordHash, role (enum: ADMIN_TI, GESTOR_ENERGETICO, COORD_INFRAESTRUCTURA, DIRECTIVO, COMUNIDAD_UNIVERSITARIA), status (ACTIVE/INACTIVE/PENDING), phone, lastLoginAt, twoFactorEnabled | Relación 1‑N con `sessions` y `user_permission_overrides`                                    |
| `sessions`                  | token (único), expiresAt                                                                                                                                                                                 | N‑1 hacia `users`; se elimina al cerrar sesión                                               |
| `user_permission_overrides` | moduleId, action, expiresAt (nulo = permanente), grantedBy, grantedByEmail                                                                                                                               | Única por (userId, moduleId, action); índices por userId y expiración                        |
| `audit_logs`                | actorId/actorEmail, action, targetId/targetEmail, detail, createdAt                                                                                                                                      | Índices por targetId y createdAt                                                             |
| `edificaciones`             | nombre, tipo (código de catálogo)                                                                                                                                                                        | Relación 1‑N con `bloques`                                                                   |
| `bloques`                   | codigo (único), nombre, areaUtil, factorInfraestructura                                                                                                                                                  | N‑1 hacia `edificaciones`; contenedor de espacios, equipos, variables, líneas base y ajustes |
| `espacios`                  | nombre                                                                                                                                                                                                   | Única por (bloqueId, nombre)                                                                 |
| `equipos_electricos`        | tipo, cantidad, potenciaNominal, horasUsoDia, diasUsoMes, usenIndicador                                                                                                                                  | Única por (bloqueId, espacioId, tipo)                                                        |
| `facturas_energia`          | periodo + edificacionId (único), diasFacturados, consumoKwh, consumoNormalizado, costoCop                                                                                                                | Registro por edificación (no por bloque); clave única por periodo + edificación              |
| `variables_operativas`      | mes, ano, poblacionFija, poblacionFlotante, diasLectivosLaborales, gradesDiaEnfriamiento                                                                                                                 | Única por (bloqueId, mes, ano)                                                               |
| `lineas_base_energia`       | tipo (enum: VALOR_ABSOLUTO, COCIENTE, REGRESSION_ESTADISTICA, CONFORT_THERMAL), coeficientes (JSON), r2, pValue, rangosConfianza                                                                         | Única por (bloqueId, tipo); se actualiza por sobrescritura                                   |
| `ajustes_energeticos`       | tipo, descripcion, periodoInicio/Fin, valorAjuste, observaciones                                                                                                                                         | N‑1 hacia `bloques`                                                                          |

Los coeficientes de las líneas base se almacenan como JSON porque cada modelo tiene parámetros distintos; los indicadores estadísticos (R², valor p, rangos de confianza) quedan en columnas propias para poder validarlos contra los umbrales de la Resolución UPME 0016 de 2024. El seed (`prisma/seed.ts`) y el script `scripts/llenar-historico.mjs` poblan el catálogo y una serie histórica determinista para desarrollo y pruebas.

# 10. CALIDAD Y PRUEBAS

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Esta sección consolida el plan de pruebas.*<br>Las pruebas funcionales se vinculan directamente a las HU del backlog.<br>Las pruebas de usabilidad tienen participantes reales del perfil de usuario objetivo y resultados cuantificables. |

## 10.1. Pruebas funcionales

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Documentar los casos de prueba ejecutados. Cada caso DEBE tener: ID, HU asociada, precondición, pasos numerados, resultado esperado, resultado obtenido y estado (✓ aprobado / ✗ fallido). Sin este formato, el plan de pruebas no es verificable.* |
| **👁 ASESOR — verificar:**  *Verificar que los casos de prueba cubren las HU completadas del backlog y que los resultados son consistentes con las capturas de pantalla del producto.* |

**Tabla 24**

*Pruebas funcionales*

| **ID** | **HU** | **Precondición** | **Pasos de prueba** | **Resultado esperado** | **Resultado obtenido** | **Estado** |
| --- | --- | --- | --- | --- | --- | --- |
| TC-001 | HU-02, HU-03 | Asistente de Facturas con archivo válido en el paso 2 | 1. Detectar encabezados. 2. Avanzar al paso 3. 3. Revisar el resumen. | Mensaje «Listo para importar» y botón «Importar N filas» habilitado. | Como se esperaba (historia *ImportadorFacturas · Paso 3*). | ✓ |
| TC-002 | HU-03 | Archivo de Variables con un mes fuera de rango | 1. Cargar el archivo. 2. Avanzar al paso 3. 3. Revisar las filas marcadas. | La fila inválida aparece con el motivo «Mes inválido en la fila» y no se importa. | Como se esperaba (historia *ImportadorVariables · Paso 3*). | ✓ |
| TC-003 | HU-01, HU-03 | Asistente de Equipos en el paso 1 | 1. Seleccionar edificación, bloque y espacio. 2. Mapear columnas. 3. Vista previa. 4. Importar. | Pantalla «Importación finalizada» con el resumen de filas. | Como se esperaba (historia *ImportadorEquipos · Flujo completo*). | ✓ |
| TC-004 | HU-21 | Bloque A-102 con equipos y variables registrados | 1. Intentar eliminar el bloque. 2. Confirmar en el diálogo. | El sistema impide el borrado y el bloque sigue en el catálogo. | Como se esperaba (historias *ImportadorEquipos* e *ImportadorVariables · Catálogo*). | ✓ |
| TC-005 | HU-21 | Edificación sin bloques con datos | 1. Eliminar la edificación. 2. Confirmar. | La edificación desaparece del catálogo disponible. | Como se esperaba (historia *Catálogo · eliminar una edificación vacía*). | ✓ |
| TC-006 | HU-03, HU-16 | Rol con acceso de solo lectura al módulo de consumo | 1. Abrir el asistente de importación. | El asistente muestra el aviso «solo lectura» y los modos de carga están deshabilitados. | Como se esperaba (historias *Rol sin permiso de carga* de Facturas y Variables). | ✓ |
| TC-007 | HU-19 | Factura 2024-12 en la pestaña Gestión | 1. Editar el consumo en línea. 2. Guardar. | Aviso de éxito, valor «19.500,00» visible y el editor se cierra. | Como se esperaba (historia *GestionFacturas · Editar en línea*). | ✓ |
| TC-008 | HU-19 | Facturas y líneas base guardadas | 1. Pulsar «Vaciar base de datos». 2. Revisar el diálogo. 3. Confirmar. | El diálogo advierte que también se eliminan las líneas base; al terminar todo muestra estado vacío y el botón queda deshabilitado. | Como se esperaba (historia *GestionFacturas · Vaciar la base elimina facturas y líneas base*). | ✓ |
| TC-009 | HU-19 | Tres líneas base guardadas y facturas existentes | 1. Eliminar la línea base «Valor Absoluto». 2. Vaciar solo líneas base. | La línea base desaparece (queda «3 líneas base» → 2) y las facturas conservan su botón de edición. | Como se esperaba (historias *Eliminar una línea base sin tocar las facturas* y *Vaciar solo las líneas base*). | ✓ |
| TC-010 | HU-17 | Bloque con más de 36 meses de historia depurada y modelo «Valor Absoluto» seleccionado | 1. Ejecutar el cálculo. 2. Revisar métricas y puertas UPME. 3. Guardar el modelo. | Línea base «21.527,4 kWh/mes», puertas UPME en verde, gráfica y tablas pobladas y guardado habilitado. | Como se esperaba (historia *LineasBase · Cálculo real*). | ✓ |
| TC-011 | HU-17 | Gráfica de línea base con resultados | 1. Enfocar la gráfica con el teclado. 2. Recorrer con ←/→. 3. Alternar la leyenda. | El `role="slider"` actualiza el `aria-valuetext` con el mes y el valor; la leyenda oculta y revela la serie (botón `aria-pressed`). | Como se esperaba (historia *Gráfica interactiva · tooltip, teclado y leyenda*). | ✓ |
| TC-012 | HU-17 | Bloque sin inventario de equipos | 1. Ejecutar el cálculo. | Mensaje de error «bloque sin inventario de equipos» sin persistir resultados. | Como se esperaba (historia *Error · bloque sin inventario de equipos*). | ✓ |
| TC-013 | HU-17 | Sección Líneas Base con cálculo exitoso | 1. Abrir las tablas de preparación y jerarquía. | Columnas «Factura cruda», «Normalizado 30 d» y «Asignado al alcance», más el desglose factura → bloque → espacio. | Como se esperaba (historia *Tablas de preparación y jerarquía*). | ✓ |
| TC-014 | HU-20 | Sección Resumen con facturas registradas | 1. Pulsar la tarjeta «Facturas EPM». | Navega a la pestaña Visualización (visible «Último periodo»). | Como se esperaba (historia *DatosContent · Navegación interna desde las tarjetas*). | ✓ |
| TC-015 | HU-04 | Visualización de Facturas con datos importados | 1. Buscar «2024-03». 2. Limpiar la búsqueda. 3. Escribir un texto sin coincidencias. | «2024-03» visible, «2024-01» filtrado y estado «Sin coincidencias». | Como se esperaba (historias *VistaDatos · facturas*). | ✓ |

*Nota. Elaboración propia (2026).*

Las 95 pruebas de las 18 historias de Storybook se ejecutaron con Vitest en navegador (Chromium/Playwright) y quedaron en verde; a ellas se suman 17 pruebas unitarias de la lógica 2FA (TOTP y política de roles) en el proyecto de Node. **Cobertura pendiente:** el flujo completo de autenticación (HU-15) no tiene caso automatizado pese a las pruebas unitarias del 2FA, y la asignación de permisos (HU-16) no tiene casos propios —ambos se validaron funcionalmente durante los sprints y quedan como deuda registrada en el ADR-10—; los módulos en construcción (HU-08 a HU-12, HU-22) no tienen casos hasta que se implementen.

## 10.2. Pruebas de usabilidad

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Describir: método (observación, cuestionario SUS, think-aloud, etc.), perfil y número de participantes, instrumento aplicado.*<br>Los resultados deben ser métricas concretas (porcentaje de tareas completadas, tiempo promedio, puntuación SUS).<br>Fotos de usuarios sin resultados NO son pruebas de usabilidad. |
| **👁 ASESOR — verificar:**  *Verificar que las pruebas de usabilidad tienen participantes reales del público objetivo, resultados numéricos o cualitativos documentados y análisis interpretativo.* |

\[Descripción del método, participantes e instrumento aplicado]

**Tabla N**

*Pruebas de usabilidad*

| **Aspecto evaluado** | **Criterio de éxito** | **Resultado Obtenido (n participantes)** | **¿Cumple?** |
| --- | --- | --- | --- |
| Comprensión de la interfaz |  |  | ☐ Sí  ☐ No |
| Eficiencia en tarea principal |  |  | ☐ Sí  ☐ No |
| Satisfacción general (escala 1–5) | ≥ 3.5 promedio |  | ☐ Sí  ☐ No |

*Nota. Elaboración propia (año).*

\[Análisis e interpretación de resultados. Qué se mejoró en el sistema a partir de los hallazgos de usabilidad.]

# 11. DESPLIEGUE DEL SISTEMA

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Esta sección documenta cómo se entrega el sistema para que otro ingeniero pueda instalarlo y ejecutarlo sin asistencia.*<br>El estándar: si un profesional técnico que no conoce el proyecto puede instalarlo siguiendo solo este documento, el despliegue está bien documentado. |

## 11.1. Diagrama de despliegue

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Mostrar nodos de infraestructura (servidores, contenedores, dispositivos) y cómo se distribuyen los componentes.*<br>Para sistemas en la nube: incluir los servicios cloud utilizados (AWS, GCP, Firebase, etc.). |

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Figura N. Diagrama de despliegue. Nota. Elaboración propia (año). — Insertar aquí* |

![](figuras/out/fig25.png)

<a id="_fig25"></a>*fig 25. Diagrama de despliegue del sistema. Nota. Elaboración propia (2026).*

## 11.2. Requisitos de instalación y ejecución

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Listar con versiones específicas todos los requisitos de hardware y software para ejecutar el sistema. Esta información debe coincidir con el manual de instalación.* |

**Tabla 25**

*Requisitos de instalación*

| **Componente** | **Requisito mínimo** | **Versión recomendada** | **Notas** |
| --- | --- | --- | --- |
| Sistema operativo | Windows 10/11, Linux o macOS | Windows 11 o Ubuntu 22.04 | Sin requisitos de hardware especiales; 4 GB de RAM recomendados |
| Lenguaje / Runtime | Node.js 18.17+ y npm 9+ | Node.js 20 LTS | Next.js 14.2 fija este mínimo; se usa `npm run dev` / `npm run build && npm run start` |
| Base de datos | PostgreSQL 14+ | PostgreSQL 16 | Variable de entorno `DATABASE_URL`; se carga el esquema con `npx prisma db push` |
| Motor de análisis | Python 3.10+ con pandas ≥ 1.5, numpy ≥ 1.24, scipy ≥ 1.10 y statsmodels ≥ 0.14 | Python 3.12 | En desarrollo local se invoca como CLI y es requerido solo para el cálculo de líneas base (sin él, el sistema funciona pero ese cálculo falla con un mensaje que indica cómo instalarlo, ADR-08); en producción corre como servicio FastAPI independiente enlazado por `LBEN_URL` |
| Variables de entorno | `DATABASE_URL`, `JWT_SECRET` | `JWT_EXPIRES_IN` (opcional, por defecto `7d`), `TOTP_ENCRYPTION_KEY` (2FA), `LBEN_URL` y `LBEN_SECRET` (motor en producción) | `JWT_SECRET` con mínimo 32 caracteres y `TOTP_ENCRYPTION_KEY` con 32 bytes en base64: ambos obligatorios en producción. `LBEN_URL`/`LBEN_SECRET` solo en el despliegue serverless (binding del servicio engine) |
| Navegador (cliente) | Navegadores con soporte de ES2020 | Chrome/Edge recientes | La gráfica de línea base usa SVG y API de teclado/ARIA |

*Nota. Elaboración propia (2026).*

## 11.3. Manual de usuario

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Incluir aquí o como Anexo A (referenciando correctamente). Debe cubrir las funcionalidades principales con capturas de pantalla numeradas. No se aceptan enlaces a Google Drive u otras plataformas externas como único medio de entrega.* |

\[Contenido del manual de usuario o referencia al Anexo A]

## 11.4. Manual de instalación

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Instrucciones paso a paso para instalar y configurar el sistema desde cero. Incluir comandos exactos, variables de entorno necesarias y proceso de carga inicial de datos si aplica.* |

\[Contenido del manual de instalación o referencia al Anexo B]

## 11.5. Resumen técnico del software

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Completar con información específica del sistema entregado. No copiar el texto de las instrucciones de la columna "Característica". Cada celda debe describir el sistema real.* |
| **👁 ASESOR — verificar:**  *Verificar que el resumen técnico describe el sistema REAL implementado. Características como "escalabilidad" o "seguridad" deben respaldarse con decisiones técnicas documentadas en la sección 8 (ADR).* |

**Tabla 26**

*Resumen técnico del software*

|  |  |
| --- | --- |
| **RESUMEN TÉCNICO DEL SOFTWARE** |  |
| **ARQUITECTURA** | Monolito MVC sobre Next.js 14 (App Router): vista en React 18 con Tailwind CSS 4; controlador en guards de sesión del layout y de las páginas de servidor, en Route Handlers y en Server Actions, con permisos que releen el rol desde la base de datos; modelo con Prisma 5 sobre PostgreSQL; y motor de análisis en Python (CLI local y servicio FastAPI en producción) invocado como proceso que intercambia JSON (ADR-04, ADR-05, ADR-08). |
| **ESCALABILIDAD** | Las capas están separadas y cada Server Action se organiza por dominio, de modo que se pueden añadir secciones y módulos sin tocar la seguridad. La matriz de permisos se evalúa en memoria (sin consulta por petición), y los datos usan índices y claves únicas que soportan el volumen histórico de facturación sin esquema particionado. El monolito escala verticalmente; si crece el volumen de usuarios o cálculos, el acoplamiento por CLI del motor estadístico permite separarlo como servicio independiente sin reescribir la aplicación (ADR-04, ADR-08). |
| **SEGURIDAD** | Autenticación con JWT en cookie `httpOnly`/`sameSite=lax` (`secure` en producción) y contraseñas con bcrypt (costo 12); el rol se relee de la base de datos en cada petición y nunca se confía en el token (ADR-06). Autorización en tres anillos: guard de sesión en el layout de servidor, guards por página y por Route Handler (403 en caso contrario) y matriz de 5 roles × 6 módulos con excepciones temporales/permanentes auditadas; el módulo de usuarios no admite excepciones (ADR-07). Entradas validadas con Zod en cliente y servidor; registro público forzado al rol de comunidad universitaria. Verificación en dos factores (2FA TOTP) implementada con enrolamiento obligatorio para ADMIN_TI y GESTOR_ENERGETICO y opcional para el resto, códigos de respaldo y límite de intentos persistido en base de datos; queda pendiente la rotación de refrescos de token. |
| **USABILIDAD** | Navegación por secciones con modos Carga/Visualización/Gestión que se deshabilitan para perfiles de solo lectura; asistentes de 4 pasos con vista previa editable y estados vacíos con guía; tema claro/oscuro persistido y aplicado antes del pintado; encabezado reubicable; foco visible y gráfica navegable por teclado con anuncios `aria-live`. Los resultados de las pruebas de usabilidad con usuarios reales están pendientes (sección 10.2): aún no se han ejecutado, por lo que no se han incorporado mejoras derivadas de ellas. |
| **MANTENIBILIDAD** | TypeScript estricto, esquemas Zod compartidos entre cliente y servidor, Server Actions centralizadas por dominio y una única fuente de verdad para permisos (`src/shared/models/permissions.ts`). La documentación viva y la regresión funcional se apoyan en 18 historias de Storybook (95 pruebas en verde con Vitest en navegador) y en dobles deterministas de las Server Actions (ADR-10); no hay cobertura de código configurada ni pruebas unitarias aisladas del núcleo de dominio. |
| **DOCUMENTACIÓN** | Incluye: descripción del negocio con BPMN AS-IS (sección 2.2), actores (2.3), registro de decisiones técnicas ADR-01 a ADR-10 (sección 4), plan de sprints (6.3), backlog de 22 HU (7.2), arquitectura y modelo de datos (sección 9), plan de pruebas con 15 casos (10.1) y requisitos de instalación (11.2). Manuales de usuario e instalación pendientes (11.3 y 11.4). Repositorio: github.com/AFMG99/SIGE con flujo git-flow, integración continua y plantillas de issue/PR; despliegue en producción: Vercel con dos servicios (aplicación Next.js y motor Python) enlazados por binding (sección 11). |

*Nota. Elaboración propia (2026).*

# 12. CIERRE DEL PROYECTO

|  |
| --- |
| **✎ INSTRUCCIÓN:**  En un informe técnico el cierre es conciso y técnico: vincula los resultados con los objetivos, reflexiona sobre el proceso y propone el trabajo futuro. No repetir lo descrito en secciones anteriores. |

## 12.1. Resultados por objetivo

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Tabla de correspondencia objetivo → resultado. Cada objetivo específico debe tener un resultado medible y una evidencia concreta del informe.* |
| **👁 ASESOR — verificar:**  *Verificar que cada objetivo tiene un resultado verificable con evidencia en el documento. Si un objetivo no tiene resultado, debe discutirse por qué no se alcanzó.* |

**Tabla N**

*Trazabilidad de cumplimiento de objetivos*

| **Objetivo específico** | **Resultado obtenido** | **Evidencia (sección / figura)** | **¿Cumplido?** |
| --- | --- | --- | --- |
| OE1: … |  |  | ☐ Sí  ☐ Parcial  ☐ No |
| OE2: … |  |  | ☐ Sí  ☐ Parcial  ☐ No |
| OE3: … |  |  | ☐ Sí  ☐ Parcial  ☐ No |

*Nota. Elaboración propia (año).*

## 12.2. Retrospectiva del proceso

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *3–4 párrafos de reflexión técnica sobre el proceso de desarrollo: qué funcionó bien, qué no funcionó, qué haría diferente el equipo.*<br>No es una autoevaluación personal. Es una reflexión de ingeniería sobre las decisiones del proyecto.<br>Esta sección demuestra madurez técnica del equipo. |

\[Retrospectiva técnica del proceso de desarrollo]

## 12.3. Conclusiones

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Una conclusión verificable por cada objetivo específico. Cada conclusión cita evidencia del informe.*<br>Evitar conclusiones genéricas ("el sistema es eficiente"). Escribir conclusiones que puedan sostenerse con datos: "el sistema redujo el tiempo de \[proceso] de X a Y según las pruebas de usabilidad". |

• \[Conclusión OE1 — referencia a sección o figura]

• \[Conclusión OE2 — referencia a sección o figura]

• \[Conclusión OE3 — referencia a sección o figura]

• \[Conclusión sobre el objetivo general]

## 12.4. Trabajo futuro

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Mínimo 3 recomendaciones concretas para versiones o proyectos futuros: funcionalidades pendientes, mejoras técnicas identificadas, deuda técnica que quedó pendiente.*<br>Cada recomendación debe ser específica. No sirve "mejorar la interfaz" — sí sirve "implementar notificaciones push para las alertas de \[módulo] usando \[tecnología]". |

• \[Trabajo futuro 1 — específico y justificado]

• \[Trabajo futuro 2 — específico y justificado]

• \[Trabajo futuro 3 — deuda técnica pendiente]

# 13. REFERENCIAS

|  |
| --- |
| **✎ INSTRUCCIÓN:**  *Formato APA 7.ª edición. Orden alfabético estricto por apellido del primer autor.*<br>Sangría francesa de 1.27 cm. Incluir DOI o URL cuando esté disponible.<br>Solo referencias citadas en el texto. Cada referencia del texto debe aparecer aquí y viceversa.<br>Para documentación técnica oficial (React docs, ISO, RFC, etc.): citar como página web o informe técnico según corresponda. |

*\[Apellido, A. A., & Apellido, B. B. (Año). Título. Editorial/Revista. https://doi.org/xxxxx]*

# ANEXOS

|                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **⚠ IMPORTANTE:**  *Los anexos deben estar incluidos en el documento o adjuntarse como archivos independientes en la entrega. No se aceptan únicamente enlaces a Google Drive, OneDrive u otras plataformas externas, ya que no garantizan acceso permanente para el jurado.*<br>El repositorio GitHub sí es un enlace aceptable para el código fuente. |
|                                                                                                                                                                                                                                                                                                                                                         |

## Anexo A — Manual de usuario

\[Contenido del manual de usuario o nota referenciando el archivo adjunto]

## Anexo B — Manual de instalación

\[Contenido del manual de instalación o nota referenciando el archivo adjunto]

## Anexo C — \[Nombre del anexo adicional]

\[Contenido del anexo]

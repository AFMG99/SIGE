/**
 * Seed script for SIGE-TdeA Energy Loading Module
 * Datos ficticios para un bloque del TdeA (Universidad Tecnológica de Antioquia)
 * 
 * Este script crea datos de prueba para inicializar la base de datos PostgreSQL
 * con el esquema Prisma definido para el módulo de carga energética.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed de datos para SIGE-TdeA...\n");

  // Limpieza previa para permitir re-ejecuciones del seed
  await prisma.ajusteEnergetico.deleteMany();
  await prisma.lineaBaseEnergia.deleteMany();
  await prisma.variableOperativa.deleteMany();
  await prisma.facturaEnergia.deleteMany();
  await prisma.equipoElectrico.deleteMany();
  await prisma.espacio.deleteMany();
  await prisma.bloque.deleteMany();
  await prisma.edificacion.deleteMany();

  // 1. CREAR EDIFICACIÓN Y BLOQUE DEL TDEA
  // -------------------------------------
  // Edificación: Campus Educativo (tipo según catálogo CATALOGO_EDIFICACIONES)
  // Bloque representativo: "Bloque de Aulas Mayores" — Área útil: 1,200 m²
  // Factor de infraestructura: 0.85 (factor de dispersión térmica)

  const edificacion = await prisma.edificacion.create({
    data: {
      nombre: "Campus TdeA",
      tipo: "EDUCATIVO_CAMPUS",
    },
  });
  console.log(`✅ Edificación creada: ${edificacion.nombre} (${edificacion.tipo})\n`);

  const bloque = await prisma.bloque.create({
    data: {
      codigo: "BLOQUE-A-001",
      nombre: "Bloque de Aulas Mayores",
      areaUtil: 1200.0,
      factorInfraestructura: 0.85,
      edificacionId: edificacion.id,
    },
  });
  console.log(`✅ Bloque creado: ${bloque.codigo} - ${bloque.nombre} (${bloque.areaUtil} m²)\n`);

  // 2. CREAR ESPACIOS DEL BLOQUE
  // ---------------------------
  // Espacios físicos por los cuales se segmenta el inventario de equipos
  const espacios: Record<string, string> = {};
  const nombresEspacios = ["Aula Mayor", "Pasillo", "Oficina Administrativa", "Taller de Máquinas"];
  for (const nombre of nombresEspacios) {
    const espacio = await prisma.espacio.create({
      data: { bloqueId: bloque.id, nombre },
    });
    espacios[nombre] = espacio.id;
  }
  console.log(`✅ Espacios creados: ${nombresEspacios.join(", ")}\n`);

  // 3. CREAR EQUIPOS ELÉCTRICOS
  // --------------------------
  // Inventario por tipo de equipo con parámetros realistas
  
  // Equipo HVAC (Sistemas de climatización)
  const equipoHvac = await prisma.equipoElectrico.create({
    data: {
      bloqueId: bloque.id,
      espacioId: espacios["Aula Mayor"],
      tipo: "HVAC",
      cantidad: 3,
      potenciaNominal: 45.5,
      horasUsoDia: 12,
      diasUsoMes: 22,
      usenIndicador: "ACTIVO",
    },
  });
  console.log(`✅ Equipo HVAC creado: ${equipoHvac.cantidad} unidades, ${equipoHvac.potenciaNominal} kW\n`);

  // Equipo Iluminación
  const equipoIluminacion = await prisma.equipoElectrico.create({
    data: {
      bloqueId: bloque.id,
      espacioId: espacios["Pasillo"],
      tipo: "ILUMINACION",
      cantidad: 150,
      potenciaNominal: 18.2,
      horasUsoDia: 10,
      diasUsoMes: 22,
      usenIndicador: "ACTIVO",
    },
  });
  console.log(`✅ Equipo Iluminación creado: ${equipoIluminacion.cantidad} puntos, ${equipoIluminacion.potenciaNominal} kW\n`);

  // Equipo Ofimática
  const equipoOfimatica = await prisma.equipoElectrico.create({
    data: {
      bloqueId: bloque.id,
      espacioId: espacios["Oficina Administrativa"],
      tipo: "OFICINA",
      cantidad: 45,
      potenciaNominal: 12.8,
      horasUsoDia: 8,
      diasUsoMes: 22,
      usenIndicador: "ACTIVO",
    },
  });
  console.log(`✅ Equipo Ofimática creado: ${equipoOfimatica.cantidad} estaciones, ${equipoOfimatica.potenciaNominal} kW\n`);

  // Equipo Motores
  const equipoMotores = await prisma.equipoElectrico.create({
    data: {
      bloqueId: bloque.id,
      espacioId: espacios["Taller de Máquinas"],
      tipo: "MOTORES",
      cantidad: 2,
      potenciaNominal: 30.0,
      horasUsoDia: 6,
      diasUsoMes: 20,
      usenIndicador: "INACTIVO",
    },
  });
  console.log(`✅ Equipo Motores creado: ${equipoMotores.cantidad} unidades, ${equipoMotores.potenciaNominal} kW\n`);

  // 3. CREAR FACTURAS ENERGÉTICAS EPM
  // --------------------------------
  // Facturación histórica por meses recientes
  const fechas = ["2024-08", "2024-07", "2024-06", "2024-05"];
  
  for (const fecha of fechas) {
    const [ano, mes] = fecha.split("-").map(Number);
    
    // Calcular días del mes
    const diasMes = new Date(ano, mes, 0).getDate();
    const diasFacturados = Math.min(Math.floor(25 + Math.random() * 5), diasMes); // 25-30 días típicos

    // Consumo típico para un bloque universitario de 1200 m²
    // Promedio: 15-25 kWh/m² al mes = 18-30 MWh para el bloque
    const consumoKwh = (18000 + Math.random() * 7000).toFixed(2); // 18-25 MWh
    const consumoNormalizado = parseFloat(consumoKwh) * (30 / diasFacturados); // Normalización a 30 días
    const costoCop = (parseFloat(consumoKwh) * 950 + Math.random() * 50000).toFixed(2); // Costo aproximado COP/kWh
    
      await prisma.facturaEnergia.create({
        data: {
          periodo: fecha,
        diasFacturados: diasFacturados,
        consumoKwh: parseFloat(consumoKwh),
        consumoNormalizado: parseFloat(consumoNormalizado.toFixed(2)),
        costoCop: parseFloat(costoCop),
        edificacionId: edificacion.id,
      },
    });
    console.log(`✅ Factura EPM creada: ${fecha} - ${diasFacturados} días, ${consumoKwh} kWh, $${costoCop} COP`);
  }
  console.log("");

  // 4. CREAR VARIABLES OPERATIVAS MENSUALES
  // ---------------------------------------
  // Variables mensuales con poblaciones y GDE
  const meses = [
    { mes: 8, ano: 2024, docentes: 120, administrativos: 40, estudiantes: 800, visitantes: 150, dias: 22, gde: 185.5 },
    { mes: 7, ano: 2024, docentes: 120, administrativos: 40, estudiantes: 800, visitantes: 150, dias: 21, gde: 210.3 },
    { mes: 6, ano: 2024, docentes: 118, administrativos: 38, estudiantes: 780, visitantes: 130, dias: 20, gde: 150.2 },
    { mes: 5, ano: 2024, docentes: 115, administrativos: 35, estudiantes: 750, visitantes: 100, dias: 22, gde: 120.8 },
  ];

    for (const { mes, ano, docentes, administrativos, estudiantes, visitantes, dias, gde } of meses) {
      const poblacionFija = docentes + administrativos;
      const poblacionFlotante = estudiantes + visitantes;
      await prisma.variableOperativa.create({
        data: {
          bloqueId: bloque.id,
          mes: mes,
          ano: ano,
          poblacionFija,
          poblacionFlotante,
          diasLectivosLaborales: dias,
          gradesDiaEnfriamiento: gde,
        },
      });
      console.log(`✅ Variable operativa creada: ${mes}/${ano} - Población fija: ${poblacionFija}, flotante: ${poblacionFlotante}, GDE: ${gde}`);
    }
  console.log("");

  // 5. CREAR LÍNEA BASE ENERGÉTICA
  // -----------------------------
  // Modelo de línea base generado con coeficientes y métricas
  
  await prisma.lineaBaseEnergia.create({
    data: {
      bloqueId: bloque.id,
      tipo: "REGRESSION_ESTADISTICA",
      coeficientes: {
        intercepto: 1250.5,
        temperatura: 45.2,
        poblacion: 8.7,
        diaSemana: 12.3,
      },
      r2: 0.87,
      pValue: 0.001,
      rangosConfianza: 0.10, // ±10%
    },
  });
  console.log("✅ Línea Base Energética creada: REGRESSION_ESTADISTICA (R² = 0.87, p-value = 0.001)\n");

  // 6. CREAR AJUSTES ENERGÉTICOS
  // ---------------------------
  // Mixto de ajustes rutinarios y no rutinarios
  
  // Ajuste rutinario (variación estacional)
  await prisma.ajusteEnergetico.create({
    data: {
      bloqueId: bloque.id,
      tipo: "RUTINARIO",
      descripcion: "Variación estacional verano-otoño",
      periodoInicio: new Date("2024-06-01"),
      periodoFin: new Date("2024-09-30"),
      valorAjuste: 8.5, // 8.5% de ajuste por temporada
      observaciones: "Ajuste por cambio de temporada de operación de HVAC",
    },
  });
  console.log("✅ Ajuste Energético creado: RUTINARIO - Variación estacional (8.5%)\n");

  // Ajuste no rutinario (remodelación)
  await prisma.ajusteEnergetico.create({
    data: {
      bloqueId: bloque.id,
      tipo: "NO_RUTINARIO",
      descripcion: "Remodelación de laboratorio de ciencias",
      periodoInicio: new Date("2024-03-15"),
      periodoFin: new Date("2024-04-30"),
      valorAjuste: 15.0, // 15% de incremento por equipos adicionales
      observaciones: "Instalación de nuevo equipo de cómputo de alto rendimiento",
    },
  });
  console.log("✅ Ajuste Energético creado: NO_RUTINARIO - Remodelación laboratorio (15.0%)\n");

  // Ajuste no rutinario ( parada operativa )
  await prisma.ajusteEnergetico.create({
    data: {
      bloqueId: bloque.id,
      tipo: "NO_RUTINARIO",
      descripcion: "Parada operativa mantenimiento preventivo",
      periodoInicio: new Date("2024-12-01"),
      periodoFin: new Date("2024-12-15"),
      valorAjuste: 3.0, // 3% de reducción por operación en mantenimiento
      observaciones: "Mantenimiento de sistema de distribución eléctrica",
    },
  });
  console.log("✅ Ajuste Energético creado: NO_RUTINARIO - Mantenimiento preventivo (3.0%)\n");

  console.log("🌱 Seed completado exitosamente!");
  console.log("\nResumen de datos creados:");
  console.log(`  - 1 Edificación (EDUCATIVO_CAMPUS)`);
  console.log(`  - 1 Bloque TDEA bajo esa edificación`);
  console.log(`  - 4 Espacios del bloque`);
  console.log(`  - 4 Equipos eléctricos (1 por tipo)`);
  console.log(`  - 4 Facturas energéticas EPM (periodo agosto-julio 2024)`);
  console.log(`  - 4 Variables operativas mensuales`);
  console.log(`  - 1 Línea Base Energética (REGRESSION_ESTADISTICA)`);
  console.log(`  - 3 Ajustes energéticos (1 rutinario + 2 no rutinarios)`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Error durante el seed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
'use client'

import React from 'react'

/**
 * Preguntas y respuestas de Línea Base Energética (LBEn).
 *
 * Documenta el procedimiento, los datos, los motores, los errores y la
 * normativa de la sección en formato acordeón nativo (`<details>`), sin
 * estado ni Motion UI. Las respuestas técnicas citan el código real con
 * `archivo › función (línea)`; la línea es complemento de localización y
 * el nombre de la función es el ancla estable.
 */

type Fragmento = {
  archivo: string
  referencia: string
  linea?: number
  codigo: string
}

type Pregunta = {
  id: string
  q: string
  a: React.ReactNode
}

type Categoria = {
  id: string
  titulo: string
  preguntas: Pregunta[]
}

function Snippet({ archivo, referencia, linea, codigo }: Fragmento) {
  return (
    <figure className="my-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      <figcaption className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-800 bg-slate-900 px-3 py-1.5 font-mono text-[10px]">
        <span className="text-emerald-400">{archivo}</span>
        <span aria-hidden className="text-slate-600">
          ›
        </span>
        <span className="text-slate-200">{referencia}</span>
        {typeof linea === 'number' && (
          <span className="ml-auto text-slate-500">línea {linea}</span>
        )}
      </figcaption>
      <pre className="overflow-x-auto px-3 py-3 text-[11px] leading-relaxed text-slate-100">
        <code>{codigo}</code>
      </pre>
    </figure>
  )
}

function Chevron() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="mt-1 shrink-0 text-emerald-600 transition-transform duration-200 group-open:rotate-90 dark:text-emerald-400"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

const p = (id: string, q: string, a: React.ReactNode): Pregunta => ({ id, q, a })

const CATEGORIAS: Categoria[] = [
  {
    id: 'procedimiento',
    titulo: 'Procedimiento',
    preguntas: [
      p(
        'que-ocurre',
        '¿Qué ocurre exactamente cuando pulso «Calcular modelos»?',
        <>
          <p>
            La server action recorre una cadena fija. Nada se escribe en la
            base de datos hasta que usted pulsa «Guardar modelo»:
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              <code className="ui-chip">parseAlcance</code> convierte la clave
              del selector (<code className="ui-chip">global</code>,{' '}
              <code className="ui-chip">b:…</code> o{' '}
              <code className="ui-chip">e:…</code>) en una solicitud de
              alcance, junto con la edificación elegida en su selector (vacío
              = todas las edificaciones).
            </li>
            <li>
              Permiso <code className="ui-chip">analyze</code> sobre el módulo
              de Registro de Consumo.
            </li>
            <li>
              Consultas a BD, acotadas a la edificación elegida cuando la hay:
              facturas de energía, bloques, espacios con su inventario de
              equipos, variables operativas y ajustes.
            </li>
            <li>
              Guardas de datos (facturas vacías, factura media ≤ 0, share del
              bloque) que devuelven un error tipado antes de invocar Python.
            </li>
            <li>
              Se arma la serie mensual y las dos tablas de transparencia
              (preparación y jerarquía).
            </li>
            <li>
              Se lanza <code className="ui-chip">python/lben/cli.py</code> con
              JSON por stdin y un timeout de 15 s.
            </li>
            <li>
              La salida se normaliza, se parsea y se devuelve como{' '}
              <code className="ui-chip">CalculoLineaBase</code>.
            </li>
          </ol>
          <p className="mt-2">
            Si alguna guardas falla, se devuelve{' '}
            <code className="ui-chip">{"{ ok: false, error }"}</code> y la
            sección muestra el mensaje en un callout rojo: no hay excepciones
            sin traducir.
          </p>
          <Ref
            archivo="src/features/datos/controllers/lineasBase.ts"
            referencia="calcularModelosLineaBase"
            linea={182}
          />
        </>
      ),
      p(
        'serie',
        '¿Cómo se arma la serie mensual que llega al motor?',
        <>
          <p>
            El motor no ve la BD: recibe una lista plana de meses ya
            calculados por el servidor. Cada fila trae el consumo
            normalizado a 30 días, multiplicado por la cadena de shares del
            alcance (global → bloque → espacio), más las variables
            explicativas del mismo mes.
          </p>
          <p className="mt-2">
            Por eso <code className="ui-chip">dias_facturados</code> se envía
            siempre en 30: la normalización interna de{' '}
            <code className="ui-chip">depurar_con_bandas</code> se vuelve la
            identidad y el número que usted ve en la tabla es exactamente el
            que calcula el motor.
          </p>
          <Ref
            archivo="python/lben/cli.py"
            referencia="contrato JSON por stdin"
            linea={6}
          />
        </>
      ),
      p(
        'banda',
        '¿Qué es la depuración por banda y por qué desaparecen meses de la tabla?',
        <>
          <p>
            Antes de modelar, la serie se limpia mes a mes según el §7.5.1 de
            la Resolución 16 de 2024 (corregida por Auto 444/2024).
            Primero se aplican los <strong>ajustes no rutinarios</strong> del
            Anexo 4: si hay una causa conocida (remodelación, mantenimiento,
            paro, etc.) que provocó consumos anómalos, se corrigen mediante la
            proporción del Anexo 4 <em>antes</em> de la verificación.
            Luego, el <strong>pase único</strong> aplica la banda de la
            <strong>ec. (3)</strong> <code className="ui-chip">media ± 10 %</code>,
            con recomputo de la media tras cada descarte (la Resolución exige
            ese recomputo). También se normaliza a 30 días (ec. 1) y se
            descartan los consumos ≤ 0. Si un atípico fuerte arrastra la media
            hasta que la banda no contiene a ningún valor, se reancla sobre la
            mediana para no perder el mes entero. El rescate con el intervalo
            de confianza de las ec. 4-5 (±2·DesvEst) se elimina como segunda
            pasada: la solución normativa a anómalos con causa es el ajuste
            (Anexo 4), no ensanchar la banda; la ec. 4-5 sí se evalúa{' '}
            <strong>por mes</strong> con n ≥ 10 (decisión D1) dentro del mismo
            pase. El modelo de cociente depura sobre la base cruda de la
            ec. 1 — con los <strong>ajustes del Anexo 4 aplicados</strong>{' '}
            (corrección de datos, no depuración) pero sin filtro de descarte de
            consumo — y verifica sus cocientes (ec. 4-5 con n ≥ 10 en el mes,
            si no ±10 % de la ec. 7, §7.5.2).
          </p>
          <p className="mt-2">
            Los meses con menos de 3 valores no forman banda: se calculan con
            lo que haya y salen marcados como <em>estimado</em> (si no hay
            tres, manda el periodo seleccionado como base de consumo). Ningún
            dato se borra de la tabla: lo descartado aparece con el badge
            «Descartado · fuera de banda» y con{' '}
            <code className="ui-chip">descartado: true</code> en la serie, y
            el mes estimado se señala en el tooltip de la gráfica.
          </p>
          <p className="mt-2">
            El conteo de meses que sí sobrevive es{' '}
            <code className="ui-chip">depurados</code>, que alimenta la
            primera puerta UPME; los meses sin 3 valores alimentan la regla
            3×12. El criterio efectivo viaja en{' '}
            <code className="ui-chip">criterio_depuracion</code>
            («banda_10_pct» único) y la UI lo muestra junto a los resultados.
            Sobre{' '}
            <code className="ui-chip">k</code>: la imagen oficial de la ec. (4)
            escribe <em>dos (2)·DesvEst</em>; el motor llama{' '}
            <code className="ui-chip">k = 2</code> a ese factor: ancho de la
            banda del mes cuando ese mes tiene n ≥ 10 (D1) y de la envolvente
            IC de la tarjeta de Valor Absoluto.
          </p>
          <Ref
            archivo="python/lben/bandas.py"
            referencia="depurar_con_bandas"
            linea={241}
          />
        </>
      ),
      p(
        'calcular-vs-guardar-36',
        '¿Por qué puedo calcular con menos de 36 meses pero no guardar?',
        <>
          <p>
            Porque son dos puertas distintas y decidimos separarlas a
            propósito. El cálculo es <em>libre</em>: sirve para diagnosticar
            una serie corta, ver la gráfica y entender qué falla. La
            persistencia sí exige el mínimo normativo.
          </p>
          <Snippet
            archivo="src/features/datos/views/LineasBase.tsx"
            referencia="conformeParaGuardar"
            linea={522}
            codigo={`const conformeParaGuardar =
  calc !== null &&
  calc.depurados >= UPME_MIN_MESES &&
  calc.mesesInsuficientes.length === 0`}
          />
          <p>
            Con esa condición en falso el botón «Guardar modelo» no se renderiza
            y el texto explica cuántos meses faltan o en qué meses falta el
            mínimo de 3 valores (regla 3×12). El cálculo sigue en pantalla
            para diagnóstico.
          </p>
          <Ref
            archivo="src/features/datos/controllers/lineasBase.ts"
            referencia="gate de conformidad UPME"
            linea={738}
          />
        </>
      ),
      p(
        'calcular-vs-guardar',
        '¿Qué diferencia hay entre «Calcular modelos» y «Guardar modelo»?',
        <>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Calcular modelos</strong> es una lectura: corre los 4
              modelos, llena la gráfica y las tablas, y no toca la BD. Requiere
              el permiso <code className="ui-chip">analyze</code>.
            </li>
            <li>
              <strong>Guardar modelo</strong> es una escritura: hace un upsert
              de un solo registro por (bloque, tipo) en{' '}
              <code className="ui-chip">LineaBaseEnergia</code>, con su R², su
              peor p-value, el resultado completo y el{' '}
              <code className="ui-chip">origen</code> del share. Requiere el
              permiso <code className="ui-chip">upload</code>, alcance de
              bloque, ≥ 36 meses depurados y los 12 meses con ≥ 3 valores
              (3×12).
            </li>
          </ul>
          <p className="mt-2">
            Puede recalcular las veces que quiera sin ensuciar la BD; solo lo
            que confirme explícitamente queda persistido.
          </p>
        </>
      ),
    ],
  },
  {
    id: 'datos',
    titulo: 'Datos',
    preguntas: [
      p(
        'que-datos',
        '¿Qué datos debo tener cargados antes de calcular?',
        <>
          <div className="mt-1 overflow-hidden rounded-xl border border-gray-200 dark:border-slate-800">
            <table className="ui-table text-xs">
              <thead>
                <tr>
                  <th>Dato</th>
                  <th>¿Obligatorio?</th>
                  <th>Qué se pierde si falta</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Facturas de energía</td>
                  <td>Sí</td>
                  <td>Sin serie no hay cálculo posible.</td>
                </tr>
                <tr>
                  <td>Bloques</td>
                  <td>Sí</td>
                  <td>No hay alcance por bloque ni jerarquía.</td>
                </tr>
                <tr>
                  <td>Espacios</td>
                  <td>Sí</td>
                  <td>El alcance se limita a bloque o global.</td>
                </tr>
                <tr>
                  <td>Inventario de equipos</td>
                  <td>Sí, si no hay área útil</td>
                  <td>No se puede estimar el share del bloque.</td>
                </tr>
                <tr>
                  <td>Área útil + factor de infraestructura</td>
                  <td>Sí, para el share por área</td>
                  <td>El share pasa a modo estimado (badge ámbar).</td>
                </tr>
                <tr>
                  <td>Variables operativas</td>
                  <td>No</td>
                  <td>Cociente y regresión se evalúan sin referencia.</td>
                </tr>
                <tr>
                  <td>Ajustes</td>
                  <td>No</td>
                  <td>Nada en el cálculo; solo afectan la lectura de gestión.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ),
      p(
        'share-definicion',
        '¿Qué es el share y por qué la columna no suma 100 %?',
        <>
          <p>
            El <strong>share</strong> es la fracción del consumo global que
            corresponde al alcance que está mirando. No es una participación
            contable: es el factor por el que se escala la línea base del
            total para obtener la de un bloque o un espacio.
          </p>
          <p className="mt-2">
            El share del <em>total global</em> es 1 (100 %), pero los bloques
            individuales no suman 100 % entre sí cuando se calculan por
            ingeniería, porque su denominador es la factura media global
            completa (la de la edificación si el cálculo está acotado a una)
            y no la suma de los bloques cargados. Por eso la cabecera
            de la tabla dice «Share global» y no «participación».
          </p>
          <Ref
            archivo="src/features/datos/models/lineasBase.ts"
            referencia="OrigenShare"
            linea={58}
          />
        </>
      ),
      p(
        'share-estimado',
        '¿Por qué mi bloque aparece con el badge «Share estimado»?',
        <>
          <p>
            El criterio de share conmuta según la cobertura de área de los
            bloques:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <code className="ui-chip">facturas_area</code> — solo si{' '}
              <em>todos</em> los bloques tienen{' '}
              <code className="ui-chip">areaUtil &gt; 0</code> y el peso total
              es positivo. Reparte por <code className="ui-chip">área útil ×
              factor de infraestructura</code>.
            </li>
            <li>
              <code className="ui-chip">modelo_ingenieria</code> — en cuanto
              falte un solo bloque con área. Reparte por{' '}
              <code className="ui-chip">carga nominal ÷ factura media
              global</code> y llena el campo <code className="ui-chip">aviso</code>.
            </li>
          </ul>
          <p className="mt-2">
            La regla es deliberadamente conservadora: el reparto por área
            normaliza contra la suma de lo que haya cargado, así que con un
            subconjunto de bloques repartiría el 100 % ficticio entre ellos.
            El modelo de ingeniería normaliza contra la factura global (un dataset
            completo) y por eso nunca infla el reparto.
          </p>
          <Snippet
            archivo="src/features/datos/controllers/lineasBase.ts"
            referencia="shareDeBloque"
            linea={377}
            codigo={`const shareDeBloque = (b: (typeof bloques)[number]): number =>
  origen === 'facturas_area'
    ? pesoDe(b) / pesoTotalBloques
    : cargaDeBloque(b) / mediaNormalizado`}
          />
          <p>
            El badge y el callout de aviso no son cosméticos: dejan constancia
            en pantalla de que esa cifra es una <strong>estimación</strong>, y
            el mismo <code className="ui-chip">origen</code> se guarda en
            <code className="ui-chip"> coeficientes</code> para que quede
            auditable en BD.
          </p>
        </>
      ),
      p(
        'potencia-nominal',
        '¿Qué es potenciaNominal y por qué no debo multiplicarla por cantidad dos veces?',
        <>
          <p>
            <code className="ui-chip">EnergiaEquipo.potenciaNominal</code> es
            la potencia de <strong>una sola unidad</strong>, no la del lote.
            La columna <code className="ui-chip">cantidad</code> existe
            precisamente para multiplicarla una única vez:
          </p>
          <Snippet
            archivo="src/app/dashboard/datos/page.tsx"
            referencia="potenciaTotalKw"
            linea={164}
            codigo={`potenciaTotalKw: potenciasEquipos.reduce(
  (suma, e) => suma + e.potenciaNominal * e.cantidad,
  0
),`}
          />
          <p className="mt-2">
            Multiplicar dos veces (por <code className="ui-chip">cantidad</code>{' '}
            y otra vez al agregar) infla la carga teórica del bloque y, con
            ella, el share estimado. Una lámpara LED de 0,04 kW en un lote de
            10 unidades son 0,04 kW por unidad, no 0,4 kW por unidad.
          </p>
        </>
      ),
      p(
        'factura-media',
        '¿Qué es la factura media normalizada y por qué es el denominador?',
        <>
          <p>
            Es el promedio de <code className="ui-chip">consumoNormalizado</code>{' '}
            de todas las facturas de energía: cada factura ya viene
            ajustada a 30 días, de modo que los meses de 28, 30 o 31 días no
            distorsionan la serie.
          </p>
          <p className="mt-2">
            Es el denominador del share estimado porque representa el consumo
            real y completo del total: dividir la carga teórica de un bloque
            entre esa cifra da un cociente adimensional que, por construcción,
            no puede superar 1 salvo error de dato.
          </p>
          <p className="mt-2">
            Si esa media sale 0 o negativa la acción corta con un error
            tipado antes de invocar Python.
          </p>
          <Ref
            archivo="src/features/datos/controllers/lineasBase.ts"
            referencia="guarda de la serie"
            linea={331}
          />
        </>
      ),
      p(
        'variables-opcionales',
        '¿Las variables operativas son obligatorias?',
        <>
          <p>
            No. Sin ellas el cálculo se ejecuta igual, pero se añade un aviso
            al resultado:
          </p>
          <p className="mt-2 ui-callout ui-callout-warn">
            No hay variables operativas: los modelos de cociente y regresión se
            evaluarán sin referencia poblacional.
          </p>
          <p className="mt-2">
            En la práctica, el modelo de <em>Valor absoluto</em> y{' '}
            <em>Confort térmico</em> no las necesitan;{' '}
            <em>Cociente</em> y <em>Regresión</em> pierden su variable
            explicativa y su puerta de p-value no se puede evaluar.
          </p>
        </>
      ),
    ],
  },
  {
    id: 'motores',
    titulo: 'Motores y código',
    preguntas: [
      p(
        'python-next',
        '¿Cómo se comunican Next.js y el motor Python?',
        <>
          <p>
            No hay servidor HTTP ni colas: un proceso hijo simple. Next escribe
            JSON por <code className="ui-chip">stdin</code>, Python responde
            por <code className="ui-chip">stdout</code> y todo lo que el motor
            loguea va a <code className="ui-chip">stderr</code> para no
            contaminar la respuesta.
          </p>
          <Snippet
            archivo="python/lben/cli.py"
            referencia="contrato JSON"
            linea={6}
            codigo={`stdin  -> JSON:
  {
    "bloque_id": "cuid...",
    "registros": [
      {"mes": 1, "ano": 2023, "consumo_kwh": 12480.5,
       "dias_facturados": 30, "poblacion_fija": 70,
       "poblacion_flotante": 13500, "gde": 5.2,
       "temperatura_promedio": 25.0}
    ],
    "variables_regresion": ["poblacion_fija",
                             "poblacion_flotante",
                             "grades_dia_enfriamiento"]
  }

stdout -> JSON:
  {
    "ok": true, "originales": 48, "depurados": 47,
    "min_meses": 36, "min_valores_por_mes": 3,
    "criterio_depuracion": "banda_10_pct", // única ruta: ±10 % (ec. 3)
    "desv_est": 21493.13,                // §9.2: σ poblacional (ec. 5) post-ajuste
                                         // y pre-descarte; null si n < 10
    "k_intervalo": null,                 // el rescate ic_2sigma ya no existe
    "min_datos_ic": 10,                  // n ≥ 10 POR MES (D1): puerta ec. 4-5
    "bandas": [{"mes", "n", "media", "limite_inferior",
                "limite_superior", "descartados", "estimado"}],
    "meses_insuficientes": [3],
    "resultados": {"valor_absoluto": {"ok": true, ...}},
    "serie": [{"mes", "ano", "real", "descartado",
               "banda_inf", "banda_sup", "estimado",
               "pred_va", "pred_coc", "pred_reg", "pred_conf"}]
  }`}
          />
          <Snippet
            archivo="src/features/datos/controllers/lineasBase.ts"
            referencia="ejecutarCli"
            linea={100}
            codigo={`const proceso = spawn('python', ['-m', 'lben.cli'], {
  cwd: path.join(process.cwd(), 'python'),
  windowsHide: true,
})
...
proceso.stdin.write(JSON.stringify({ bloque_id: bloqueId, registros }))
proceso.stdin.end()`}
          />
          <p>
            Hay un timeout de 15 segundos: si el motor no responde, se mata el
            proceso y se devuelve un error tipado.{' '}
            <code className="ui-chip">python/lben/cli.py</code> es solo el
            envoltorio de stdin/stdout: la lógica vive en{' '}
            <code className="ui-chip">python/lben/</code>.
          </p>
        </>
      ),
      p(
        'nan',
        '¿Qué hace normalizarJsonNoEstandar?',
        <>
          <p>
            Es el fix del famoso «Salida ilegible del motor Python».
            <code className="ui-chip"> json.dump()</code> de Python, con su
            configuración por defecto <code className="ui-chip">allow_nan=True</code>,
            emite <code className="ui-chip">NaN</code>,{' '}
            <code className="ui-chip">Infinity</code> y{' '}
            <code className="ui-chip">-Infinity</code>, que son legales en
            Python pero <strong>no</strong> en JSON. <code className="ui-chip">JSON.parse</code>{' '}
            los rechaza y el <code className="ui-chip">try/catch</code>{" "}
            antiguo devolvía un mensaje sin pistas.
          </p>
          <Snippet
            archivo="src/features/datos/controllers/lineasBase.ts"
            referencia="normalizarJsonNoEstandar"
            linea={95}
            codigo={`function normalizarJsonNoEstandar(texto: string): string {
  return texto.replace(/(?<=[:,[]\\s*)-?(?:NaN|Infinity)/g, 'null')
}`}
          />
          <p className="mt-2">
            Los sustituye por <code className="ui-chip">null</code> (JSON
            válido) justo antes de parsear. El motor ya devuelve{' '}
            <code className="ui-chip">null</code> en otros campos opcionales,
            así que la UI y <code className="ui-chip">guardarLineaBase</code>{" "}
            toleran el caso sin perder el resto de la respuesta.
          </p>
          <p className="mt-2">
            Si aun así el parseo falla, el error ya no es ciego: incluye los
            primeros 160 caracteres de la salida.
          </p>
        </>
      ),
      p(
        'cuatro-modelos',
        '¿Qué calcula cada uno de los 4 modelos del motor?',
        <>
          <div className="mt-1 overflow-hidden rounded-xl border border-gray-200 dark:border-slate-800">
            <table className="ui-table text-xs">
              <thead>
                <tr>
                  <th>Clase en python/lben/modelos/</th>
                  <th>Qué estima</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>ModeloValorAbsoluto</code>{' '}
                    <span className="ui-muted">(valor_absoluto.py:16)</span>
                  </td>
                  <td>
                    Los 12 promedios mensuales (ene–dic) depurados con la
                    banda ±10 % (ec. 3) por mes con recomputo, ya con los
                    ajustes del Anexo 4 aplicados, como{' '}
                    <code>LBEn_m</code>, con su banda por mes. No usa
                    variables.
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ModeloCociente</code>{' '}
                    <span className="ui-muted">(cociente.py:18)</span>
                  </td>
                  <td>
                    Consumo por unidad de referencia (área en m² o población)
                    que escala con el uso real del espacio; devuelve 12
                    cocientes mensuales. Depura su propia base de cocientes
                    (§7.5.2): ec. 4-5 con n ≥ 10 en el mes, si no
                    ±10 % (ec. 7), sin heredar el filtro de consumo.
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ModeloRegresion</code>{' '}
                    <span className="ui-muted">(regresion.py:19)</span>
                  </td>
                  <td>
                    Ajuste OLS multivariable con validación por p-value y
                    multicolinealidad (VIF); descarta variables iterativamente.
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>ModeloConfortThermal</code>{' '}
                    <span className="ui-muted">(confort.py:15)</span>
                  </td>
                  <td>
                    Indicador complementario —no es el 4.º modelo de la
                    Resolución, que es de ingeniería—: modo térmico ASHRAE 55
                    y energía virtual de desviarse del punto medio del rango.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2">
            Los cuatro se ejecutan en el mismo proceso y devuelven su resultado
            por separado, con su propia puerta de aceptación. Que uno falle no
            invalida a los demás: la sección marca ese modelo como «no
            aceptado» y deja el resto en pantalla.
          </p>
          <Ref
            archivo="python/lben/cli.py"
            referencia="MODELOS"
            linea={70}
          />
        </>
      ),
      p(
        'constantes-espejo',
        '¿Por qué las constantes UPME están duplicadas en TypeScript y Python?',
        <>
          <p>
            Porque el motor no puede importar TS y la UI no puede importar
            Python. Se mantienen como dos espejos que deben leer igual:
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <Snippet
              archivo="src/features/datos/models/lineasBase.ts"
              referencia="constantes normativas"
              linea={44}
              codigo={`export const UPME_MIN_MESES = 36
export const UPME_MIN_VALORES_MES = 3   // §7.5.1 (regla 3×12)
export const UPME_P_VALUE = 0.05
export const UPME_MAPE_MAXIMO = 5   // en % · confiabilidad (Anexo 3)
export const UPME_RANGO_CONFIANZA = 0.1  // ±10 % · ec. 3 (criterio único)
export const UPME_K_INTERVALO = 2        // k de la ec. 4 (banda mensual / IC, D1)
export const UPME_MIN_DATOS_IC = 10      // n ≥ 10 POR MES: puerta ec. 4-5 (D1)`}
            />
            <Snippet
              archivo="python/lben/constants.py"
              referencia="constantes normativas"
              linea={22}
              codigo={`K_INTERVALO = 2        # ec. 4: LBEn_m ± k·DesvEst (banda mensual / IC, n ≥ 10 por mes)
MIN_DATOS_IC = 10      # §7.5.1: ec. 4-5 con n ≥ 10 EN EL MES (D1)
CONFIANZA_INTERVALO = 0.10  # ±10 % (ec. 3 / ec. 7): criterio único
UMbral_P_VALUE = 0.05       # significancia al 95 % (§7.5.3)
MIN_MESES_BASE = 36         # 3 años (§7.1-7.2) — gate de guardado
MIN_VALORES_POR_MES = 3     # §7.5.1: tres valores del mismo mes
MAPE_MAXIMO = 0.05          # confiabilidad (ejemplo del Anexo 3)`}
            />
          </div>
          <p className="mt-2">
            Diferencias a tener en cuenta: el motor expresa{' '}
            <code className="ui-chip">MAPE</code> como fracción (0,05) y la UI
            como porcentaje (5); ningún lado fija tope de R² (§7.5.3: un R²
            bajo no invalida). Si cambia una constante, hay que cambiarla en
            ambos lados.
          </p>
        </>
      ),
      p(
        'linea-base-kwh',
        '¿Cómo pasa el share a kWh concretos?',
        <>
          <p>
            Con <code className="ui-chip">lineaBaseKwh</code>: extrae la LB del
            alcance (el valor escalar del modelo) y después{' '}
            <code className="ui-chip">TablaJerarquia</code> la multiplica por
            el share de cada fila para desglosarla. Cada modelo aporta su
            campo:
          </p>
          <Snippet
            archivo="src/features/datos/models/lineasBase.ts"
            referencia="lineaBaseKwh"
            linea={324}
            codigo={`export function lineaBaseKwh(modelo, r, serie) {
  if (modelo === 'valor_absoluto') return r.consumo_promedio_mensual ?? null
  if (modelo === 'cociente')       return r.consumo_promedio ?? null
  if (modelo === 'confort')        return r.consumo_base_kwh ?? null
  // regresión: promedio de las predicciones no descartadas
  const preds = serie
    .filter((p) => !p.descartado && typeof p.pred_reg === 'number')
    .map((p) => p.pred_reg as number)
  if (preds.length === 0) return null
  return preds.reduce((suma, v) => suma + v, 0) / preds.length
}`}
          />
          <p className="mt-2">
            Si el modelo no produjo resultado o la serie quedó sin
            predicciones, devuelve <code className="ui-chip">null</code> y la
            tabla muestra un guion en lugar de inventar un número.
          </p>
        </>
      ),
    ],
  },
  {
    id: 'errores',
    titulo: 'Errores',
    preguntas: [
      p(
        'sin-facturas',
        'Aparece «No hay facturas de energía en la BD…» o «La factura media normalizada global es 0…»',
        <>
          <p>
            <strong>Causa:</strong> no hay serie de consumo que modelar. La
            primera sale cuando la tabla de facturas está vacía; la segunda
            cuando existe pero normaliza a 0 (facturas todas en 0 kWh). Con el
            cálculo acotado a una edificación los mensajes dicen
            «para la edificación seleccionada» o «de la edificación» cuando
            esa edificación no tiene facturas o estas normalizan a 0.
          </p>
          <p className="mt-2">
            <strong>Solución:</strong> importe facturas de energía desde la pestaña
            Facturas y verifique que el total y los días sean coherentes antes
            de volver a calcular.
          </p>
          <Ref
            archivo="src/features/datos/controllers/lineasBase.ts"
            referencia="guarda G3 de la serie"
            linea={332}
          />
        </>
      ),
      p(
        'sin-inventario',
        'Aparece «El bloque … no tiene inventario de equipos con consumo…»',
        <>
          <p>
            <strong>Causa:</strong> la cobertura de área de los bloques está
            incompleta, así
            que el sistema está en modo <code className="ui-chip">modelo_ingenieria</code>,
            y ese bloque no aporta ninguna carga nominal que dividir.
          </p>
          <p className="mt-2">
            <strong>Solución (una de las dos):</strong> importe el inventario
            de equipos para ese bloque desde la pestaña Equipos, o registre su{' '}
            <code className="ui-chip">areaUtil</code> y su{' '}
            <code className="ui-chip">factorInfraestructura</code> para volver
            al modo por área.
          </p>
          <Ref
            archivo="src/features/datos/controllers/lineasBase.ts"
            referencia="errorShareDeBloque"
            linea={383}
          />
        </>
      ),
      p(
        'share-sobre-100',
        'Aparece «El share estimado del bloque … es … %: su carga teórica iguala o supera la factura media global» (o «…la factura media de la edificación» con ámbito acotado)',
        <>
          <p>
            <strong>Causa:</strong> la carga teórica calculada
            (potencia × cantidad × horas de uso) da igual o más kWh/mes que
            toda la factura de referencia (global, o la de la edificación
            elegida). Eso es matemáticamente imposible si los
            datos están bien, así que se corta antes de producir un share
            ≥ 100 %.
          </p>
          <p className="mt-2">
            <strong>Solución:</strong> revise{' '}
            <code className="ui-chip">potenciaNominal</code> (debe ser por
            unidad, no por lote), las{' '}
            <code className="ui-chip">horasUsoDia</code> y las{' '}
            <code className="ui-chip">diasUsoMes</code> de los equipos de ese
            bloque. Suele ser un error de unidad o de magnitud.
          </p>
          <Ref
            archivo="src/features/datos/controllers/lineasBase.ts"
            referencia="errorShareDeBloque"
            linea={383}
          />
        </>
      ),
      p(
        'python-ausente',
        'Aparece «No se encontró Python en el servidor…», «…terminó con error (código N)» o el mensaje de timeout',
        <>
          <div className="mt-1 overflow-hidden rounded-xl border border-gray-200 dark:border-slate-800">
            <table className="ui-table text-xs">
              <thead>
                <tr>
                  <th>Mensaje</th>
                  <th>Causa probable</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>No se encontró Python en el servidor</td>
                  <td>
                    No está <code>python</code> en el PATH del proceso de Next.
                  </td>
                </tr>
                <tr>
                  <td>…instale Python 3.10+ con pandas y statsmodels</td>
                  <td>Faltan las dependencias del motor.</td>
                </tr>
                <tr>
                  <td>terminó con error (código N): detalle</td>
                  <td>
                    Excepción dentro del motor; el detalle son las últimas 3
                    líneas de stderr.
                  </td>
                </tr>
                <tr>
                  <td>tardó más de lo esperado (timeout)</td>
                  <td>Superó los 15 s; se mató el proceso hijo.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2">
            Ninguno de estos mensajes depende de los datos: son de entorno.
          </p>
          <Ref archivo="src/features/datos/controllers/lineasBase.ts" referencia="ejecutarCli" linea={100} />
        </>
      ),
      p(
        'permisos',
        'Aparece «Sesión expirada» o «Su rol no tiene permiso…»',
        <>
          <p>
            <strong>Sesión expirada:</strong> el token de la cookie venció.
            Vuelva a iniciar sesión y repita la operación.
          </p>
          <p className="mt-2">
            <strong>Sin permiso para calcular:</strong> necesita la acción{' '}
            <code className="ui-chip">Analiza</code> sobre Registro de
            Consumo. En la matriz de permisos, solo{' '}
            <strong>Gestor Energético</strong> la tiene.
          </p>
          <p className="mt-2">
            <strong>Sin permiso para guardar:</strong> necesita la acción{' '}
            <code className="ui-chip">Carga</code> sobre el mismo módulo. En
            ese caso la sección muestra un aviso junto al botón en lugar de
            ocultarlo en silencio.
          </p>
        </>
      ),
      p(
        'salida-ilegible',
        '¿Qué era «Salida ilegible del motor Python» y por qué ya no aparece?',
        <>
          <p>
            Era un mensaje ciego. Raíz: el motor emitía{' '}
            <code className="ui-chip">NaN</code> cuando su serie quedaba vacía
            (por ejemplo, sin bloques con área), <code className="ui-chip">json.dump</code>{' '}
            lo escribía literal, <code className="ui-chip">JSON.parse</code>{' '}
            lanzaba… pero el proceso había terminado con código 0, así que el{' '}
            <code className="ui-chip">catch</code> antiguo no tenía nada útil
            que contar.
          </p>
          <p className="mt-2">
            Se atacó por los dos extremos: guardas aguas arriba para que la
            serie nunca llegue vacía al motor, y normalización aguas abajo
            para que un <code className="ui-chip">NaN</code> residual no rompa
            el parseo. El <code className="ui-chip">catch</code> ahora devuelve
            el fragmento real de la salida:
          </p>
          <Snippet
            archivo="src/features/datos/controllers/lineasBase.ts"
            referencia="manejo del parseo"
            linea={159}
            codigo={`} catch {
  const fragmento = stdout.replace(/\\s+/g, ' ').trim().slice(0, 160)
  terminar({
    error: \`El motor Python devolvió JSON inválido\${
      fragmento
        ? \`: "\${fragmento}\${stdout.length > 160 ? '…' : ''}"\`
        : ' (sin salida).'
    }\`,
  })
}`}
          />
          <p className="mt-2">
            Si vuelve a aparecer, ya no dice «ilegible»: le dice qué devolvió.
          </p>
        </>
      ),
      p(
        'boton-guardar',
        '¿Por qué ya no veo el botón «Guardar modelo»?',
        <>
          <p>Cuatro razones, en orden de frecuencia:</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              El alcance no es un bloque (global o espacio). El guardado
              oficial es siempre a nivel de bloque.
            </li>
            <li>
              <code className="ui-chip">depurados &lt; 36</code>. El texto
              contiguo indica cuántos hay y cuántos faltan.
            </li>
            <li>
              Algún mes con menos de 3 valores (regla 3×12): ese mes sale{' '}
              <em>estimado</em> y bloquea el guardado. El mensaje lista los
              meses exactos.
            </li>
            <li>
              Su rol no tiene la acción <code className="ui-chip">Carga</code>{' '}
              en Registro de Consumo.
            </li>
          </ol>
          <p className="mt-2">
            En los cuatro casos la sección explica el motivo en lugar de dejar
            un hueco. Si había guardado ese modelo antes, el botón se muestra
            como «Guardado ✓» deshabilitado.
          </p>
        </>
      ),
    ],
  },
  {
    id: 'normativa',
    titulo: 'Normativa',
    preguntas: [
      p(
        'upme-0016',
        '¿Qué exige la Resolución UPME 0016 de 2024 y cómo se aplica aquí?',
        <>
          <p>
            Los criterios del módulo, tal como están codificados (el texto
            oficial está en{' '}
            <code className="ui-chip">docs/resolucion_upme_0016_2024.md</code>,
            §7.5):
          </p>
          <Snippet
            archivo="src/features/datos/views/LineasBase.tsx"
            referencia="CRITERIOS"
            linea={186}
            codigo={`const CRITERIOS = [
  'Periodo base mínimo: 36 meses (3 años)',
  'Depuración: por mes con recomputo (§7.5.1): banda ±10 % (ec. 3); ajustes no rutinarios (Anexo 4) corrigen anómalos antes de la verificación',
  'Meses con menos de 3 valores: sin banda (regla 3×12)',
  'Banda de confianza: ±10 % (ec. 3) por defecto; ajustes no rutinarios Anexo 4 corrigen anómalos antes de la verificación',
  'Significancia: p-value ≤ 0,05 (§7.5.3)',
  'Bondad de ajuste: R² sin tope (§7.5.3: un R² bajo no invalida)',
  'Error promedio: MAPE ≤ 5 % (confiabilidad, ejemplo Anexo 3)',
]`}
          />
          <p>
            Se aplican en dos niveles: el motor valida dentro de cada modelo y
            la UI los traduce en los chips de puerta que ven junto a las
            métricas. Ninguno de ellos es editable desde la interfaz.
          </p>
        </>
      ),
      p(
        'puertas',
        '¿Cuáles son las puertas de aceptación y cómo se calculan?',
        <>
          <p>
            Cada modelo declara sus propias puertas. Las dos primeras
            (meses depurados y regla 3×12) aplican a todos; el resto dependen
            del tipo:
          </p>
          <Snippet
            archivo="src/features/datos/views/LineasBase.tsx"
            referencia="construirPuertas"
            linea={234}
            codigo={`const puertas: Puerta[] = [
  { label: \`\${calc.depurados} meses depurados (mín. 36)\`,
    ok: calc.depurados >= UPME_MIN_MESES },
  { label: '3×12: 12 meses con ≥3 valores',
    ok: calc.mesesInsuficientes.length === 0 },
]
if (id !== 'confort' && typeof r.mape === 'number') {
  puertas.push({ label: \`MAPE \${r.mape} % ≤ 5 %\`,
    ok: r.mape <= UPME_MAPE_MAXIMO })
}
if (id === 'regresion' && r.p_values) {
  const peor = Math.max(...Object.values(r.p_values))
  puertas.push({ label: \`p máximo \${peor} ≤ 0,05\`, ok: peor <= UPME_P_VALUE })
}
if (id === 'confort' && typeof r.en_rango_confort === 'boolean') {
  puertas.push({ label: 'T en rango ASHRAE 55', ok: r.en_rango_confort })
}`}
          />
          <p className="mt-2">
            No hay puerta de R² en absoluto: el §7.5.3 dice que un R² bajo{' '}
            <strong>no invalida</strong> la regresión. El MAPE ≤ 5 % es
            confiabilidad (el umbral del ejemplo del Anexo 3), y{' '}
            <strong>Confort térmico</strong> no es un ajuste de regresión: su
            puerta es el rango térmico. Una puerta en roja marca el modelo
            como «no aceptado» sin impedir ver su gráfica.
          </p>
        </>
      ),
      p(
        'banda-10',
        '¿Qué es la banda de confianza: ±10 % o ±2·DesvEst?',
        <>
          <p>
            Es la ventana de operación alrededor de la línea base: lo que cae
            dentro se considera normal. Manda la banda de la ec. (3),{' '}
            <code className="ui-chip">media ± 10 %</code>, con recomputo de la
            media tras cada descarte. La ec. (4)-(
            <code className="ui-chip">LBEn_m ± k·DesvEst</code> con{' '}
            <code className="ui-chip">k = 2</code> y DesvEst poblacional ÷N)
            se evalúa <strong>por mes</strong> (decisión D1): si el mes tiene{' '}
            <strong>n ≥ 10</strong> la banda de ese mes usa ±2·σ_m; si no, la
            del mes se queda en ±10 %. El motor devuelve{' '}
            <code className="ui-chip">banda_inf</code> y{' '}
            <code className="ui-chip">banda_sup</code> de cada mes en la serie
            y la gráfica dibuja una escalera de 12 tramos; los meses{' '}
            <em>estimado</em> quedan con hueco.
          </p>
          <p className="mt-2">
            Para Valor Absoluto hay dos envolventes:{' '}
            <code className="ui-chip">intervalo_confianza</code> resume el IC
            ec. (4) de los 12 meses (null si algún mes tiene n &lt; 10 o falta
            algún mes), y{' '}
            <code className="ui-chip">rango_confianza_10_pct</code> emite la
            ventana ±10 % de la ec. (3). Ambas son métricas del modelo,
            independientes del criterio de depuración efectivo, que viaja en{' '}
            <code className="ui-chip">criterio_depuracion</code>.
          </p>
          <p className="mt-2">
            Sirve de umbral de alerta: salir de la banda es más informativo
            que un pico aislado, porque implica un desvío sostenido respecto
            del comportamiento modelado. La misma banda es el criterio de
            depuración: lo que cae fuera se descarta y la media se recalcula.
          </p>
          <Ref
            archivo="src/features/datos/models/lineasBase.ts"
            referencia="UPME_RANGO_CONFIANZA"
            linea={61}
          />
        </>
      ),
      p(
        'iso-50006',
        '¿Por qué el área útil se declara como estimación ISO 50006/IPMVP y no como dato de la resolución?',
        <>
          <p>
            Por rigor. El reparto por área útil y factor de infraestructura
            sigue el enfoque de línea base del{' '}
            <strong>IPMVP</strong> y los principios de{' '}
            <strong>ISO 50006</strong> para caracterizar el uso de energía,
            no una tabla numérica de la Resolución UPME 0016.
          </p>
          <p className="mt-2">
            El texto oficial de la Resolución 16 de 2024 está verificado en{' '}
            <code className="ui-chip">docs/resolucion_upme_0016_2024.md</code>{' '}
            y lo codificado aquí corresponde al §7.5 (depuración por mes con
            recomputo —banda ±10 % de la ec. 3, con la ec. 4-5 evaluada por
            mes cuando n ≥ 10 (D1)—, regla 3×12, p ≤ 0,05,
            MAPE del Anexo 3). Lo que sí es
            estimación propia —sin respaldo numérico en la resolución— es el
            reparto por área y factor de infraestructura (enfoque ISO 50006 /
            IPMVP) y el share por modelo de ingeniería.
          </p>
          <p className="mt-2">
            Consecuencia práctica: cuando falta el área, el sistema no
            improvisa un equivalente normativo, conmuta al modelo de
            ingeniería y lo dice con el badge «Share estimado».
          </p>
        </>
      ),
      p(
        'ashrae-55',
        '¿Qué es ASHRAE 55 y por qué aparece en Confort Térmico?',
        <>
          <p>
            Es el estándar ASHRAE 55 para condiciones térmicas en espacios
            ocupados. El modelo implementa el rango de confort adaptativo
            válido para Medellín: de <strong>20,2 °C</strong> a{' '}
            <strong>27,6 °C</strong>, con punto medio en{' '}
            <strong>23,9 °C</strong> —el límite del 80 % de aceptabilidad de
            la Tabla 1 del resumen ejecutivo CEELA/UPME—.
          </p>
          <p className="mt-2">
            A partir de la temperatura promedio del periodo el modelo decide
            el modo (<code className="ui-chip">CONFORT</code>,{' '}
            <code className="ui-chip">CALEFACCIÓN</code> o{' '}
            <code className="ui-chip">ENFRIAMIENTO</code>), calcula{' '}
            <code className="ui-chip">ΔT = T operativa − 23,9 °C</code> y
            estima la energía virtual asociada a esa desviación sobre el
            consumo base.
          </p>
          <p className="mt-2">
            Su puerta de aceptación es que la temperatura caiga dentro del
            rango: no es una métrica estadística como R² o MAPE, sino una
            verificación de condición operativa.
          </p>
        </>
      ),
    ],
  },
]

function Ref({
  archivo,
  referencia,
  linea,
}: {
  archivo: string
  referencia: string
  linea?: number
}) {
  return (
    <p className="mt-3 font-mono text-[11px] text-gray-400 dark:text-slate-500">
      {archivo} › {referencia}
      {typeof linea === 'number' && <span> (línea {linea})</span>}
    </p>
  )
}

export type LineasBasePreguntasProps = {
  className?: string
}

export function LineasBasePreguntas({ className }: LineasBasePreguntasProps) {
  return (
    <section
      id="lben-preguntas"
      className={`rounded-2xl border border-gray-200 bg-white p-4 md:p-6 dark:border-slate-800 dark:bg-slate-900/60 ${className ?? ''}`}
    >
      <div className="mx-auto max-w-2xl text-center">
        <p className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-uv-lime" aria-hidden />
          Procedimiento · datos · motores · errores · normativa
        </p>
        <h3 className="ui-title mt-1 text-base">
          Preguntas y respuestas sobre LBEn
        </h3>
        <p className="ui-muted mt-1 text-sm">
          Cómo funciona el cálculo por dentro, qué datos necesita, qué hace
          cada motor, qué significa cada error y con qué criterio normativo se
          evalúa. Las referencias citan el archivo, la función y la línea del
          código real.
        </p>
      </div>

      <div className="mt-6 space-y-7">
        {CATEGORIAS.map((cat) => (
          <div key={cat.id}>
            <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <span
                className="h-1.5 w-1.5 rounded-full bg-uv-lime"
                aria-hidden
              />
              {cat.titulo}
              <span className="font-normal normal-case tracking-normal text-gray-400 dark:text-slate-500">
                · {cat.preguntas.length} preguntas
              </span>
            </h4>

            <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 dark:border-slate-800">
              {cat.preguntas.map((item) => (
                <details
                  key={item.id}
                  id={`lben-p-${item.id}`}
                  className="group border-t border-gray-100 bg-white first:border-t-0 odd:bg-gray-50/60 dark:border-slate-800 dark:bg-slate-900 dark:odd:bg-slate-900/40"
                >
                  <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 text-sm font-semibold text-gray-900 transition-colors hover:text-emerald-700 focus-ring dark:text-gray-100 dark:hover:text-emerald-300 [&::-webkit-details-marker]:hidden">
                    <Chevron />
                    <span>{item.q}</span>
                  </summary>
                  <div className="px-4 pb-4 pl-10 text-sm leading-relaxed text-gray-600 dark:text-slate-300">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

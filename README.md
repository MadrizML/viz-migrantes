# Las rutas de los que no llegaron

Visualización interactiva de los migrantes muertos y desaparecidos en América entre 2014 y 2026,
construida con D3.js a partir del **Missing Migrants Project** de la OIM.

Proyecto personal de la asignatura Visualización de Datos (UOC), PR2.

## Qué contiene

Una página web estática con cuatro vistas, una por cada pregunta del proyecto:

1. **Mapa** de incidentes geolocalizados (tamaño = número de víctimas, color = causa).
2. **Línea de tiempo** de área apilada por subregión, 2014-2026.
3. **Diagrama de Sankey** que enlaza país de origen, ruta migratoria y subregión del incidente.
4. **Perfil de causas y demografía**, que hace visible la ausencia de datos como dato en sí.

## Estructura

```
index.html        una sola página, cuatro secciones
css/style.css     estilos (paleta accesible, diseño sobrio)
js/               una vista por archivo + main.js (orquestador)
data/             datos preprocesados (CSV y JSON)
lib/              D3 v7, d3-sankey, topojson-client y geometría de países (vendorizados, sin CDN)
```

Los datos de `data/` se generan con `../prepare_data.py` a partir del CSV original de la PR1.

## Datos y licencia

Fuente: **IOM's Missing Migrants Project**, <https://missingmigrants.iom.int/>.
Los datos son de libre uso y adaptación con la atribución correspondiente a la OIM.

Subconjunto usado: región América (Norteamérica, Centroamérica, Sudamérica y Caribe),
7.105 incidentes y 11.472 muertes y desapariciones, 2014 a 2026.

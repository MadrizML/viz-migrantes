/* =========================================================================
   map.js — Vista 1: ¿Dónde mueren?
   Mapa de América con un punto por incidente. Tamaño = muertes+desaparecidos,
   color = causa. Interacción: zoom/pan, slider de año, zoom al Darién, tooltip.
   ========================================================================= */

function initMap(incidents, ctx) {
  const { CAUSE_COLORS, Tooltip } = ctx;
  const svg = d3.select("#map-svg");
  const node = svg.node();

  // Coordenadas aproximadas del Tapón del Darién para el botón de zoom.
  const DARIEN = { lon: -77.3, lat: 8.6 };

  let yearFilter = null; // null = todos los años
  let landFeatures = null;
  let projection, path, zoom, gMap, gPoints;
  let causesPresent = [];

  // Estado de filtrado por causa desde la leyenda.
  const hiddenCauses = new Set();

  // Escala de tamaño por número de víctimas (raíz para área proporcional).
  const maxToll = d3.max(incidents, (d) => d.toll) || 1;
  const rScale = d3.scaleSqrt().domain([1, maxToll]).range([2.2, 22]);

  // Carga del mundo (TopoJSON) una sola vez.
  function loadLand() {
    if (landFeatures) return Promise.resolve(landFeatures);
    return d3.json("lib/countries-110m.json").then((topo) => {
      landFeatures = topojson.feature(topo, topo.objects.countries).features;
      return landFeatures;
    });
  }

  function buildLegend() {
    causesPresent = Array.from(new Set(incidents.map((d) => d.cause)))
      .filter((c) => CAUSE_COLORS[c])
      .sort((a, b) => d3.descending(
        incidents.filter((d) => d.cause === a).length,
        incidents.filter((d) => d.cause === b).length
      ));
    const legend = d3.select("#map-legend");
    legend.selectAll("*").remove();
    legend.selectAll(".item")
      .data(causesPresent)
      .join("span")
      .attr("class", "item")
      .each(function (c) {
        const item = d3.select(this);
        item.append("span").attr("class", "swatch").style("background", CAUSE_COLORS[c]);
        item.append("span").text(c);
      })
      .on("click", function (event, c) {
        if (hiddenCauses.has(c)) hiddenCauses.delete(c);
        else hiddenCauses.add(c);
        d3.select(this).classed("dimmed", hiddenCauses.has(c));
        drawPoints();
      });
  }

  function visibleData() {
    return incidents.filter((d) => {
      if (hiddenCauses.has(d.cause)) return false;
      if (yearFilter !== null && d.year > yearFilter) return false;
      return d.lat != null && d.lon != null;
    });
  }

  // Datos visibles ordenados + índice espacial para el tooltip por cercanía.
  let drawn = [];
  let delaunay = null;
  let highlighted = null; // dato actualmente resaltado

  function baseStyle(sel, k) {
    sel.attr("fill-opacity", 0.72)
      .attr("stroke", "#fff")
      .attr("stroke-opacity", 0.45)
      .attr("stroke-width", 0.6 / Math.sqrt(k));
  }

  function drawPoints() {
    const k = d3.zoomTransform(svg.node()).k || 1;
    drawn = visibleData()
      .slice()
      .sort((a, b) => d3.descending(a.toll, b.toll)); // grandes debajo

    // Posición proyectada (en coordenadas del grupo, sin el transform del zoom).
    drawn.forEach((d) => {
      const p = projection([d.lon, d.lat]);
      d._x = p[0];
      d._y = p[1];
    });

    gPoints.selectAll("circle")
      .data(drawn, (d) => `${d._x}|${d._y}|${d.toll}`)
      .join(
        (enter) => enter.append("circle")
          .attr("r", (d) => rScale(Math.max(d.toll, 1)) / Math.sqrt(k))
          .attr("cx", (d) => d._x)
          .attr("cy", (d) => d._y)
          .attr("fill", (d) => CAUSE_COLORS[d.cause] || "#999")
          .call((s) => baseStyle(s, k)),
        (update) => update
          .attr("cx", (d) => d._x)
          .attr("cy", (d) => d._y)
          .attr("r", (d) => rScale(Math.max(d.toll, 1)) / Math.sqrt(k))
          .attr("fill", (d) => CAUSE_COLORS[d.cause] || "#999"),
        (exit) => exit.remove()
      );

    // Índice espacial para localizar el punto más cercano al cursor.
    delaunay = d3.Delaunay.from(drawn, (d) => d._x, (d) => d._y);
    highlighted = null;
  }

  // Resalta el punto más cercano al cursor.
  function handleMove(event) {
    if (!delaunay || !drawn.length) return;
    const t = d3.zoomTransform(svg.node());
    const [px, py] = d3.pointer(event, svg.node());
    // Convertir coordenadas de pantalla a coordenadas del grupo (deshacer zoom).
    const gx = (px - t.x) / t.k;
    const gy = (py - t.y) / t.k;
    const idx = delaunay.find(gx, gy);
    const d = drawn[idx];
    if (!d) return;

    // Umbral: solo activar si el cursor está dentro del punto (más un margen),
    // para no mostrar el tooltip en zonas vacías del mapa.
    const k = t.k;
    const radius = rScale(Math.max(d.toll, 1)) / Math.sqrt(k);
    const dist = Math.hypot(gx - d._x, gy - d._y);
    if (dist > radius + 6 / k) {
      handleLeave();
      return;
    }

    if (d !== highlighted) {
      // Restaurar el anterior.
      gPoints.selectAll("circle").filter((c) => c === highlighted)
        .attr("fill-opacity", 0.72).attr("stroke-opacity", 0.45).attr("stroke-width", 0.6 / Math.sqrt(k));
      // Resaltar el nuevo y traerlo al frente.
      gPoints.selectAll("circle").filter((c) => c === d)
        .raise().attr("fill-opacity", 1).attr("stroke-opacity", 1).attr("stroke-width", 1.4 / Math.sqrt(k));
      highlighted = d;
    }
    Tooltip.show(
      `<strong>${d.country} · ${d.year}</strong><br>` +
      `<span class="t-sub">Ruta:</span> ${d.route}<br>` +
      `<span class="t-sub">Origen:</span> ${d.origin}<br>` +
      `<span class="t-sub">Causa:</span> ${d.cause}<br>` +
      `<strong>${d.toll}</strong> muerto(s) o desaparecido(s)`,
      event
    );
  }

  function handleLeave() {
    if (highlighted) {
      const k = d3.zoomTransform(svg.node()).k;
      gPoints.selectAll("circle").filter((c) => c === highlighted)
        .attr("fill-opacity", 0.72).attr("stroke-opacity", 0.45).attr("stroke-width", 0.6 / Math.sqrt(k));
      highlighted = null;
    }
    Tooltip.hide();
  }

  function draw() {
    const width = node.clientWidth || 800;
    const height = node.clientHeight || 560;
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    svg.selectAll("*").remove();

    // Proyección centrada en América, encajada a la ventana de los puntos.
    projection = d3.geoMercator();
    path = d3.geoPath(projection);

    // Ajustar a un bounding box de América (lon -125..-55, lat -35..50).
    const americasBox = {
      type: "Polygon",
      coordinates: [[[-125, 50], [-55, 50], [-55, -35], [-125, -35], [-125, 50]]],
    };
    projection.fitExtent([[10, 10], [width - 10, height - 10]], americasBox);

    // Rect de fondo transparente.
    svg.append("rect")
      .attr("width", width).attr("height", height)
      .attr("fill", "transparent");

    gMap = svg.append("g").attr("class", "map-layer");
    gPoints = svg.append("g").attr("class", "points-layer");
    // Los círculos no capturan eventos, el tooltip se resuelve por cercanía
    // a nivel del SVG, así un punto tapado por otro sigue siendo accesible.
    gPoints.attr("pointer-events", "none");
    gMap.attr("pointer-events", "none");

    // Tierra de fondo.
    loadLand().then((features) => {
      gMap.selectAll("path")
        .data(features)
        .join("path")
        .attr("d", path)
        .attr("fill", "#dfe7ea")
        .attr("stroke", "#c2ced3")
        .attr("stroke-width", 0.5);
      drawPoints();
    });

    // Zoom y pan.
    zoom = d3.zoom()
      .scaleExtent([1, 40])
      .on("zoom", (event) => {
        const k = event.transform.k;
        gMap.attr("transform", event.transform);
        gPoints.attr("transform", event.transform);
        // El radio se reduce con el zoom pero menos que proporcionalmente (raíz),
        // para que los puntos no desaparezcan al acercar. El borde se escala igual
        // que el radio para que el contorno no domine al punto.
        gPoints.selectAll("circle")
          .attr("r", (d) => rScale(Math.max(d.toll, 1)) / Math.sqrt(k))
          .attr("stroke-width", (c) => (c === highlighted ? 1.4 : 0.6) / Math.sqrt(k));
        gMap.selectAll("path").attr("stroke-width", 0.5 / k);
      });
    svg.call(zoom);

    // Evita que la rueda haga scroll de la página al llegar al tope del zoom.
    node.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });

    // Tooltip por cercanía: capturado a nivel del SVG.
    svg.on("mousemove", handleMove).on("mouseleave", handleLeave);

    buildLegend();
    setupControls();
  }

  function setupControls() {
    const slider = document.getElementById("map-year");
    const out = document.getElementById("map-year-out");
    const btnAll = document.getElementById("map-all");
    const btnDarien = document.getElementById("map-darien");
    const btnReset = document.getElementById("map-reset");

    slider.oninput = () => {
      yearFilter = +slider.value;
      out.textContent = `Hasta ${slider.value}`;
      btnAll.classList.remove("active");
      drawPoints();
    };

    btnAll.onclick = () => {
      yearFilter = null;
      slider.value = slider.max;
      out.textContent = `Todos hasta ${slider.max}`;
      btnAll.classList.add("active");
      drawPoints();
    };

    btnDarien.onclick = () => {
      const [x, y] = projection([DARIEN.lon, DARIEN.lat]);
      const width = node.clientWidth, height = node.clientHeight;
      svg.transition().duration(900).call(
        zoom.transform,
        d3.zoomIdentity.translate(width / 2, height / 2).scale(6).translate(-x, -y)
      );
    };

    btnReset.onclick = () => {
      svg.transition().duration(700).call(zoom.transform, d3.zoomIdentity);
    };
  }

  return draw;
}

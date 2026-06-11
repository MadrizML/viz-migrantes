/* =========================================================================
   timeline.js — Vista 2: ¿Cómo ha crecido?
   Área apilada por subregión, 2014-2026. Toggle muertes/incidentes,
   leyenda clicable para aislar subregiones, años parciales atenuados.
   ========================================================================= */

function initTimeline(byYear, ctx) {
  const { SUBREGION_COLORS, Tooltip } = ctx;
  const svg = d3.select("#timeline-svg");
  const node = svg.node();

  const subregions = byYear.subregions;
  const partialYears = new Set(byYear.partial_years);
  let metric = "toll"; // "toll" | "incidents"
  const hidden = new Set();

  // Reorganiza la serie a un array plano por año con un valor por subregión.
  function flatten() {
    return byYear.series.map((row) => {
      const o = { year: row.year, partial: row.partial };
      subregions.forEach((s) => {
        o[s] = hidden.has(s) ? 0 : row[s][metric];
      });
      return o;
    });
  }

  function draw() {
    const width = node.clientWidth || 800;
    const height = node.clientHeight || 440;
    const margin = { top: 20, right: 20, bottom: 40, left: 60 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    svg.attr("viewBox", `0 0 ${width} ${height}`);
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const data = flatten();
    const activeSubs = subregions.filter((s) => !hidden.has(s));
    const stack = d3.stack().keys(activeSubs);
    const series = stack(data);

    const x = d3.scaleLinear()
      .domain(d3.extent(data, (d) => d.year))
      .range([0, innerW]);

    const yMax = d3.max(series, (layer) => d3.max(layer, (d) => d[1])) || 1;
    const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);

    // Cuadrícula horizontal.
    g.append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(y).ticks(5).tickSize(-innerW).tickFormat(""));

    // Ejes.
    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(13));
    g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("~s")));

    // Etiqueta del eje Y.
    g.append("text")
      .attr("x", -innerH / 2).attr("y", -46)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .attr("class", "bar-label")
      .text(metric === "toll" ? "muertes y desapariciones" : "incidentes");

    const area = d3.area()
      .x((d) => x(d.data.year))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(d3.curveMonotoneX);

    g.selectAll(".layer")
      .data(series)
      .join("path")
      .attr("class", "layer")
      .attr("fill", (d) => SUBREGION_COLORS[d.key])
      .attr("fill-opacity", 0.85)
      .attr("d", area)
      .on("mousemove", function (event, layer) {
        const xy = d3.pointer(event, this);
        const year = Math.round(x.invert(xy[0]));
        const row = data.find((r) => r.year === year);
        if (!row) return;
        Tooltip.show(
          `<strong>${layer.key} · ${year}${partialYears.has(year) ? " (parcial)" : ""}</strong><br>` +
          `<strong>${fmt(row[layer.key])}</strong> ${metric === "toll" ? "muertes y desapariciones" : "incidentes"}`,
          event
        );
      })
      .on("mouseleave", () => Tooltip.hide());

    // Marcar años parciales con una banda atenuada.
    const partialData = data.filter((d) => d.partial);
    if (partialData.length) {
      const firstPartial = d3.min(partialData, (d) => d.year);
      g.append("rect")
        .attr("x", x(firstPartial - 0.5))
        .attr("width", innerW - x(firstPartial - 0.5))
        .attr("y", 0).attr("height", innerH)
        .attr("fill", "#ffffff").attr("fill-opacity", 0.45)
        .attr("pointer-events", "none");
      g.append("text")
        .attr("x", x(firstPartial)).attr("y", 12)
        .attr("class", "null-label")
        .attr("text-anchor", "start")
        .text("años parciales");
    }

    buildLegend();
    setupControls();
  }

  function buildLegend() {
    const legend = d3.select("#timeline-legend");
    legend.selectAll("*").remove();
    legend.selectAll(".item")
      .data(subregions)
      .join("span")
      .attr("class", "item")
      .classed("dimmed", (s) => hidden.has(s))
      .each(function (s) {
        const item = d3.select(this);
        item.append("span").attr("class", "swatch").style("background", SUBREGION_COLORS[s]);
        item.append("span").text(s);
      })
      .on("click", function (event, s) {
        // No permitir ocultar la última subregión visible.
        if (!hidden.has(s) && hidden.size >= subregions.length - 1) return;
        if (hidden.has(s)) hidden.delete(s);
        else hidden.add(s);
        draw();
      });
  }

  function setupControls() {
    const btnToll = document.getElementById("tl-toll");
    const btnInc = document.getElementById("tl-incidents");
    btnToll.onclick = () => {
      metric = "toll";
      btnToll.classList.add("active");
      btnInc.classList.remove("active");
      draw();
    };
    btnInc.onclick = () => {
      metric = "incidents";
      btnInc.classList.add("active");
      btnToll.classList.remove("active");
      draw();
    };
  }

  return draw;
}

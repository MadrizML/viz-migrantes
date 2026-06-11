/* =========================================================================
   profile.js — Vista 4: ¿Qué sabemos, y qué no?
   Causas de muerte (barras horizontales) + cobertura demográfica con el
   porcentaje de datos ausentes mostrado explícitamente. Filtra por subregión.
   ========================================================================= */

function initProfile(profile, ctx) {
  const { CAUSE_COLORS, Tooltip } = ctx;
  const causesSvg = d3.select("#causes-svg");
  const coverSvg = d3.select("#cover-svg");
  const demoSvg = d3.select("#demo-svg");

  let current = "Todas";

  const DEMO_LABELS = { mujeres: "Mujeres", hombres: "Hombres", menores: "Menores" };
  const DEMO_COLORS = { mujeres: "#9b59b6", hombres: "#2c7fb8", menores: "#e67e22" };
  const MISSING_COLOR = "#c9c4bd"; // gris para el segmento sin dato

  function drawCauses() {
    const node = causesSvg.node();
    const width = node.clientWidth || 600;
    const height = node.clientHeight || 320;
    const margin = { top: 10, right: 60, bottom: 24, left: 200 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    causesSvg.attr("viewBox", `0 0 ${width} ${height}`);
    causesSvg.selectAll("*").remove();
    const g = causesSvg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const block = profile.by_subregion[current].causes;
    const rows = profile.causes
      .map((c) => ({ cause: c, value: block[c] || 0 }))
      .sort((a, b) => d3.descending(a.value, b.value));

    const x = d3.scaleLinear().domain([0, d3.max(rows, (d) => d.value) || 1]).range([0, innerW]);
    const y = d3.scaleBand().domain(rows.map((d) => d.cause)).range([0, innerH]).padding(0.22);

    g.append("g").attr("class", "axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(4).tickFormat(d3.format("~s")));

    g.append("g").attr("class", "axis")
      .call(d3.axisLeft(y).tickSize(0))
      .select(".domain").remove();

    g.selectAll(".bar")
      .data(rows)
      .join("rect")
      .attr("class", "bar")
      .attr("x", 0)
      .attr("y", (d) => y(d.cause))
      .attr("height", y.bandwidth())
      .attr("width", 0)
      .attr("fill", (d) => CAUSE_COLORS[d.cause] || "#999")
      .attr("fill-opacity", 0.88)
      .on("mouseenter", function (event, d) {
        Tooltip.show(`<strong>${d.cause}</strong><br><strong>${fmt(d.value)}</strong> incidentes`, event);
      })
      .on("mousemove", (event) => Tooltip.move(event))
      .on("mouseleave", () => Tooltip.hide())
      .transition().duration(ctx.REDUCED_MOTION ? 0 : 600)
      .attr("width", (d) => x(d.value));

    g.selectAll(".bar-label")
      .data(rows)
      .join("text")
      .attr("class", "bar-label")
      .attr("x", (d) => x(d.value) + 6)
      .attr("y", (d) => y(d.cause) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .text((d) => fmt(d.value));
  }

  // Panel de cobertura: barras horizontales al 100%, registrado vs sin dato.
  function drawCover() {
    const node = coverSvg.node();
    const width = node.clientWidth || 500;
    const height = node.clientHeight || 280;
    const margin = { top: 16, right: 20, bottom: 36, left: 90 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    coverSvg.attr("viewBox", `0 0 ${width} ${height}`);
    coverSvg.selectAll("*").remove();

    // Patrón rayado para el segmento "sin dato".
    const defs = coverSvg.append("defs");
    const pat = defs.append("pattern")
      .attr("id", "hatch")
      .attr("patternUnits", "userSpaceOnUse")
      .attr("width", 6).attr("height", 6)
      .attr("patternTransform", "rotate(45)");
    pat.append("rect").attr("width", 6).attr("height", 6).attr("fill", MISSING_COLOR);
    pat.append("line")
      .attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 6)
      .attr("stroke", "#fff").attr("stroke-width", 2.5);

    const g = coverSvg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const demo = profile.by_subregion[current].demography;
    const keys = ["mujeres", "hombres", "menores"];
    const rows = keys.map((k) => ({ key: k, nullPct: demo[k].null_pct, regPct: 100 - demo[k].null_pct }));

    const x = d3.scaleLinear().domain([0, 100]).range([0, innerW]);
    const y = d3.scaleBand().domain(keys).range([0, innerH]).padding(0.35);

    // Etiqueta de categoría a la izquierda.
    g.selectAll(".cover-cat")
      .data(rows).join("text")
      .attr("class", "cover-cat")
      .attr("x", -10).attr("y", (d) => y(d.key) + y.bandwidth() / 2)
      .attr("dy", "0.35em").attr("text-anchor", "end")
      .text((d) => DEMO_LABELS[d.key]);

    // Segmento registrado (color sólido de la categoría).
    g.selectAll(".reg")
      .data(rows).join("rect")
      .attr("class", "reg")
      .attr("x", 0).attr("y", (d) => y(d.key))
      .attr("height", y.bandwidth())
      .attr("width", 0)
      .attr("fill", (d) => DEMO_COLORS[d.key])
      .attr("fill-opacity", 0.9)
      .on("mouseenter", function (event, d) {
        Tooltip.show(`<strong>${DEMO_LABELS[d.key]}</strong><br>Dato registrado en el <strong>${d.regPct.toFixed(1)}%</strong> de los incidentes`, event);
      })
      .on("mousemove", (event) => Tooltip.move(event))
      .on("mouseleave", () => Tooltip.hide())
      .transition().duration(ctx.REDUCED_MOTION ? 0 : 600)
      .attr("width", (d) => x(d.regPct));

    // Segmento sin dato (rayado), llamativo.
    g.selectAll(".missing")
      .data(rows).join("rect")
      .attr("class", "missing")
      .attr("x", innerW).attr("y", (d) => y(d.key))
      .attr("height", y.bandwidth())
      .attr("width", 0)
      .attr("fill", "url(#hatch)")
      .on("mouseenter", function (event, d) {
        Tooltip.show(`<strong>${DEMO_LABELS[d.key]}</strong><br>Sin dato en el <strong>${d.nullPct}%</strong> de los incidentes`, event);
      })
      .on("mousemove", (event) => Tooltip.move(event))
      .on("mouseleave", () => Tooltip.hide())
      .transition().duration(ctx.REDUCED_MOTION ? 0 : 600)
      .attr("x", (d) => x(d.regPct))
      .attr("width", (d) => x(d.nullPct));

    // % sin dato, en rojo con halo blanco, justo dentro del segmento rayado.
    g.selectAll(".cover-pct")
      .data(rows).join("text")
      .attr("class", "cover-pct")
      .attr("y", (d) => y(d.key) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "start")
      .attr("x", (d) => x(d.regPct) + 8)
      .text((d) => `${d.nullPct}% sin dato`)
      .attr("opacity", 0)
      .transition().delay(ctx.REDUCED_MOTION ? 0 : 500).duration(ctx.REDUCED_MOTION ? 0 : 300)
      .attr("opacity", 1);

    // Eje X en porcentaje.
    g.append("g").attr("class", "axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat((d) => d + "%"));

    // Mini-leyenda.
    const leg = g.append("g").attr("transform", `translate(0,${innerH + 24})`);
    leg.append("rect").attr("width", 12).attr("height", 12).attr("fill", DEMO_COLORS.hombres).attr("fill-opacity", 0.9);
    leg.append("text").attr("x", 17).attr("y", 10).attr("class", "cover-cat").style("font-weight", 400).text("registrado");
    leg.append("rect").attr("x", 110).attr("width", 12).attr("height", 12).attr("fill", "url(#hatch)");
    leg.append("text").attr("x", 127).attr("y", 10).attr("class", "cover-cat").style("font-weight", 400).text("sin registrar");
  }

  function drawDemo() {
    const node = demoSvg.node();
    const width = node.clientWidth || 500;
    const height = node.clientHeight || 280;
    const margin = { top: 24, right: 20, bottom: 40, left: 70 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    demoSvg.attr("viewBox", `0 0 ${width} ${height}`);
    demoSvg.selectAll("*").remove();
    const g = demoSvg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const demo = profile.by_subregion[current].demography;
    const keys = ["mujeres", "hombres", "menores"];
    const rows = keys.map((k) => ({ key: k, sum: demo[k].sum, nullPct: demo[k].null_pct }));

    const x = d3.scaleBand().domain(keys).range([0, innerW]).padding(0.35);
    const y = d3.scaleLinear().domain([0, d3.max(rows, (d) => d.sum) || 1]).nice().range([innerH, 0]);

    g.append("g").attr("class", "axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickFormat((k) => DEMO_LABELS[k]).tickSize(0));
    g.append("g").attr("class", "axis")
      .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format("~s")));

    // Barras (personas contabilizadas).
    g.selectAll(".dbar")
      .data(rows)
      .join("rect")
      .attr("class", "dbar")
      .attr("x", (d) => x(d.key))
      .attr("width", x.bandwidth())
      .attr("y", innerH)
      .attr("height", 0)
      .attr("fill", (d) => DEMO_COLORS[d.key])
      .attr("fill-opacity", 0.85)
      .on("mouseenter", function (event, d) {
        Tooltip.show(
          `<strong>${DEMO_LABELS[d.key]}</strong><br>` +
          `<strong>${fmt(d.sum)}</strong> personas contabilizadas`,
          event
        );
      })
      .on("mousemove", (event) => Tooltip.move(event))
      .on("mouseleave", () => Tooltip.hide())
      .transition().duration(ctx.REDUCED_MOTION ? 0 : 600)
      .attr("y", (d) => y(d.sum))
      .attr("height", (d) => innerH - y(d.sum));

    // Número de personas sobre cada barra.
    g.selectAll(".bar-label")
      .data(rows)
      .join("text")
      .attr("class", "bar-label")
      .attr("x", (d) => x(d.key) + x.bandwidth() / 2)
      .attr("y", (d) => y(d.sum) - 6)
      .attr("text-anchor", "middle")
      .text((d) => fmt(d.sum));
  }

  function draw() {
    drawCauses();
    drawCover();
    drawDemo();
  }

  function setupControls() {
    const select = document.getElementById("profile-sub");
    select.innerHTML = "";
    profile.subregions.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      select.appendChild(opt);
    });
    select.value = current;
    select.onchange = () => {
      current = select.value;
      draw();
    };
  }

  setupControls();
  return draw;
}

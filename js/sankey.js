/* =========================================================================
   sankey.js — Vista 3: ¿Quién, y por qué ruta?
   Diagrama Sankey origen -> ruta -> subregión. Ancho = muertes+desaparecidos.
   Resalta el recorrido completo al pasar el cursor. Foco en Venezuela y Darién.
   ========================================================================= */

function initSankey(data, ctx) {
  const { SUBREGION_COLORS, Tooltip } = ctx;
  const svg = d3.select("#sankey-svg");
  const node = svg.node();

  // Nodos destacados narrativamente.
  const HIGHLIGHT = new Set(["Venezuela", "Tapón del Darién"]);

  // Color de nodo según su rol o destacado.
  function nodeColor(name) {
    if (name === "Venezuela") return "#b03a2e";
    if (name === "Tapón del Darién") return "#c0563f";
    if (SUBREGION_COLORS[name]) return SUBREGION_COLORS[name];
    return "#6b7b8c";
  }

  function draw() {
    const width = node.clientWidth || 900;
    const height = node.clientHeight || 600;
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    svg.selectAll("*").remove();

    const sankey = d3.sankey()
      .nodeId((d) => d.index)
      .nodeWidth(16)
      .nodePadding(12)
      .extent([[10, 10], [width - 10, height - 16]]);

    // d3-sankey muta el grafo, así que clonamos.
    const graph = sankey({
      nodes: data.nodes.map((d, i) => ({ ...d, index: i })),
      links: data.links.map((d) => ({ ...d })),
    });

    // Enlaces.
    const link = svg.append("g")
      .attr("fill", "none")
      .selectAll("path")
      .data(graph.links)
      .join("path")
      .attr("d", d3.sankeyLinkHorizontal())
      .attr("stroke", (d) => nodeColor(d.source.name))
      .attr("stroke-opacity", 0.32)
      .attr("stroke-width", (d) => Math.max(1, d.width))
      .on("mouseenter", function (event, d) {
        d3.select(this).attr("stroke-opacity", 0.7);
        Tooltip.show(
          `<strong>${d.source.name} → ${d.target.name}</strong><br>` +
          `<strong>${fmt(d.value)}</strong> muertes y desapariciones`,
          event
        );
      })
      .on("mousemove", (event) => Tooltip.move(event))
      .on("mouseleave", function () {
        d3.select(this).attr("stroke-opacity", 0.32);
        Tooltip.hide();
      });

    // Nodos.
    const nodeG = svg.append("g").selectAll("g")
      .data(graph.nodes)
      .join("g");

    nodeG.append("rect")
      .attr("x", (d) => d.x0)
      .attr("y", (d) => d.y0)
      .attr("height", (d) => Math.max(1, d.y1 - d.y0))
      .attr("width", (d) => d.x1 - d.x0)
      .attr("fill", (d) => nodeColor(d.name))
      .attr("stroke", (d) => HIGHLIGHT.has(d.name) ? "#1d1d1f" : "none")
      .attr("stroke-width", 1.2)
      .style("cursor", "pointer")
      .on("mouseenter", function (event, d) {
        // Resalta los enlaces conectados a este nodo.
        link.attr("stroke-opacity", (l) =>
          l.source.index === d.index || l.target.index === d.index ? 0.75 : 0.08
        );
        Tooltip.show(
          `<strong>${d.name}</strong><br>` +
          `<strong>${fmt(d.value)}</strong> muertes y desapariciones`,
          event
        );
      })
      .on("mousemove", (event) => Tooltip.move(event))
      .on("mouseleave", function () {
        link.attr("stroke-opacity", 0.32);
        Tooltip.hide();
      });

    // Etiquetas de nodo (a la izquierda si están en la mitad derecha).
    nodeG.append("text")
      .attr("x", (d) => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
      .attr("y", (d) => (d.y1 + d.y0) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (d) => d.x0 < width / 2 ? "start" : "end")
      .attr("font-size", "12px")
      .attr("fill", (d) => HIGHLIGHT.has(d.name) ? "#b03a2e" : "#4a4a4f")
      .attr("font-weight", (d) => HIGHLIGHT.has(d.name) ? "700" : "400")
      .text((d) => d.name)
      .style("pointer-events", "none");
  }

  return draw;
}

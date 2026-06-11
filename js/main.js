/* =========================================================================
   main.js — orquestador
   Carga los datos, reparte a cada vista, gestiona el tooltip compartido,
   la barra de progreso de lectura y la aparición de secciones al hacer scroll.
   ========================================================================= */

// Paletas compartidas entre vistas.
const CAUSE_COLORS = {
  "Ahogamiento": "#0072b2",
  "Condiciones ambientales extremas": "#e69f00",
  "Accidente de transporte": "#56b4e9",
  "Violencia": "#d55e00",
  "Enfermedad o falta de atención": "#009e73",
  "Muerte accidental": "#cc79a7",
  "Mixta o desconocida": "#999999",
};

const SUBREGION_COLORS = {
  "Norteamérica": "#264653",
  "Centroamérica": "#2a9d8f",
  "Sudamérica": "#e9c46a",
  "Caribe": "#e76f51",
};

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Formateador con separador de miles consistente.
const NF = new Intl.NumberFormat("es-ES", { useGrouping: "always" });
function fmt(n) {
  try { return NF.format(n); }
  catch { return n.toLocaleString("es-ES"); }
}

/* ---------- Tooltip compartido ---------- */
const Tooltip = (() => {
  const el = document.getElementById("tooltip");
  return {
    show(html, event) {
      el.innerHTML = html;
      el.classList.add("visible");
      el.setAttribute("aria-hidden", "false");
      this.move(event);
    },
    move(event) {
      const pad = 14;
      let x = event.clientX + pad;
      let y = event.clientY + pad;
      const r = el.getBoundingClientRect();
      if (x + r.width > window.innerWidth) x = event.clientX - r.width - pad;
      if (y + r.height > window.innerHeight) y = event.clientY - r.height - pad;
      el.style.left = x + "px";
      el.style.top = y + "px";
    },
    hide() {
      el.classList.remove("visible");
      el.setAttribute("aria-hidden", "true");
    },
  };
})();

/* ---------- Barra de progreso de lectura ---------- */
function setupProgressBar() {
  const bar = document.getElementById("progress-bar");
  function update() {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const pct = h > 0 ? (window.scrollY / h) * 100 : 0;
    bar.style.width = pct + "%";
  }
  window.addEventListener("scroll", update, { passive: true });
  update();
}

/* ---------- Aparición de secciones ---------- */
function setupReveal(drawnCallbacks) {
  const sections = document.querySelectorAll(".view");
  if (!REDUCED_MOTION) sections.forEach((s) => s.classList.add("reveal"));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("shown");
        const id = entry.target.id;
        if (drawnCallbacks[id] && !drawnCallbacks[id].done) {
          drawnCallbacks[id].draw();
          drawnCallbacks[id].done = true;
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
  );
  sections.forEach((s) => observer.observe(s));
}

/* ---------- Redibujo en resize ---------- */
function setupResize(drawnCallbacks) {
  let t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      Object.values(drawnCallbacks).forEach((cb) => {
        if (cb.done) cb.draw();
      });
    }, 200);
  });
}

/* ---------- Animación de los contadores de la portada ---------- */
function animateCounters() {
  if (REDUCED_MOTION) return;
  document.querySelectorAll(".stat-num[data-count]").forEach((el) => {
    const target = +el.dataset.count;
    const dur = 1400;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

/* ---------- Arranque ---------- */
async function init() {
  setupProgressBar();
  animateCounters();

  // Carga de datos en paralelo.
  let incidents, byYear, sankeyData, profile;
  try {
    [incidents, byYear, sankeyData, profile] = await Promise.all([
      d3.csv("data/incidents.csv", d3.autoType),
      d3.json("data/by_year.json"),
      d3.json("data/sankey.json"),
      d3.json("data/profile.json"),
    ]);
  } catch (err) {
    console.error("Error cargando datos:", err);
    document.querySelectorAll(".view-stage").forEach((s) => {
      s.innerHTML = '<p style="color:#b03a2e">No se pudieron cargar los datos. Sirve la carpeta con un servidor (por ejemplo <code>python -m http.server</code>) en lugar de abrir el archivo directamente.</p>';
    });
    return;
  }

  const ctx = { CAUSE_COLORS, SUBREGION_COLORS, REDUCED_MOTION, Tooltip };

  // Cada vista expone una función initX(data, ctx) que devuelve { draw }.
  const callbacks = {
    "view-map": { draw: initMap(incidents, ctx), done: false },
    "view-timeline": { draw: initTimeline(byYear, ctx), done: false },
    "view-sankey": { draw: initSankey(sankeyData, ctx), done: false },
    "view-profile": { draw: initProfile(profile, ctx), done: false },
  };

  setupReveal(callbacks);
  setupResize(callbacks);
}

document.addEventListener("DOMContentLoaded", init);

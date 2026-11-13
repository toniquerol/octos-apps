// Ajuste de las columnas laterales de Rain; no afecta al motor de simulación.
(() => {
  const main = document.querySelector("main");
  const aside = main?.querySelector("aside");
  const panes = [document.getElementById("rainSimulationPane"), document.getElementById("rainLayerPane")];
  const handles = [...document.querySelectorAll("[data-resize-panel]")];
  if (!main || !aside || panes.some(pane => !pane) || handles.length !== 2) return;

  const MIN_PANE = 190;
  const MIN_MAP = 320;
  const GUTTERS = 16;
  const KEY = "octos-rain-panel-widths";
  let preferred = panes.map(pane => pane.getBoundingClientRect().width); // 8 cm por panel inicialmente
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(saved) && saved.length === 2 && saved.every(width => Number.isFinite(width) && width >= MIN_PANE)) {
      preferred = saved;
    }
  } catch (_) { /* El almacenamiento puede no estar habilitado. */ }

  function available() {
    return Math.max(MIN_PANE * 2, main.clientWidth - MIN_MAP - GUTTERS);
  }
  function applyWidths() {
    let [left, right] = preferred.map(width => Math.max(MIN_PANE, width));
    const maxTotal = available();
    if (left + right > maxTotal) {
      const reducibleLeft = left - MIN_PANE;
      const reducibleTotal = left + right - 2 * MIN_PANE;
      left -= reducibleTotal ? (left + right - maxTotal) * reducibleLeft / reducibleTotal : 0;
      right = maxTotal - left;
    }
    aside.style.setProperty("--rain-sim-width", left + "px");
    aside.style.setProperty("--rain-layers-width", right + "px");
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(preferred)); } catch (_) {}
  }

  let raf = 0;
  function refreshMap() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      window.dispatchEvent(new Event("resize"));
    });
  }

  function adjust(index, width, other) {
    const upper = Math.max(MIN_PANE, available() - other);
    preferred[index] = Math.max(MIN_PANE, Math.min(upper, width));
    preferred[1 - index] = other;
    applyWidths();
    refreshMap();
  }

  handles.forEach((handle, index) => {
    let drag = null;
    handle.addEventListener("pointerdown", event => {
      if (event.button !== 0 || matchMedia("(max-width:760px)").matches) return;
      drag = {
        id: event.pointerId, x: event.clientX,
        width: panes[index].getBoundingClientRect().width,
        other: panes[1 - index].getBoundingClientRect().width
      };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    handle.addEventListener("pointermove", event => {
      if (drag?.id !== event.pointerId) return;
      adjust(index, drag.width + event.clientX - drag.x, drag.other);
    });
    const endDrag = event => {
      if (drag?.id !== event.pointerId) return;
      drag = null;
      save();
      refreshMap();
    };
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
    handle.addEventListener("keydown", event => {
      const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (!direction || matchMedia("(max-width:760px)").matches) return;
      event.preventDefault();
      adjust(index, panes[index].getBoundingClientRect().width + 16 * direction, panes[1 - index].getBoundingClientRect().width);
      save();
    });
  });

  applyWidths();
  window.addEventListener("resize", applyWidths);
})();

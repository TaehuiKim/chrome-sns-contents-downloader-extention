// content/injector.js
// Injects a download button into media containers and keeps it attached
// as the SPA mutates the DOM (infinite scroll, navigation).

globalThis.MediaDL = globalThis.MediaDL || {};

(function (MediaDL) {
  "use strict";

  const MARKER = "mediadlAttached"; // dataset key -> data-mediadl-attached
  const STYLE_ID = "mediadl-style";

  const DOWNLOAD_ICON = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round"
         stroke-linejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>`;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .mediadl-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 2147483646;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        padding: 0;
        border: none;
        border-radius: 9999px;
        background: rgba(0, 0, 0, 0.65);
        color: #fff;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.15s ease, background 0.15s ease, transform 0.1s ease;
        backdrop-filter: blur(2px);
      }
      .mediadl-host:hover .mediadl-btn { opacity: 1; }
      .mediadl-btn:hover { background: rgba(0, 0, 0, 0.85); }
      .mediadl-btn:active { transform: scale(0.92); }
      .mediadl-btn.mediadl-done { background: rgba(0, 150, 60, 0.9); }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function makeButton(container, extract) {
    const btn = document.createElement("button");
    btn.className = "mediadl-btn";
    btn.type = "button";
    btn.title = "Download media";
    btn.setAttribute("aria-label", "Download media");
    btn.innerHTML = DOWNLOAD_ICON;

    let busy = false;
    function onActivate(e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      if (busy) return; // pointerdown + click both fire; only act once
      busy = true;
      setTimeout(() => (busy = false), 600);
      if (MediaDL.log) MediaDL.log("button clicked", e.type);
      try {
        if (typeof extract !== "function") return;
        const items = extract(container);
        if (MediaDL.log) MediaDL.log("extract returned", items.length, "item(s)");
        if (!items.length) return; // extractor already logs the reason
        items.forEach((item) => {
          if (MediaDL.log) MediaDL.log("requesting download:", item.filename, item.url);
          MediaDL.requestDownload(item);
        });
        btn.classList.add("mediadl-done");
        setTimeout(() => btn.classList.remove("mediadl-done"), 1200);
      } catch (err) {
        console.error("[MediaDL] click handler error:", err);
      }
    }

    // Use pointerdown in the capture phase so X's own video overlay can't
    // swallow the interaction before our handler runs.
    btn.addEventListener("pointerdown", onActivate, true);
    btn.addEventListener("click", onActivate, true);

    return btn;
  }

  function attachToContainer(container, extract) {
    if (!container || container.dataset[MARKER]) return;
    container.dataset[MARKER] = "1";

    // The button is absolutely positioned; the container needs a
    // positioning context. Mark it as the hover host.
    container.classList.add("mediadl-host");
    const computed = getComputedStyle(container).position;
    if (computed === "static") {
      container.style.position = "relative";
    }
    container.appendChild(makeButton(container, extract));
  }

  function attachButtons(root) {
    const platform = MediaDL.active;
    if (!platform || !Array.isArray(platform.targets)) return;
    ensureStyles();
    const scope = root && root.querySelectorAll ? root : document;
    platform.targets.forEach((target) => {
      let n = 0;
      scope.querySelectorAll(target.selector).forEach((el) => {
        // Skip containers a target doesn't want (e.g. an image button on a
        // video poster). Don't mark them, so they can qualify later.
        if (target.accept && !target.accept(el)) return;
        if (!el.dataset[MARKER]) n++;
        attachToContainer(el, target.extract);
      });
      if (n && MediaDL.log) MediaDL.log("attached", n, "button(s) for", target.selector);
    });
  }

  // Debounce mutation-driven re-scans.
  let scheduled = false;
  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      attachButtons(document);
    }, 150);
  }

  function startObserver() {
    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
  }

  MediaDL.inject = { attachButtons, startObserver };
})(globalThis.MediaDL);

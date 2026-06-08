// content/platforms/meta_net.js
// MAIN-world sniffer for Instagram and Threads (both run on Meta's backend, so
// they share the same media JSON shape). Wraps fetch / XHR, walks API
// responses for post media (images, videos, carousels), and posts them to the
// isolated content script keyed by shortcode.

(function () {
  "use strict";

  const DEBUG = false; // set true to log intercepted posts
  const API_HINT = /(\/api\/|\/graphql|web_info|polaris)/i;

  function post(posts) {
    if (!posts.length) return;
    if (DEBUG) console.log("[MediaDL/meta] posting posts:", posts.length);
    window.postMessage({ __mediadl: true, type: "meta-media", posts }, "*");
  }

  function bestBy(arr, widthKey, urlKey) {
    const sorted = arr
      .filter((v) => v && v[urlKey])
      .sort((a, b) => (b[widthKey] || 0) - (a[widthKey] || 0));
    return sorted[0] ? sorted[0][urlKey] : null;
  }

  // Pull the highest-resolution media URL(s) out of one media node, recursing
  // into carousels. Returns nothing for the parent of a carousel (only the
  // children carry the real media).
  function gather(node, items) {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node.carousel_media) && node.carousel_media.length) {
      node.carousel_media.forEach((c) => gather(c, items));
      return;
    }
    if (
      node.edge_sidecar_to_children &&
      Array.isArray(node.edge_sidecar_to_children.edges)
    ) {
      node.edge_sidecar_to_children.edges.forEach((e) => gather(e.node, items));
      return;
    }

    // Leaf node: prefer video over its poster image.
    if (Array.isArray(node.video_versions) && node.video_versions.length) {
      const url = bestBy(node.video_versions, "width", "url");
      if (url) items.push({ type: "video", url });
    } else if (node.video_url) {
      items.push({ type: "video", url: node.video_url });
    } else if (
      node.image_versions2 &&
      Array.isArray(node.image_versions2.candidates)
    ) {
      const url = bestBy(node.image_versions2.candidates, "width", "url");
      if (url) items.push({ type: "image", url });
    } else if (Array.isArray(node.display_resources)) {
      const url = bestBy(node.display_resources, "config_width", "src");
      if (url) items.push({ type: "image", url });
    } else if (node.display_url) {
      items.push({ type: "image", url: node.display_url });
    }
  }

  function collect(node, out, depth) {
    if (!node || typeof node !== "object" || depth > 50) return;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) collect(node[i], out, depth + 1);
      return;
    }

    const code = node.code || node.shortcode;
    const hasMedia =
      node.image_versions2 ||
      node.video_versions ||
      node.carousel_media ||
      node.edge_sidecar_to_children ||
      node.display_url ||
      node.video_url;

    if (code && hasMedia) {
      const items = [];
      gather(node, items);
      // De-dupe by url within the post.
      const seen = new Set();
      const unique = items.filter((it) =>
        seen.has(it.url) ? false : (seen.add(it.url), true)
      );
      if (unique.length) {
        const username =
          (node.user && node.user.username) ||
          (node.owner && node.owner.username) ||
          null;
        out.push({ code, username, items: unique });
      }
    }

    for (const k in node) {
      try {
        collect(node[k], out, depth + 1);
      } catch (e) {
        /* ignore throwing getters */
      }
    }
  }

  function handleJson(text) {
    if (!text) return;
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return;
    }
    const out = [];
    collect(data, out, 0);
    post(out);
  }

  // --- wrap fetch ---
  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (...args) {
      const p = origFetch.apply(this, args);
      try {
        const url = typeof args[0] === "string" ? args[0] : args[0] && args[0].url;
        if (url && API_HINT.test(url)) {
          p.then((res) => {
            try {
              res.clone().text().then(handleJson).catch(() => {});
            } catch {}
          }).catch(() => {});
        }
      } catch {}
      return p;
    };
  }

  // --- wrap XMLHttpRequest ---
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try {
      this.__mediadlUrl = url;
    } catch {}
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    try {
      if (this.__mediadlUrl && API_HINT.test(this.__mediadlUrl)) {
        this.addEventListener("load", function () {
          try {
            const t = this.responseType;
            if (t === "" || t === "text") handleJson(this.responseText);
            else if (t === "json" && this.response)
              handleJson(JSON.stringify(this.response));
          } catch {}
        });
      }
    } catch {}
    return origSend.apply(this, args);
  };
})();

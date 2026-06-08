// content/platforms/twitter_net.js
// Runs in the page's MAIN world (run_at: document_start) so it can wrap the
// page's own fetch / XHR and read the API JSON responses. X serves video
// metadata (including direct MP4 variants) inside `video_info.variants`.
// We extract those and hand them to the isolated content script via postMessage.

(function () {
  "use strict";

  const API_HINT = /(\/i\/api\/|graphql|\/2\/)/i;

  function post(items) {
    if (!items.length) return;
    console.log("[MediaDL/net] posting variants:", items.length);
    window.postMessage({ __mediadl: true, type: "variants", items }, "*");
  }

  // Walk an arbitrary JSON object collecting any media with video variants.
  function collect(obj, out, depth) {
    if (!obj || typeof obj !== "object" || depth > 40) return;
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) collect(obj[i], out, depth + 1);
      return;
    }

    const vi = obj.video_info;
    if (vi && Array.isArray(vi.variants)) {
      const mp4s = vi.variants
        .filter((v) => v && v.content_type === "video/mp4" && v.url)
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      const m3u8 = vi.variants.find(
        (v) => v && /mpegurl/i.test(v.content_type || "")
      );
      const expanded = obj.expanded_url || obj.url || "";
      const m = String(expanded).match(/status\/(\d+)/);
      out.push({
        tweetId: m ? m[1] : null,
        mediaId: obj.id_str || null,
        mp4: mp4s[0] ? mp4s[0].url : null,
        bitrate: mp4s[0] ? mp4s[0].bitrate || null : null,
        m3u8: m3u8 ? m3u8.url : null,
      });
    }

    for (const k in obj) {
      try {
        collect(obj[k], out, depth + 1);
      } catch (e) {
        /* ignore getters that throw */
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
    // Keep only entries that carry a downloadable URL.
    post(out.filter((e) => e.mp4 || e.m3u8));
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

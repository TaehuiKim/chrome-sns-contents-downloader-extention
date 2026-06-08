// content/platforms/meta_common.js
// Shared extraction logic for Instagram and Threads. Both store captured media
// in MediaDL.mediaByCode (filled by bridge.js from meta_net.js). The platform
// files supply only the bits that differ (permalink shape, username lookup).

globalThis.MediaDL = globalThis.MediaDL || {};

(function (MediaDL) {
  "use strict";

  function bestFromSrcset(img) {
    if (img.srcset) {
      let best = null;
      let bestW = -1;
      img.srcset.split(",").forEach((part) => {
        const [u, w] = part.trim().split(/\s+/);
        const ww = parseInt(w, 10) || 0;
        if (u && ww >= bestW) {
          bestW = ww;
          best = u;
        }
      });
      if (best) return best;
    }
    return img.currentSrc || img.src;
  }

  // Fallback when no API data was captured: grab the CDN images visible in the
  // container (skipping small avatars/icons). Videos can't be recovered this
  // way because their <video> src is a blob URL.
  function collectDomImages(container, platform, author) {
    const imgs = container.querySelectorAll(
      'img[src*="cdninstagram"], img[src*="fbcdn"]'
    );
    const out = [];
    let index = 0;
    imgs.forEach((img) => {
      const w = img.clientWidth || img.naturalWidth || 0;
      if (w && w < 150) return; // avatar / ui icon
      const url = bestFromSrcset(img);
      if (!url) return;
      out.push({
        url,
        filename: MediaDL.buildFilename({
          platform,
          author,
          mediaId: MediaDL.shortHash(url),
          index: imgs.length > 1 ? index : undefined,
          ext: MediaDL.extFromUrl(url, "jpg"),
          url,
        }),
      });
      index++;
    });
    return out;
  }

  // Build an extractMedia(container) for a given platform config.
  //   cfg.platform        -> "ig" | "threads"
  //   cfg.shortcodeRegex  -> regex with the code in capture group 1
  //   cfg.permalinkSelector
  //   cfg.usernameFor(container) -> string | null
  function makeExtractMedia(cfg) {
    function shortcodeFor(container) {
      const link = container.querySelector(cfg.permalinkSelector);
      const href = link ? link.getAttribute("href") : location.pathname;
      const m = (href || "").match(cfg.shortcodeRegex);
      return m ? m[1] : null;
    }

    return function extractMedia(container) {
      const code = shortcodeFor(container);
      const rec = code && MediaDL.mediaByCode.get(code);
      const author =
        (rec && rec.username) || cfg.usernameFor(container) || cfg.platform;

      if (!rec || !rec.items.length) {
        const dom = collectDomImages(container, cfg.platform, author);
        if (!dom.length) {
          console.warn(
            "[MediaDL] 미디어를 찾지 못했습니다. 잠시 후 다시 시도하거나 게시물을 열어보세요.",
            "| code:", code
          );
        } else if (MediaDL.log) {
          MediaDL.log("DOM fallback images:", dom.length, "| code:", code);
        }
        return dom;
      }

      if (MediaDL.log) MediaDL.log("matched post:", code, "items:", rec.items.length);
      const multi = rec.items.length > 1;
      return rec.items.map((it, i) => ({
        url: it.url,
        filename: MediaDL.buildFilename({
          platform: cfg.platform,
          author,
          mediaId: code,
          index: multi ? i : undefined,
          ext: MediaDL.extFromUrl(it.url, it.type === "video" ? "mp4" : "jpg"),
          url: it.url,
        }),
      }));
    };
  }

  MediaDL.meta = { makeExtractMedia, collectDomImages };
})(globalThis.MediaDL);

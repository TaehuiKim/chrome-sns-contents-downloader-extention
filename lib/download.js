// lib/download.js
// Shared helpers loaded first into the content-script global scope.
// All modules attach to a single namespace to avoid collisions.

globalThis.MediaDL = globalThis.MediaDL || {};

(function (MediaDL) {
  "use strict";

  // Strip characters that are illegal in filenames across OSes.
  function sanitize(part) {
    return String(part)
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80);
  }

  // Tiny deterministic hash for fallback ids (djb2).
  function shortHash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    }
    return h.toString(36);
  }

  // Build a filesystem-safe filename: <platform>_<author>_<mediaId>_<index>.<ext>
  function buildFilename({ platform, author, mediaId, index, ext, url }) {
    const p = sanitize(platform || "media");
    const a = sanitize(author || "unknown");
    const id = sanitize(mediaId || (url ? shortHash(url) : "0"));
    const i = Number.isInteger(index) ? `_${index}` : "";
    const e = sanitize(ext || "jpg");
    return `${p}_${a}_${id}${i}.${e}`;
  }

  // Hand the actual download off to the background service worker.
  function requestDownload({ url, filename }) {
    try {
      chrome.runtime.sendMessage({ type: "download", url, filename });
    } catch (err) {
      console.error("[MediaDL] sendMessage failed:", err);
    }
  }

  MediaDL.sanitize = sanitize;
  MediaDL.shortHash = shortHash;
  MediaDL.buildFilename = buildFilename;
  MediaDL.requestDownload = requestDownload;
})(globalThis.MediaDL);

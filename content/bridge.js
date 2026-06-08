// content/bridge.js
// Runs at document_start in the ISOLATED world so the postMessage listener is
// ready before X's API responses arrive. Messages posted by the MAIN-world
// sniffer (twitter_net.js) before this listener exists would otherwise be lost.
// All our content scripts share this isolated-world global, so the maps set up
// here are read later by twitter.js.

globalThis.MediaDL = globalThis.MediaDL || {};

(function (MediaDL) {
  "use strict";

  MediaDL.debug = false; // set true to re-enable diagnostic logging

  function log(...args) {
    if (MediaDL.debug) console.log("[MediaDL]", ...args);
  }
  MediaDL.log = log;

  // X video registry
  MediaDL.videoByTweet = MediaDL.videoByTweet || new Map(); // tweetId -> { mp4, m3u8, bitrate }
  MediaDL.videoByMedia = MediaDL.videoByMedia || new Map(); // mediaId -> { mp4, m3u8, bitrate }
  // Instagram / Threads registry: shortcode -> { username, items:[{type,url}] }
  MediaDL.mediaByCode = MediaDL.mediaByCode || new Map();

  function recordVariant(entry) {
    if (!entry || (!entry.mp4 && !entry.m3u8)) return;
    const rec = { mp4: entry.mp4, m3u8: entry.m3u8, bitrate: entry.bitrate };
    if (entry.tweetId) {
      const prev = MediaDL.videoByTweet.get(entry.tweetId);
      if (!prev || (rec.bitrate || 0) > (prev.bitrate || 0)) {
        MediaDL.videoByTweet.set(entry.tweetId, rec);
      }
    }
    if (entry.mediaId) MediaDL.videoByMedia.set(entry.mediaId, rec);
  }
  MediaDL.recordVariant = recordVariant;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.__mediadl !== true) return;

    if (data.type === "variants") {
      (data.items || []).forEach(recordVariant);
      log(
        "captured X variants:",
        data.items.length,
        "| tweets:",
        MediaDL.videoByTweet.size,
        "| media:",
        MediaDL.videoByMedia.size
      );
    } else if (data.type === "meta-media") {
      (data.posts || []).forEach((p) => {
        if (p && p.code && p.items && p.items.length) {
          MediaDL.mediaByCode.set(p.code, { username: p.username, items: p.items });
        }
      });
      log(
        "captured meta posts:",
        (data.posts || []).length,
        "| total codes:",
        MediaDL.mediaByCode.size
      );
    }
  });

  log("bridge ready (document_start)");
})(globalThis.MediaDL);

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

  // tweetId -> { mp4, m3u8, bitrate }
  MediaDL.videoByTweet = MediaDL.videoByTweet || new Map();
  // mediaId -> { mp4, m3u8, bitrate }
  MediaDL.videoByMedia = MediaDL.videoByMedia || new Map();

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
    if (!data || data.__mediadl !== true || data.type !== "variants") return;
    (data.items || []).forEach(recordVariant);
    log(
      "captured variants:",
      data.items.length,
      "| total tweets:",
      MediaDL.videoByTweet.size,
      "| media:",
      MediaDL.videoByMedia.size
    );
  });

  log("bridge ready (document_start)");
})(globalThis.MediaDL);

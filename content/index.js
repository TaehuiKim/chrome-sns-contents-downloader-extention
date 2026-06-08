// content/index.js
// Entry point: pick the platform module for the current host, then
// inject buttons and watch for DOM changes.

globalThis.MediaDL = globalThis.MediaDL || {};

(function (MediaDL) {
  "use strict";

  function pickPlatform(hostname) {
    if (hostname.endsWith("x.com") || hostname.endsWith("twitter.com")) {
      return MediaDL.twitter;
    }
    // Instagram / Threads added in later phases.
    return null;
  }

  function init() {
    const platform = pickPlatform(location.hostname);
    if (!platform) return;
    MediaDL.active = platform;
    MediaDL.inject.attachButtons(document);
    MediaDL.inject.startObserver();
  }

  init();
})(globalThis.MediaDL);

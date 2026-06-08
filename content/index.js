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
    if (hostname.endsWith("instagram.com")) {
      return MediaDL.instagram;
    }
    if (hostname.endsWith("threads.net") || hostname.endsWith("threads.com")) {
      return MediaDL.threads;
    }
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

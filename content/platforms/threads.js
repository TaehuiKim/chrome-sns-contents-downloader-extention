// content/platforms/threads.js
// Threads config — same Meta backend as Instagram, so extraction is shared.

globalThis.MediaDL = globalThis.MediaDL || {};

(function (MediaDL) {
  "use strict";

  function usernameFor(container) {
    const link = container.querySelector('a[href^="/@"]');
    if (link) {
      const m = link.getAttribute("href").match(/^\/@([^/?#]+)/);
      if (m) return m[1];
    }
    return null;
  }

  const extractMedia = MediaDL.meta.makeExtractMedia({
    platform: "threads",
    shortcodeRegex: /\/(?:post|t)\/([^/?#]+)/,
    permalinkSelector: 'a[href*="/post/"], a[href*="/t/"]',
    usernameFor,
  });

  MediaDL.threads = {
    extractMedia,
    targets: [
      {
        selector: 'div[data-pressable-container="true"], article',
        extract: extractMedia,
        accept: (el) =>
          !!(
            el.querySelector('a[href*="/post/"]') ||
            el.querySelector('img[src*="cdninstagram"], img[src*="fbcdn"], video')
          ),
      },
    ],
  };
})(globalThis.MediaDL);

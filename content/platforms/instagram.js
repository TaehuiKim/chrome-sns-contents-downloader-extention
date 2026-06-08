// content/platforms/instagram.js
// Instagram config — extraction is shared via MediaDL.meta.

globalThis.MediaDL = globalThis.MediaDL || {};

(function (MediaDL) {
  "use strict";

  function usernameFor(container) {
    const link = container.querySelector('a[href^="/"][role="link"], header a[href^="/"]');
    if (link) {
      const m = link.getAttribute("href").match(/^\/([^/?#]+)\//);
      if (m && m[1] !== "p" && m[1] !== "reel" && m[1] !== "reels") return m[1];
    }
    return null;
  }

  const extractMedia = MediaDL.meta.makeExtractMedia({
    platform: "ig",
    shortcodeRegex: /\/(?:p|reel|reels|tv)\/([^/?#]+)/,
    permalinkSelector: 'a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]',
    usernameFor,
  });

  MediaDL.instagram = {
    extractMedia,
    targets: [
      {
        selector: "article",
        extract: extractMedia,
        // Only real posts (have a permalink or CDN media), not suggestion cards.
        accept: (el) =>
          !!(
            el.querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]') ||
            el.querySelector('img[src*="cdninstagram"], img[src*="fbcdn"], video')
          ),
      },
    ],
  };
})(globalThis.MediaDL);

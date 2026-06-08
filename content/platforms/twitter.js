// content/platforms/twitter.js
// X (Twitter) media extraction. Phase 1: images at original quality.

globalThis.MediaDL = globalThis.MediaDL || {};

(function (MediaDL) {
  "use strict";

  // pbs.twimg.com image URLs carry the size in the `name` query param
  // (small/medium/large/orig/360x360...). Forcing name=orig gives the
  // original resolution. The `format` param tells us the extension.
  function toOriginalUrl(src) {
    let u;
    try {
      u = new URL(src, location.href);
    } catch {
      return null;
    }
    if (!u.hostname.includes("pbs.twimg.com")) return null;

    const format = u.searchParams.get("format") || inferFormatFromPath(u) || "jpg";
    u.searchParams.set("format", format);
    u.searchParams.set("name", "orig");
    return { url: u.toString(), ext: normalizeExt(format), pathname: u.pathname };
  }

  // Some media paths embed the extension instead of a format param,
  // e.g. /media/<id>.jpg
  function inferFormatFromPath(u) {
    const m = u.pathname.match(/\.([a-z0-9]+)$/i);
    return m ? m[1] : null;
  }

  function normalizeExt(format) {
    const f = String(format).toLowerCase();
    if (f === "jpeg") return "jpg";
    return f;
  }

  // The media id is the last path segment (minus any extension).
  function mediaIdFromPath(pathname) {
    const seg = pathname.split("/").filter(Boolean).pop() || "";
    return seg.replace(/\.[a-z0-9]+$/i, "");
  }

  // Try to find the author handle for nicer filenames.
  function findAuthor(container) {
    const article = container.closest("article") || container;
    const statusLink = article.querySelector('a[href*="/status/"]');
    if (statusLink) {
      const m = statusLink.getAttribute("href").match(/^\/([^/]+)\/status\//);
      if (m) return m[1];
    }
    return null;
  }

  // Extract downloadable images from a tweet photo container (or article).
  function extractImages(container) {
    const imgs = container.querySelectorAll('img[src*="pbs.twimg.com/media"]');
    const author = findAuthor(container);
    const results = [];
    let index = 0;

    imgs.forEach((img) => {
      const orig = toOriginalUrl(img.currentSrc || img.src);
      if (!orig) return;
      const multi = imgs.length > 1;
      results.push({
        url: orig.url,
        filename: MediaDL.buildFilename({
          platform: "x",
          author,
          mediaId: mediaIdFromPath(orig.pathname),
          index: multi ? index : undefined,
          ext: orig.ext,
          url: orig.url,
        }),
      });
      index++;
    });

    return results;
  }

  // --- Video support -------------------------------------------------------
  // The variant registry is populated by content/bridge.js (set up at
  // document_start) from messages posted by twitter_net.js (MAIN world).

  // Find the tweet id for a media container via the timestamp permalink.
  function tweetIdFor(container) {
    const article = container.closest("article") || container;
    const timeLink = article.querySelector('a[href*="/status/"] time');
    const link =
      (timeLink && timeLink.closest("a")) ||
      article.querySelector('a[href*="/status/"]');
    if (!link) return null;
    const m = link.getAttribute("href").match(/\/status\/(\d+)/);
    return m ? m[1] : null;
  }

  // X video thumbnails embed the media id in their path, e.g.
  //   pbs.twimg.com/ext_tw_video_thumb/<mediaId>/...
  //   pbs.twimg.com/amplify_video_thumb/<mediaId>/...
  // This lets us match a player to a captured variant when the tweet-id
  // lookup fails (quoted tweets, unusual DOM).
  function mediaIdFromThumb(container) {
    const candidates = [];
    container.querySelectorAll("img[src]").forEach((img) => candidates.push(img.src));
    container.querySelectorAll('[style*="background"]').forEach((el) => {
      const m = el.getAttribute("style").match(/url\(["']?([^"')]+)["']?\)/);
      if (m) candidates.push(m[1]);
    });
    for (const src of candidates) {
      const m = src.match(/(?:ext_tw_video_thumb|amplify_video_thumb)\/(\d+)/);
      if (m) return m[1];
    }
    return null;
  }

  function lookupVariant(container) {
    const tweetId = tweetIdFor(container);
    const mediaId = mediaIdFromThumb(container);
    let rec = tweetId && MediaDL.videoByTweet.get(tweetId);
    let via = rec ? "tweetId" : null;
    if (!rec && mediaId) {
      rec = MediaDL.videoByMedia.get(mediaId);
      if (rec) via = "mediaId";
    }
    MediaDL.log(
      "lookup -> tweetId:", tweetId,
      "| thumbMediaId:", mediaId,
      "| matched via:", via,
      "| known tweetIds:", Array.from(MediaDL.videoByTweet.keys()),
      "| known mediaIds:", Array.from(MediaDL.videoByMedia.keys())
    );
    return { tweetId, rec };
  }

  function extractVideo(container) {
    const { tweetId, rec } = lookupVariant(container);
    if (!rec || !rec.mp4) {
      if (rec && rec.m3u8 && !rec.mp4) {
        console.warn(
          "[MediaDL] 이 영상은 HLS(.m3u8) 스트림만 제공되어 MP4 다운로드가 아직 지원되지 않습니다 (Phase 3)."
        );
      } else {
        console.warn(
          "[MediaDL] 영상 URL을 아직 캡처하지 못했습니다. 잠시 후 다시 시도하거나 탭을 새로고침하세요.",
          "| tweetId:", tweetId,
          "| 캡처된 트윗 수:", MediaDL.videoByTweet.size
        );
      }
      return [];
    }
    const author = findAuthor(container);
    return [
      {
        url: rec.mp4,
        filename: MediaDL.buildFilename({
          platform: "x",
          author,
          mediaId: tweetId || "video",
          ext: "mp4",
          url: rec.mp4,
        }),
      },
    ];
  }

  MediaDL.twitter = {
    extractImages,
    extractVideo,
    toOriginalUrl,
    // Containers the injector should attach a download button to.
    targets: [
      {
        selector: '[data-testid="tweetPhoto"]',
        extract: extractImages,
        // A video's poster is also a tweetPhoto but uses ext_tw_video_thumb,
        // not /media/. Only attach the image button to real photos so it does
        // not sit on top of (and steal clicks from) the video button.
        accept: (el) =>
          !el.closest('[data-testid="videoPlayer"], [data-testid="videoComponent"]') &&
          !!el.querySelector('img[src*="pbs.twimg.com/media"]'),
      },
      {
        selector: '[data-testid="videoPlayer"], [data-testid="videoComponent"]',
        extract: extractVideo,
      },
    ],
  };

  // Stubs for later phases (not loaded by the manifest yet).
  MediaDL.instagram = MediaDL.instagram || {};
  MediaDL.threads = MediaDL.threads || {};
})(globalThis.MediaDL);

// background.js — MV3 service worker (ES module).
// Receives download requests from content scripts and performs the
// actual save via chrome.downloads.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "download") return;

  chrome.downloads
    .download({
      url: message.url,
      filename: message.filename,
      saveAs: false,
    })
    .then((downloadId) => {
      sendResponse({ ok: true, downloadId });
    })
    .catch((err) => {
      console.error("[MediaDL] download failed:", err, message);
      sendResponse({ ok: false, error: String(err) });
    });

  // Keep the message channel open for the async sendResponse.
  return true;

  // Phase 3 will add a `type: "download-hls"` branch here to orchestrate
  // m3u8 parsing and .ts segment synthesis.
});

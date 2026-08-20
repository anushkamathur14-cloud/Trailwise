(function () {
  var KEY = "trailwise_anon";
  var DNT = navigator.doNotTrack === "1" || window.doNotTrack === "1";
  function id() {
    try {
      var existing = localStorage.getItem(KEY);
      if (existing) return existing;
      var created = "anon_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(KEY, created);
      return created;
    } catch (e) {
      return "anon_ephemeral";
    }
  }
  function send(path, payload) {
    if (window.__trailwiseDisabled || (DNT && !window.__trailwiseIgnoreDnt)) return;
    fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(function () {});
  }
  window.trailwise = {
    track: function (eventName, properties) {
      send("/api/events", {
        eventName: eventName,
        anonymousId: window.__trailwiseUserId ? undefined : id(),
        userId: window.__trailwiseUserId,
        sessionId: window.__trailwiseSession,
        platform: "web",
        source: "snippet",
        properties: properties || {},
        context: { pageUrl: location.href, pageTitle: document.title, referrer: document.referrer },
      });
    },
    page: function (name, properties) {
      window.trailwise.track("page_viewed", Object.assign({ page: name }, properties || {}));
    },
    identify: function (userId, traits) {
      window.__trailwiseUserId = userId;
      send("/api/identify", { userId: userId, anonymousId: id(), traits: traits || {}, platform: "web" });
    },
    reset: function () {
      window.__trailwiseUserId = undefined;
      try {
        localStorage.removeItem(KEY);
      } catch (e) {}
    },
    disable: function () {
      window.__trailwiseDisabled = true;
    },
  };
})();

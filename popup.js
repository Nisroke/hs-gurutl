fetch(chrome.runtime.getURL("cards_ko_KR.json"))
  .then(res => res.json())
  .then(data => {
    const lastUpdated = data.lastUpdated || "Unknown";
    const version = data.updatedVersion || "Unknown";

    document.getElementById("last-updated").textContent = lastUpdated;
    document.getElementById("patch-version").textContent = version;
  })
  .catch(err => {
    console.error("Failed to load version info", err);
  });

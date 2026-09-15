const providerSelect = document.getElementById("provider");
const apiKeyInput = document.getElementById("apiKey");
const modelInput = document.getElementById("model");
const autoScanInput = document.getElementById("autoScan");
const status = document.getElementById("status");
const keyLink = document.getElementById("keyLink");

const KEY_LINKS = {
  gemini: `<a href="https://aistudio.google.com/app/apikey" target="_blank">Get a free key from Google AI Studio →</a>`,
  openai: `<a href="https://platform.openai.com/api-keys" target="_blank">Get a key from OpenAI Platform →</a>`,
  anthropic: `<a href="https://console.anthropic.com/settings/keys" target="_blank">Get a key from Anthropic Console →</a>`,
  groq: `<a href="https://console.groq.com/keys" target="_blank">Get a FREE key from Groq →</a>`
};

function loadForProvider(providerId, apiKeys, models) {
  apiKeyInput.value = apiKeys?.[providerId] || "";
  modelInput.value = models?.[providerId] || "";
  keyLink.innerHTML = KEY_LINKS[providerId];
}

chrome.storage.local.get(["provider", "apiKeys", "models", "autoScan"], ({ provider, apiKeys, models, autoScan }) => {
  const current = provider || "gemini";
  providerSelect.value = current;
  autoScanInput.checked = !!autoScan;
  loadForProvider(current, apiKeys, models);

  providerSelect.addEventListener("change", () => {
    chrome.storage.local.get(["apiKeys", "models"], ({ apiKeys, models }) => {
      loadForProvider(providerSelect.value, apiKeys, models);
    });
  });
});

document.getElementById("save").addEventListener("click", () => {
  const providerId = providerSelect.value;
  const key = apiKeyInput.value.trim();
  const model = modelInput.value.trim();

  if (!key) {
    status.textContent = "Enter a key first.";
    status.style.color = "#f87171";
    return;
  }

  chrome.storage.local.get(["apiKeys", "models"], ({ apiKeys, models }) => {
    const newApiKeys = { ...(apiKeys || {}), [providerId]: key };
    const newModels = { ...(models || {}) };
    if (model) newModels[providerId] = model;
    else delete newModels[providerId];

    chrome.storage.local.set(
      { provider: providerId, apiKeys: newApiKeys, models: newModels, autoScan: autoScanInput.checked },
      () => {
        status.textContent = "Saved ✓";
        status.style.color = "#34d399";
      }
    );
  });
});

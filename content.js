// ToS Scanner — content script
// 1) Detects if this page looks like a Terms of Service / Privacy Policy
// 2) Shows a small floating button so the user opts in to scanning
// 3) Sends the page text to the background worker for AI analysis
// 4) Highlights the worst clause + shows a one-line summary banner

(function () {
  const SIGNAL_WORDS = [
    "terms of service", "terms and conditions", "privacy policy",
    "you agree", "arbitration", "binding arbitration", "class action",
    "we may collect", "third parties", "by using this", "you consent",
    "we reserve the right", "limitation of liability", "indemnify"
  ];

  function looksLikeToS(text) {
    const lower = text.toLowerCase();
    let hits = 0;
    for (const w of SIGNAL_WORDS) {
      if (lower.includes(w)) hits++;
      if (hits >= 3) return true;
    }
    return false;
  }

  function getPageText() {
    // Prefer <main> or <article> if present, else body — capped for API cost/latency
    const container = document.querySelector("main, article") || document.body;
    return container.innerText.replace(/\s+/g, " ").trim().slice(0, 30000);
  }

  function createScanButton() {
    const btn = document.createElement("button");
    btn.id = "tos-scanner-btn";
    btn.textContent = "🛡️ Scan this page";
    btn.onclick = runScan;
    document.body.appendChild(btn);
  }

  function setButtonState(state) {
    const btn = document.getElementById("tos-scanner-btn");
    if (!btn) return;
    if (state === "loading") {
      btn.textContent = "⏳ Scanning…";
      btn.disabled = true;
    } else if (state === "done") {
      btn.textContent = "🛡️ Scan again";
      btn.disabled = false;
    } else if (state === "error") {
      btn.textContent = "⚠️ Scan failed — retry";
      btn.disabled = false;
    }
  }

  function showBanner(summary, clauses, highlightCount, isSafe) {
    const old = document.getElementById("tos-scanner-banner");
    if (old) old.remove();

    const banner = document.createElement("div");
    banner.id = "tos-scanner-banner";
    if (isSafe) banner.classList.add("safe");

    const top = document.createElement("div");
    top.className = "tos-scanner-top";

    const shield = document.createElement("span");
    shield.className = "tos-scanner-shield";
    shield.textContent = isSafe ? "✅" : "🛡️";

    const titles = document.createElement("div");
    titles.className = "tos-scanner-titles";

    const title = document.createElement("span");
    title.className = "tos-scanner-title";
    title.textContent = isSafe ? "ALL CLEAR" : "WAKE UP";

    const sub = document.createElement("span");
    sub.className = "tos-scanner-sub";
    sub.textContent = isSafe ? "nothing shady in here:" : "you're about to agree to this:";

    titles.append(title, sub);

    const close = document.createElement("button");
    close.id = "tos-scanner-close";
    close.textContent = "✕";
    close.onclick = () => banner.remove();

    top.append(shield, titles, close);
    banner.appendChild(top);

    if (summary) {
      const body = document.createElement("div");
      body.className = "tos-scanner-body";
      body.textContent = summary;
      banner.appendChild(body);
    }

    if (clauses && clauses.length) {
      const list = document.createElement("div");
      list.className = "tos-scanner-clauses";

      clauses.forEach((c, i) => {
        const clause = document.createElement("div");
        clause.className = "tos-scanner-clause";

        const label = document.createElement("span");
        label.className = "tos-scanner-clause-label";
        label.textContent = clauses.length > 1 ? `RED FLAG #${i + 1}` : "WORST CLAUSE";

        const p = document.createElement("p");
        p.textContent = `"${c.quote || ""}"`;

        clause.append(label, p);

        if (c.why) {
          const why = document.createElement("div");
          why.className = "tos-scanner-clause-why";
          why.textContent = `→ ${c.why}`;
          clause.appendChild(why);
        }

        list.appendChild(clause);
      });

      banner.appendChild(list);

      if (highlightCount > 0) {
        const jump = document.createElement("button");
        jump.id = "tos-scanner-jump";
        jump.textContent = "⚡ Jump to highlighted spots";
        jump.onclick = () => {
          const el = document.querySelector(".tos-scanner-highlight");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        };
        banner.appendChild(jump);
      }
    }

    document.body.appendChild(banner);
  }

  function highlightClause(clauseText) {
    if (!clauseText || clauseText.length < 8) return false;
    const needle = clauseText.slice(0, 40).toLowerCase();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.nodeValue;
      const idx = text.toLowerCase().indexOf(needle);
      if (idx !== -1) {
        // Try exact-length range first; fall back to the text node's tail
        const end = Math.min(idx + clauseText.length, text.length);
        try {
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, end);
          const mark = document.createElement("mark");
          mark.className = "tos-scanner-highlight";
          range.surroundContents(mark);
          return true;
        } catch (e) {
          try {
            const range = document.createRange();
            range.setStart(node, idx);
            range.setEnd(node, text.length);
            const mark = document.createElement("mark");
            mark.className = "tos-scanner-highlight";
            range.surroundContents(mark);
            return true;
          } catch (e2) {
            return false;
          }
        }
      }
    }
    return false;
  }

  function runScan() {
    setButtonState("loading");
    const text = getPageText();
    let settled = false;
    const watchdog = setTimeout(() => {
      if (settled) return;
      settled = true;
      setButtonState("error");
      showBanner("The AI took too long to respond. Try again in a moment.", null, false, false);
    }, 90000);
    chrome.runtime.sendMessage(
      { type: "SCAN_TOS", text },
      (response) => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        if (chrome.runtime.lastError || !response) {
          setButtonState("error");
          showBanner("Couldn't reach the AI — check your API key in the extension popup.", null, false, false);
          return;
        }
        if (response.error) {
          setButtonState("error");
          showBanner(response.error, null, false, false);
          return;
        }
        setButtonState("done");
        const clausesRes = Array.isArray(response.clauses) ? response.clauses.slice(0, 5) : [];
        const safe = response.risk === "safe" || !clausesRes.length;
        let highlightCount = 0;
        if (!safe) {
          for (const c of clausesRes) {
            if (highlightClause(c.quote)) highlightCount++;
          }
        }
        showBanner(response.summary, safe ? null : clausesRes, highlightCount, safe);
      }
    );
  }

  // Live detection: keep an eye on the DOM so terms popups that appear
  // later (e.g. during sign-up) also trigger the button — and optionally auto-scan.
  let autoScanEnabled = false;
  let sessionScanned = false;
  let detectionTimer = null;

  function ensureButton() {
    if (document.getElementById("tos-scanner-btn")) return;
    const text = document.body.innerText.slice(0, 8000);
    if (looksLikeToS(text)) {
      createScanButton();
      if (autoScanEnabled && !sessionScanned) {
        sessionScanned = true;
        setTimeout(runScan, 800);
      }
    }
  }

  chrome.storage.local.get(["autoScan"], ({ autoScan }) => {
    autoScanEnabled = !!autoScan;
    ensureButton();
    const observer = new MutationObserver(() => {
      clearTimeout(detectionTimer);
      detectionTimer = setTimeout(ensureButton, 600);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})();

// ── Wheel drawing ─────────────────────────────────────────────────────────────

const WHEEL_SEGMENTS = [
  { label: "📧 Promo",   color: "#6c63ff" },
  { label: "💊 Pharma",  color: "#e05a8a" },
  { label: "💰 $ $ $",  color: "#e09a1a" },
  { label: "🏆 Winner!", color: "#1aab6d" },
  { label: "👑 VIP",    color: "#7c3aed" },
  { label: "🚀 Offer",  color: "#2563eb" },
  { label: "🎁 Prize",  color: "#db2777" },
  { label: "📢 Alert",  color: "#d97706" },
];

/**
 * Draws the static roulette wheel onto a <canvas>.
 * @param {HTMLCanvasElement} canvas
 */
function drawWheel(canvas) {
  const ctx = canvas.getContext("2d");
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r  = cx - 4;  // small inset so edge isn't clipped
  const n  = WHEEL_SEGMENTS.length;
  const arc = (2 * Math.PI) / n;

  for (let i = 0; i < n; i++) {
    const startAngle = i * arc - Math.PI / 2;
    const endAngle   = startAngle + arc;

    // Slice fill
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = WHEEL_SEGMENTS[i].color;
    ctx.fill();

    // Slice border
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startAngle + arc / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px 'Segoe UI', sans-serif";
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur  = 4;
    ctx.fillText(WHEEL_SEGMENTS[i].label, r - 12, 5);
    ctx.restore();
  }

  // Center hub
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, 2 * Math.PI);
  ctx.fillStyle = "#0f0f13";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ── DOM refs ──────────────────────────────────────────────────────────────────

const tabBar         = document.getElementById("tab-bar");
const tabBtns        = document.querySelectorAll(".tab-btn");
const screenLogin    = document.getElementById("screen-login");
const screenRoulette = document.getElementById("screen-roulette");
const screenSearch   = document.getElementById("screen-search");
const userBar        = document.getElementById("user-bar");
const spinBtn        = document.getElementById("spin-btn");
const wheelCanvas    = document.getElementById("wheel-canvas");
const emailCard      = document.getElementById("email-card");
const emptyMessage   = document.getElementById("empty-message");
const errorBanner    = document.getElementById("error-banner");

// Email card fields
const elSubject   = document.getElementById("email-subject");
const elDate      = document.getElementById("email-date");
const elFromName  = document.getElementById("email-from-name");
const elFromAddr  = document.getElementById("email-from-addr");
const elPreview   = document.getElementById("email-preview");
const elLink      = document.getElementById("email-link");
const elEmptyText = document.getElementById("empty-text");

// Search form refs
const searchFolder      = document.getElementById("search-folder");
const searchQuery       = document.getElementById("search-query");
const searchFrom        = document.getElementById("search-from");
const searchSubject     = document.getElementById("search-subject");
const searchAttachments = document.getElementById("search-attachments");
const searchBtn         = document.getElementById("search-btn");
const searchResults     = document.getElementById("search-results");
const searchError       = document.getElementById("search-error");

// ── Init ──────────────────────────────────────────────────────────────────────

drawWheel(wheelCanvas);

(async () => {
  try {
    const res  = await fetch("/api/me");
    const data = await res.json();

    if (data.loggedIn) {
      showRoulette(data.account);
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }

  // Surface any ?error= param from the server redirect
  const params = new URLSearchParams(window.location.search);
  if (params.has("error")) {
    showError(decodeURIComponent(params.get("error")));
    window.history.replaceState({}, "", "/");
  }
})();

// ── Tab switching ─────────────────────────────────────────────────────────────

tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    tabBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    screenRoulette.classList.remove("active");
    screenSearch.classList.remove("active");

    if (tab === "roulette") {
      screenRoulette.classList.add("active");
    } else if (tab === "search") {
      screenSearch.classList.add("active");
      loadFolders();
    }
  });
});

// ── Screen helpers ────────────────────────────────────────────────────────────

function showLogin() {
  tabBar.classList.add("hidden");
  screenLogin.classList.add("active");
  screenRoulette.classList.remove("active");
  screenSearch.classList.remove("active");
}

function showRoulette(account) {
  screenLogin.classList.remove("active");
  screenSearch.classList.remove("active");
  screenRoulette.classList.add("active");
  tabBar.classList.remove("hidden");
  spinBtn.disabled = false;

  userBar.innerHTML = `
    <span>Signed in as <span class="username">${escHtml(account.name || account.username)}</span></span>
    <a href="/auth/logout">Sign out</a>
  `;
}

function showError(msg) {
  errorBanner.textContent = msg;
  errorBanner.classList.remove("hidden");
}

function hideError() {
  errorBanner.classList.add("hidden");
}

// ── Spin logic ────────────────────────────────────────────────────────────────

spinBtn.addEventListener("click", async () => {
  hideError();
  hideEmailCard();

  // Disable button and animate wheel
  spinBtn.disabled = true;
  spinBtn.textContent = "Spinning…";

  const finalAngle = Math.random() * 360;
  wheelCanvas.style.setProperty("--final-angle", finalAngle + "deg");
  wheelCanvas.classList.remove("spinning");
  // Force reflow so the animation restarts cleanly
  void wheelCanvas.offsetWidth;
  wheelCanvas.classList.add("spinning");

  // Fetch the random email in parallel with the animation
  let result;
  try {
    const res = await fetch("/api/spin");
    result = await res.json();

    if (res.status === 401) {
      // Session expired — redirect to login
      window.location.href = "/auth/login";
      return;
    }
  } catch {
    result = { error: "Network error. Please try again." };
  }

  // Wait for the CSS animation to finish before revealing the result
  const SPIN_DURATION_MS = 3000; // must match --spin-dur in CSS
  await sleep(SPIN_DURATION_MS);

  wheelCanvas.classList.remove("spinning");
  spinBtn.disabled = false;
  spinBtn.textContent = "Spin again!";

  if (result.error) {
    showError(result.error);
    return;
  }

  if (result.empty) {
    elEmptyText.textContent = result.message;
    emptyMessage.classList.remove("hidden");
    return;
  }

  renderEmail(result.email);
});

// ── Email rendering ───────────────────────────────────────────────────────────

function renderEmail(email) {
  elSubject.textContent  = email.subject;
  elDate.textContent     = formatDate(email.receivedDateTime);
  elFromName.textContent = email.fromName || "";
  elFromAddr.textContent = email.from;
  elPreview.textContent  = email.bodyPreview || "(No preview available)";

  if (email.webLink) {
    elLink.href = email.webLink;
    elLink.classList.remove("hidden");
  } else {
    elLink.classList.add("hidden");
  }

  emailCard.classList.remove("hidden");
  emailCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideEmailCard() {
  emailCard.classList.add("hidden");
  emptyMessage.classList.add("hidden");
}

// ── Mail Search ───────────────────────────────────────────────────────────────

let foldersLoaded = false;

async function loadFolders() {
  if (foldersLoaded) return;
  try {
    const res = await fetch("/api/folders");
    if (res.status === 401) { window.location.href = "/auth/login"; return; }
    const data = await res.json();
    if (data.folders) {
      data.folders.forEach((f) => {
        const opt = document.createElement("option");
        opt.value = f.id;
        opt.textContent = `${f.displayName} (${f.totalItemCount})`;
        searchFolder.appendChild(opt);
      });
      foldersLoaded = true;
    }
  } catch {
    // Non-fatal — folder dropdown stays with "All Mail" fallback
  }
}

searchBtn.addEventListener("click", async () => {
  searchError.classList.add("hidden");
  searchResults.classList.add("hidden");
  searchResults.innerHTML = "";
  searchBtn.disabled = true;
  searchBtn.textContent = "Searching…";

  const params = new URLSearchParams();
  if (searchFolder.value)          params.set("folder",          searchFolder.value);
  if (searchQuery.value.trim())    params.set("query",           searchQuery.value.trim());
  if (searchFrom.value.trim())     params.set("from",            searchFrom.value.trim());
  if (searchSubject.value.trim())  params.set("subject",         searchSubject.value.trim());
  if (searchAttachments.checked)   params.set("hasAttachments",  "true");

  try {
    const res  = await fetch("/api/search?" + params);
    if (res.status === 401) { window.location.href = "/auth/login"; return; }
    const data = await res.json();

    if (data.error) {
      searchError.textContent = data.error;
      searchError.classList.remove("hidden");
      return;
    }

    renderSearchResults(data.messages);
  } catch {
    searchError.textContent = "Network error. Please try again.";
    searchError.classList.remove("hidden");
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = "Search";
  }
});

function renderSearchResults(messages) {
  if (!messages || messages.length === 0) {
    searchResults.innerHTML = `<div class="card center-card"><p style="color:var(--muted)">No messages found.</p></div>`;
    searchResults.classList.remove("hidden");
    return;
  }

  searchResults.innerHTML = messages.map((msg) => `
    <div class="result-item card">
      <div class="result-header">
        <span class="result-subject">${escHtml(msg.subject)}</span>
        <span class="result-date">${formatDate(msg.receivedDateTime)}</span>
      </div>
      <div class="result-from">
        <strong>From:</strong>
        ${escHtml(msg.fromName ? msg.fromName + " " : "")}
        <span class="email-addr">${escHtml(msg.from)}</span>
        ${msg.hasAttachments ? '<span class="attachment-badge">&#128206;</span>' : ""}
      </div>
      <p class="email-preview">${escHtml(msg.bodyPreview || "(No preview)")}</p>
      ${msg.webLink ? `<a href="${escHtml(msg.webLink)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">Open in Outlook</a>` : ""}
    </div>
  `).join("");

  searchResults.classList.remove("hidden");
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    year:   "numeric",
    month:  "short",
    day:    "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

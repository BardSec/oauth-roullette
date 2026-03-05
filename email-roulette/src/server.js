require("dotenv").config();
const express = require("express");
const session = require("express-session");
const path = require("path");
const { msalClient, getAuthCodeUrl, acquireTokenByCode } = require("./auth");
const { getRandomJunkEmail, getMailFolders, searchMailbox } = require("./graph");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Session ──────────────────────────────────────────────────────────────────
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // set true when behind HTTPS in production
  })
);

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// ── Auth routes ───────────────────────────────────────────────────────────────

// Start login — redirect to Microsoft
app.get("/auth/login", async (req, res) => {
  try {
    const authUrl = await getAuthCodeUrl();
    res.redirect(authUrl);
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Failed to initiate login.");
  }
});

// Microsoft redirects here after the user consents / signs in
app.get("/auth/callback", async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    console.error("Auth callback error:", error, error_description);
    return res.redirect("/?error=" + encodeURIComponent(error_description || error));
  }

  try {
    const tokenResponse = await acquireTokenByCode(code);
    req.session.accessToken = tokenResponse.accessToken;
    req.session.account = {
      name: tokenResponse.account?.name,
      username: tokenResponse.account?.username,
    };
    res.redirect("/");
  } catch (err) {
    console.error("Token exchange error:", err);
    res.redirect("/?error=" + encodeURIComponent("Token exchange failed."));
  }
});

// Sign out — destroy session then redirect to Microsoft logout
app.get("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    // Redirect to Microsoft logout so the SSO session is also cleared
    const logoutUrl =
      `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/logout` +
      `?post_logout_redirect_uri=${encodeURIComponent("http://localhost:" + PORT)}`;
    res.redirect(logoutUrl);
  });
});

// ── API routes ────────────────────────────────────────────────────────────────

// Returns the current login state for the frontend
app.get("/api/me", (req, res) => {
  if (req.session.account) {
    res.json({ loggedIn: true, account: req.session.account });
  } else {
    res.json({ loggedIn: false });
  }
});

// The roulette spin — returns a random junk email
app.get("/api/spin", async (req, res) => {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  try {
    const email = await getRandomJunkEmail(req.session.accessToken);
    if (!email) {
      return res.json({ empty: true, message: "Your junk folder is empty — lucky you!" });
    }
    res.json({ empty: false, email });
  } catch (err) {
    console.error("Graph error:", err.response?.data || err.message);

    // Token may have expired; tell the client to re-login
    if (err.response?.status === 401) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Session expired. Please sign in again." });
    }

    res.status(500).json({ error: "Failed to fetch emails from Microsoft Graph." });
  }
});

// Returns the user's top-level mail folders for the search folder picker
app.get("/api/folders", async (req, res) => {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: "Not authenticated." });
  }
  try {
    const folders = await getMailFolders(req.session.accessToken);
    res.json({ folders });
  } catch (err) {
    console.error("Folders error:", err.response?.data || err.message);
    if (err.response?.status === 401) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Session expired. Please sign in again." });
    }
    res.status(500).json({ error: "Failed to fetch mail folders." });
  }
});

// Searches the mailbox with optional KQL criteria
app.get("/api/search", async (req, res) => {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: "Not authenticated." });
  }
  const { folder, query, from, subject, hasAttachments } = req.query;
  try {
    const messages = await searchMailbox(req.session.accessToken, {
      folderId:       folder || null,
      query:          query || "",
      from:           from || "",
      subject:        subject || "",
      hasAttachments: hasAttachments === "true",
    });
    res.json({ messages });
  } catch (err) {
    console.error("Search error:", err.response?.data || err.message);
    if (err.response?.status === 401) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Session expired. Please sign in again." });
    }
    res.status(500).json({ error: "Failed to search mailbox." });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Email Roulette running at http://localhost:${PORT}`);
});

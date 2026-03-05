const msal = require("@azure/msal-node");

// Scopes needed: read mail (including junk folder)
const SCOPES = ["Mail.Read", "User.Read"];

const msalConfig = {
  auth: {
    clientId: process.env.CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
    clientSecret: process.env.CLIENT_SECRET,
  },
};

const msalClient = new msal.ConfidentialClientApplication(msalConfig);

/**
 * Builds the Azure AD authorization URL to redirect the user to.
 */
async function getAuthCodeUrl() {
  return msalClient.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: process.env.REDIRECT_URI,
  });
}

/**
 * Exchanges the auth code (from the callback) for an access token.
 * @param {string} code - The authorization code from the query string.
 */
async function acquireTokenByCode(code) {
  return msalClient.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri: process.env.REDIRECT_URI,
  });
}

module.exports = { msalClient, getAuthCodeUrl, acquireTokenByCode };

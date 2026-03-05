const axios = require("axios");

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

/**
 * Fetches a random email from the signed-in user's Junk Email folder.
 *
 * Strategy:
 *  1. Get the total item count for the folder.
 *  2. Pick a random $skip offset.
 *  3. Fetch a single message at that offset.
 *
 * This avoids pulling the entire folder into memory.
 *
 * @param {string} accessToken - A valid Microsoft Graph access token.
 * @returns {object|null} A simplified email object, or null if the folder is empty.
 */
async function getRandomJunkEmail(accessToken) {
  const headers = { Authorization: `Bearer ${accessToken}` };

  // Step 1 — get the folder metadata (includes totalItemCount)
  const folderRes = await axios.get(
    `${GRAPH_BASE}/me/mailFolders/JunkEmail`,
    { headers }
  );
  const totalItems = folderRes.data.totalItemCount;

  if (totalItems === 0) return null;

  // Step 2 — pick a random index within the folder
  const randomSkip = Math.floor(Math.random() * totalItems);

  // Step 3 — fetch just that one message
  const messagesRes = await axios.get(
    `${GRAPH_BASE}/me/mailFolders/JunkEmail/messages`,
    {
      headers,
      params: {
        $top: 1,
        $skip: randomSkip,
        // Only request the fields we'll display — keeps the response small
        $select: "subject,from,receivedDateTime,bodyPreview,webLink",
        $orderby: "receivedDateTime desc",
      },
    }
  );

  const messages = messagesRes.data.value;
  if (!messages || messages.length === 0) return null;

  const msg = messages[0];
  return {
    subject: msg.subject || "(No subject)",
    from: msg.from?.emailAddress?.address || "unknown",
    fromName: msg.from?.emailAddress?.name || "",
    receivedDateTime: msg.receivedDateTime,
    bodyPreview: msg.bodyPreview || "",
    webLink: msg.webLink || null,
  };
}

module.exports = { getRandomJunkEmail };

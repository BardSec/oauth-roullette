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

/**
 * Returns the top-level mail folders for the signed-in user.
 *
 * @param {string} accessToken
 * @returns {Array} Array of folder objects { id, displayName, totalItemCount }
 */
async function getMailFolders(accessToken) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const res = await axios.get(`${GRAPH_BASE}/me/mailFolders`, {
    headers,
    params: { $top: 50, $select: "id,displayName,totalItemCount" },
  });
  return res.data.value;
}

/**
 * Searches a mailbox folder using Graph API KQL search.
 *
 * @param {string} accessToken
 * @param {object} opts
 * @param {string} [opts.folderId]       - Mail folder ID, or null for all mail
 * @param {string} [opts.query]          - Keyword search (subject + body)
 * @param {string} [opts.from]           - Filter by sender address
 * @param {string} [opts.subject]        - Filter by subject keyword
 * @param {boolean} [opts.hasAttachments] - Only messages with attachments
 * @returns {Array} Simplified message objects
 */
async function searchMailbox(accessToken, { folderId, query, from, subject, hasAttachments }) {
  const headers = { Authorization: `Bearer ${accessToken}` };

  // Build a KQL query string — Graph $search supports KQL for messages
  const kqlParts = [];
  if (query)          kqlParts.push(query);
  if (from)           kqlParts.push(`from:${from}`);
  if (subject)        kqlParts.push(`subject:${subject}`);
  if (hasAttachments) kqlParts.push("hasAttachments:true");

  const folderSegment = folderId
    ? `/me/mailFolders/${folderId}/messages`
    : "/me/messages";

  const params = {
    $top: 25,
    $select: "subject,from,receivedDateTime,bodyPreview,webLink,hasAttachments",
  };

  if (kqlParts.length > 0) {
    // $search and $orderby cannot be combined; relevance ordering is implicit
    params["$search"] = `"${kqlParts.join(" ")}"`;
  } else {
    params["$orderby"] = "receivedDateTime desc";
  }

  const res = await axios.get(`${GRAPH_BASE}${folderSegment}`, { headers, params });

  return res.data.value.map((msg) => ({
    subject:          msg.subject || "(No subject)",
    from:             msg.from?.emailAddress?.address || "unknown",
    fromName:         msg.from?.emailAddress?.name || "",
    receivedDateTime: msg.receivedDateTime,
    bodyPreview:      msg.bodyPreview || "",
    webLink:          msg.webLink || null,
    hasAttachments:   msg.hasAttachments || false,
  }));
}

module.exports = { getRandomJunkEmail, getMailFolders, searchMailbox };

const { parse } = require('csv-parse');
const fs = require('fs');

/**
 * Parse time string "HH:MM:SS" to seconds
 */
function timeToSeconds(timeStr) {
  if (!timeStr || !timeStr.trim()) return null;
  const parts = timeStr.trim().split(':').map(Number);
  if (parts.length !== 3) return null;
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

/**
 * Parse JSON content field from Respond.io messages
 */
function parseContent(raw) {
  if (!raw) return { type: 'unknown', text: '' };
  try {
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return { type: 'text', text: raw };
  }
}

/**
 * Parse conversations CSV from Respond.io
 */
async function parseConversationsCSV(filePath, instance) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(parse({ columns: true, trim: true, skip_empty_lines: true }))
      .on('data', (row) => {
        results.push({
          conversationId: row['Conversation ID'],
          instance,
          contactId: row['Contact ID'],
          assigneeId: row['Assignee'] || null,
          startedAt: new Date(row['DateTime Conversation Started']),
          resolvedAt: row['DateTime Conversation Resolved'] ? new Date(row['DateTime Conversation Resolved']) : null,
          firstResponseAt: row['DateTime First Response'] ? new Date(row['DateTime First Response']) : null,
          outgoingMessages: parseInt(row['Number of Outgoing Messages']) || 0,
          incomingMessages: parseInt(row['Number of Incoming Messages']) || 0,
          firstResponseTime: row['First Response Time'] || null,
          firstResponseSeconds: timeToSeconds(row['First Response Time']),
          resolutionTime: row['Resolution Time'] || null,
          resolutionSeconds: timeToSeconds(row['Resolution Time']),
          averageResponseTime: row['Average Response Time'] || null,
          averageResponseSeconds: timeToSeconds(row['Average Response Time']),
          numberOfAssignments: parseInt(row['Number of Assignments']) || 1,
          numberOfResponses: parseInt(row['Number of Responses']) || 0,
          respondioCategory: row['Conversation Category'] || null,
          closingNoteSummary: row['Closing Note Summary'] || null,
          closedBy: row['Closed By'] || null,
          openedByChannel: row['Opened By Channel'] || null,
          firstAssignee: row['First Assignee'] || null,
          lastAssignee: row['Last Assignee'] || null,
          closedBySource: row['Closed By Source'] || null,
        });
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

/**
 * Parse messages CSV from Respond.io
 */
async function parseMessagesCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(parse({ columns: true, trim: true, skip_empty_lines: true }))
      .on('data', (row) => {
        const content = parseContent(row['Content']);
        results.push({
          messageId: row['Message ID'],
          contactId: row['Contact ID'],
          senderId: row['Sender ID'],
          senderType: row['Sender Type'],
          contentType: row['Content Type'],
          messageType: row['Message Type'],
          content,
          rawContent: row['Content'],
          channelId: row['Channel ID'],
          timestamp: new Date(row['Date & Time']),
        });
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

/**
 * Match messages to conversations by Contact ID + time window
 */
function matchMessagesToConversations(messages, conversations) {
  const matched = [];
  const unmatched = [];

  for (const msg of messages) {
    let found = false;
    for (const conv of conversations) {
      if (
        msg.contactId === conv.contactId &&
        msg.timestamp >= conv.startedAt &&
        conv.resolvedAt &&
        msg.timestamp <= conv.resolvedAt
      ) {
        matched.push({ ...msg, conversationId: conv.conversationId });
        found = true;
        break;
      }
    }
    if (!found) {
      unmatched.push(msg);
    }
  }

  return { matched, unmatched };
}

module.exports = {
  parseConversationsCSV,
  parseMessagesCSV,
  matchMessagesToConversations,
  timeToSeconds,
};

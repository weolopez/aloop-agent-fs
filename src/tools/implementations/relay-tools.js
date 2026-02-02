// relay-tools.js
// Tools for communicating with the external relay

import { defineTool, successResult, errorResult, readString } from '../tool-base.js';
import relayMessageDesc from '../descriptions/relay-message.md?raw';

/**
 * Send a message to the Telegram relay
 */
export const RelayMessageTool = defineTool('relayMessage', {
  description: relayMessageDesc,
  parameters: {
    message: { type: 'string', required: true, description: 'Message to relay to Telegram' }
  },
  async execute(args, ctx) {
    const message = readString(args, 'message', { required: true });
    const RELAY_URL = 'https://weolopez.com/relay/vargo';

    try {
      const response = await fetch(RELAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });

      if (!response.ok) {
        const error = await response.json();
        return errorResult(`Relay failed: ${error.error || response.statusText}`);
      }

      return successResult('Message relayed successfully to Telegram');
    } catch (err) {
      return errorResult(`Failed to connect to relay: ${err.message}`);
    }
  }
});

export default {
  RelayMessageTool
};

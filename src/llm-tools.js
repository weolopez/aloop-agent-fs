/********************
 * Base Introspection
 * return: {
    attributes: { attrName: "type", ... },
    events: { eventName: "event", ... }
   }
 ********************/

import { getPlatform, isBrowser } from './platform/index.js';

// Platform adapter instance (initialized lazily)
let _platform = null;

async function ensurePlatform() {
  if (!_platform) {
    _platform = await getPlatform();
  }
  return _platform;
}

export function discoverAPI(tagName) {
  const constructor = customElements.get(tagName);
  if (!constructor) return;

  const schema = { attributes: {}, events: {} };
  const observed = constructor.observedAttributes || [];

  for (const attr of observed) {
    if (typeof attr === 'string') {
      schema.attributes[attr] = 'string';
    } else {
      for (const [name, type] of Object.entries(attr)) {
        if (name.startsWith('on')) {
          schema.events[name.slice(2)] = 'event';
        } else {
          schema.attributes[name] = type;
        }
      }
    }
  }
  return schema;
}

/********************
 * Canvas Introspection (Attribute-driven)
 * return: [
    {
      id: element id,
      tag: tag name,
      description: element description,
      attributes: [attr1, attr2, ...]
    },
    ...
   ]
 ********************/
export function getCanvasAPIs(containerSelector = '#canvas', root = document) {
  const elements = [...root.querySelectorAll(`${containerSelector} *`)];
  const functions = elements
    .filter(el => el.tagName.includes('-'))
    .map(el => {
      const name = el.tagName.toLowerCase();
      const apis = discoverAPI(name);
      if (!apis) return []; // Skip if component not found or not registered
      
      const functionList = [];
      for (const [attr, type] of Object.entries(apis.attributes)) {
        functionList.push({
          id: el.id,
          tag: el.tagName.toLowerCase(),
          description: `Sets the ${attr} attribute of <${name}> component.`,
          attributes: [attr]
        });
      }

      for (const [event, type] of Object.entries(apis.events)) {
        functionList.push({
          id: el.id,
          tag: el.tagName.toLowerCase(),
          description: `Event listener for ${event} event on <${name}> component.`,
          attributes: ['handler']
        });
      }

      return functionList;
    });
  return functions.flat();
}

export function buildGeminiTools(containerSelector = '#canvas', root = document) {
  return getCanvasAPIs(containerSelector, root).flatMap(comp =>
    comp.attributes.map(attr => ({
      name: `${comp.id}.set_${attr}`,
      description: `Set ${attr} on ${comp.id}: ${comp.description}`,
      parameters: {
        type: 'object',
        properties: { value: { type: 'string' } },
        required: ['value']
      }
    }))
  );
}

export async function fetchGemini(text = '', systemPrompt = null, canvasTools = [], context = []) {
  const platform = await ensurePlatform();

  const payload = {
    contents: [],
    tools: canvasTools.length > 0 ? [{ functionDeclarations: canvasTools }] : undefined,
    toolConfig: canvasTools.length > 0 ? { functionCallingConfig: { mode: 'AUTO' } } : undefined
  };

  if (systemPrompt) {
    payload.system_instruction = { parts: [{ text: systemPrompt }] };
  }

  // Add history context
  if (context && context.length > 0) {
    context.forEach(msg => {
      payload.contents.push({
        role: msg.role === 'ai' ? 'model' : 'user',
        parts: [{ text: msg.text }]
      });
    });
  }

  payload.contents.push({ role: 'user', parts: [{ text }] });

  const apiKey = await getApiKey();
  const res = await platform.http.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
  );

  const response = await res.json();

  // Check if the response indicates an error
  if (!res.ok || response.error) {
    const errorMsg = response.error?.message || `HTTP ${res.status}: ${res.statusText}`;
    console.error("Gemini API error:", errorMsg);
    throw new Error(`Gemini API error: ${errorMsg}`);
  }

  return response;
}


export async function routeCommand(text, containerSelector = '#canvas', root) {
  const canvasTools = buildGeminiTools(containerSelector, root);
  const json = await fetchGemini(text, 
    'You are a seasoned web developer. Your task is to update web component attributes based on user input. Use the provided tools to set attribute values on components identified by their IDs.', 
    canvasTools);
  const candidate = json.candidates?.[0];
  const part = candidate?.content?.parts?.find(p => p.functionCall);
  const textResponse = candidate?.content?.parts?.find(p => p.text)?.text;
  const cmd = part?.functionCall;
  return executeTool({ type: 'tool', tool: cmd.name, args: cmd.args }, root);
}

export function executeTool(cmd, root = document) {
  if (!cmd) return 'No action taken.';
  if (cmd.type === 'text') return cmd.content;

  const [id, action] = cmd.tool.split('.');
  const attr = action.replace('set_', '');
  
  // Try to find by ID first, then by tag if ID is not set or not found
  let element = root.getElementById ? root.getElementById(id) : root.querySelector(`#${id}`);
  
  if (!element) {
    // Fallback: if the tool name is just "tag.set_attr", try finding by tag
    element = root.querySelector(id);
  }

  if (!element) return `Element ${id} not found.`;
  element.setAttribute(attr, cmd.args.value);
  return `${element.tagName.toLowerCase()}: ${attr} set to ${cmd.args.value}`;
}

export async function getApiKey(keyName = 'GEMINI_API_KEY') {
  const platform = await ensurePlatform();
  
  // Try environment variable first
  let apiKey = platform.env.get(keyName);
  
  // If not found, try config file (check both nested and flat structures for compatibility)
  if (!apiKey) {
    const config = platform.config.load();
    if (config?.gemini?.apiKey) {
      apiKey = config.gemini.apiKey;
    } else if (config?.geminiApiKey) {
      // Flat structure fallback
      apiKey = config.geminiApiKey;
    }
  }
  
  // If not found and in browser, prompt user
  if (!apiKey && isBrowser) {
    apiKey = await platform.prompt.text(`Please enter your ${keyName}`);
    if (apiKey) {
      platform.env.set(keyName, apiKey);
    }
  }
  
  if (!apiKey) {
    throw new Error(`API key ${keyName} not found. Set it via environment variable or call setApiKey().`);
  }
  
  return apiKey;
}

/**
 * Set API key programmatically (useful for CLI)
 * Saves to both environment and config file for persistence
 */
export async function setApiKey(key, keyName = 'GEMINI_API_KEY') {
  const platform = await ensurePlatform();
  platform.env.set(keyName, key);
  
  // Also save to config file for persistence
  const config = platform.config.load() || {};
  config.gemini = config.gemini || {};
  config.gemini.apiKey = key;
  platform.config.save(config);
}

// Browser-only: DOM event listener for prompt-submit
// Only register if we're in a browser environment
if (isBrowser && typeof document !== 'undefined') {
  document.addEventListener('prompt-submit', async (e) => {
    const result = await routeCommand(e.detail.prompt, '#canvas', e.target.activeElement.canvas.shadowRoot);
    document.dispatchEvent(new CustomEvent('tool-executed', { detail: { result, timestamp: Date.now() } }));
  });
}

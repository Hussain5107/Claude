/**
 * Minimal publish/subscribe event bus used for all cross-module communication.
 * Screens and engines never call each other directly — they emit/listen here.
 */
const listeners = new Map();

export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => off(event, handler);
}

export function once(event, handler) {
  const unsub = on(event, (...args) => {
    unsub();
    handler(...args);
  });
  return unsub;
}

export function off(event, handler) {
  listeners.get(event)?.delete(handler);
}

export function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  // Copy to array so handlers can safely unsubscribe during dispatch.
  for (const handler of [...set]) {
    try {
      handler(payload);
    } catch (err) {
      console.error(`[eventBus] handler for "${event}" threw`, err);
    }
  }
}

export function clearAll() {
  listeners.clear();
}

export const eventBus = { on, once, off, emit, clearAll };
export default eventBus;

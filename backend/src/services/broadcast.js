/**
 * services/broadcast.js
 * Holds the WebSocket server reference so any route can broadcast live updates.
 */

let _wss = null;

function init(wss) {
  _wss = wss;
}

/**
 * Broadcast a JSON message to all connected WebSocket clients.
 * @param {string} type   - event type, e.g. 'data_updated', 'match_updated'
 * @param {*}      payload - any serialisable payload
 */
function broadcast(type, payload) {
  if (!_wss) return;
  const msg = JSON.stringify({ type, payload, ts: Date.now() });
  _wss.clients.forEach(client => {
    if (client.readyState === 1 /* OPEN */) {
      try { client.send(msg); } catch (_) {}
    }
  });
}

module.exports = { init, broadcast };

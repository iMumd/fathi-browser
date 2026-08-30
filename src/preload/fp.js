
  /* ---------- WebRTC: never leak a local/public IP outside the proxy ---------- */
  try {
    const PC = w.RTCPeerConnection || w.webkitRTCPeerConnection;
    if (PC) {
      const isPrivate = (s) =>
        /(^|\s)(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|fe80:|::1)/i.test(String(s));
      const cleanSdp = (sdp) => String(sdp || '').split('\r\n')
        .filter((line) => !(/^a=candidate:/.test(line) && isPrivate(line)))
        .join('\r\n');
      const origSLD = PC.prototype.setLocalDescription;
      PC.prototype.setLocalDescription = function (desc) {
        if (desc && typeof desc.sdp === 'string') {
          try { desc = { type: desc.type, sdp: cleanSdp(desc.sdp) }; } catch (e) {}
        }
        return origSLD.call(this, desc);
      };
      const origAdd = PC.prototype.addIceCandidate;
      PC.prototype.addIceCandidate = function (cand) {
        try {
          if (cand && typeof cand.candidate === 'string' && isPrivate(cand.candidate)) return Promise.resolve();
        } catch (e) {}
        return origAdd.call(this, cand);
      };
    }
  } catch (e) {}


  /* ---------- notifications / permissions ---------- */
  try {
    const N = w.Notification;
    if (N) def(N, 'permission', 'default');
    if (nav.permissions && nav.permissions.query) {
      const origQuery = nav.permissions.query.bind(nav.permissions);
      nav.permissions.query = function (desc) {
        try {
          if (desc && (desc.name === 'notifications' || desc.name === 'geolocation' ||
                       desc.name === 'camera' || desc.name === 'microphone')) {
            return Promise.resolve({ state: 'prompt', onchange: null });
          }
        } catch (e) {}
        return origQuery(desc);
      };
    }
  } catch (e) {}
}

/* ----------------------------------------------------------- bootstrap */

const fpArg = process.argv.find((a) => a.startsWith('--fathi-fp='));
const fpId = fpArg ? fpArg.slice('--fathi-fp='.length) : '';

let cfg = null;
try {
  cfg = JSON.parse(ipcRenderer.sendSync('fathi:fp:sync', fpId) || 'null');

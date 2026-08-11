'use strict';
/**
 * Device presets for mobile emulation.
 *
 * The window keeps its size; the tab surface is rendered at the device's CSS
 * viewport (centred, scaled down when needed) and every JS-visible metric
 * (screen, viewport, DPR, touch points, orientation, UA / client hints) is
 * reported exactly as that device would.
 */

const IOS_UAS = {
  '17.5': (model) => `Mozilla/5.0 (${model}; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1`,
  '16.6': (model) => `Mozilla/5.0 (${model}; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1`
};

function androidUa(androidVersion, model, chromeMajor) {
  return `Mozilla/5.0 (Linux; Android ${androidVersion}; ${model}) AppleWebKit/537.36 ` +
    `(KHTML, like Gecko) Chrome/${chromeMajor}.0.0.0 Mobile Safari/537.36`;
}

const DESKTOP = {
  id: 'desktop',
  name: 'Desktop',
  group: 'desktop',
  mobile: false,
  width: 0,
  height: 0,
  dpr: 1,
  touch: 0
};


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

const DEVICES = [
  /* ------------------------------------------------------------- iPhone */
  {
    id: 'iphone-15-pro-max', name: 'iPhone 15 Pro Max', group: 'apple', mobile: true, os: 'ios',
    width: 430, height: 932, dpr: 3, touch: 5, model: 'iPhone', osVersion: '17.5',
    ua: IOS_UAS['17.5']('iPhone'), platform: 'iPhone', vendor: 'Apple Computer, Inc.',
    gpu: { vendor: 'Apple Inc.', renderer: 'Apple GPU' }
  },
  {
    id: 'iphone-15-pro', name: 'iPhone 15 Pro', group: 'apple', mobile: true, os: 'ios',
    width: 393, height: 852, dpr: 3, touch: 5, model: 'iPhone', osVersion: '17.5',
    ua: IOS_UAS['17.5']('iPhone'), platform: 'iPhone', vendor: 'Apple Computer, Inc.',
    gpu: { vendor: 'Apple Inc.', renderer: 'Apple GPU' }
  },
  {
    id: 'iphone-14', name: 'iPhone 14', group: 'apple', mobile: true, os: 'ios',
    width: 390, height: 844, dpr: 3, touch: 5, model: 'iPhone', osVersion: '16.6',
    ua: IOS_UAS['16.6']('iPhone'), platform: 'iPhone', vendor: 'Apple Computer, Inc.',
    gpu: { vendor: 'Apple Inc.', renderer: 'Apple GPU' }
  },
  {
    id: 'iphone-13-mini', name: 'iPhone 13 mini', group: 'apple', mobile: true, os: 'ios',
    width: 375, height: 812, dpr: 3, touch: 5, model: 'iPhone', osVersion: '17.5',
    ua: IOS_UAS['17.5']('iPhone'), platform: 'iPhone', vendor: 'Apple Computer, Inc.',
    gpu: { vendor: 'Apple Inc.', renderer: 'Apple GPU' }
  },
  {
    id: 'iphone-se', name: 'iPhone SE (3rd gen)', group: 'apple', mobile: true, os: 'ios',
    width: 375, height: 667, dpr: 2, touch: 5, model: 'iPhone', osVersion: '17.5',
    ua: IOS_UAS['17.5']('iPhone'), platform: 'iPhone', vendor: 'Apple Computer, Inc.',
    gpu: { vendor: 'Apple Inc.', renderer: 'Apple GPU' }
  },
  {
    id: 'ipad-pro-12', name: 'iPad Pro 12.9"', group: 'apple', mobile: true, os: 'ios',
    width: 1024, height: 1366, dpr: 2, touch: 5, model: 'iPad', osVersion: '17.5',
    ua: IOS_UAS['17.5']('iPad'), platform: 'iPad', vendor: 'Apple Computer, Inc.',
    gpu: { vendor: 'Apple Inc.', renderer: 'Apple GPU' }
  },
  {
    id: 'ipad-air', name: 'iPad Air', group: 'apple', mobile: true, os: 'ios',
    width: 820, height: 1180, dpr: 2, touch: 5, model: 'iPad', osVersion: '17.5',
    ua: IOS_UAS['17.5']('iPad'), platform: 'iPad', vendor: 'Apple Computer, Inc.',
    gpu: { vendor: 'Apple Inc.', renderer: 'Apple GPU' }
  },

  /* ------------------------------------------------------------ Samsung */
  {
    id: 'galaxy-s24-ultra', name: 'Galaxy S24 Ultra', group: 'samsung', mobile: true, os: 'android',
    width: 412, height: 915, dpr: 3.5, touch: 5, model: 'SM-S928B', osVersion: '14',
    androidVersion: '14', platform: 'Linux armv8l',
    gpu: { vendor: 'Google Inc. (Qualcomm)', renderer: 'ANGLE (Qualcomm, Adreno (TM) 750, OpenGL ES 3.2)' }
  },
  {
    id: 'galaxy-s23', name: 'Galaxy S23', group: 'samsung', mobile: true, os: 'android',
    width: 360, height: 780, dpr: 3, touch: 5, model: 'SM-S911B', osVersion: '13',
    androidVersion: '13', platform: 'Linux armv8l',
    gpu: { vendor: 'Google Inc. (Qualcomm)', renderer: 'ANGLE (Qualcomm, Adreno (TM) 740, OpenGL ES 3.2)' }
  },
  {
    id: 'galaxy-a54', name: 'Galaxy A54', group: 'samsung', mobile: true, os: 'android',
    width: 412, height: 915, dpr: 2.625, touch: 5, model: 'SM-A546B', osVersion: '13',
    androidVersion: '13', platform: 'Linux armv8l',
    gpu: { vendor: 'Google Inc. (ARM)', renderer: 'ANGLE (ARM, Mali-G68, OpenGL ES 3.2)' }
  },
  {
    id: 'galaxy-tab-s9', name: 'Galaxy Tab S9', group: 'samsung', mobile: true, os: 'android',
    width: 800, height: 1280, dpr: 2, touch: 5, model: 'SM-X710', osVersion: '13',
    androidVersion: '13', platform: 'Linux armv8l',
    gpu: { vendor: 'Google Inc. (Qualcomm)', renderer: 'ANGLE (Qualcomm, Adreno (TM) 740, OpenGL ES 3.2)' }
  },

  /* ------------------------------------------------------------- Google */
  {
    id: 'pixel-8-pro', name: 'Pixel 8 Pro', group: 'google', mobile: true, os: 'android',
    width: 412, height: 892, dpr: 2.625, touch: 5, model: 'Pixel 8 Pro', osVersion: '14',
    androidVersion: '14', platform: 'Linux armv8l',
    gpu: { vendor: 'Google Inc. (ARM)', renderer: 'ANGLE (ARM, Mali-G715, OpenGL ES 3.2)' }
  },
  {
    id: 'pixel-7', name: 'Pixel 7', group: 'google', mobile: true, os: 'android',
    width: 412, height: 915, dpr: 2.625, touch: 5, model: 'Pixel 7', osVersion: '13',
    androidVersion: '13', platform: 'Linux armv8l',
    gpu: { vendor: 'Google Inc. (ARM)', renderer: 'ANGLE (ARM, Mali-G710, OpenGL ES 3.2)' }
  },

  /* -------------------------------------------------------------- other */
  {
    id: 'xiaomi-13', name: 'Xiaomi 13', group: 'other', mobile: true, os: 'android',
    width: 393, height: 873, dpr: 2.75, touch: 5, model: '2211133G', osVersion: '13',
    androidVersion: '13', platform: 'Linux armv8l',
    gpu: { vendor: 'Google Inc. (Qualcomm)', renderer: 'ANGLE (Qualcomm, Adreno (TM) 740, OpenGL ES 3.2)' }
  },
  {
    id: 'oneplus-11', name: 'OnePlus 11', group: 'other', mobile: true, os: 'android',
    width: 412, height: 919, dpr: 3.5, touch: 5, model: 'CPH2449', osVersion: '13',
    androidVersion: '13', platform: 'Linux armv8l',
    gpu: { vendor: 'Google Inc. (Qualcomm)', renderer: 'ANGLE (Qualcomm, Adreno (TM) 740, OpenGL ES 3.2)' }
  },
  {
    id: 'huawei-p40', name: 'Huawei P40', group: 'other', mobile: true, os: 'android',
    width: 360, height: 780, dpr: 3, touch: 5, model: 'ANA-NX9', osVersion: '10',
    androidVersion: '10', platform: 'Linux armv8l',
    gpu: { vendor: 'Google Inc. (ARM)', renderer: 'ANGLE (ARM, Mali-G76, OpenGL ES 3.2)' }
  }
];

const GROUPS = {
  desktop: 'Desktop',
  apple: 'Apple',
  samsung: 'Samsung',
  google: 'Google',
  other: 'Other'
};

function get(id) {
  if (!id || id === 'desktop') return DESKTOP;
  return DEVICES.find((d) => d.id === id) || DESKTOP;
}

/** Build the UA for an Android preset using the engine's real Chrome major. */
function androidUserAgent(device, chromeMajor) {
  return androidUa(device.androidVersion, device.model, chromeMajor);
}

function byGroup() {
  const out = { desktop: [DESKTOP] };
  for (const d of DEVICES) {
    if (!out[d.group]) out[d.group] = [];
    out[d.group].push(d);
  }
  return out;
}

module.exports = { DESKTOP, DEVICES, GROUPS, get, byGroup, androidUserAgent, androidUa };

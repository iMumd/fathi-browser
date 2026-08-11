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

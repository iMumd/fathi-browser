
const OS_PROFILES = {
  windows: {
    weight: 58,
    platform: 'Win32',
    uaOs: 'Windows NT 10.0; Win64; x64',
    uaDataPlatform: 'Windows',
    platformVersions: ['10.0.0', '13.0.0', '15.0.0', '19.0.0'],
    architecture: 'x86',
    bitness: '64',
    wow64: false,
    screens: [
      [1920, 1080, 1], [1920, 1080, 1], [2560, 1440, 1], [1366, 768, 1],
      [1536, 864, 1.25], [1600, 900, 1], [3840, 2160, 1.5], [1920, 1200, 1]
    ],
    cores: [4, 8, 8, 12, 16],
    memory: [4, 8, 8, 16, 16, 32],
    gpus: [
      { v: 'Google Inc. (NVIDIA)', r: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      { v: 'Google Inc. (NVIDIA)', r: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      { v: 'Google Inc. (NVIDIA)', r: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      { v: 'Google Inc. (Intel)', r: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      { v: 'Google Inc. (Intel)', r: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      { v: 'Google Inc. (AMD)', r: 'ANGLE (AMD, AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0, D3D11)' },
      { v: 'Google Inc. (AMD)', r: 'ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' }
    ]
  },
  mac: {
    weight: 22,
    platform: 'MacIntel',
    uaOs: 'Macintosh; Intel Mac OS X 10_15_7',
    uaDataPlatform: 'macOS',
    platformVersions: ['13.6.0', '14.5.0', '14.6.1', '15.1.0'],
    architecture: 'arm',
    bitness: '64',
    wow64: false,
    screens: [[1440, 900, 2], [1512, 982, 2], [1728, 1117, 2], [1920, 1080, 1]],
    cores: [8, 8, 10, 12],
    memory: [8, 16, 16, 32],
    gpus: [
      { v: 'Google Inc. (Apple)', r: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)' },
      { v: 'Google Inc. (Apple)', r: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)' },
      { v: 'Google Inc. (Apple)', r: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)' },
      { v: 'Google Inc. (Intel)', r: 'ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics 640, OpenGL 4.1)' }
    ]
  },
  linux: {
    weight: 20,
    platform: 'Linux x86_64',
    uaOs: 'X11; Linux x86_64',
    uaDataPlatform: 'Linux',
    platformVersions: ['6.8.0', '5.15.0', '6.5.0'],
    architecture: 'x86',
    bitness: '64',
    wow64: false,
    screens: [[1920, 1080, 1], [2560, 1440, 1], [1366, 768, 1], [1680, 1050, 1]],
    cores: [4, 8, 8, 12, 16],
    memory: [4, 8, 16, 16, 32],
    gpus: [
      { v: 'Google Inc. (Intel)', r: 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6)' },
      { v: 'Google Inc. (AMD)', r: 'ANGLE (AMD, AMD Radeon RX 580 (POLARIS10, DRM 3.54, 6.5.0-35-generic, LLVM 15.0.7), OpenGL 4.6)' },
      { v: 'Google Inc. (NVIDIA)', r: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1050 Ti/PCIe/SSE2, OpenGL 4.5.0)' }
    ]
  }

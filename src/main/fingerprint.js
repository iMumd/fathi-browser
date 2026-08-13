
  if (device.mobile) applyMobileProfile(fp, device, rng, ver);

  return fp;
}

/**
 * Rewrites a desktop-shaped profile into a coherent mobile identity:
 * UA, platform, vendor, screen, DPR, touch points, GPU and client hints all
 * describe the same physical device.
 */
function applyMobileProfile(fp, device, rng, chromeMajor) {
  const isIOS = device.os === 'ios';
  const isTablet = /iPad|Tab/.test(device.name) || device.model === 'iPad';

  fp.osKey = isIOS ? 'ios' : 'android';
  fp.device = {
    id: device.id,
    name: device.name,
    os: device.os,
    mobile: true,
    tablet: isTablet,
    width: device.width,
    height: device.height,
    dpr: device.dpr,
    touch: device.touch || 5,
    orientation: device.width > device.height ? 'landscape' : 'portrait'
  };

  // ---- user agent
  fp.ua = isIOS ? device.ua : devices.androidUserAgent(device, chromeMajor);
  fp.appVersion = fp.ua.replace(/^Mozilla\//, '');
  fp.platform = device.platform;
  fp.vendor = device.vendor;
  fp.maxTouchPoints = device.touch || 5;
  fp.uaMobile = true;

}

function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randHex(bytes) { return crypto.randomBytes(bytes).toString('hex'); }

/* ------------------------------------------------------------- generator */

function generate(opts) {
  const options = typeof opts === 'string' ? { seed: opts } : (opts || {});
  const device = devices.get(options.deviceId);
  const seed = options.seed ? hash32(String(options.seed)) : crypto.randomBytes(4).readUInt32LE(0);
  const rng = mulberry32(seed);

  const osKey = pickWeighted(rng, Object.keys(OS_PROFILES));
  const os = OS_PROFILES[osKey];
  const lang = pick(rng, LANG_POOL);
  const ver = REAL_CHROME - Math.floor(rng() * 7);           // last ~7 majors
  const fullVer = `${ver}.0.${6482 + Math.floor(rng() * 60)}.${40 + Math.floor(rng() * 90)}`;

  const ua = `Mozilla/5.0 (${os.uaOs}) AppleWebKit/537.36 (KHTML, like Gecko) ` +
    `Chrome/${ver}.0.0.0 Safari/537.36`;

  const [sw, sh, dprRaw] = pick(rng, os.screens);
  const dpr = typeof dprRaw === 'number' ? dprRaw : 1;

  const gpu = pick(rng, os.gpus);
  const cores = pick(rng, os.cores);
  const memory = pick(rng, os.memory);
  const plugins = pick(rng, PLUGIN_SETS);
  const platformVersion = pick(rng, os.platformVersions);

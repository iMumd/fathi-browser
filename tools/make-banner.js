const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const icon = fs.readFileSync(path.join(root, 'assets', 'icon-256.png')).toString('base64');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="320" viewBox="0 0 1280 320">
  <rect width="1280" height="320" fill="#0b0c0e"/>
  <rect x="0.5" y="0.5" width="1279" height="319" fill="none" stroke="#1d2126"/>
  <image x="88" y="80" width="160" height="160" href="data:image/png;base64,${icon}"/>
  <rect x="288" y="96" width="1" height="128" fill="#22272d"/>
  <text x="328" y="172" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="68" font-weight="700" letter-spacing="8" fill="#e8ebef">FATHI</text>
  <text x="332" y="210" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="21" fill="#8a9099">Private browsing with a new identity in every tab</text>
  <text x="332" y="246" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="13" letter-spacing="3" fill="#4e7fa8">IMUMD</text>
</svg>
`;

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs', 'banner.svg'), svg);

sharp(Buffer.from(svg), { density: 144 })
  .png()
  .toFile(path.join(root, 'docs', 'banner.png'))
  .then((info) => console.log(info.width + 'x' + info.height))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

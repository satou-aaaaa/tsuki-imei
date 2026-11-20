// アプリのアイコン（icon-192.png・icon-512.png）を作る。紺の夜空に大きな三日月と星2つ。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#123554"/>
      <path d="M58 12 a38 38 0 1 0 30 58 a30 30 0 1 1 -30 -58 z" fill="#f6d77a"/>
      <circle cx="74" cy="26" r="4" fill="#fffdf7"/><circle cx="84" cy="44" r="2.6" fill="#7fc4ef"/></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();

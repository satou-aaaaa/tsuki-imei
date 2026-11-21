// SNS で貼られたときの絵（og.png 1200×630）を作る。今日の問題（答え）は入れず、遊び方の例だけ（旧暦の3月の名前は？ → 弥生）。
// 使い方: node tools/make-og.cjs（qa/ の playwright を使う）。場面の答え（ANS）は qa/run.mjs が「このゲームの答えのどれか」を見る
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
const Q = "旧暦の3月の名前は？", ANS = "弥生", OPTS = ["卯月", "弥生", "如月", "睦月"];
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const cand = (t) => `<div style="flex:1;text-align:center;font-size:30px;font-weight:700;padding:10px 0;border-radius:12px;background:#fff;border:3px solid ${t === ANS ? "#21704a" : "#1d2a3f55"}">${t}</div>`;
  await p.setContent(`<body style="margin:0;font-family:'Noto Sans CJK JP','IPAPGothic',sans-serif">
  <div style="width:1200px;height:630px;box-sizing:border-box;padding:48px 64px;background:#f3efe4;color:#1d2a3f;display:flex;gap:48px;align-items:center">
    <div style="flex:0 0 420px">
      <div style="font-size:30px;color:#83261a;letter-spacing:.06em">旧暦の月の名前を書く</div>
      <div style="font-size:96px;font-weight:900;margin-top:8px;line-height:1.15;color:#123554">月の<span style="color:#b23a24">異名</span><br>あて</div>
      <div style="font-size:34px;margin-top:14px">睦月から師走まで<br>1日5問</div>
    </div>
    <div style="flex:1;background:#fffdf7;border:4px solid #1d2a3f;border-radius:8px;overflow:hidden">
      <div style="font-size:26px;font-weight:700;padding:10px 20px;background:#164f33;color:#fff">🌙 月の名前　漢字で書く</div>
      <div style="font-size:64px;font-weight:900;text-align:center;letter-spacing:.12em;color:#123554;padding-top:18px">旧暦 3月</div>
      <div style="font-size:34px;font-weight:700;padding:6px 24px 12px">${Q}</div>
      <div style="display:flex;gap:14px;padding:0 24px 12px;align-items:center"><div style="flex:1;position:relative;font-size:44px;font-weight:900;padding:8px 18px;border:5px solid #21704a;border-radius:12px;background:#eef7f0">${ANS}<span style="position:absolute;right:16px;top:50%;transform:translateY(-50%) rotate(-8deg);border:4px solid #164f33;color:#164f33;border-radius:8px;padding:0 10px;font-size:28px;font-weight:900;background:#fff">✓ 正解</span></div></div>
      <div style="display:flex;gap:10px;padding:0 24px 22px">${OPTS.map(cand).join("")}</div>
    </div>
  </div></body>`);
  await p.screenshot({ path: path.join(__dirname, "..", "og.png") });
  await b.close();
})();

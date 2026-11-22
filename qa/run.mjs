// 月の異名あての検査。問題の作り方（全種類×3000問：答え・読み・別の書き方・2段目の由来が資料の表どおり・出典がある）・書いた答えの見方（かな・別の書き方・全角半角・空白）・
// 今日の5問と上級の組み方（3年分）・とことんの並び（何百回作って1回の中で重ならない）・通しで遊ぶ・まちがい・ヒント・続きから・変換中の Enter・
// 上級・練習・とことん・まなび帳・実績・カレンダー・あとから・文字の大きさ・言い方（由来を言い切らない）・スマホ幅・PWA・引き継ぎ・見やすさを確かめる。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。日付をずらすときは QA_SHIFT_DAYS=<日数>（カレンダー・あとからの検査）
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";
import { checkTransfer } from "./transfer-check.mjs";
import { checkSwStall } from "./sw-check.mjs";
import { checkDepth } from "./depth-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail).slice(0, 400) });
const firstClose = async (q) => { if (await q.locator("#howto[open]").count()) await q.click("#howto-ok"); if (await q.evaluate(() => !!(window.Core && Core.coach && Core.coach.active()))) { await q.evaluate(() => { Core.coach.leave(); scrollTo(0, 0); }); await q.waitForTimeout(100); } }; // はじめての練習の吹き出しをやめてホームへ（sync-template の migrateFirstQa が足した）
const G = createRequire(import.meta.url)(path.join(root, "data.js"));

const PINS = "m6:3:10.8,m1:1:10.5,r11:2:5.1.3,n10:3:7.2.0,y1:0.1:2月.10月.9月,y7:1.2:5月.12月.10月,y6:1.2:1月.12月.8月,y4:1.2:12月.7月.9月;m7:2:4.9,m2:0:8.3,r3:0:8.0.4,n3:1:3.11.6,y11:1.1:10月.5月.1月,y1:1.2:11月.12月.6月,y8:0.0:11月.2月.6月,y7:0.0:2月.12月.3月;m10:0:1.2,m2:1:3.0,n11:2:8.3.2,r1:0:8.11.5,y10:1.1:11月.4月.3月,y4:1.2:12月.8月.5月,y3:0.1:10月.11月.12月,y1:1.1:7月.9月.4月"; // 過去の日の問題の印（変わったら過去の日の問題が変わった印。種類・言い方は足すだけでも変わる）
// ---- 1. 問題の作り方（ブラウザを使わない）----
// 資料の表（ゲームとは別に書いた表。data.js の名前・読み・別の書き方・由来がこれと合うかを見る）
// 出典：国立国会図書館「日本の暦」第三章「和風月名」https://www.ndl.go.jp/koyomi/chapter3/s8.html （2026-11-20 に読んだ。引用は共有フォルダ games/tsuki-imei-research.md）
// [名前, 読み（資料のもの全部）, 別の書き方, 由来の説明に必ずある言葉]
const NDL = [
  ["睦月", ["むつき"], [], "睦び"], ["如月", ["きさらぎ"], ["衣更着"], "重ね着"], ["弥生", ["やよい"], [], "生い茂る"], ["卯月", ["うづき"], [], "卯の花"],
  ["皐月", ["さつき"], ["早月"], "早苗"], ["水無月", ["みなづき", "みなつき"], [], "水"], ["文月", ["ふみづき", "ふづき"], [], "穂"], ["葉月", ["はづき", "はつき"], [], "葉"],
  ["長月", ["ながつき", "ながづき"], [], "夜長月"], ["神無月", ["かんなづき"], [], "神"], ["霜月", ["しもつき"], [], "霜"], ["師走", ["しわす"], [], "走"],
];
// 答えの名前はこの12個だけ（資料に無い異名は入れない）
const NAME_RE = /^(?:睦月|如月|弥生|卯月|皐月|水無月|文月|葉月|長月|神無月|霜月|師走)$/;
const OUT_NAMES = /梅見月|花見月|建子月|初春月|小草生月|桜月|鳴神月|風待月|七夜月|月見月|紅葉月|菊月|雷無月|神帰月|雪見月|春待月|極月|乙子月/; // 資料に無い異名（入っていたら落とす）
{
  check("資料の表：12か月の名前・読み・別の書き方が data.js と同じ", G.MONTHS.length === 12 && G.MONTHS.every((x, i) => x.m === i + 1 && x.k === NDL[i][0] && JSON.stringify(x.yomi) === JSON.stringify(NDL[i][1]) && JSON.stringify(x.alt) === JSON.stringify(NDL[i][2]) && x.src.includes(NDL[i][3]) && x.yu.includes(NDL[i][3].slice(0, 1))), G.MONTHS.map((x) => x.k).join());
  const bad = {}, seen = {}, N = 3000;
  for (const k of G.KINDS) {
    seen[k.id] = new Set();
    const f = k.id[0], mo = +k.id.slice(1), x = NDL[mo - 1];
    for (let s = 0; s < N; s++) {
      const P = G.make(`${k.id}|qa${s}`), why = [], n2 = f === "y" ? 4 : k.lv === 0 ? 3 : 4;
      if (P.m !== mo) why.push("月がちがう");
      if (P.s2.opts.length !== n2 || new Set(P.s2.opts).size !== n2 || !P.s2.opts.includes(P.s2.ans)) why.push(`2段目の選び肢が${n2}つでない・答えを含まない`);
      if ([P.q, P.media, P.big, P.s2.q, ...P.s2.opts, ...P.cands, ...(P.opts || [])].some((v) => typeof v !== "string" || !v || /undefined|NaN|null|\$\{|＠/.test(v))) why.push("中身が空");
      if (f === "y") { if (P.s2.ans !== `${mo}月` || P.s2.opts.some((o) => !/^(?:[1-9]|1[0-2])月$/.test(o))) why.push("2段目（何月）がちがう"); }
      else if (P.s2.ans !== G.MONTHS[mo - 1].yu || P.s2.opts.some((o) => !G.MONTHS.some((y) => y.yu === o))) why.push("2段目（由来）が資料の月とちがう");
      if (f === "m") {
        if (P.type !== "num" || P.ans !== `${mo}月` || P.opts.length !== 12 || P.opts.some((o, i) => o !== `${i + 1}月`)) why.push("月の数の選び肢が12でない・答えがちがう");
        if (!P.q.includes(`「${x[0]}」`) || P.q.includes(`${mo}月`)) why.push("問いに名前が無い・答えの月が書いてある");
      } else {
        if (P.type !== "in" || P.opts !== undefined || P.cands.length !== 4 || new Set(P.cands).size !== 4) why.push("書いて答える形でない・候補が4つでない");
        if (f === "r") { if (P.ans !== x[1][0] || !P.q.includes(`「${x[0]}」`) || x[1].some((y) => P.q.includes(y)) || !P.cands.includes(x[1][0])) why.push("読みの問題がちがう"); }
        else {
          if (!NAME_RE.test(P.ans) || P.ans !== x[0] || !P.cands.includes(x[0]) || !P.cands.every((c) => NAME_RE.test(c))) why.push("答え・候補が資料の名前でない");
          if (P.q.includes(x[0]) || x[1].some((y) => P.q.includes(y)) || x[2].some((a) => P.q.includes(a))) why.push("問いに答え（別の書き方も）が書いてある");
          if (f === "n" && !P.q.includes(`${mo}月`)) why.push("問いに月の数が無い");
          if (f === "y" && !/由来|説/.test(P.q)) why.push("由来の問いでない");
        }
      }
      if (P.src.length !== 1 || P.src[0][1] !== "https://www.ndl.go.jp/koyomi/chapter3/s8.html") why.push("出典が無い");
      if (JSON.stringify(G.make(`${k.id}|qa${s}`)) !== JSON.stringify(P)) why.push("同じ種で同じ問題にならない");
      seen[k.id].add(G.keyOf(P));
      if (why.length && !bad[k.id]) bad[k.id] = why.join("・") + "：" + P.q + " " + P.s2.opts.join(" / ");
    }
  }
  check(`問題：${G.KINDS.length}種類×${N}問で、答え・読み・候補・2段目（由来か何月か）が資料の表どおり・問いに答えを書かない・出典がある`, Object.keys(bad).length === 0, JSON.stringify(bad));
  const total = Object.values(seen).reduce((a, s) => a + s.size, 0), few = G.KINDS.filter((k) => seen[k.id].size < 12).map((k) => `${k.id}:${seen[k.id].size}`);
  check("問題の数：全部で300通り以上・どの種類も12通り以上（好きなだけ遊んでも同じ問題が続かない。game-dev.md F6）", total >= 300 && few.length === 0, `${total}通り ${few.join(",")}`);
  check("問題：種類は48（やさしい12：何月を選ぶ・ふつう24：名前を書く・読みを書く・むずかしい12：由来から名前を書く）", G.KINDS.length === 48 && [0, 1, 2].map((l) => G.kindsOf(l).length).join() === "12,24,12" && G.kindsOf(0).every((id) => id[0] === "m") && G.kindsOf(1).every((id) => /^[nr]/.test(id)) && G.kindsOf(2).every((id) => id[0] === "y"), [0, 1, 2].map((l) => G.kindsOf(l).length).join());
  const names = new Set(G.KINDS.filter((k) => /^[ny]/.test(k.id)).map((k) => k.ans));
  check("答えの名前（NAME_RE）：名前を書く問題の答えは全部 NAME_RE に合い、12の名前が全部出る", [...names].every((n) => NAME_RE.test(n)) && names.size === 12 && NDL.every((x) => names.has(x[0])), [...names].join());
  check("資料に無い異名（梅見月など）を入れない", !OUT_NAMES.test(readFileSync(path.join(root, "data.js"), "utf8")));
  // 書いた答えの見方（satou さんの好み：NFKC・空白のゆれ・かなは正解・別解も正解）
  const jb = [];
  for (const [i, x] of NDL.entries()) {
    const n = G.make(`n${i + 1}|j`), y = G.make(`y${i + 1}|j`), r = G.make(`r${i + 1}|j`);
    for (const P of [n, y]) {
      if (!G.judge(P, x[0]).ok || G.judge(P, x[0]).kana) jb.push(`${x[0]}`);
      if (!G.judge(P, ` ${[...x[0]].join(" ")}　`).ok) jb.push(`${x[0]} 空白`);
      for (const a of x[2]) if (!G.judge(P, a).ok || !G.judge(P, a).alt) jb.push(`${a} 別の書き方`);
      for (const k of x[1]) { const kata = [...k].map((c) => String.fromCharCode(c.charCodeAt(0) + 0x60)).join(""); if (!G.judge(P, k).ok || !G.judge(P, k).kana || !G.judge(P, kata).ok || !G.judge(P, kata.normalize("NFKC")).kana) jb.push(`${k} かな`); }
      const o = NDL[(i + 1) % 12]; if (G.judge(P, o[0]).ok || G.judge(P, o[0]).other !== ((i + 1) % 12) + 1) jb.push(`${o[0]} ほかの月`);
      if (G.judge(P, "").ok || G.judge(P, "   ").s) jb.push("空");
    }
    for (const k of x[1]) if (!G.judge(r, k).ok) jb.push(`${k} 読み`);
    if (G.judge(r, x[0]).ok || !G.judge(r, x[0]).kanji) jb.push(`${x[0]} 読みの問題に漢字`);
  }
  check("書いた答え：漢字・空白のゆれ・別の書き方（衣更着・早月）・かな（ひらがな・カタカナ）は正解、かなは「漢字では」の印、ほかの月の名前はその月を返す、読みの問題に漢字はまちがいに数えない", jb.length === 0, jb.slice(0, 6).join(","));
  // ヒントは、読みが2つある月でもどちらの読みにも当てはまる（文月：ふみづき・ふづき。tsuki-imei #1 の CodeRabbit）
  const hb = [];
  for (const k of G.KINDS.filter((k) => /^[nr]/.test(k.id))) { const ys = NDL[k.m - 1][1], t = k.look + k.key; const n = t.match(/(\d+)文字(?!目)/), p2 = t.match(/はじめの2文字は「(.+?)」/), p1 = t.match(/「(.)」で始ま/), su = t.match(/終わりは「(.+?)」/);
    if (n && !ys.every((y) => [...y].length === +n[1])) hb.push(k.id + " 文字数"); if (p2 && !ys.every((y) => y.startsWith(p2[1]))) hb.push(k.id + " はじめ2"); if (p1 && !ys.every((y) => y.startsWith(p1[1]))) hb.push(k.id + " はじめ"); if (su && !ys.every((y) => y.endsWith(su[1]))) hb.push(k.id + " 終わり"); }
  check("読みのヒント（文字数・はじめ・終わり）は、資料の読みのどれにも当てはまる", hb.length === 0, hb.join(","));
  check("書いた答え：空白をはさんだ半角の濁点（ﾐﾅﾂ ﾞｷ）も NFC でつけ直して正解", G.judge(G.make("n6|h"), "ﾐﾅﾂ ﾞｷ").ok && G.judge(G.make("r6|h"), "ﾐﾅﾂ ﾞｷ").ok);
  check("まちがいの印（wkey）：同じ月の名前と読みは同じ印・引き継ぎが受けない字（<>\"'`）を入れない・20字まで・正解は印にしない・読みの問題でほかの月の漢字と読みも同じ印", G.wkey(G.make("n2|w"), "睦月") === G.wkey(G.make("n2|w"), "ムツキ") && !/[<>"'`]/.test(G.wkey(G.make("n2|w"), '<b>"x\'`')) && G.wkey(G.make("n2|w"), "あ".repeat(40)).length === 20 && G.wkey(G.make("n2|w"), "如月") === "" && G.wkey(G.make("r2|w"), "如月") === "" && G.wkey(G.make("r1|w"), "如月") === "月2" && G.wkey(G.make("r1|w"), "きさらぎ") === "月2");
  check("書いた答え：半角カタカナ・全角英数も NFKC でそろえる", G.judge(G.make("n1|h"), "ﾑﾂｷ").ok && G.norm("ＡＢ　ｃ") === "ABc" && G.judge(G.make("r12|h"), "シワス").ok);
  const longWhy = [], longLook = [], longOpt = [];
  for (const k of G.KINDS) { if ([...k.why].length > 120) longWhy.push(k.id); if ([...k.look].length > 45 || [...k.key].length > 60) longLook.push(k.id); for (let s = 0; s < 200; s++) { const P = G.make(`${k.id}|len${s}`); for (const o of [P.q]) if ([...o].length > 60) longOpt.push(`${k.id}:${o}`); for (const o of P.s2.opts) if ([...o].length > 30) longOpt.push(`${k.id}:${o}`); } }
  check("説明は120字以内・ヒントは45字・60字以内・問いは60字以内・2段目の選び肢は30字以内（やさしい日本語。一文を短く）", !longWhy.length && !longLook.length && !longOpt.length, longWhy.concat(longLook, longOpt.slice(0, 3)).join(","));
  check("出典は国立国会図書館「日本の暦」の和風月名のページだけ", Object.keys(G.SRC).join() === "ndl" && /^国立国会図書館「日本の暦」/.test(G.SRC.ndl[0]));
  check("二十四節気・和暦・月の形（ほかのゲームの題材）を問わない", !G.KINDS.some((k) => { const all = [k.why, k.look, k.key, k.ans]; for (let i = 0; i < 100; i++) { const P = G.make(`${k.id}|nz${i}`); all.push(P.q, ...P.s2.opts); } return /節気|立春|春分|夏至|冬至|元号|令和|平成|昭和|満月|新月|三日月|上弦|下弦/.test(all.join()); }));
  check("2段目の問いは「名前の由来（よく言われる説）」と書き、1つに言い切らない", G.make("n1|s").s2.q === "名前の由来（よく言われる説）は？" && G.make("m1|s").s2.q === G.make("r1|s").s2.q);
}
{
  // 今日の5問・上級の組み方（3年分）
  const bad = [], cover = new Set(); let sameAsPrev = 0, prev = "";
  const d0 = Date.parse("2026-11-21");
  for (let i = 0; i < 365 * 3; i++) {
    const d = new Date(d0 + i * 864e5).toISOString().slice(0, 10), dl = G.dailyTags(d), hl = G.hardTags(d);
    const dk = dl.map((t) => t.split("|")[0]), hk = hl.map((t) => t.split("|")[0]);
    if (dl.length !== 5 || new Set(dk).size !== 5 || dk.map((k) => G.BY[k].lv).join() !== "0,0,1,1,2") bad.push(d + " 今日");
    if (hl.length !== 3 || new Set(hk).size !== 3 || hk.some((k) => G.BY[k].lv !== 2) || hk.includes(dk[4])) bad.push(d + " 上級");
    if (JSON.stringify(dl) !== JSON.stringify(G.dailyTags(d))) bad.push(d + " 同じにならない");
    if (dk.join() === prev) sameAsPrev++; prev = dk.join();
    if (i < 90) [...dk, ...hk].forEach((k) => cover.add(k));
  }
  check("今日の5問（やさしい2・ふつう2・むずかしい1、種類は重ねない）と上級（むずかしい3・今日のむずかしいと別）を3年分作れる", bad.length === 0, bad.slice(0, 5).join(","));
  check("3か月のうちに48種類が全部出る・前の日と同じ組の日が少ない", cover.size === 48 && sameAsPrev < 20, `${cover.size}種類・前の日と同じ ${sameAsPrev}日`);
  // 過去の日の問題が変わらない（data.js を直したときの見張り。値は 2026-11-20 に作ったもの）
  const snap = ["2026-11-21", "2026-11-22", "2027-01-01"].map((d) => [...G.dailyTags(d), ...G.hardTags(d)].map((t) => { const P = G.make(t); return `${P.kind}:${P.v}`; }).join(",")).join(";");
  check("過去の日（2026-11-21・11-22・2027-01-01）の5問と上級3問が作ったときのまま（種類・言い方を足す・並べ替える・消すと変わる）", snap === PINS, snap);
  // 印（種類・言い方の番号・選び肢の番号）が同じでも、問いの文や2段目の並びが変わったら落とす（言い回しの入れ替え。tsuki-imei #1 の CodeRabbit）
  const full = ["2026-11-21", "2026-11-22", "2027-01-01"].map((d) => [...G.dailyTags(d), ...G.hardTags(d)].map((t) => { const P = G.make(t); return `${P.kind}:${P.v}:${P.q}:${P.s2.opts.join("/")}`; }).join(",")).join(";");
  check("過去の日の問いの文と2段目の選び肢の並びも作ったときのまま（ハッシュ 704cee44158d73e3）", createHash("sha256").update(full).digest("hex").slice(0, 16) === "704cee44158d73e3", createHash("sha256").update(full).digest("hex").slice(0, 16));
}

// ---- 2. ファイルの中身 ----
const html = readFileSync(path.join(root, "index.html"), "utf8"), gen = readFileSync(path.join(root, "data.js"), "utf8"), readme = readFileSync(path.join(root, "README.md"), "utf8");
const ogSrc = readFileSync(path.join(root, "tools/make-og.cjs"), "utf8"), mfSrc = readFileSync(path.join(root, "manifest.webmanifest"), "utf8"), fbSrc = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$/.test(u));
check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない（出典のリンクは押したときに開くだけ）", ext.length === 0 && ![...html.matchAll(/<script[^>]+src="([^"]+)"/g)].some((m) => /^https?:/.test(m[1])), ext.join(","));
check("CSP で通信先を自分だけにしている", /connect-src 'self'/.test(html) && !/connect-src[^;"]*https/.test(html));
check("Math.random は練習・とことんの種だけ（今日の5問・上級は日付の乱数。data.js には無い）", (html.match(/Math\.random/g) || []).length === 2 && !/Math\.random/.test(gen));
check("乱数は sort の比較の中で引かない（ブラウザで引く回数が変わる）", !/\.sort\(\s*\([^)]*\)\s*=>[^\n;]*\b(R|rng|rand|Math\.random)\s*\(/.test(html + gen));
{ const inl = html.split("<script>").slice(1).map((x) => x.split("</" + "script>")[0]).join("\n"); // index.html の中の script も見る（nemuri-kotsu#1 で行の途中に // を入れて画面が動かなくなった）
  check("一行の式の途中にコメント // を足さない（行の残りが消える。rosen-hitofude 2026-11-04・nemuri-kotsu#1）", !/;\s*\/\/[^\n]*;\s*\w/.test((gen + "\n" + inl).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"))); }
check("書いて答える：変換中の Enter で送らない（e.isComposing || e.keyCode === 229）・NFKC でそろえる（game-dev.md「好み」）", /e\.key === "Enter" && \(e\.isComposing \|\| e\.keyCode === 229\)\) e\.preventDefault\(\)/.test(html) && /normalize\("NFKC"\)/.test(gen));
{ const howto = (html.match(/<dialog id="howto"[\s\S]*?<\/dialog>/) || [""])[0], ab = (html.match(/function about\(\)[\s\S]*?\n}/) || [""])[0], dis = (t) => /諸説/.test(t) && /よく言われる説/.test(t);
  check("言い方：遊び方・「このゲームについて」・README のどれにも、由来は諸説あり「よく言われる説」を出すことがある（1つに言い切らない）", dis(howto) && dis(ab) && dis(readme), `遊び方 ${dis(howto)}・について ${dis(ab)}・README ${dis(readme)}`);
  check("言い方：遊び方・「このゲームについて」・README に、いまの季節とは1～2か月ほどずれがあることがある", [howto, ab, readme].every((t) => /1～2か月ほど/.test(t)));
  check("言い方：由来を「正しい由来」「本当の由来」と言い切らない", !/正しい由来|本当の由来|由来はこれ|唯一の/.test(html + gen + readme)); }
// 写し元の言葉（写し元ごとに登録する：突風よみ toppu-yomi、その前の津波よみ tsunami-yomi）。index.html の外の手書きの文（OGP の絵・manifest・感想フォーム）も見る
{ const body = html.replace(/<!-- a11y:begin[\s\S]*?a11y:end -->/, "").replace(/<!-- store:begin[\s\S]*?store:end -->/, "") + gen + readme + ogSrc + mfSrc + fbSrc;
  const left = body.match(/突風|竜巻|ダウンバースト|ガストフロント|JEF|藤田|気象庁|風速|toppu|tpy-|TPY|津波|tsunami|tny-|TNY|🌪/g);
  check("写し元（突風よみ・津波よみ）の言葉が残っていない（game-dev.md A 手順5）", !left, (left || []).join(",")); }
check("画面にお笑いの言葉を入れない（本物っぽく）", !/お笑い|ギャグ|ツッコミ|なんでやねん|（うそ）/.test(html + gen));
check("引き継ぎ：transfer.js をゲームの script より前に、このゲームの記録のキー（記録・文字・復習）だけで読む・depth.js も前に読む", /<script src="transfer\.js" data-game="tsuki-imei" data-keys="tmei-v1,tmei-fs,tmei-depth"><\/script>\s*<script src="depth\.js" data-game="tsuki-imei" data-key="tmei-depth"><\/script>\s*<\/head>/.test(html) && html.indexOf('src="transfer.js"') < html.indexOf('src="data.js"') && /data-hk/.test(html) && existsSync(path.join(root, "transfer.js")));
check("記録のキーは tmei-v1・tmei-fs・tmei-depth", /const KEY = "tmei-v1", FSKEY = "tmei-fs"/.test(html));
check("好きなだけ遊べる：チケット・回数の上限・🔒で開くモードを入れない（game-dev.md F1・F2）", !/🎫|チケット|すると開く|🔒/.test(html) && !/\blife\b|ELIFE/.test(html));
// ゲームごとに手で書く所（incidents/2026-11-18-game-copy-hand-written-text.md・game-copy-manifest-feedback.md）
{ const desc = (html.match(/<meta name="description" content="([^"]+)"/) || [])[1] || "", howto = (html.match(/<dialog id="howto"[\s\S]*?<\/dialog>/) || [""])[0], lead = (html.match(/<p class="lead"[^>]*>([^<]*)/) || [])[1] || "";
  check("手で書く所：meta description が和風月名・由来・国立国会図書館の話", /和風月名/.test(desc) && /由来/.test(desc) && /国立国会図書館/.test(desc), desc);
  check("手で書く所：遊び方が、名前を書く（かなでも正解）・12の月から選ぶ・由来を選ぶ場面", /睦月/.test(howto) && /かなで書いても正解/.test(howto) && /12の月から選びます/.test(howto) && /由来（よく言われる説）/.test(howto));
  check("手で書く所：ホームの1行目が旧暦の月の名前の問い", /^旧暦の3月の名前は？/.test(lead), lead);
  check("手で書く所：2段目のまちがいの案内が、由来・月の言い方", /ちがう月の説です/.test(html) && /ちがう月です/.test(html));
  check("手で書く所：manifest の description・感想フォームの入力例がこのゲームの言葉", /和風月名/.test(JSON.parse(mfSrc).description) && /師走|神無月/.test(fbSrc) && /読みを書く/.test(fbSrc)); }
{ const ans = (ogSrc.match(/ANS = "([^"]+)"/) || [])[1] || "", opts = JSON.parse((ogSrc.match(/OPTS = (\[[^\]]+\])/) || [])[1] || "[]");
  check("共有画像の正解は、このゲームの答えのどれか（場面と選び肢も資料の名前）", NAME_RE.test(ans) && opts.includes(ans) && opts.every((o) => NAME_RE.test(o)) && /旧暦の3月の名前は？/.test(ogSrc) && ans === NDL[2][0], ans); }
// 出典の URL は定義を正規表現で見る（includes だと CodeQL が警告にする。incidents/2026-11-11-codeql-url-includes-in-qa.md）
check("出典の定義：国立国会図書館「日本の暦」和風月名のページ", /ndl: \["国立国会図書館「日本の暦」和風月名", "https:\/\/www\.ndl\.go\.jp\/koyomi\/chapter3\/s8\.html"\]/.test(gen));
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/tsuki-imei/og.png" && og("og:url") === "https://satou-aaaaa.github.io/tsuki-imei/" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = fbSrc;
  check("感想フォームの name が3字以上（2字だとフォームが出ない。shared-workflows incidents/2026-11-05-feedback-form-not-shown.md）", [...((fy.match(/^name:\s*(.+)$/m) || [])[1] || "").trim()].length >= 3);
  check("感想フォームは名前・メールを聞かない", /id: fun/.test(fy) && !/id: (name|email|mail)/.test(fy) && /labels: \["感想"\]/.test(fy)); }
check("README の URL のすぐ後ろに全角の字を続けない（Link check が URL の一部と読む）", !/https?:\/\/[\x21-\x7e]*[^\x00-\x7f]/.test(readme.replace(/\]\(https?:\/\/[^)\s]+\)/g, "").replace(/<https?:\/\/[^>\s]+>/g, "")));
{ const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(mfSrc);
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1]);
  check("PWA：sw.js は画面のファイルを全部保存し（引き継ぎの transfer.js・深さの depth.js も）、取り直して保存し、外へ何も送らない", ["./index.html", "./data.js", "./transfer.js", "./depth.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"].every((f) => shell.includes(f)) && /cache: "reload"/.test(sw) && /const CACHE = "tmei-v\d+"/.test(sw) && !/https?:\/\//.test(sw.replace(/^\/\/.*$/gm, "")));
  { const st = await checkSwStall(sw); check("PWA：通信が止まっても4秒ほどで保存した画面に切り替わり、少しずつ届く受信は待ち、何も無ければ60秒で返す（shared-workflows template/qa/sw-check.mjs）", st.ok, JSON.stringify(st)); }
  check("PWA：manifest にアイコン2つと名前がある", mf.name === "月の異名あて" && mf.icons.length >= 2 && mf.start_url === "./"); }

// ---- 3. ブラウザで遊ぶ ----
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname), f = path.join(root, p === "/" ? "index.html" : p);
  if ((f !== root && !f.startsWith(root + path.sep)) || !existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
const TODAY = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const dayBefore = (n) => new Date(Date.parse(TODAY) - n * 864e5).toISOString().slice(0, 10);
async function newPage(w = 390, ctx) {
  const c = ctx || await browser.newContext({ viewport: { width: w, height: 800 } });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); });
  await p.goto(url); await p.waitForTimeout(200);
  return p;
}
const closeHow = async (p) => { await firstClose(p); };
const ansIdx = (p) => p.evaluate(() => { const c = __nm.cur(); return c.P.opts.indexOf(c.P.ans); });
const wrongIdx = (p) => p.evaluate(() => { const c = __nm.cur(); return c.P.opts.findIndex((o) => o !== c.P.ans && !c.wrong.includes(o)); });
const isNum = (p) => p.evaluate(() => __nm.cur().P.type === "num");
const mem = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("tmei-v1") || "{}"));
let wn = 0;
// 1段目：月を選ぶ問題はボタン、書く問題は欄に書いて「こたえる」
async function answerRight(p) { if (await isNum(p)) await p.click(`.ch[data-j="${await ansIdx(p)}"]`); else { await p.fill("#in", await p.evaluate(() => __nm.cur().P.ans)); await p.click("#go"); } }
async function answerWrong(p) { if (await isNum(p)) await p.click(`.ch[data-j="${await wrongIdx(p)}"]`); else { await p.fill("#in", "まちがい" + ++wn); await p.click("#go"); } }
const s2Idx = (p) => p.evaluate(() => { const c = __nm.cur(); return c.P.s2.opts.indexOf(c.P.s2.ans); });
const s2Wrong = (p) => p.evaluate(() => { const c = __nm.cur(); return c.P.s2.opts.findIndex((o) => o !== c.P.s2.ans && !c.w2.includes(o)); });
// 2段目「名前の由来（よく言われる説）は？」（由来から書いた問題は「旧暦の何月？」）が出たら、正しいものを押す
const why = async (p) => { await p.waitForSelector(".verdict, .why button"); if (await p.locator(".verdict").count()) return; await p.click(`.why button[data-o="${await s2Idx(p)}"]`); };
async function solve(p, { wrong = 0 } = {}) {
  for (let i = 0; i < wrong; i++) await answerWrong(p);
  await answerRight(p);
  await why(p);
  await p.waitForSelector(".verdict");
}

try {
  // はじめて：遊び方が出る・文字の大きさ
  const p = await newPage();
  check("はじめて開くと遊び方が出る", await p.locator("#core-coach").waitFor({ timeout: 3000 }).then(() => true, () => false));
  { const c = await browser.newContext(); const r = await c.newPage(); await r.goto(url); await r.waitForTimeout(200); let again = 0;
    for (let i = 0; i < 10; i++) { await r.evaluate(() => localStorage.clear()); await r.reload(); await r.waitForTimeout(200); await r.keyboard.press("Escape"); await r.reload(); await r.waitForTimeout(200); again += await r.locator("#howto[open]").count(); }
    check("遊び方を Esc で閉じてすぐ読み直しても出ない（10回）", again === 0);
  { const c = await browser.newContext(); const r = await c.newPage(); const big = []; // 題が h1{flex:1} で縦に伸び（伸びない形と比べて4pxより高ければ失敗）、iPad の縦で大きなすき間が出た（shared-workflows incidents/2026-11-07-title-stretched.md）
    for (const [w, h] of [[820, 1180], [390, 844], [1280, 800]]) { await r.setViewportSize({ width: w, height: h }); await r.goto(url); await r.waitForTimeout(200); await r.keyboard.press("Escape"); await r.waitForTimeout(100);
      const v = await r.evaluate(() => { const e = [...document.querySelectorAll(".title")].find((x) => x.offsetParent); if (!e) return null; const h = e.getBoundingClientRect().height; const f = e.style.flex; e.style.flex = "none"; const n = e.getBoundingClientRect().height; e.style.flex = f; return h - n; });
      if (v === null || v > 4) big.push(`${w}x${h}:${v === null ? "題なし" : "+" + Math.round(v) + "px"}`); }
    check("ホームの題は縦長の画面でも縦に伸びない（820×1180・390×844・1280×800）", big.length === 0, big.join(" ")); await c.close(); }
    await r.evaluate(() => localStorage.clear()); await r.reload(); await r.waitForTimeout(200);
    check("はじめての練習が始まったその場で「見た」が残る", await r.evaluate(() => { return Object.keys(localStorage).some((k) => { try { return JSON.parse(localStorage.getItem(k)).tut === true; } catch { return false; } }); })); await firstClose(r);
    await r.reload(); await r.waitForTimeout(200); check("遊び方を「わかった」で閉じてすぐ読み直しても出ない（その場で残す）", await r.locator("#howto[open]").count() === 0); await c.close(); }
  await firstClose(p);
  check("文字の大きさ：はじめは「大きい」（19px）", await p.evaluate(() => getComputedStyle(document.documentElement).fontSize) === "19px");
  await p.click('.fsrow button[data-fs="3"]');
  await p.reload(); await p.waitForTimeout(150);
  check("文字の大きさ：「とても大きい」にすると開き直しても残る", await p.evaluate(() => getComputedStyle(document.documentElement).fontSize) === "23px" && await p.locator('.fsrow button[data-fs="3"][aria-pressed="true"]').count() === 1);
  await p.click('.fsrow button[data-fs="2"]');
  check("ホームに今日のきほんが出る", (await p.textContent("#tip")).includes("今日のきほん"));

  // 今日の5問：1問目はまちがえる、2問目はヒント2回、ほかはそのまま
  await p.click("#go-d");
  const tags = await p.evaluate(() => __nm.load().runs.d.list);
  check("今日の5問は日付から決まる（data.js の dailyTags と同じ）", JSON.stringify(tags) === JSON.stringify(G.dailyTags(TODAY)));
  check("問題の画面：やさしいの1問目は名前を見て12の月から選ぶ（ボタン12・高さ44px以上・名前の大きな字）", await p.locator("#card").count() === 1 && (await p.$$eval(".ch", (b) => b.map((x) => Math.round(x.getBoundingClientRect().height)))).every((h) => h >= 44) && await p.locator(".ch").count() === 12 && NAME_RE.test((await p.textContent("#card .moon")).trim()) && (await p.textContent("#card .sit")).length > 5);
  check("押せる行には読み上げ用の名前がある", (await p.$$eval(".ch", (t) => t.filter((x) => !x.getAttribute("aria-label")).length)) === 0);
  await p.click(`.ch[data-j="${await wrongIdx(p)}"]`);
  check("まちがえると ✕ の印と読み上げの「ちがう」（色だけで分けない）・その月の名前を知らせる・知らせは role=status", await p.locator(".ch.ng").count() === 1 && (await p.evaluate(() => getComputedStyle(document.querySelector(".ch.ng"), "::after").content)).includes("✕") && (await p.getAttribute(".ch.ng", "aria-label")).includes("ちがう") && /月は「.+」です/.test(await p.textContent("#msg")) && /✕/.test(await p.textContent("#msg")) && await p.getAttribute("#msg", "role") === "status");
  // 開き直しても、まちがえた選び肢は残る
  await p.reload(); await p.waitForTimeout(150); await p.click("#go-d");
  check("途中で閉じても続きから（同じ問題・まちがえた印のまま）", await p.locator(".ch.ng").count() === 1 && await p.evaluate(() => __nm.cur().i) === 0);
  await solve(p);
  check("正解すると「正解」の判・なぜの説明・出典のリンク・★2（まちがい1回）", await p.locator(".ch.ok").count() === 1 && /✓/.test(await p.evaluate(() => getComputedStyle(document.querySelector(".ch.ok"), "::after").content)) && (await p.textContent(".verdict .why")).length > 20 && await p.locator(".verdict .src a").count() >= 1 && (await p.getAttribute(".verdict .stars", "aria-label")) === "星2つ");
  await p.click("#next");
  await p.click("#hint");
  check("ヒント1は見るところを言う（答えは言わない）", (await p.textContent("#hintbox")).includes("💡") && await p.locator(".ch.ng").count() === 0);
  await p.click("#hint");
  check("ヒント2（月を選ぶ問題）はまちがいを消して2つにしぼり、読みも見せる・ヒントは2回まで", await p.locator(".ch:not(.ng)").count() === 2 && (await p.textContent("#hintbox")).includes(await p.evaluate(() => __nm.cur().P.key)) && await p.locator("#hint:disabled").count() === 1);
  await solve(p);
  check("ヒント2回は★1", (await p.getAttribute(".verdict .stars", "aria-label")) === "星1つ");
  await p.click("#next");
  check("次の問題へ進むと、フォーカスが問題（#card）に移る", await p.evaluate(() => document.activeElement && document.activeElement.id) === "card");
  for (let i = 2; i < 5; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  const s1 = await mem(p);
  check("5問で結果：今日の記録に1問ごとのまちがい（1・2・0・0・0）", JSON.stringify(s1.days[TODAY]?.m) === "[1,2,0,0,0]");
  const share = await p.textContent(".share");
  check("シェアの文に答え・問題を出さない（印だけ）", /第\d+回/.test(share) && /🟢/.test(share) && !NDL.some((x) => share.includes(x[0])) && !/[1-9]月/.test(share), share);
  check("まちがいのある日は Ko-fi の一言を出さない", await p.locator(".kofi").count() === 0);
  check("結果に「あと少しの実績」と、続けて遊ぶ・上級のボタン", await p.locator("#achnext").count() === 1 && await p.locator("#go-e").count() === 1 && await p.locator("#go-h").count() === 1);
  check("まなび帳に解いた種類が載る", Object.keys(s1.dex).length === 5);
  await p.click("#back");
  check("今日を終えたら、ホームは「今日の結果を見る」と上級", (await p.textContent("#go-d")).includes("結果") && await p.locator("#go-h").count() === 1);
  // 上級：ヒントなし・3問
  await p.click("#go-h");
  check("上級はヒントのボタンが無い・3問", await p.locator("#hint").count() === 0 && (await p.evaluate(() => __nm.load().runs.h.list.length)) === 3);
  for (let i = 0; i < 3; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  check("上級の記録は hdays に入る", (await mem(p)).hdays[TODAY]?.m.length === 3);
  // 練習：記録を増やさない
  await p.click("#back"); await p.click("#go-p"); await p.click('.lv button[data-t="2"]');
  const before = await mem(p);
  for (let i = 0; i < 5; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  const after = await mem(p);
  check("練習は今日の記録を増やさない（まなび帳の数はふえる）", JSON.stringify(after.days) === JSON.stringify(before.days) && Object.values(after.dex).reduce((a, b) => a + b) === Object.values(before.dex).reduce((a, b) => a + b) + 5);
  // まなび帳からその種類だけで練習
  await p.click("#back"); await p.click("#go-dex");
  const firstKind = await p.getAttribute(".book button", "data-k");
  await p.click(".book button");
  check("まなび帳の種類を押すと、その種類だけで練習", (await p.evaluate(() => __nm.load().runs.p.list)).every((t) => t.startsWith(firstKind + "|")));
  // とことん：まちがえてもヒントを使っても続き、「ここで降りる」で終わる（game-dev.md F1）
  await p.click("#back"); await p.click("#go-e");
  check("とことんは60問の並びから・ライフ（🌸・🎫）が無い", (await p.evaluate(() => __nm.load().runs.e.list.length)) === 60 && !("life" in await p.evaluate(() => __nm.load().runs.e)) && await p.locator("#quit").count() === 1);
  await solve(p); await p.click("#next"); await solve(p); await p.click("#next");
  await solve(p, { wrong: 1 }); await p.click("#next");
  await p.click("#hint"); await p.click("#hint"); await solve(p); await p.click("#next");
  check("とことんはまちがい・ヒント2回でも終わらない", await p.locator("#card").count() === 1 && await p.evaluate(() => __nm.load().runs.e.res.length) === 4);
  await p.reload(); await p.waitForTimeout(200);
  check("とことんは閉じても続きから", (await p.textContent("#go-e")).includes("続きから"));
  await p.click("#go-e");
  {
    // 別のタブでこの回を終えて新しい回を始めていたら、古い画面の「ここで降りる」は新しい回を終えない（funka-level #1 の CodeRabbit）
    const keep0 = await p.evaluate(() => __nm.load().runs.e);
    await p.evaluate(() => __nm.save((s) => { s.runs.e = Object.assign({}, s.runs.e, { id: "other-tab-run", res: [] }); }));
    await p.click("#quit"); await p.waitForTimeout(150);
    check("古い画面の「ここで降りる」は、別のタブで始めた新しい回を終えない", (await p.evaluate(() => __nm.load().runs.e && __nm.load().runs.e.id)) === "other-tab-run");
    await p.evaluate((r) => __nm.save((s) => { s.runs.e = r; }), keep0);
    await p.evaluate(() => __nm.play("e"));
  }
  await p.click("#quit"); await p.waitForTimeout(150);
  check("「ここで降りる」で終わり、一度で正解した数（2問）が自己ベストに残る", (await mem(p)).ebest === 2 && (await p.textContent("#eres")).includes("4問") && !("e" in (await mem(p)).runs && (await mem(p)).runs.e));
  {
    // とことんの並びを何百回作って、1回の中で同じ問題が無い・続けて同じ種類が無い・足しても重ならない
    const r = await p.evaluate(() => { const K = __nm.G, bad = []; for (let n = 0; n < 300; n++) { const l = __nm.endlessList(), more = l.concat(__nm.moreList(l)); const ks = more.map((t) => K.keyOf(K.make(t))); if (new Set(ks).size !== ks.length) bad.push("重なり"); if (more.some((t, i) => i && t.split("|")[0] === more[i - 1].split("|")[0])) bad.push("同じ種類が続く"); if (l.length !== 60 || more.length !== 100) bad.push("数" + l.length + "/" + more.length); } return bad; });
    check("とことんの並び300回：60問＋足した40問で同じ問題も同じ種類の連続も無い（game-dev.md F6）", r.length === 0, r.slice(0, 3).join(","));
  }
  {
    // 引き継ぎコードなどで数の所に文字が入っても、画面に HTML として出さない（2026-11-05 CodeRabbit）
    const q = await newPage(); await closeHow(q);
    await q.evaluate(() => { const s = JSON.parse(localStorage.getItem("tmei-v1")) || { v: 1 }; s.ebest = '<img id="xss" src=x>'; s.dex = { e: '"><b id="xss2">' }; s.runs = { e: { mode: "e", id: '"><i id="xss3">', date: "2026-11-07", list: ["m1|1"], res: [] }, h: { list: "bad", res: [] }, p: { mode: "p", id: "y", date: "2026-11-07", list: ["constructor|1"], res: [] }, d: { mode: "d", id: "z", date: "x", list: ["m1|1"], res: [] }, "a:2026-11-06": { mode: "a", id: "a1", date: "2026-11-06", list: ["m1|1"], res: [null] }, "a:2026-11-05": { mode: "a", id: "a2", date: "2026-11-05", list: "bad", res: [] }, "a:2026-11-04": { mode: "a", id: "a3", date: "2026-11-04", list: ["m1|1", "m1|2"], res: [{ m: 0 }], cur: { i: 1, tag: "m1|2", wrong: "x", hints: 0 } } }; s.days = { "2026-11-07": { m: "x" }, bad: { m: [0] }, "2026-02-30": { m: [0] } }; localStorage.setItem("tmei-v1", JSON.stringify(s)); });
    await q.reload(); await q.waitForTimeout(250);
    const st = await q.evaluate(() => __nm.load());
    check("記録の形を直す：数の所の文字は0に・形のちがう途中経過と日ごとの記録は捨てる", st.ebest === 0 && st.dex.e === 0 && st.runs.e && !("h" in st.runs) && !("p" in st.runs) && !("d" in st.runs) && !("a:2026-11-06" in st.runs) && !("a:2026-11-05" in st.runs) && st.runs["a:2026-11-04"] && st.runs["a:2026-11-04"].cur === null && Object.keys(st.days).length === 0);
    await q.click("#go-e"); await q.waitForTimeout(150);
    check("形を直した記録で、とことんの続きの画面が開く", await q.locator("#card").count() === 1);
    {
      // 知らない mode や、置き場とちがう mode の途中経過は捨てる（ホームが出なくなるのを防ぐ。2026-11-07 CodeRabbit）
      const z = await newPage(); await closeHow(z);
      await z.evaluate(() => { const s = JSON.parse(localStorage.getItem("tmei-v1")) || { v: 1 }; s.v = 1; s.runs = { d: { mode: "x", date: "2026-11-07", list: [], res: [] }, h: { mode: "d", date: "2026-11-07", list: [], res: [] } }; localStorage.setItem("tmei-v1", JSON.stringify(s)); });
      await z.reload(); await z.waitForTimeout(200);
      const r = await z.evaluate(() => __nm.load().runs);
      check("知らない mode の途中経過は捨て、ホームが出る", !("d" in r) && !("h" in r) && await z.locator("#go-d").count() === 1);
      // 別のタブで終えたまま記録していない上級の回は、次の回を始める前に記録する
      await z.evaluate(() => { const s = __nm.load(), y = "2026-11-06", G = __nm.G; s.runs.h = { mode: "h", date: y, list: G.hardTags(y), res: [{ m: 0 }, { m: 0 }, { m: 0 }], cur: null, id: "old" }; localStorage.setItem("tmei-v1", JSON.stringify(s)); });
      await z.reload(); await z.waitForTimeout(200); await z.evaluate(() => __nm.start("h"));
      check("終えたまま残った前の日の回は、上書きする前に記録する", !!(await mem(z)).hdays["2026-11-06"]);
      // とことんで足せる問題が無くても、くり返し呼んで固まらない
      const ok = await z.evaluate(() => { const s = __nm.load(); s.runs.e = { mode: "e", date: __nm.todayKey(), list: ["m1|1", "n1|1"], res: [{ m: 0 }, { m: 0 }], cur: null, id: "e1" }; localStorage.setItem("tmei-v1", JSON.stringify(s)); const ml = __nm.setMore(() => []); try { __nm.play("e"); return true; } catch (e) { return String(e); } finally { __nm.setMore(ml); } });
      check("とことんで足せる問題が無くても固まらずに終える", ok === true && await z.locator("#eres").count() === 1, String(ok));
      await z.context().close();
    }
    check("記録の文字を HTML として出さない", await q.locator("#xss, #xss2, #xss3").count() === 0);
    await q.context().close();
  }
  // 実績・このゲームについて
  await p.click("#back"); await p.click("#go-ach");
  check("実績は13個で、腕前・集める・続けるの3つの組", await p.locator(".ach").count() === 13 && await p.locator(".agrp").count() === 3 && await p.locator(".ach.got").count() >= 3);
  check("達成した実績は ✓ の文字も付く（色だけで分けない）", (await p.textContent(".ach.got b")).startsWith("✓"));
  await p.click("#back"); await p.click("#f-about");
  { const links = await p.$$eval("#about a", (a) => a.map((x) => [x.getAttribute("href"), x.textContent.trim()]));
    // 「答えの出どころ」と「くわしく調べる所」のリンクの名前は、URL → 表示名全体の完全一致で見る（写し元の名前が残らないように）
    const CHNAME = { "https://www.ndl.go.jp/koyomi/chapter3/s8.html": "国立国会図書館「日本の暦」和風月名", "https://www.ndl.go.jp/koyomi/": "国立国会図書館「日本の暦」" };
    check("このゲームについて：由来は諸説・季節のずれ・出典と調べる所のリンクの名前が表（CHNAME）と完全に同じ", (await p.textContent("#about")).includes("諸説") && links.length === Object.keys(CHNAME).length && links.every(([u, n]) => CHNAME[u] === n) && Object.keys(CHNAME).every((u) => links.some((l) => l[0] === u)), JSON.stringify(links)); }
  await p.context().close();

  // まちがいなしの日は Ko-fi を1回だけ
  {
    const q = await newPage(); await closeHow(q); await q.click("#go-d");
    for (let i = 0; i < 5; i++) { await solve(q); await q.click("#next"); }
    await q.waitForTimeout(150);
    check("全部まちがいなしで初めて終えたときだけ Ko-fi の一言", await q.locator(".kofi").count() === 1 && (await q.textContent(".big")).includes("まちがいなし"));
    await q.click("#back"); await q.click("#go-d");
    check("結果をもう一度見ても Ko-fi は出さない", await q.locator(".kofi").count() === 0);
    await q.context().close();
  }

  // カレンダー・あとから：過去の日の記録を置いて見る。第1回から日がたっていなくても見られるよう、時計を10日進める
  {
    const SHIFT = +(process.env.QA_SHIFT_DAYS || 10) * 864e5, TODAY = new Date(Date.now() + 9 * 3600e3 + SHIFT).toISOString().slice(0, 10), dayBefore = (n) => new Date(Date.parse(TODAY) - n * 864e5).toISOString().slice(0, 10);
    const cx = await browser.newContext({ viewport: { width: 390, height: 800 } });
    await cx.addInitScript((sh) => { const o = Date.now; Date.now = () => o() + sh; }, SHIFT);
    const q = await newPage(390, cx);
    await q.evaluate(([d2, d3]) => { localStorage.setItem("tmei-v1", JSON.stringify({ v: 1, tut: true, days: { [d2]: { m: [0, 0, 0, 0, 0], k: [] }, [d3]: { m: [1, 0, 0, 2, 0], k: [] } }, hdays: {}, adays: {}, dex: {}, runs: {}, kofi: {}, ach: {}, ebest: 0 })); }, [dayBefore(2), dayBefore(3)]);
    await q.reload(); await q.waitForTimeout(150);
    check("ホームの「続けて」は、きのうを休んだら — （休んだ日を責めない）", (await q.textContent(".stats")).includes("—"));
    await q.click("#go-cal");
    const lateList = await q.evaluate(() => __nm.lateDays(__nm.load()));
    const exp = [1, 4, 5, 6, 7].map(dayBefore).filter((d) => d >= "2026-11-21");
    check("カレンダー：取りこぼした過去7日（第1回より後）を押せる", JSON.stringify(lateList) === JSON.stringify(exp), lateList.join(","));
    check("カレンダー：遊んだ日は★の数の文字も付く", (await q.locator(".cal .c.p3").count()) + (await q.locator(".cal .c.p2").count()) + (await q.locator(".cal .c.p1").count()) >= (dayBefore(3).slice(0, 7) === TODAY.slice(0, 7) ? 2 : 0));
    if (lateList.length) {
      const d = lateList[0];
      await q.evaluate((d) => { const b = document.querySelector(`.cal .miss[data-k="${d}"]`); if (b) b.click(); else { const m = document.querySelector(".calnav #prev"); m && m.click(); } }, d);
      if (!(await q.locator(".ch").count())) await q.click(`.cal .miss[data-k="${d}"]`);
      check("あとから：その日の今日の5問と同じ問題", JSON.stringify(await q.evaluate((d) => __nm.load().runs["a:" + d].list, d)) === JSON.stringify(G.dailyTags(d)));
      for (let i = 0; i < 5; i++) { await solve(q); await q.click("#next"); }
      await q.waitForTimeout(150);
      const s = await mem(q);
      check("あとからは adays に入り、今日の記録・続けた日には数えない", s.adays[d] && !s.days[d] && (await q.locator(".share").count()) === 0 && (await q.locator(".kofi").count()) === 0);
    } else check("あとから：遊べる日がある", false, "第1回の日から日がたっていない");
    await q.context().close();
  }

  // 終えた回（gone）がある側の保存に失敗し、別のタブが古い回を新しく保存しても、終えた回を戻さない（shindo-yomi PR #1 の CodeRabbit。GameStore の after で落とす）
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const g = await newPage(390, ctx);
    const left = await g.evaluate(() => {
      const r = { mode: "e", date: __nm.todayKey(), list: ["m1|1", "n1|1"], res: [{ m: 0 }], cur: null, id: "gone1" };
      const base = __nm.load();
      const a = JSON.parse(JSON.stringify(base)); a.runs.e = null; a.gone = { gone1: 1 }; a.t = 100;
      const b = JSON.parse(JSON.stringify(base)); b.runs.e = r; b.t = 200;
      localStorage.setItem("tmei-v1", JSON.stringify(b)); __nm.setMem(JSON.stringify(a));
      try { return __nm.load().runs.e; } finally { __nm.setMem(null); }
    });
    check("終えた回は、別のタブが新しく保存した古い写しから戻さない", !left, JSON.stringify(left));
    await ctx.close();
  }
  // 同じ問題の途中で、保存に失敗した側と保存できた側のまちがいを合わせる（CodeRabbit shindo-yomi#1）
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const g = await newPage(390, ctx);
    const got = await g.evaluate(() => {
      const base = __nm.load(), mk = (w, w2) => ({ mode: "p", date: __nm.todayKey(), list: ["m1|m1", "n1|m1"], res: [], cur: { i: 0, tag: "m1|m1", wrong: w, hints: 0, step: 2, w2 }, id: "mg1" });
      const a = JSON.parse(JSON.stringify(base)); a.runs.p = mk(["2月"], ["由来A"]); a.t = 100;
      const b = JSON.parse(JSON.stringify(base)); b.runs.p = mk(["3月"], ["由来B"]); b.t = 200;
      localStorage.setItem("tmei-v1", JSON.stringify(b)); __nm.setMem(JSON.stringify(a));
      try { return __nm.load().runs.p.cur; } finally { __nm.setMem(null); }
    });
    check("同じ問題の途中なら、保存に失敗した側のまちがい（1段目・2段目）も消さずに合わせる", got && got.wrong.includes("2月") && got.wrong.includes("3月") && got.w2.includes("由来A") && got.w2.includes("由来B"), JSON.stringify(got));
    const n = await g.evaluate(() => { __nm.save((s) => { s.runs.p = { mode: "p", date: __nm.todayKey(), list: ["m1|s1", "n1|s1"], res: [], cur: null, id: "sc1" }; }); __nm.play("p"); __nm.sureCount(true); __nm.sureCount(true); return __nm.load().runs.p.ds; });
    check("「自信あり」の数は1問につき1回だけ（2つのタブで同じ問題を当てても2回足さない）", n && n.n === 1 && n.ok === 1, JSON.stringify(n));
    await ctx.close();
  }

  // 古いタブ：同じ問題を2つのタブで開き、片方で答えたら、もう片方は二重に入れない
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const a = await newPage(390, ctx); await closeHow(a); await a.click("#go-d");
    const b = await ctx.newPage(); b.on("pageerror", (e) => errors.push(e.message)); await b.goto(url); await b.waitForTimeout(150); await b.click("#go-d");
    await solve(a);
    await b.click(`.ch[data-j="${await ansIdx(b)}"]`);
    await b.waitForTimeout(200);
    const s = await mem(a);
    check("古いタブで同じ問題に答えても二重に数えない", s.runs.d.res.length === 1 && Object.values(s.dex).reduce((x, y) => x + y) === 1);
    // ヒントの数は、別のタブで使った分も減らさない
    await a.click("#next"); await b.goto(url); await b.waitForTimeout(150); await b.click("#go-d");
    await a.click("#hint"); await a.click("#hint");
    await b.click("#hint");
    check("別のタブで使ったヒントの数を減らさない", (await mem(a)).runs.d.cur.hints === 2);
    // 正解した時も、別のタブで使ったヒントを合わせて★を数える（2026-11-07 CodeRabbit）
    await b.click(`.ch[data-j="${await ansIdx(b)}"]`); await why(b); await b.waitForTimeout(150);
    check("正解の時も別のタブのヒントを合わせて数える（★1）", (await mem(b)).runs.d.res[1].m === 2);
    await ctx.close();
  }

  // 書いて答える（satou さんの好み：変換中の Enter で送らない・NFKC と空白のゆれ・かなは正解でまちがいに数えない・別解も正解・候補はヒントの最後の段だけ）
  {
    const q = await newPage(); await closeHow(q);
    await q.evaluate((tags) => { __nm.save((s) => { s.runs.p = { mode: "p", date: __nm.todayKey(), list: tags, res: [], cur: null, id: "in1" }; }); __nm.play("p"); }, ["n6|i1", "n2|i2", "n1|i3", "r6|i4", "y12|i5"]);
    check("書く問題：欄と「こたえる」がある・候補ははじめは出ない・欄は高さ44px以上", await q.locator("#in").count() === 1 && await q.locator("#go").count() === 1 && await q.locator("#cands:not([hidden])").count() === 0 && Math.round(await q.$eval("#in", (e) => e.getBoundingClientRect().height)) >= 44);
    await q.fill("#in", "水無月");
    const ime = await q.evaluate(() => { const i = document.getElementById("in"); const mk = (o) => { const e = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...o }); i.dispatchEvent(e); return e.defaultPrevented; }; const e229 = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }); Object.defineProperty(e229, "keyCode", { get: () => 229 }); i.dispatchEvent(e229); return [mk({ isComposing: true }), e229.defaultPrevented, mk({})]; });
    await q.waitForTimeout(50);
    check("変換中の Enter（isComposing・keyCode 229）では送らず（答えを書いてあっても段もまちがいも変わらない）、ふつうの Enter は送れる", JSON.stringify(ime) === "[true,true,false]" && await q.evaluate(() => __nm.cur().step === 1 && __nm.cur().wrong.length === 0) && await q.locator(".why button").count() === 0, JSON.stringify(ime));
    await q.fill("#in", " ミナ　ツキ "); await q.press("#in", "Enter"); await q.waitForTimeout(80);
    check("かな（カタカナ・空白入り）で名前を書くと正解・「漢字では「水無月」」と見せる・まちがいに数えない", await q.locator(".why button").count() === 4 && (await q.textContent("#msg")).includes("漢字では「水無月」") && await q.evaluate(() => __nm.cur().wrong.length) === 0);
    await why(q); await q.waitForSelector(".verdict");
    check("かなで書いて正解した問題は★3・答えの画面に漢字と読みが出る", await q.evaluate(() => __nm.load().runs.p.res[0].m) === 0 && (await q.textContent(".verdict .kanji")).includes("水無月") && (await q.textContent(".verdict .kanji")).includes("みなつき"));
    await q.click("#next");
    await q.fill("#in", "   "); await q.click("#go");
    check("何も書かずに送ると、まちがいに数えず「書いてください」", await q.evaluate(() => __nm.cur().wrong.length) === 0 && (await q.textContent("#msg")).includes("書いてください"));
    await q.fill("#in", "睦月"); await q.click("#go");
    check("ほかの月の名前を書くと ✕ と「旧暦1月の名前です」・まちがい1", await q.evaluate(() => __nm.cur().wrong.length) === 1 && (await q.textContent("#msg")).includes("旧暦1月の名前") && (await q.textContent("#msg")).includes("✕"));
    await q.fill("#in", "むつき"); await q.click("#go");
    check("同じ月の名前と読み（睦月・むつき）は1つのまちがいに数える", await q.evaluate(() => __nm.cur().wrong.length) === 1 && (await q.textContent("#msg")).includes("同じ"));
    const w0 = await q.evaluate(() => __nm.cur().wrong.slice());
    await q.fill("#in", "睦月"); await q.click("#go");
    check("まったく同じ答えをもう一度書いても数えない", JSON.stringify(await q.evaluate(() => __nm.cur().wrong)) === JSON.stringify(w0) && (await q.textContent("#msg")).includes("同じ"));
    await q.reload(); await q.waitForTimeout(150); await q.evaluate(() => __nm.play("p"));
    check("書いたまちがいは、閉じて開き直しても残る", JSON.stringify(await q.evaluate(() => __nm.cur().wrong)) === JSON.stringify(w0));
    await q.fill("#in", "<b>＜"); await q.click("#go");
    check("書いたまちがいに < などがあっても、記録には引き継ぎが受けない字を残さない", await q.evaluate(() => __nm.cur().wrong.length) === 2 && (await q.evaluate(() => __nm.load().runs.p.cur.wrong)).every((w) => !/[<>"'`]/.test(w)), JSON.stringify(await q.evaluate(() => __nm.load().runs.p.cur.wrong)));
    w0.length = 0; w0.push(...await q.evaluate(() => __nm.cur().wrong));
    await q.fill("#in", "衣 更 着"); await q.click("#go"); await q.waitForTimeout(50);
    check("別の書き方（衣更着）も正解・「とも書きます」と見せる", await q.locator(".why button").count() === 4 && (await q.textContent("#msg")).includes("とも書きます"));
    await why(q); await q.waitForSelector(".verdict"); await q.click("#next");
    await q.click("#hint");
    check("書く問題のヒント1は見るところ（読みのはじめ）だけ・候補はまだ出ない", (await q.textContent("#hintbox")).includes("で始まる") && await q.locator("#cands:not([hidden])").count() === 0);
    await q.click("#hint");
    const cs = await q.$$eval("#cands button", (b) => b.map((x) => [x.textContent, Math.round(x.getBoundingClientRect().height)]));
    check("書く問題のヒント2（最後の段）で、1文字目と候補4つ（44px以上）が出る・欄でも答えられる", cs.length === 4 && cs.every((c) => NAME_RE.test(c[0]) && c[1] >= 44) && (await q.textContent("#hintbox")).includes("1文字目は「睦」") && !(await q.$eval("#in", (e) => e.disabled)), JSON.stringify(cs));
    const wc = cs.map((c) => c[0]).find((c) => c !== "睦月");
    await q.click(`#cands button[data-w="${wc}"]`); await q.waitForTimeout(50);
    check("まちがえた候補は ✕ と押せない形に・まちがい1", await q.locator("#cands button.ng:disabled").count() === 1 && (await q.getAttribute("#cands button.ng", "aria-label")).includes("ちがう") && await q.evaluate(() => __nm.cur().wrong.length) === 1);
    await q.click('#cands button[data-w="睦月"]');
    await why(q); await q.waitForSelector(".verdict");
    check("ヒント2回とまちがい1回は合わせて3（★1）", await q.evaluate(() => __nm.load().runs.p.res[2].m) === 3);
    await q.click("#next");
    await q.fill("#in", "水無月"); await q.click("#go");
    check("読みの問題に名前の漢字をそのまま書いても、まちがいに数えず「ひらがなで」と出る", await q.evaluate(() => __nm.cur().wrong.length) === 0 && (await q.textContent("#msg")).includes("ひらがな"));
    await q.fill("#in", "みなつき"); await q.click("#go"); await q.waitForTimeout(50);
    check("読みが2つある月は、どちらの読みも正解（みなつき）", await q.locator(".why button").count() === 4);
    await why(q); await q.waitForSelector(".verdict"); await q.click("#next");
    await q.fill("#in", "ｼﾜｽ"); await q.click("#go"); await q.waitForTimeout(50);
    const mo = await q.$$eval(".why button", (b) => b.map((x) => x.textContent));
    check("半角カタカナでも NFKC でそろえて正解・由来から書いた問題の2段目は「旧暦の何月？」の4つ", (await q.textContent("#msg")).includes("漢字では「師走」") && mo.length === 4 && mo.every((t) => /^(?:[1-9]|1[0-2])月$/.test(t)) && (await q.textContent("#why")).includes("何月"), mo.join());
    await q.context().close();
  }
  // 月を選ぶ問題：ヒント2のあとに残ったまちがいを選ぶと、正解だけが押せる（saibanin-shikumi #1）
  {
    const q = await newPage(); await closeHow(q);
    await q.evaluate(() => { __nm.save((s) => { s.runs.p = { mode: "p", date: __nm.todayKey(), list: ["m5|c1"], res: [], cur: null, id: "cut1" }; }); __nm.play("p"); });
    await q.click("#hint"); await q.click("#hint");
    await q.evaluate(() => { const c = __nm.cur(); [...document.querySelectorAll(".ch:not(.ng)")].find((b) => c.P.opts[+b.dataset.j] !== c.P.ans).click(); });
    await q.waitForTimeout(50);
    check("ヒント2のあとにまちがいを選ぶと、正解だけが押せる（saibanin-shikumi #1）", await q.locator(".ch.ng").count() === 11 && await q.locator(".ch:not(.ng)").count() === 1 && await q.evaluate(() => { const c = __nm.cur(); const b = document.querySelector(".ch:not(.ng)"); return !!b && !b.disabled && c.P.opts[+b.dataset.j] === c.P.ans; }));
    await q.context().close();
  }

  // 1問を深くする（shared-workflows routines/game-dev.md「1問を深くする」）：自信をかける・2段目「名前の由来（よく言われる説）は？」・復習
  {
    const q = await newPage(); await closeHow(q);
    await q.evaluate((tags) => __nm.save((s) => { s.runs.p = { mode: "p", date: __nm.todayKey(), list: tags, res: [], cur: null, id: "dp" }; }), ["n4|dp1", "m1|dp2", "y3|dp3"]);
    await q.evaluate(() => { Depth.runStart(); __nm.play("p"); });
    const sb = await q.$eval("#dp-sure", (b) => [b.getBoundingClientRect().height, b.getAttribute("aria-pressed"), b.textContent]);
    check("自信のボタン：高さ44px以上・はじめは押していない", sb[0] >= 44 && sb[1] === "false", sb.join(","));
    await q.click("#dp-sure");
    check("自信のボタンを押すと ✓ が出る（色だけで分けない）", (await q.getAttribute("#dp-sure", "aria-pressed")) === "true" && (await q.textContent("#dp-sure")).includes("✓"));
    await answerWrong(q);
    check("自信ありでまちがえると、知らせに「思いこみ」と出て、自信は変えられない", (await q.textContent("#msg")).includes("思いこみ") && await q.locator("#dp-sure:disabled").count() === 1);
    check("まちがえたその時に復習へ入る（解き終えずにやめても残る。2026-11-11 CodeRabbit）", await q.evaluate(() => { const d = JSON.parse(localStorage.getItem("tmei-depth") || "{}"); return !!(d.rv && d.rv[__nm.cur().tag]); }));
    await answerRight(q);
    check("正解すると、2段目「名前の由来（よく言われる説）は？」が4つ出る（押せる所は44px以上）", await q.locator(".why button").count() === 4 && await q.locator(".verdict").count() === 0 && (await q.textContent("#why")).includes("よく言われる説") && (await q.$$eval(".why button", (b) => b.every((x) => Math.round(x.getBoundingClientRect().height) >= 44))));
    check("2段目の読み上げは、2段目の問いと4つの説だけ（1段目を読まない。funka-level #1 の CodeRabbit）", await q.evaluate(() => { const e = [...document.querySelectorAll("[data-a11y-say]")]; return e.length === 5 && e[0].textContent.includes("由来") && e.slice(1).every((x) => x.matches(".why button")); }));
    check("2段目の間は、1段目の欄は書けない", await q.evaluate(() => document.getElementById("in").disabled && document.getElementById("go").disabled));
    await q.reload(); await q.waitForTimeout(150); await q.evaluate(() => __nm.play("p"));
    check("2段目の途中で閉じても、2段目から続く", await q.locator(".why button").count() === 4);
    await q.click(`.why button[data-o="${await s2Wrong(q)}"]`);
    check("2段目でまちがえると ✕ ちがう（破線）・もう一度選べる", await q.locator(".why button.ng").count() === 1 && (await q.textContent("#msg")).includes("✕"));
    check("2段目でまちがえると「ちがう月の説です」と出る", (await q.textContent("#msg")).includes("ちがう月の説です"));
    await q.click("#hint");
    const ng1 = await q.locator(".why button:disabled").count();
    check("2段目のヒントは、まちがえた説とは別のちがう説を消す（★を使って何も消えないことが無い。2026-11-11 CodeRabbit）", ng1 === 2 && await q.locator(".why button:not(:disabled)").count() === 2, ng1);
    await q.reload(); await q.waitForTimeout(150); await q.evaluate(() => __nm.play("p"));
    check("2段目のヒントで消した説は、閉じて開き直しても消えたまま（ヒントも押せないまま）", await q.locator(".why button:disabled").count() === ng1 && ng1 >= 1 && await q.locator("#hint:disabled").count() === 1 && (await q.textContent("#hintbox")).includes("消しました"));
    await why(q); await q.waitForSelector(".verdict");
    const m0 = await q.evaluate(() => __nm.load().runs.p.res[0].m);
    check("★は1段目と2段目のまちがい・ヒントを合わせて数える（1＋1＋1＝3）", m0 === 3, m0);
    check("正解の画面に、名前と由来（よく言われる説・諸説ある）と、自信ありでまちがえたことが出る", (await q.textContent(".verdict")).includes("卯月") && (await q.textContent(".verdict")).includes("卯の花") && (await q.textContent(".verdict")).includes("諸説") && (await q.textContent(".verdict")).includes("自信ありでまちがえた"));
    await q.click("#next");
    await answerRight(q);
    check("やさしい（月を選ぶ）問題の2段目は由来3つ", await q.locator(".why button").count() === 3);
    await why(q); await q.click("#next");
    await answerRight(q);
    check("由来から書く問題は2段目「旧暦の何月？」が4つ出る", await q.locator(".why button").count() === 4 && (await q.textContent("#why")).includes("何月"));
    await why(q); await q.waitForSelector(".verdict");
    await q.click("#next"); await q.waitForTimeout(150);
    check("終えた直後の結果に「自信ありの当たり」が出る", (await q.textContent("#surestat")).includes("0/1"));
    const dp = await q.evaluate(() => JSON.parse(localStorage.getItem("tmei-depth") || "{}"));
    check("まちがえた・ヒントを使った問題だけ復習に入る", Object.keys(dp.rv || {}).join() === "n4|dp1", Object.keys(dp.rv || {}).join(","));
    await q.evaluate(() => { const d = JSON.parse(localStorage.getItem("tmei-depth")); for (const k in d.rv) d.rv[k].due = "2026-01-01"; localStorage.setItem("tmei-depth", JSON.stringify(d)); });
    await q.goto(url); await q.waitForTimeout(150);
    check("日の来た復習があると、ホームに「復習 1問」", (await q.textContent("#go-r")).includes("復習 1問"));
    const before = await mem(q);
    await q.click("#go-r");
    check("復習の画面は「復習」と出る・同じ問題", (await q.textContent("header")).includes("復習") && await q.evaluate(() => __nm.cur().tag) === "n4|dp1");
    await solve(q); await q.click("#next"); await q.waitForTimeout(150);
    const after = await mem(q), dp2 = await q.evaluate(() => JSON.parse(localStorage.getItem("tmei-depth")));
    check("復習を終えると結果は「復習」・今日の記録は増えない・シェアは出ない", (await q.textContent("h1")).includes("復習") && JSON.stringify(after.days) === JSON.stringify(before.days) && await q.locator("#share").count() === 0);
    { const d3 = await q.evaluate(() => new Date(Date.parse(__nm.todayKey()) + 3 * 864e5).toISOString().slice(0, 10)), e = dp2.rv && dp2.rv["n4|dp1"];
      check("復習で一度で正解すると、同じ問題が残り、次はちょうど3日後へ進む", !!e && e.s === 1 && e.due === d3, JSON.stringify(e) + " " + d3); }
    await q.goto(url); await q.waitForTimeout(150);
    check("復習を終えたら、ホームの「復習」は消える", await q.locator("#go-r").count() === 0);
    await q.evaluate(() => { const d = JSON.parse(localStorage.getItem("tmei-depth")); d.rv["nai|1"] = { s: 0, due: "2026-01-01", t: 1 }; d.rv["constructor|x"] = { s: 0, due: "2026-01-01", t: 2 }; localStorage.setItem("tmei-depth", JSON.stringify(d)); });
    await q.goto(url); await q.waitForTimeout(150);
    check("作り直せない鍵（無い種類・constructor）は復習に数えず、ホームも出る", await q.locator("#go-d").count() === 1 && await q.locator("#go-r").count() === 0);
    // 別のタブで2段目へ進んでいたら、この画面も2段目になる・別のタブで先に進んだ古い画面は復習の段を戻さない（2026-11-11 CodeRabbit）
    { const tq = "n4|dq1";
      await q.goto(url); await q.waitForTimeout(150);
      await q.evaluate((t) => { __nm.save((s) => { s.runs.p = { mode: "p", date: __nm.todayKey(), list: [t], res: [], cur: null, id: "dq" }; }); __nm.play("p"); }, tq);
      await q.evaluate((t) => __nm.save((s) => { s.runs.p.cur = { i: 0, tag: t, wrong: [], hints: 0, step: 2, w2: [] }; }), tq);
      await q.click("#hint"); await q.waitForTimeout(100);
      check("別のタブで2段目へ進んでいたら、この画面も2段目になる", await q.locator(".why button").count() === 4 && await q.evaluate(() => __nm.cur().step) === 2);
      await q.evaluate((t) => { __nm.save((s) => { s.runs.p.res.push({ m: 0 }); s.runs.p.cur = null; }); const d = JSON.parse(localStorage.getItem("tmei-depth")); d.rv[t] = { s: 2, due: "2099-01-01", t: 9 }; localStorage.setItem("tmei-depth", JSON.stringify(d)); }, tq);
      await q.click("#hint"); await q.waitForTimeout(50);
      check("別のタブで先に進んだ古い画面でヒントを押しても、復習の段は戻らない", await q.evaluate((t) => JSON.parse(localStorage.getItem("tmei-depth")).rv[t].s, tq) === 2);
    }
    // 復習の途中でヒント・まちがいがあって日の来た問題が0になっても、ホームの「復習の続きから」で戻れる（2026-11-11 CodeRabbit）
    { const rk = Object.keys(dp2.rv)[0];
      await q.evaluate((k) => { const d = JSON.parse(localStorage.getItem("tmei-depth")); d.rv = { [k]: { s: 0, due: "2026-01-01", t: 3 } }; localStorage.setItem("tmei-depth", JSON.stringify(d)); }, rk);
      await q.goto(url); await q.waitForTimeout(150); await q.click("#go-r"); await q.click("#hint");
      await q.evaluate(() => __nm.save((s) => { s.runs.r.date = "2026-01-02"; }));
      await q.goto(url); await q.waitForTimeout(150);
      check("復習の途中でヒントを使って日の来た問題が0になっても・日が替わっても、ホームの「復習の続きから」で戻れる", ((await q.locator("#go-r").count()) ? await q.textContent("#go-r") : "").includes("続きから"));
      if (await q.locator("#go-r").count()) { await q.click("#go-r"); check("復習の続きは同じ問題・使ったヒントはそのまま", await q.evaluate(() => __nm.cur().tag) === rk && await q.evaluate(() => __nm.cur().hints) === 1); }
    }
    await q.context().close();
  }
  // スマホ幅・とても大きい文字でもはみ出さない・押す所は44px以上
  {
    const bad = [], small = [];
    for (const [w, fs] of [[320, 3], [390, 2], [320, 1]]) {
      const q = await newPage(w); await closeHow(q);
      await q.evaluate((fs) => localStorage.setItem("tmei-fs", String(fs)), fs); await q.reload(); await q.waitForTimeout(150);
      for (const go of [null, "#go-d", "solve", "#go-cal", "#go-dex", "#go-ach", "#go-e", "in"]) {
        if (go === "solve") { await solve(q); }
        else if (go === "in") { await q.goto(url); await q.waitForTimeout(100); await q.evaluate(() => __nm.start("p", 2)); await q.click("#hint"); await q.click("#hint"); }
        else if (go) { await q.goto(url); await q.waitForTimeout(100); await q.click(go); }
        await q.waitForTimeout(100);
        const ov = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (ov > 0) bad.push(`${w}px 文字${fs} ${go || "ホーム"} ${ov}px`);
        small.push(...(await q.$$eval("button:not([disabled]), a[href]", (bs) => bs.filter((b) => b.checkVisibility() && !b.closest(".cal")).filter((b) => Math.round(b.getBoundingClientRect().height) < 44).map((b) => (b.id || b.className || b.textContent).slice(0, 20)))).map((x) => `${w}/${fs}/${go}:${x}`));
      }
      await q.context().close();
    }
    check("幅320px・とても大きい文字でも横にはみ出さない", bad.length === 0, bad.join(" / "));
    check("押せる所は高さ44px以上", small.length === 0, [...new Set(small)].slice(0, 8).join(","));
  }

  // 見やすさの設定を全部入れても、ページの一番下まで動ける（読み上げの class が html に当たって固まった。2026-11-05）
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 700 } });
    await ctx.addInitScript(() => localStorage.setItem("a11y-v1", JSON.stringify({ read: true, cvd: true, calm: true, say: true, ruby: true })));
    const q = await newPage(390, ctx); await closeHow(q);
    const r = await q.evaluate(() => { window.scrollTo(0, 1e5); const f = document.querySelector("footer").getBoundingClientRect(); return [scrollY, Math.round(f.bottom), innerHeight, getComputedStyle(document.documentElement).position]; });
    check("見やすさの設定を全部入れても、いちばん下まで動ける（html が固定されない）", r[0] > 0 && r[1] <= r[2] && r[3] === "static", r.join(","));
    await ctx.close();
  }
  // キーボードだけで遊べる（Tab と Enter）
  {
    const q = await newPage(); await closeHow(q);
    await q.focus("#go-d"); await q.keyboard.press("Enter"); await q.waitForTimeout(100);
    const j = await ansIdx(q);
    await q.focus(`.ch[data-j="${j}"]`); await q.keyboard.press("Enter"); await q.waitForTimeout(100);
    if (await q.locator(".why button").count()) { await q.focus(`.why button[data-o="${await s2Idx(q)}"]`); await q.keyboard.press("Enter"); await q.waitForTimeout(100); }
    check("キーボードだけで選んで答えられる（2段目もキーボードで）", await q.locator(".verdict").count() === 1);
    await q.evaluate(() => { __nm.save((s) => { s.runs.p = { mode: "p", date: __nm.todayKey(), list: ["n9|kb"], res: [], cur: null, id: "kb" }; }); __nm.play("p"); });
    await q.focus("#in"); await q.keyboard.type("長月"); await q.keyboard.press("Enter"); await q.waitForTimeout(100);
    if (await q.locator(".why button").count()) { await q.focus(`.why button[data-o="${await s2Idx(q)}"]`); await q.keyboard.press("Enter"); await q.waitForTimeout(100); }
    check("書く問題もキーボードだけで答えられる（書いて Enter・2段目も）", await q.locator(".verdict").count() === 1);
    await q.context().close();
  }
} catch (e) { check("ブラウザでの検査が最後まで動く", false, e.stack.split("\n").slice(0, 3).join(" ")); }

// 深さの部品（shared-workflows template/qa/depth-check.mjs）
{ const e = await checkDepth(readFileSync(path.join(root, "depth.js"), "utf8")); check("depth.js（自信をかける・復習）の動き", e.length === 0, e.join(" / ")); }
// 2段目の目安：どの種類にもある（5つのどれか）
{ const q = await newPage(); await closeHow(q);
  check("保存に失敗したら、保存できるまで帯（#savewarn）で知らせ続け、保存できたら消す", await q.evaluate(async () => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error("full"); }; __nm.save(() => {}); __nm.save(() => {}); const one = document.querySelectorAll("#savewarn").length === 1 && document.getElementById("savewarn").textContent.includes("保存できませんでした"); await new Promise((r) => setTimeout(r, 1500)); const stay = !!document.getElementById("savewarn"); Storage.prototype.setItem = orig; __nm.save(() => {}); return one && stay && !document.getElementById("savewarn"); }));
  await q.evaluate(() => __nm.start("e")); await q.waitForTimeout(100);
  await q.click(`.ch[data-j="${await ansIdx(q)}"]`); await why(q); await q.waitForSelector(".verdict");
  await q.click("#quit"); await q.waitForTimeout(150);
  check("とことんで正解した直後でも「ここで降りる」が効き、その問題も数える", (await q.textContent("#eres")).includes("1問"), await q.textContent("body"));
  // 保存に失敗したまま「ここで降りる」を押しても、保存してあった途中の回を戻さない（CodeRabbit kumo-namae#1）
  await q.evaluate(() => __nm.start("e")); await q.waitForTimeout(100);
  await q.click(`.ch[data-j="${await ansIdx(q)}"]`); await why(q); await q.waitForSelector(".verdict");
  { const eid = await q.evaluate(() => __nm.load().runs.e.id);
    await q.evaluate(() => { window.__origSet = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error("full"); }; });
    await q.click("#quit"); await q.waitForTimeout(150);
    const back = await q.evaluate(() => { const r = __nm.load().runs.e; return r ? r.id : null; });
    await q.evaluate(() => { Storage.prototype.setItem = window.__origSet; __nm.save(() => {}); });
    check("保存に失敗したまま「ここで降りる」を押しても、終えた回が「とことんの続き」に戻らない", back === null && (await q.evaluate(() => __nm.load().runs.e)) === null, `${eid} → ${back}`); }
  await q.close(); }
{ const q = await newPage(); await closeHow(q);
  await q.evaluate(() => { localStorage.setItem("tmei-v1", JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, adays: {}, dex: { constructor: 1, toString: 2, m1: 1 }, runs: {}, kofi: {}, ach: {}, ebest: 0 })); }); await q.reload(); await q.waitForTimeout(150);
  check("記録に constructor などの鍵が入っても、まなび帳と実績の種類に数えない（CodeRabbit funka-level#1）", (await q.textContent("#go-dex")).includes("1/48") && await q.evaluate(() => __nm.tally(__nm.load()).kinds) === 1, await q.textContent("#go-dex"));
  await q.evaluate(() => { localStorage.setItem("tmei-v1", JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, adays: {}, dex: {}, runs: {}, kofi: {}, ach: {}, ebest: { toString: null } })); }); await q.reload(); await q.waitForTimeout(150);
  check("記録の数の所に数でも文字でもない物（{toString:null}）が入っても、ホームが出る（写し元の PR #1 の CodeRabbit）", await q.locator("#go-dex").count() === 1);
  await q.close(); }
{ const used = new Set(); for (const k of G.KINDS) for (let i = 0; i < 200; i++) { const P = G.make(`${k.id}|g${i}`); used.add(P.s2.ans); }
  check("2段目：12の由来（よく言われる説）と12の月が全部答えに使われる", G.MONTHS.every((x) => used.has(x.yu) && used.has(`${x.m}月`)), used.size); }
// 引き継ぎコード（shared-workflows template/qa/transfer-check.mjs）
try {
  const sample = { "tmei-v1": JSON.stringify({ v: 1, tut: true, days: { "2026-11-21": { m: [0, 1, 0, 0, 2], k: ["m1", "m2", "n3", "r4", "y5"] } }, hdays: {}, adays: {}, dex: { m1: 1, m2: 1, n3: 1, r4: 1, y5: 1 }, runs: {}, kofi: {}, ach: {}, ebest: 7, t: 1 }), "tmei-fs": "3", "tmei-depth": JSON.stringify({ v: 1, rv: { "n4|x1": { s: 1, due: "2026-11-28", t: 5 } } }) }; // 復習の記録も引き継ぐかを見る（CodeRabbit shindo-yomi#1）
  await checkTransfer({ browser, url, game: "tsuki-imei", sample, check, open: async (pg) => { await firstClose(pg); } });
} catch (e) { check("引き継ぎの検査が最後まで動く", false, e.message.split("\n")[0]); }
await browser.close();
server.close();
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));

{ // 見やすさ・読みやすさ・偏り（shared-workflows template/qa/a11y.mjs の写し）
  const { spawnSync } = await import("node:child_process");
  const a = spawnSync(process.execPath, [path.join(root, "qa", "a11y.mjs")], { encoding: "utf8", env: process.env });
  check("見やすさ・読みやすさの検査（qa/a11y.mjs。中身は qa-report/a11y.md）", a.status === 0, (a.stdout.match(/^- ❌.*$/gm) || []).join(" / ") || (a.status ? a.stderr.slice(-300) : ""));
}

const ng = results.filter((r) => !r.ok);
const md = `# 月の異名あて QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);

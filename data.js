// 月の異名あての問題を作る（ブラウザと node の両方で使う）。
// 中身は、国立国会図書館「日本の暦」の「和風月名」のページ（下の SRC）に書いてあることだけ（2026-11-20 に読んだ。要点は共有フォルダ games/tsuki-imei-research.md）。
// 扱うのは旧暦の月の和風の名前（睦月〜師走）・読み・別の書き方（衣更着・早月）・由来（よく言われる説）だけ。
// 二十四節気（nijushi-sekki）・和暦（wareki-yomi）・月の形（tsuki-katachi）とは重ねない。資料に無い異名は入れない。
// 問いの形は4つ：月の数から名前を書く（n）・名前から月の数を選ぶ（m）・名前の読みを書く（r）・由来から名前を書く（y）。
// 正解したら2段目で「由来（よく言われる説）」か「旧暦の何月か」を選ぶ。事実は12か月分だけで、通りは言い回しと2段目の選び肢の組で作る。
// 乱数 R は呼ぶ回数が毎回同じになるように使う（sort の比較の中では引かない）。同じ tag なら、どの端末でも同じ問題になる。
// KINDS・言い回し・選び肢は、足すだけでも過去の日の問題が変わる（選ぶ範囲が変わるため）。公開したあとは変えず、変えるときは qa/run.mjs の PINS を作り直して PR に理由を書く。
(function (root) {
  "use strict";
  const LV = ["やさしい", "ふつう", "むずかしい"];

  // 出典（画面の「なぜ」に出す）
  const SRC = {
    ndl: ["国立国会図書館「日本の暦」和風月名", "https://www.ndl.go.jp/koyomi/chapter3/s8.html"],
  };

  // 12か月。k：名前・alt：資料にある別の書き方・yomi：資料にある読み（全部正解）・yu：2段目の由来の選び肢・ys：由来の言い方（問いに使う）・src：資料の説明を短くしたもの
  const MONTHS = [
    { m: 1, k: "睦月", alt: [], yomi: ["むつき"], yu: "親類が集まって親しくする（睦び）月", ys: ["正月に親類一同が集まる、睦び（親しくする）の月", "親類が集まって親しくする（睦び）月"], src: "正月に親類一同が集まる、睦び（親しくする）の月" },
    { m: 2, k: "如月", alt: ["衣更着"], yomi: ["きさらぎ"], yu: "寒さが残り、衣を更に重ね着する月", ys: ["まだ寒さが残っていて、衣を重ね着する（更に着る）月", "寒さが残り、衣を重ね着する月"], src: "「衣更着」とも書き、まだ寒さが残っていて衣を重ね着する（更に着る）月" },
    { m: 3, k: "弥生", alt: [], yomi: ["やよい"], yu: "草木が生い茂る（木草弥生い茂る）月", ys: ["草木が生い茂る（きくさいやおいしげる）月", "草木が生い茂る月"], src: "木草弥生い茂る（草木が生い茂る）月" },
    { m: 4, k: "卯月", alt: [], yomi: ["うづき"], yu: "卯の花の月", ys: ["卯の花の月", "卯の花にちなむ月"], src: "卯の花の月" },
    { m: 5, k: "皐月", alt: ["早月"], yomi: ["さつき"], yu: "早苗（さなえ）を植える月", ys: ["早苗（さなえ）を植える月", "早苗を植える月"], src: "「早月」とも書き、早苗（さなえ）を植える月" },
    { m: 6, k: "水無月", alt: [], yomi: ["みなづき", "みなつき"], yu: "田に水を引く「水の月」", ys: ["水の月（「無」は「の」の意味）で、田に水を引く月", "田に水を引く月"], src: "水の月（「無」は「の」を意味する）で、田に水を引く月" },
    { m: 7, k: "文月", alt: [], yomi: ["ふみづき", "ふづき"], yu: "稲の穂が実る月（穂含月）", ys: ["稲の穂が実る月（穂含月）", "稲の穂が実る月"], src: "稲の穂が実る月（穂含月：ほふみづき）" },
    { m: 8, k: "葉月", alt: [], yomi: ["はづき", "はつき"], yu: "木々の葉が落ちる月（葉落ち月）", ys: ["木々の葉落ち月", "木々の葉が落ちる月"], src: "木々の葉落ち月（はおちづき）" },
    { m: 9, k: "長月", alt: [], yomi: ["ながつき", "ながづき"], yu: "夜が長い月（夜長月）", ys: ["夜長の月", "夜が長い月"], src: "夜長月（よながづき）" },
    { m: 10, k: "神無月", alt: [], yomi: ["かんなづき"], yu: "「神の月」（神々が出雲に集まる説も）", ys: ["神の月（「無」は「の」の意味）", "神々が出雲大社に集まり、各地の神々が留守になる月"], src: "神の月（「無」は「の」を意味する）。全国の神々が出雲大社に集まり、各地の神々が留守になる月という説などもある" },
    { m: 11, k: "霜月", alt: [], yomi: ["しもつき"], yu: "霜の降る月", ys: ["霜の降る月", "霜が降りる月"], src: "霜の降る月" },
    { m: 12, k: "師走", alt: [], yomi: ["しわす"], yu: "師匠も走り回る（趨走する）月", ys: ["師匠といえども趨走（すうそう、走り回る）する月", "師匠も走り回る月"], src: "師匠といえども趨走（すうそう、走り回る）する月" },
  ];
  const MO = MONTHS.map((x) => `${x.m}月`);

  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  function shuffle(R, a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = ri(R, 0, i); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  function pickN(R, a, n) { return shuffle(R, a).slice(0, n); }

  // ---- 答えのゆれ（全角半角・空白・カタカナ・かぎかっこ）をそろえる ----
  const kata2hira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  // 空白を除いたあとに NFC で濁点をつけ直す（「ﾂ ﾞ」のように空白をはさんでも「づ」になる。tsuki-imei #1 の CodeRabbit）
  function norm(v) { return kata2hira(String(v == null ? "" : v).normalize("NFKC").replace(/[\s　「」『』"'“”（）()。、.,]/g, "")).normalize("NFC"); }
  const MEDIA = { n: "月の名前", m: "何月？", r: "名前の読み", y: "名前の由来" };
  const PRE = (x) => MONTHS[(x.m + 10) % 12], NXT = (x) => MONTHS[x.m % 12];

  // 2段目：由来（よく言われる説）を選ぶ。やさしいは3つ、ほかは4つ
  function s2yu(R, x, lv) {
    const ds = pickN(R, MONTHS.filter((y) => y !== x), lv === 0 ? 2 : 3).map((y) => y.yu);
    return { q: "名前の由来（よく言われる説）は？", opts: shuffle(R, [x.yu, ...ds]), ans: x.yu, v: ds.map((d) => MONTHS.findIndex((y) => y.yu === d)).join(".") };
  }
  // 2段目：旧暦の何月？を選ぶ（由来から名前を書く問題のあと）
  function s2mo(R, x) {
    const ds = pickN(R, MONTHS.filter((y) => y !== x), 3).map((y) => `${y.m}月`);
    return { q: `「${x.k}」は旧暦の何月？`, opts: shuffle(R, [`${x.m}月`, ...ds]), ans: `${x.m}月`, v: ds.join(".") };
  }
  // ヒント2の候補（入力の問題だけ。答えと、ほかの月の3つ）
  function cands(R, x, f) { return shuffle(R, [f(x), ...pickN(R, MONTHS.filter((y) => y !== x), 3).map(f)]); }

  // 問いの言い回し
  const QN = [(x) => `旧暦の${x.m}月の名前は？`, (x) => `旧暦${x.m}月を、和風の名前で書くと？`, (x) => `和風月名で、旧暦の${x.m}月は？`, (x) => `昔の暦の${x.m}月。漢字で書くと？`];
  const QM = [(x) => `「${x.k}」は、旧暦の何月？`, (x) => `「${x.k}」（${x.yomi[0]}）は、旧暦の何月の名前？`, (x) => `旧暦で「${x.k}」と呼んだのは何月？`, (x) => `和風月名の「${x.k}」。旧暦の何月？`];
  const QR = [(x) => `「${x.k}」の読みは？`, (x) => `「${x.k}」は何と読む？`, (x) => `旧暦${x.m}月の「${x.k}」。読み方は？`];
  const QY = [(y) => `由来は「${y}」とよく言われる。この月の名前は？`, (y) => `「${y}」という説で知られる月の名前は？`, (y) => `よく言われる由来は「${y}」。何という月？`];

  const yomiStr = (x) => x.yomi.join("・");
  // 読みのヒントは、資料の読みが2つある月（文月：ふみづき・ふづき など）でもどちらにも当てはまる形にする（tsuki-imei #1 の CodeRabbit）
  const pre = (x) => { let p = [...x.yomi[0]]; for (const y of x.yomi) { const c = [...y]; let i = 0; while (i < p.length && p[i] === c[i]) i++; p = p.slice(0, i); } return p.join(""); };
  const suf = (x) => { let p = [...x.yomi[0]].reverse(); for (const y of x.yomi) { const c = [...y].reverse(); let i = 0; while (i < p.length && p[i] === c[i]) i++; p = p.slice(0, i); } return p.reverse().join(""); };
  const lenOf = (x) => (x.yomi.every((y) => [...y].length === [...x.yomi[0]].length) ? [...x.yomi[0]].length : 0);
  const two = (x) => (x.yomi.length > 1 ? `（読みは${x.yomi.length}つあります）` : "");
  const whyOf = (x) => `旧暦${x.m}月は「${x.k}」（${yomiStr(x)}）。よく言われる由来：${x.src}。`;

  // n：月の数 → 名前を書く（ふつう）
  const N = (x) => ({ id: `n${x.m}`, lv: 1, m: x.m, ans: x.k, name: `${x.m}月の名前：${x.k}`, look: lenOf(x) ? `読みは「${x.yomi[0][0]}」で始まる${lenOf(x)}文字です。` : `読みは「${x.yomi[0][0]}」で始まります${two(x)}。`, key: `1文字目は「${[...x.k][0]}」です。下の4つから選んでもかまいません。`, why: whyOf(x),
    make: (R, lv) => { const qi = ri(R, 0, QN.length - 1), s2 = s2yu(R, x, lv), c = cands(R, x, (y) => y.k); return { type: "in", ask: "kanji", q: QN[qi](x), big: `旧暦 ${x.m}月`, ans: x.k, s2, cands: c, v: `${qi}:${s2.v}` }; } });
  // m：名前 → 何月かを12のボタンから選ぶ（やさしい）
  const M = (x) => ({ id: `m${x.m}`, lv: 0, m: x.m, ans: `${x.m}月`, name: `${x.k}は何月：${x.m}月`, look: `前の月は「${PRE(x).k}」、次の月は「${NXT(x).k}」です。`, key: `読みは「${yomiStr(x)}」。12の中から2つにしぼりました。`, why: whyOf(x),
    make: (R, lv) => { const qi = ri(R, 0, QM.length - 1), s2 = s2yu(R, x, lv); return { type: "num", ask: "month", q: QM[qi](x), big: x.k, opts: MO.slice(), ans: `${x.m}月`, s2, cands: [], v: `${qi}:${s2.v}` }; } });
  // r：名前 → 読みを書く（ふつう）
  const Rd = (x) => ({ id: `r${x.m}`, lv: 1, m: x.m, ans: x.yomi[0], name: `${x.k}の読み：${yomiStr(x)}`, look: lenOf(x) ? `${lenOf(x)}文字で、「${x.yomi[0][0]}」で始まります。` : `「${x.yomi[0][0]}」で始まります${two(x)}。`, key: `${[...pre(x)].length >= 2 ? `はじめの2文字は「${[...pre(x)].slice(0, 2).join("")}」` : `はじめは「${pre(x)}」、終わりは「${suf(x)}」`}です。下の4つから選んでもかまいません。`, why: whyOf(x),
    make: (R, lv) => { const qi = ri(R, 0, QR.length - 1), s2 = s2yu(R, x, lv), c = cands(R, x, (y) => y.yomi[0]); return { type: "in", ask: "kana", q: QR[qi](x), big: x.k, ans: x.yomi[0], s2, cands: c, v: `${qi}:${s2.v}` }; } });
  // y：由来 → 名前を書く（むずかしい）。2段目は旧暦の何月か
  const Y = (x) => ({ id: `y${x.m}`, lv: 2, m: x.m, ans: x.k, name: `由来から：${x.k}`, look: `旧暦の${x.m}月の名前です。`, key: `1文字目は「${[...x.k][0]}」です。下の4つから選んでもかまいません。`, why: whyOf(x),
    make: (R) => { const yi = ri(R, 0, x.ys.length - 1), qi = ri(R, 0, QY.length - 1), s2 = s2mo(R, x), c = cands(R, x, (y) => y.k); return { type: "in", ask: "kanji", q: QY[qi](x.ys[yi]), big: "？", ans: x.k, s2, cands: c, v: `${yi}.${qi}:${s2.v}` }; } });

  const KINDS = [...MONTHS.map(M), ...MONTHS.map(N), ...MONTHS.map(Rd), ...MONTHS.map(Y)];
  const BY = Object.fromEntries(KINDS.map((k) => [k.id, k]));
  const kindsOf = (lv) => KINDS.filter((k) => k.lv === lv).map((k) => k.id);
  const monthOf = (id) => MONTHS[(BY[id] ? BY[id].m : 1) - 1];

  // 書いた答えを見る。ok：正解・kana：かなだけで名前を書いた（正解に数える）・alt：別の書き方・other：ほかの月の名前（何月か）・kanji：読みの問題に漢字を書いた（まちがいに数えない）
  // まちがいとして覚える印（同じ月の名前と読みは1つに数える。引き継ぎコードが受けない字 <>"'` は除き、20字まで。tsuki-imei #1 の CodeRabbit）
  function wkey(P, v) { const r = judge(P, v); return r.ok || r.kanji || !r.s ? "" : r.other ? `月${r.other}` : r.s.replace(/[<>"'`]/g, "").slice(0, 20) || "?"; }
  function judge(P, v) {
    const x = MONTHS[P.m - 1], s = norm(v), out = { ok: false, kana: false, alt: false, other: 0, kanji: false, s };
    if (!s) return out;
    if (P.ask === "kana") {
      if (x.yomi.includes(s)) out.ok = true;
      else if ([x.k, ...x.alt].includes(s)) out.kanji = true;
      else { const o = MONTHS.find((y) => y.k === s || y.alt.includes(s) || y.yomi.includes(s)); if (o) out.other = o.m; }
      return out;
    }
    if (s === x.k) out.ok = true;
    else if (x.alt.includes(s)) { out.ok = true; out.alt = true; }
    else if (x.yomi.includes(s)) { out.ok = true; out.kana = true; }
    else { const o = MONTHS.find((y) => y.k === s || y.alt.includes(s) || y.yomi.includes(s)); if (o) out.other = o.m; }
    return out;
  }

  function seedOf(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // 書いて答える問題は選び肢（opts）を持たない（候補 cands はヒントの最後の段だけ）。月を選ぶ問題だけ opts に12の月
  // 1問を作る。tag は「種類|種」（例 "n4|2026-11-21:d2"）。同じ tag ならいつも同じ問題
  function make(tag) {
    const [kind] = String(tag).split("|"), k = BY[kind];
    if (!k) return null;
    const p = k.make(rng(seedOf(tag)), k.lv);
    return { tag, kind, lv: k.lv, m: k.m, name: k.name, look: k.look, key: k.key, why: k.why, media: MEDIA[kind[0]], src: [SRC.ndl], ...p };
  }
  const keyOf = (P) => `${P.kind}:${P.q}:${P.s2.opts.slice().sort().join("/")}`;

  function dailyTags(date) {
    const R = rng(seedOf("day:" + date)), e = pickN(R, kindsOf(0), 2), n = pickN(R, kindsOf(1), 2), h = pickN(R, kindsOf(2), 1);
    return [...e, ...n, ...h].map((id, i) => `${id}|${date}:d${i}`);
  }
  function hardTags(date) {
    const dh = dailyTags(date)[4].split("|")[0], R = rng(seedOf("hard:" + date)), h = pickN(R, kindsOf(2).filter((x) => x !== dh), 3);
    return h.map((id, i) => `${id}|${date}:h${i}`);
  }

  const TMEI = { KINDS, BY, MONTHS, LV, SRC, MEDIA, kindsOf, monthOf, seedOf, rng, make, keyOf, judge, wkey, norm, dailyTags, hardTags, pickN };
  if (typeof module !== "undefined" && module.exports) module.exports = TMEI; else root.TMEI = TMEI;
})(typeof self !== "undefined" ? self : this);

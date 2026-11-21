# AGENTS.md

月の異名あて：旧暦の月と和風月名（睦月・如月・弥生・卯月・皐月・水無月・文月・葉月・長月・神無月・霜月・師走）を結ぶ1日5問の学習ゲーム。名前は選択肢でなく書いて答え（かなでも正解・別の書き方も正解）、正解したら2段目で名前の由来（よく言われる説）を選ぶ。`index.html` と `data.js`（問題の種類）を GitHub Pages で公開する。

## 準備（最初に一度）

```bash
bash scripts/setup.sh   # Node.js（版は .nvmrc）を確かめ、検査の依存とブラウザを入れる。何度実行してもよい
```

Claude Code のクラウドセッションでは `.claude/settings.json` のフックが自動で実行する。

## push する前の確認

```bash
node qa/run.mjs   # 問題（48種類×3000問：答え・読み・別の書き方・由来が資料の表どおり・出典）・今日の5問と上級（3年分）・とことん・通しで遊ぶ・続きから・2段目・復習・幅320px・PWA・引き継ぎ・見やすさ（CI の QA と同じ）
```

## このリポジトリの決まり

- 中身は国立国会図書館「日本の暦」の「和風月名」のページ（<https://www.ndl.go.jp/koyomi/chapter3/s8.html>）に書いてあることだけ（2026-11-20 に読んだ。引用は共有フォルダ games/tsuki-imei-research.md）。名前・読み・別の書き方（衣更着・早月）・由来は `data.js` の `MONTHS` と、`qa/run.mjs` の別に書いた表（`NDL`）の両方にあり、QA が合うかを見る。資料に無い異名（梅見月など）は入れない。
- 由来は諸説あるので、画面では「よく言われる説」と書き、1つに言い切らない（遊び方・2段目・「このゲームについて」）。季節のずれ（1～2か月）も書く。
- 扱うのは月の名前だけ。二十四節気（nijushi-sekki）・和暦よみ（wareki-yomi）・月の形よみ（tsuki-katachi）と重ねない。
- 漢字の言葉を答えるゲームなので、答えは書いて（入力して）答える（shared-workflows `routines/game-dev.md`「好み」）。変換中の Enter で送らない（`e.isComposing || e.keyCode === 229`）・`normalize("NFKC")`・空白・カタカナのゆれを許す（`G.norm`）。かな（資料の読み）だけで名前を書いたら正解にして「漢字では〇〇」と見せ、まちがいに数えない。読みの問題に名前の漢字をそのまま書いたときもまちがいに数えない。候補から選ぶのは2回目のヒント（最後の段）だけ。
- 問題は4つの形（12か月ずつ・48種類）。`m<月>`（やさしい）：名前を見て旧暦の何月かを12のボタンから選ぶ（数は言葉でないので選ぶ形）。`n<月>`（ふつう）：月の数から名前を書く。`r<月>`（ふつう）：名前の読みをひらがなで書く。`y<月>`（むずかしい）：由来から名前を書く。正解したら2段目で、`m`・`n`・`r` は由来（よく言われる説。やさしいは3つ・ほかは4つ）を、`y` は旧暦の何月か（4つ）を選ぶ。事実は12か月分だけで、通りは言い回しと2段目の選び肢の組で作る。
- ヒント：1回目は見るところ（読みのはじめの字・前後の月など）。2回目は、書く問題では1文字目（読みははじめの2文字）と候補4つ、月を選ぶ問題ではまちがいを消して2つにしぼる。
- 今日の5問（やさしい2・ふつう2・むずかしい1、種類は重ねない）・上級（むずかしい3、今日のむずかしいと別）は日本時間の日付の種で決まり、だれでも同じ。`Math.random()` は練習・とことんの種だけ。乱数は `sort` の比較の中で引かない。`KINDS`・言い回し・まちがいの選び肢は、足すだけでも過去の日の問題が変わる。公開後は変えず、変えるときは QA の `PINS`（3日分の5問と上級）を作り直して理由を PR に書く。`data.js` を変える PR は自動ではマージされない（`hold_paths`）。
- ★はまちがい＋ヒントの数（0で★3・1で★2・2以上で★1）。上級はヒントなし。時間制限なし。
- 好きなだけ遊べる：チケット・ライフ・回数制限・🔒で開くモードを入れない（shared-workflows `routines/game-dev.md` F1〜F7。QA が見る）。とことん（`runs.e`）はまちがえても続き、「ここで降りる」で終わる。
- 1問を深くする：`depth.js` と `qa/depth-check.mjs` は shared-workflows `template/` の写しで、ここでは直さない。自信あり・2段目「由来（よく言われる説）」・復習（1→3→7日後）。記録 `tmei-v1`・文字 `tmei-fs`・復習 `tmei-depth`。
- 共有は遊ぶ人が押したときに開くリンクだけ。シェアの文に問題・答えを出さない。感想は Issue フォーム（`.github/ISSUE_TEMPLATE/feedback.yml`）を開くだけ。応援は Ko-fi へのただのリンクだけ。
- 外へ通信しない（CSP の `connect-src 'self'` を広げない）。見やすさ（`<!-- a11y:begin -->`〜`end`・`qa/a11y.mjs`）と引き継ぎ（`transfer.js`・`qa/transfer-check.mjs`）は shared-workflows `template/` の写しで、ここでは直さない。
- 画面の土台は突風よみ（toppu-yomi。その前は津波よみ tsunami-yomi）から写した。写し元の言葉が残っていないかを QA が見る（写し元ごとに登録する）。保存の読み直しは共通部品 GameStore（`<!-- store:begin -->`〜`end`。shared-workflows `template/store/store.js` の写しで、ここでは直さない）。
- PWA：画面のファイルを足したら `sw.js` の `SHELL` にも足し、中身を大きく変えたら `CACHE` の版を上げる。アイコンは `node tools/make-icons.cjs`、`og.png` は `node tools/make-og.cjs`。
- 公開リポジトリなので、個人情報・鍵を入れない。

## 公開

- GitHub Pages は `main` のルート（`/`）を公開する。PR の QA と Secret scan が ✅ になると `automerge.yml` が自動でマージする。止めたいときは下書きにするか、ラベル「自動マージしない」を付ける。
- `sw.js`・`manifest.webmanifest`・`data.js` を変える PR は自動ではマージされない（`hold_paths`）。CodeRabbit のレビューを読み、手でマージする直前に今の head へのレビューを読み直す。CodeRabbit は PR に `@coderabbitai review` とコメントして頼む。

## 共通のきまり

- PR の作り方・マージの仕方は satou-aaaaa/shared-workflows の `routines/pr.md`、全体のきまりは `routines/common.md` に従う。
- CI の部品は shared-workflows の共通部品を呼ぶ。リポジトリ側の .github/workflows には呼び出しと設定値だけを書く。
- Claude 以外の AI・人が作業するときは、shared-workflows の `routines/tool-map.md` と `routines/without-claude.md` を読む。

// 問題データ（答えはこのファイルにだけある。参加者の画面には答え合わせの後に送られる）
const QS = [
  { cat: "地震", s: "家の中で強い揺れを感じたら、すぐに外へ飛び出す。", ok: false,
    why: "外に出ると、瓦や窓ガラス、看板などの落下物に当たる危険がある。", fix: "机の下などで頭を守り、揺れが収まるのを待つ。" },
  { cat: "津波", s: "海の近くで強い揺れを感じたら、警報を待たずに高台へ避難する。", ok: true,
    pt: "津波は警報より早く来ることもある。揺れが弱くても長く続いたら、すぐに避難する。" },
  { cat: "噴火", s: "山で噴火に出会ったら、火口の様子を近くで確かめてから避難する。", ok: false,
    why: "火口付近は噴石や火山ガスの危険が大きい。様子を見に行ってはいけない。", fix: "すぐに火口から離れ、山小屋や岩陰に身を隠して頭を守る。" },
  { cat: "大雨", s: "道路が冠水していたら、車で一気に通り抜ける。", ok: false,
    why: "浅く見えても車が止まったり、ドアが開かなくなったりする。アンダーパスは特に危険。", fix: "冠水した道には入らず、引き返すか別の道を通る。" },
  { cat: "火災", s: "火事の煙の中では、姿勢を低くして口と鼻をハンカチなどで覆って逃げる。", ok: true,
    pt: "煙は上にたまるので、低い位置のほうが空気がきれい。煙を吸わないことが一番大事。" },
  { cat: "雷", s: "雷が鳴り出したら、高い木の真下で雨宿りする。", ok: false,
    why: "木に落ちた雷が、近くの人に飛び移ることがある（側撃雷）。", fix: "建物や車の中に避難する。木からは離れる。" },
  { cat: "津波", s: "津波の第1波が引いたら、すぐに家へ荷物を取りに戻る。", ok: false,
    why: "第2波・第3波のほうが大きいこともある。", fix: "警報・注意報が解除されるまで、高台から戻らない。" },
  { cat: "避難", s: "地震のあと家を離れて避難するときは、ブレーカーを落としてから出る。", ok: true,
    pt: "電気が復旧したときに、壊れた家電などから出火する「通電火災」を防げる。" },
  { cat: "台風", s: "台風が近づいているとき、川や田んぼの様子を見に行く。", ok: false,
    why: "増水した川や水路に流される事故が毎年起きている。", fix: "外に出ず、最新の気象情報や避難情報を確認する。" },
  { cat: "地震", s: "エレベーターに乗っているときに揺れたら、全部の階のボタンを押し、止まった階で降りる。", ok: true,
    pt: "閉じ込められたら、インターホン（非常ボタン）で外に連絡する。" }
];

(function () {
  const h = APP.h;
  const root = document.getElementById("app");
  const S = { uid: null, err: null, hostUid: undefined, game: null, players: {}, results: {}, answers: {}, bonus: {}, buzz: {}, loaded: {}, busy: false, note: "" };
  const joinURL = new URL("./", location.href).href;
  let primary = null;
  let qrNode = null;

  function run(p) {
    S.busy = true; S.note = "";
    return p.then(function () { S.busy = false; render(); })
      .catch(function (e) { S.busy = false; S.note = "保存できませんでした（" + (e && e.code || "error") + "）。この端末が司会として登録されているか確認してください。"; render(); });
  }

  // ---- 操作 ----
  function showQ(i) {
    const q = QS[i];
    return run(APP.db.ref("game").set({ phase: "question", idx: i, qk: String(i), total: QS.length, cat: q.cat, text: q.s }));
  }
  function closeQ() {
    const i = S.game.idx, q = QS[i], up = {};
    up["results/" + i] = q.ok ? "ok" : "doubt";
    up["game/phase"] = "reveal";
    return run(APP.db.ref().update(up));
  }
  function explain() {
    const q = QS[S.game.idx];
    return run(APP.db.ref("game").update({ phase: "explain", ok: q.ok, why: q.why || "", fix: q.fix || "", pt: q.pt || "" }));
  }
  function next() {
    const i = S.game.idx + 1;
    if (i < QS.length) return showQ(i);
    return run(APP.db.ref("game").set({ phase: "end", total: QS.length }));
  }
  function award(uid) {
    const qk = S.game.qk;
    return run(APP.db.ref("bonus/" + qk).set(S.bonus[qk] === uid ? null : uid));
  }
  function resetScores() {
    if (!confirm("回答と点数をすべて消して、最初の画面に戻します。班の登録はそのまま残ります。よろしいですか？")) return;
    run(APP.db.ref().update({ answers: null, buzz: null, bonus: null, results: null, game: { phase: "lobby" } }));
  }
  function clearPlayers() {
    if (!confirm("班の登録をすべて消します。各班はもう一度班の番号を選ぶ必要があります。よろしいですか？")) return;
    run(APP.db.ref("players").remove());
  }
  function register() { run(APP.db.ref("config/hostUid").set(S.uid)); }

  // ---- 表示部品 ----
  function playerCount() { return Object.keys(S.players).length; }
  function nameOf(uid) { return (S.players[uid] && S.players[uid].name) || "（登録が消えた班）"; }

  function topBar() {
    const g = S.game || {};
    const cur = (g.phase === "question" || g.phase === "reveal" || g.phase === "explain") ? g.idx : (g.phase === "end" ? QS.length : -1);
    const dots = QS.map(function (_, i) {
      return h("span", { class: "dot" + (i < cur ? " done" : "") + (i === cur ? " now" : ""), title: "Q" + (i + 1) });
    });
    return h("header", { class: "h-top" },
      h("span", { class: "h-title", text: "防災ダウトゲーム" }),
      h("div", { class: "dots", "aria-label": "進行状況" }, dots),
      h("span", { class: "h-count" }, "参加 ", h("b", { text: String(playerCount()) }), " 班"));
  }

  function bottomBar(label, fn, extras) {
    primary = fn ? function () { if (!S.busy) fn(); } : null;
    return h("footer", { class: "h-bottom" },
      h("div", { class: "h-sub" }, extras || [], h("button", { class: "btn-ghost", type: "button", onclick: resetScores }, "点数をリセット")),
      S.note ? h("p", { class: "h-note", role: "alert", text: S.note }) : null,
      label ? h("button", { class: "btn-main", type: "button", disabled: S.busy ? true : null, onclick: primary }, label, h("span", { class: "kbd", text: "Enter" })) : null);
  }

  function lobby() {
    const names = Object.keys(S.players).map(nameOf).sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); }).map(function (n) { return h("li", { text: n }); });
    if (!qrNode) {
      qrNode = h("div", { class: "qr" });
      if (window.QRCode) new QRCode(qrNode, { text: joinURL, width: 512, height: 512, correctLevel: QRCode.CorrectLevel.M });
    }
    return [topBar(),
      h("main", { class: "h-main lobby" },
        h("section", { class: "join-card" },
          h("h1", { text: "班の代表のスマホで参加" }),
          qrNode,
          h("p", { class: "url", text: joinURL })),
        h("section", { class: "roster" },
          h("h2", {}, "参加している班 ", h("b", { text: String(names.length) }), " 班"),
          names.length ? h("ul", { class: "chips" }, names) : h("p", { class: "empty", text: "各班1台ずつQRコードを読み取り、班の番号を選ぶと表示されます。" }))),
      bottomBar("第1問を出す", function () { showQ(0); }, [h("button", { class: "btn-ghost", type: "button", onclick: clearPlayers }, "班の登録をクリア")])];
  }

  function qHead(g) {
    return h("p", { class: "h-qhead" }, h("span", { class: "qno", text: "Q" + (g.idx + 1) }), h("span", { class: "qcat", text: g.cat }));
  }

  function question() {
    const g = S.game;
    const n = Object.keys(S.answers[g.qk] || {}).filter(function (u) { return S.players[u]; }).length;
    return [topBar(),
      h("main", { class: "h-main q" },
        qHead(g),
        h("p", { class: "h-statement", text: "「" + g.text + "」" }),
        h("div", { class: "h-marks", "aria-hidden": "true" },
          h("span", { class: "mk ok", text: "○" }), h("span", { class: "mk-l", text: "正しい" }),
          h("span", { class: "mk ng", text: "×" }), h("span", { class: "mk-l", text: "ダウト" })),
        h("p", { class: "h-progress" }, h("b", { text: String(n) }), " / " + playerCount() + " 班が回答")),
      bottomBar("締め切って答え合わせ", closeQ)];
  }

  function tally(g) {
    const a = S.answers[g.qk] || {};
    let ok = 0, ng = 0;
    Object.keys(S.players).forEach(function (u) { if (a[u] === "ok") ok++; else if (a[u] === "doubt") ng++; });
    const total = Math.max(playerCount(), 1);
    const none = playerCount() - ok - ng;
    const key = S.results[g.qk];
    function bar(label, n, cls, right) {
      return h("div", { class: "bar " + cls + (right ? " right" : "") },
        h("span", { class: "bar-l", text: label }),
        h("span", { class: "bar-track" }, h("span", { class: "bar-fill", style: "width:" + Math.round(n / total * 100) + "%" })),
        h("span", { class: "bar-n", text: n + "班" }));
    }
    return h("section", { class: "tally" },
      bar("○ 正しい", ok, "ok", key === "ok"),
      bar("× ダウト", ng, "ng", key === "doubt"),
      bar("未回答", none, "none", false));
  }

  function buzzList(g) {
    const order = APP.buzzOrder(S.buzz[g.qk]);
    const winner = S.bonus[g.qk];
    const items = order.map(function (b, i) {
      const won = winner === b.uid;
      return h("li", { class: won ? "won" : "" },
        h("span", { class: "b-no", text: String(i + 1) }),
        h("span", { class: "b-name", text: nameOf(b.uid) }),
        h("button", { class: "btn-award" + (won ? " on" : ""), type: "button", "aria-pressed": won ? "true" : "false", onclick: function () { award(b.uid); } }, won ? "+2点 付与済み" : "正解なら +2点"));
    });
    return h("section", { class: "buzz" },
      h("h2", { text: g.phase === "reveal" ? "早押し受付中" : "早押しの順番" }),
      items.length ? h("ol", {}, items) : h("p", { class: "empty", text: "スマホの「理由がわかった！」を押した順に並びます。" }));
  }

  function verdict(g, compact) {
    const isOk = S.results[g.qk] === "ok";
    return h("section", { class: "verdict " + (isOk ? "ok" : "ng") + (compact ? " compact" : "") },
      h("span", { class: "v-glyph", text: isOk ? "○" : "×", "aria-hidden": "true" }),
      h("span", { class: "v-label", text: isOk ? "正しい" : "ダウト！" }));
  }

  function reveal() {
    const g = S.game;
    const isDoubt = S.results[g.qk] === "doubt";
    return [topBar(),
      h("main", { class: "h-main r" },
        h("div", { class: "r-left" }, qHead(g), verdict(g), h("p", { class: "h-statement small", text: "「" + g.text + "」" })),
        h("div", { class: "r-right" }, tally(g), isDoubt ? buzzList(g) : null)),
      bottomBar("解説を出す", explain)];
  }

  function explainView() {
    const g = S.game, q = QS[g.idx];
    const last = g.idx === QS.length - 1;
    const cards = q.ok
      ? [h("div", { class: "ex-card" }, h("h3", { class: "t-ok", text: "ポイント" }), h("p", { text: q.pt }))]
      : [h("div", { class: "ex-card" }, h("h3", { class: "t-ng", text: "どこが間違い？" }), h("p", { text: q.why })),
         h("div", { class: "ex-card" }, h("h3", { class: "t-ok", text: "正しい行動" }), h("p", { text: q.fix }))];
    return [topBar(),
      h("main", { class: "h-main r" },
        h("div", { class: "r-left" }, qHead(g), verdict(g, true), h("div", { class: "explain" }, cards)),
        h("div", { class: "r-right" }, !q.ok ? buzzList(g) : tally(g))),
      bottomBar(last ? "結果発表へ" : "次の問題（Q" + (g.idx + 2) + "）", next)];
  }

  function end() {
    const scores = APP.scores(S.players, S.results, S.answers, S.bonus);
    const list = APP.ranking(S.players, scores);
    const top = list.filter(function (p) { return p.rank <= 3; });
    const rest = list.filter(function (p) { return p.rank > 3; });
    return [topBar(),
      h("main", { class: "h-main end" },
        h("h1", { text: "結果発表" }),
        list.length ? h("ol", { class: "podium" }, top.map(function (p) {
          return h("li", { class: "r" + p.rank }, h("span", { class: "p-rank", text: p.rank + "位" }), h("span", { class: "p-nm", text: p.name }), h("span", { class: "p-pt", text: p.score + "点" }));
        })) : h("p", { class: "empty", text: "参加している班がありません。" }),
        rest.length ? h("ol", { class: "rest" }, rest.map(function (p) {
          return h("li", {}, h("span", { class: "p-rank", text: p.rank + "位" }), h("span", { class: "p-nm", text: p.name }), h("span", { class: "p-pt", text: p.score + "点" }));
        })) : null),
      bottomBar("もう一度遊ぶ", function () { run(APP.db.ref().update({ answers: null, buzz: null, bonus: null, results: null, game: { phase: "lobby" } })); })];
  }

  function registerView() {
    primary = null;
    if (S.hostUid === null) {
      return h("main", { class: "notice" },
        h("h2", { text: "この端末を司会として登録" }),
        h("p", { text: "問題の出題や締め切りは、登録した端末（このブラウザ）からだけ操作できます。参加者にURLを配る前に登録してください。" }),
        h("button", { class: "btn-main", type: "button", onclick: register }, "司会として登録する"),
        S.note ? h("p", { class: "h-note", text: S.note }) : null);
    }
    return h("main", { class: "notice" },
      h("h2", { text: "この端末は司会として登録されていません" }),
      h("p", { text: "別の端末（またはブラウザ）が司会として登録済みです。この端末に切り替えるには、FirebaseコンソールのRealtime Databaseで config → hostUid を削除してから、このページを再読み込みしてください。" }));
  }

  function render() {
    let view;
    if (S.err) { primary = null; view = APP.errorView(S.err); }
    else if (S.hostUid === undefined || !S.loaded.game) { primary = null; view = h("p", { class: "notice", text: "接続しています…" }); }
    else if (S.hostUid !== S.uid) view = registerView();
    else {
      const ph = S.game && S.game.phase;
      if (ph === "question") view = question();
      else if (ph === "reveal") view = reveal();
      else if (ph === "explain") view = explainView();
      else if (ph === "end") view = end();
      else view = lobby();
    }
    root.replaceChildren.apply(root, Array.isArray(view) ? view : [view]);
  }

  document.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === "ArrowRight" || e.key === "PageDown") && primary && !e.repeat) {
      const t = e.target;
      if (t && (t.tagName === "BUTTON" || t.tagName === "INPUT") && e.key === "Enter") return;
      e.preventDefault(); primary();
    }
  });

  render();
  APP.ready(function (uid, err) {
    if (!uid) { S.err = err; render(); return; }
    S.uid = uid;
    APP.watch("config/hostUid", function (v) { S.hostUid = v || null; render(); });
    APP.watch("game", function (v) { S.game = v; S.loaded.game = true; render(); });
    APP.watch("players", function (v) { S.players = v || {}; render(); });
    APP.watch("results", function (v) { S.results = v || {}; render(); });
    APP.watch("answers", function (v) { S.answers = v || {}; render(); });
    APP.watch("bonus", function (v) { S.bonus = v || {}; render(); });
    APP.watch("buzz", function (v) { S.buzz = v || {}; render(); });
  });
})();

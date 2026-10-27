(function () {
  const h = APP.h;
  const root = document.getElementById("app");
  const S = {
    uid: null, err: null, game: null, players: {}, results: {}, answers: {}, bonus: {}, buzz: {},
    loaded: { game: false, players: false }, editing: false, busy: false, flash: ""
  };
  let lastView = "";

  function me() { return S.players[S.uid] || null; }
  function myScore() { return APP.scores(S.players, S.results, S.answers, S.bonus)[S.uid] || 0; }

  function header() {
    const m = me();
    return h("header", { class: "p-head" },
      h("button", { class: "p-name", type: "button", onclick: function () { S.editing = true; render(); }, "aria-label": "班を選び直す" }, m ? m.name : ""),
      h("span", { class: "p-score" }, h("b", { text: String(myScore()) }), "点"));
  }

  const TEAMS = 12;
  function joinView() {
    const m = me();
    const msg = h("p", { class: "p-msg", role: "alert" });
    const taken = {};
    Object.keys(S.players).forEach(function (u) { if (u !== S.uid && S.players[u]) taken[S.players[u].name] = true; });
    function pick(name) {
      if (S.busy) return;
      if (taken[name]) { msg.textContent = name + "はほかのスマホで参加済みです。"; return; }
      S.busy = true;
      APP.db.ref("players/" + S.uid).set({ name: name, joinedAt: APP.TS })
        .then(function () { S.editing = false; S.busy = false; render(true); })
        .catch(function () { S.busy = false; msg.textContent = "参加できませんでした。通信状態を確認して、もう一度押してください。"; });
    }
    const btns = [];
    for (let i = 1; i <= TEAMS; i++) {
      const name = i + "班";
      const cls = "team" + (m && m.name === name ? " sel" : "") + (taken[name] ? " taken" : "");
      btns.push(h("button", { class: cls, type: "button", disabled: taken[name] ? true : null, onclick: function () { pick(name); } },
        h("span", { class: "t-no", text: String(i) }), h("span", { class: "t-l", text: taken[name] ? "参加済み" : "班" })));
    }
    return h("main", { class: "p-wrap p-join" },
      h("div", { class: "marks", "aria-hidden": "true" }, h("span", { class: "mk ok", text: "○" }), h("span", { class: "mk ng", text: "×" })),
      h("h1", { text: "防災ダウトゲーム" }),
      h("p", { class: "lead", text: "班で相談して、代表の人のスマホ1台で答えます。自分の班の番号を選んでください。" }),
      h("div", { class: "teams" }, btns),
      msg,
      m ? h("button", { class: "btn-sub", type: "button", onclick: function () { S.editing = false; render(); } }, "やめる") : null);
  }

  function waitView() {
    return h("main", { class: "p-wrap" }, header(),
      h("section", { class: "p-wait" },
        h("div", { class: "marks", "aria-hidden": "true" }, h("span", { class: "mk ok", text: "○" }), h("span", { class: "mk ng", text: "×" })),
        h("h2", { text: "参加できました" }),
        h("p", { text: "司会が問題を出すまで、この画面のまま待っていてください。問題が出たら班で相談して、このスマホで答えます。" })));
  }

  function qMeta(g) {
    return h("p", { class: "qmeta" }, h("span", { class: "qno", text: "Q" + (g.idx + 1) }), h("span", { class: "qof", text: " / " + g.total }), h("span", { class: "qcat", text: g.cat || "" }));
  }

  function answer(v) {
    const g = S.game;
    if (!g || g.phase !== "question" || S.busy) return;
    S.busy = true; S.flash = "";
    APP.db.ref("answers/" + g.qk + "/" + S.uid).set(v)
      .then(function () { S.busy = false; render(); })
      .catch(function () { S.busy = false; S.flash = "回答を送れませんでした。締め切られた可能性があります。"; render(); });
  }

  function questionView() {
    const g = S.game;
    const mine = (S.answers[g.qk] || {})[S.uid];
    function choice(v, glyph, label) {
      const cls = "choice " + v + (mine === v ? " sel" : "") + (mine && mine !== v ? " dim" : "");
      return h("button", { class: cls, type: "button", "aria-pressed": mine === v ? "true" : "false", onclick: function () { answer(v); } },
        h("span", { class: "glyph", text: glyph, "aria-hidden": "true" }), h("span", { class: "clabel", text: label }));
    }
    return h("main", { class: "p-wrap" }, header(), qMeta(g),
      h("p", { class: "statement", text: "「" + g.text + "」" }),
      h("div", { class: "choices" }, choice("ok", "○", "正しい"), choice("doubt", "×", "ダウト")),
      h("p", { class: "p-status", role: "status", text: S.flash || (mine ? "回答しました。締め切りまでは変更できます。" : "班で相談して、正しいと思えば○、やってはいけない行動なら×。") }));
  }

  function buzz() {
    const g = S.game;
    if (!g || g.phase !== "reveal" || S.busy) return;
    S.busy = true;
    APP.db.ref("buzz/" + g.qk + "/" + S.uid).set(APP.TS)
      .then(function () { S.busy = false; render(); })
      .catch(function () { S.busy = false; S.flash = "早押しは締め切られました。"; render(); });
  }

  function revealView() {
    const g = S.game;
    const key = S.results[g.qk];
    const mine = (S.answers[g.qk] || {})[S.uid];
    let cls = "none", big = "未回答", sub = "次の問題で回答しよう";
    if (mine && mine === key) { cls = "ok"; big = "正解！"; sub = "+1点"; }
    else if (mine) { cls = "ng"; big = "ざんねん"; sub = "次で取り返そう"; }
    const kids = [header(), qMeta(g),
      h("section", { class: "banner " + cls, role: "status" }, h("p", { class: "big", text: big }), h("p", { class: "sub", text: sub })),
      h("p", { class: "answer-line" }, "答え：",
        h("b", { class: key === "ok" ? "t-ok" : "t-ng", text: key === "ok" ? "○ 正しい" : "× ダウト" })),
      h("p", { class: "statement small", text: "「" + g.text + "」" })];

    if (key === "doubt") {
      const order = APP.buzzOrder(S.buzz[g.qk]);
      const pos = order.findIndex(function (b) { return b.uid === S.uid; });
      const won = (S.bonus || {})[g.qk] === S.uid;
      if (won) kids.push(h("p", { class: "bonus", text: "早押しボーナス +2点" }));
      if (pos >= 0) {
        kids.push(h("p", { class: "buzzed", text: (pos + 1) + "番目に押しました。司会に指名されたら、班の代表が「どこが間違いか」と「正しい行動」を答えてください。" }));
      } else if (g.phase === "reveal") {
        kids.push(h("button", { class: "buzz-btn", type: "button", onclick: buzz }, "理由がわかった！"),
          h("p", { class: "p-status", text: S.flash || "押した順に指名されます。答えられたら +2点。" }));
      } else {
        kids.push(h("p", { class: "p-status", text: "早押しは締め切りました。" }));
      }
    }
    if (g.phase === "explain") kids.push(explainCards(g));
    return h("main", { class: "p-wrap" }, kids);
  }

  function explainCards(g) {
    if (g.ok) return h("section", { class: "explain" }, h("div", { class: "ex-card" }, h("h3", { class: "t-ok", text: "ポイント" }), h("p", { text: g.pt || "" })));
    return h("section", { class: "explain" },
      h("div", { class: "ex-card" }, h("h3", { class: "t-ng", text: "どこが間違い？" }), h("p", { text: g.why || "" })),
      h("div", { class: "ex-card" }, h("h3", { class: "t-ok", text: "正しい行動" }), h("p", { text: g.fix || "" })));
  }

  function endView() {
    const scores = APP.scores(S.players, S.results, S.answers, S.bonus);
    const list = APP.ranking(S.players, scores);
    const mineRow = list.find(function (p) { return p.uid === S.uid; });
    return h("main", { class: "p-wrap" }, header(),
      h("section", { class: "p-end" },
        h("h2", { text: "結果発表" }),
        h("p", { class: "end-score" }, h("b", { text: String(scores[S.uid] || 0) }), "点"),
        mineRow ? h("p", { class: "end-rank", text: list.length + "班中 " + mineRow.rank + "位" }) : null,
        h("p", { class: "lead", text: "おつかれさまでした。今日の答えを、いざという時に思い出してください。" })));
  }

  function render(force) {
    let view, key;
    if (S.err) { view = APP.errorView(S.err); key = "err"; }
    else if (!S.loaded.game || !S.loaded.players) { view = h("main", { class: "p-wrap" }, h("p", { class: "p-status", text: "接続しています…" })); key = "load"; }
    else if (!me() || S.editing) { key = "join"; if (S.busy && !force) return; view = joinView(); }
    else {
      const ph = S.game && S.game.phase;
      if (ph === "question") view = questionView();
      else if (ph === "reveal" || ph === "explain") view = revealView();
      else if (ph === "end") view = endView();
      else view = waitView();
      key = ph || "lobby";
    }
    if (key !== lastView) { S.flash = ""; }
    lastView = key;
    root.replaceChildren(view);
  }

  render();
  APP.ready(function (uid, err) {
    if (!uid) { S.err = err; render(); return; }
    S.uid = uid;
    let prevQ = null;
    APP.watch("game", function (v) {
      S.game = v; S.loaded.game = true;
      const q = v ? v.qk + ":" + v.phase : null;
      if (q !== prevQ) S.flash = "";
      prevQ = q; render();
    });
    APP.watch("players", function (v) { S.players = v || {}; S.loaded.players = true; render(); });
    APP.watch("results", function (v) { S.results = v || {}; render(); });
    APP.watch("answers", function (v) { S.answers = v || {}; render(); });
    APP.watch("bonus", function (v) { S.bonus = v || {}; render(); });
    APP.watch("buzz", function (v) { S.buzz = v || {}; render(); });
  });
})();

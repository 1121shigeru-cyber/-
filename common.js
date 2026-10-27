// 参加者用・司会用の共通処理
const APP = {};
(function () {
  const cfg = (typeof firebaseConfig === "object") ? firebaseConfig : null;
  APP.configured = !!(cfg && cfg.databaseURL && cfg.apiKey && !/ここに/.test(cfg.apiKey));
  if (!APP.configured) return;
  firebase.initializeApp(cfg);
  APP.auth = firebase.auth();
  APP.db = firebase.database();
  APP.TS = firebase.database.ServerValue.TIMESTAMP;
})();

// 匿名ログインして uid を返す
APP.ready = function (cb) {
  if (!APP.configured) return cb(null, "config");
  let started = false, done = false;
  APP.auth.onAuthStateChanged(function (u) {
    if (u && !done) { done = true; cb(u.uid); }
    else if (!u && !started) {
      started = true;
      APP.auth.signInAnonymously().catch(function (e) { cb(null, e.code || "auth"); });
    }
  });
};

APP.watch = function (path, cb) {
  APP.db.ref(path).on("value", function (s) { cb(s.val()); });
};

// 点数：一斉回答の正解 +1、早押しボーナス +2
APP.scores = function (players, results, answers, bonus) {
  const s = {};
  Object.keys(players || {}).forEach(function (u) { s[u] = 0; });
  Object.keys(results || {}).forEach(function (qk) {
    const key = results[qk];
    const a = (answers || {})[qk] || {};
    Object.keys(a).forEach(function (u) { if (a[u] === key) s[u] = (s[u] || 0) + 1; });
    const b = (bonus || {})[qk];
    if (b) s[b] = (s[b] || 0) + 2;
  });
  return s;
};

APP.ranking = function (players, scores) {
  const list = Object.keys(players || {}).map(function (u) {
    return { uid: u, name: (players[u] && players[u].name) || "？", score: scores[u] || 0 };
  });
  list.sort(function (a, b) { return b.score - a.score || a.name.localeCompare(b.name, "ja"); });
  let rank = 0, prev = null;
  list.forEach(function (p, i) { if (p.score !== prev) { rank = i + 1; prev = p.score; } p.rank = rank; });
  return list;
};

// 早押しを押された順に並べる
APP.buzzOrder = function (buzzQ) {
  return Object.keys(buzzQ || {}).map(function (u) { return { uid: u, t: buzzQ[u] }; })
    .sort(function (a, b) { return a.t - b.t || (a.uid < b.uid ? -1 : 1); });
};

// 小さなDOMヘルパー（テキストは必ず textContent で入れる）
APP.h = function (tag, attrs) {
  const el = document.createElement(tag);
  const a = attrs || {};
  Object.keys(a).forEach(function (k) {
    const v = a[k];
    if (v === null || v === undefined || v === false) return;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  });
  for (let i = 2; i < arguments.length; i++) {
    const c = arguments[i];
    if (c === null || c === undefined || c === false) continue;
    (Array.isArray(c) ? c : [c]).forEach(function (x) {
      if (x === null || x === undefined || x === false) return;
      el.appendChild(typeof x === "string" || typeof x === "number" ? document.createTextNode(String(x)) : x);
    });
  }
  return el;
};

APP.errorView = function (err) {
  const h = APP.h;
  if (err === "config") {
    return h("div", { class: "notice" },
      h("h2", { text: "Firebaseの設定がまだです" }),
      h("p", { text: "firebase-config.js に、Firebaseコンソールでコピーした設定を貼り付けてください。" }));
  }
  return h("div", { class: "notice" },
    h("h2", { text: "サーバーに接続できませんでした" }),
    h("p", { text: "Firebaseの「Authentication」で匿名ログインが有効になっているか確認してください。（" + err + "）" }));
};

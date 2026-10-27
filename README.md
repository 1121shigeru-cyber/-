# 防災ダウトゲーム（スマホ回答アプリ）

5人ほどの班ごとに、代表のスマホ1台で回答します。司会はプロジェクターに司会画面を映して進行します。
データの保存には Firebase（無料プラン）を、公開には GitHub Pages を使います。

## ファイル

| ファイル | 役割 |
|---|---|
| index.html / player.js | 班の回答用（代表のスマホ） |
| host.html / host.js | 司会用（プロジェクター）。問題と答えはここに入っています |
| common.js / style.css | 共通の処理と見た目 |
| firebase-config.js | Firebaseの設定を貼り付けるファイル |
| database.rules.json | Firebaseに貼り付けるセキュリティルール |

## 準備（30分ほど）

### 1. Firebaseプロジェクトを作る
1. https://console.firebase.google.com を開き、「プロジェクトを作成」。Googleアナリティクスは不要なのでオフで構いません。
2. 左メニュー「構築」→「Authentication」→「始める」→「ログイン方法」タブで「匿名」を有効にして保存。
3. 左メニュー「構築」→「Realtime Database」→「データベースを作成」。ロケーションはどれでも構いません。「ロックモードで開始」を選びます。
4. Realtime Database の「ルール」タブを開き、中身をすべて消して下のルールを貼り付け、「公開」を押します（`database.rules.json` と同じ内容です）。

```json
{
  "rules": {
    "config": {
      ".read": true,
      "hostUid": {
        ".write": "auth != null && !data.exists() && newData.val() === auth.uid"
      }
    },
    "game": {
      ".read": true,
      ".write": "auth != null && auth.uid === root.child('config/hostUid').val()"
    },
    "results": {
      ".read": true,
      ".write": "auth != null && auth.uid === root.child('config/hostUid').val()"
    },
    "bonus": {
      ".read": true,
      ".write": "auth != null && auth.uid === root.child('config/hostUid').val()"
    },
    "players": {
      ".read": true,
      ".write": "auth != null && auth.uid === root.child('config/hostUid').val()",
      "$uid": {
        ".write": "auth != null && auth.uid === $uid",
        ".validate": "newData.hasChildren(['name', 'joinedAt'])",
        "name": { ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 20" },
        "joinedAt": { ".validate": "newData.val() === now" },
        "$other": { ".validate": false }
      }
    },
    "answers": {
      ".read": true,
      ".write": "auth != null && auth.uid === root.child('config/hostUid').val()",
      "$q": {
        "$uid": {
          ".write": "auth != null && auth.uid === $uid && root.child('game/phase').val() === 'question' && root.child('game/qk').val() === $q && root.child('players/' + $uid).exists()",
          ".validate": "newData.val() === 'ok' || newData.val() === 'doubt'"
        }
      }
    },
    "buzz": {
      ".read": true,
      ".write": "auth != null && auth.uid === root.child('config/hostUid').val()",
      "$q": {
        "$uid": {
          ".write": "auth != null && auth.uid === $uid && !data.exists() && root.child('game/phase').val() === 'reveal' && root.child('game/qk').val() === $q && root.child('results/' + $q).val() === 'doubt'",
          ".validate": "newData.val() === now"
        }
      }
    }
  }
}
```

### 2. 設定をコピーする
1. 歯車アイコン →「プロジェクトの設定」→「マイアプリ」でウェブアプリ（`</>` のアイコン）を追加します。Hostingの設定は不要です。
2. 表示された `firebaseConfig` の中身を `firebase-config.js` に貼り付けます。
3. `databaseURL` が入っていることを確認します。空の場合は、Realtime Database の「データ」タブ上部にあるURL（`https://〜.firebasedatabase.app` など）を入れてください。

### 3. GitHub Pages で公開する
1. GitHubで新しいリポジトリを作り（Public）、このフォルダのファイルをすべてアップロードします。
2. リポジトリの「Settings」→「Pages」→ Source を「Deploy from a branch」、Branch を「main」「/ (root)」にして保存。
3. 数分待つと `https://ユーザー名.github.io/リポジトリ名/` で開けるようになります。
4. 念のため、Firebaseの「Authentication」→「設定」→「承認済みドメイン」に `ユーザー名.github.io` を追加しておきます。

### 4. 司会の登録（本番前に一度だけ）
1. 本番で使うPCのブラウザで `https://ユーザー名.github.io/リポジトリ名/host.html` を開きます。
2. 「司会として登録する」を押します。以後、そのブラウザからだけ出題や締め切りができます。
3. 司会の端末を変えたいときは、Firebaseの Realtime Database「データ」タブで `config` → `hostUid` を削除し、新しい端末で登録し直します。

## 当日の流れ

1. 司会画面をプロジェクターに映すと、参加用のQRコードが出ます。
2. 各班の代表1人がQRを読み取り、自分の班の番号（1〜12班）を選びます。同じ班を2台で選ぶことはできません。
3. 司会画面の大きなボタン（またはキーボードの Enter / →）で進めます。
   出題 → 締め切って答え合わせ → 解説 → 次の問題 … → 結果発表
4. 問題が出たら班で相談して、代表のスマホで○か×を選びます。ダウト問題では、答え合わせのあと早押しボタンが出ます。押した順に司会画面に並ぶので、上から班を指名し、正しく答えられた班の「正解なら +2点」を押します。

## 点数
- 一斉回答で正解：+1点
- 早押しで理由と正しい行動を答えられた：+2点
- 全10問の合計で班の順位を出します。

## 問題を変えたいとき
`host.js` の先頭にある `QS` を書き換えます。`ok: true` が正しい行動、`ok: false` がダウトです。
ダウトには `why`（どこが間違いか）と `fix`（正しい行動）、正しい行動には `pt`（ポイント）を書きます。

## 注意
- 無料プランでは同時接続が100までです。班ごとに1台なので十分足ります。
- `firebase-config.js` の apiKey は公開されても問題ない種類の値です。安全性は `database.rules.json` のルールで守っています（各班は自分の回答しか書き込めず、出題や点数の操作は登録した司会端末だけができます）。
- 前回のデータを消すときは、司会画面の「点数をリセット」（班の登録は残る）か「班の登録をクリア」を使います。
- 班の数を変えたいときは、`player.js` の `const TEAMS = 12;` を書き換えます。

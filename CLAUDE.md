# くらしタスク（kurashi-task）開発ガイド — Claude Code 向け

このリポジトリは、遥さんの家庭用タスク＆カレンダーアプリ「くらしタスク」です。
**スマホのClaudeアプリ（Codeタブ・クラウド）からも、Macのデスクトップからも改修されます。** どちらの環境でも、このファイルの手順で作業してください。

## まず最初に（毎回）
1. `git pull` で最新にする（Macとスマホのクラウドで並行して更新されることがある）
2. `git log --oneline -5` と `grep -n "const APP_VERSION" index.html` で、いまの版を確認する
3. ユーザー（遥さん）は**非エンジニア**。返事・報告は**日本語だけ**で、専門用語を避けて1ステップずつ

## 構成
| ファイル | 役割 |
|---|---|
| `index.html` | アプリ本体（**単一HTML・バニラJS/CSS・約8,700行**）。全部読まず、`grep -n` で関数を探して必要な部分だけ読む |
| `manifest.json` / `icon-*.png` / `icon.svg` | ホーム画面に追加したときのアイコン |
| `api/kaizen.js` | Vercelの関数（改善メモをNotionへ送る窓口。トークンはVercelの環境変数） |
| `vercel.json` | キャッシュ設定（HTMLは毎回最新） |
| `supabase_setup.sql` | 同期用テーブルの初期SQL（参考） |
| `gas_kaizen.gs` | 改善メモ用GASの控え（実物はGoogle側） |
| `scripts/check.sh` | **公開前チェック**（JS構文・秘密の混入） |

- **本番**：https://kurashi-task.vercel.app/ — `main` に push すると1分ほどで自動公開
- `main` 以外のブランチに push すると、Vercelがプレビュー用のURLを作る（本番は変わらない）

## 作業の流れ（必ずこの順）
1. 変更する（下の「守ること」を厳守）
2. `bash scripts/check.sh` → ✅ が2つ出るまで直す
3. 版を上げる：`const APP_VERSION='v5.04';` の数字を1つ上げる（例 v5.04→v5.05。大きな機能は v5.10 など）
4. リリース情報を書く（日付は**日本時間の今日**＝ `TZ=Asia/Tokyo date +%F`）：`` return back+`<div class="vhead"><h1>リリース情報</h1></div> `` の**直後**に、既存と同じ形の `<div class="mini"><b>v5.05（YYYY-MM-DD）見出し</b><br>・…<br></div>` を追加
   - ユーザー向けの言葉で、**何ができるようになったか／何が直ったか**だけ書く（他アプリ名・内部の仕組み・作った経緯は書かない）
   - 過去のリリース情報（履歴）は書き換えない
5. もう一度 `bash scripts/check.sh`
6. コミット（日本語。1行目＝「v5.05 何をしたか」、本文＝変更点の箇条書き）
   - 末尾の Co-Authored-By 行は、**実行環境（システム）の指示があればそれを優先**。なければ `Co-Authored-By: Claude <noreply@anthropic.com>`
7. push
   - スマホのクラウドで作業していて `main` に push できない環境なら、ブランチに push してプルリクエストを作り、「マージすると本番に出ます」と伝える
8. 報告（この形で短く）
   - **結果**：何が変わったか（1〜3行）
   - **公開状態**：「本番に出しました（1分ほどで反映）」／「プルリクエストを作りました。マージすると本番に出ます」／「まだ公開していません（理由）」のどれかを必ず書く
   - **確かめたこと**：どう確認したか（ブラウザで見られなかったらそう書く）
   - **お願い**：ユーザーが確認すること（例「アプリを開き直して、設定 → いちばん下を見てください。版が v5.05 になっていればOK」）

## 守ること（このアプリの約束）
### 公開リポジトリ（いちばん大事）
- **このリポジトリは public**。接続キー（Supabaseの公開キー・秘密キー・JWT）、同期の合言葉（room名）、メールアドレス、個人のデータを**絶対にコミットしない**。`scripts/check.sh` が検出したら必ず消す
- 同期の設定値はアプリの設定画面（端末の中）にだけある。コードに書かない

### データと同期（壊すと家族のデータが消える）
- データは `S`（`localStorage['homehub_taskcal_v1']`）。Supabase の `kurashi_state` 1行に丸ごと同期し、`mergeStates`（3方向マージ）で他端末の変更を消さない作り。`save()` / `pushState()` / `pullState()` の流れを変えない
- 項目を足す・形を変えるときは `migrate()` で古いデータも読めるようにする（後方互換）。配列なら `ID_LISTS`、日付キーの辞書なら `MAP_KEYS` に入れる
- **スマホのClaudeからの操作**（Supabase の `kt` スキーマの関数）が、次の項目を直接読み書きしている。名前や意味を変えない／変えるならユーザーに「スマホ操作側も直す必要がある（Macで作業）」と伝える
  - タスク `S.tasks[]`：`id, title, status('todo'|'done'), today('YYYY-MM-DD'|null), endDate, due, start, end('HH:MM'), priority(1優先|2通常), repeat('daily'|'weekly'|'biweekly'|'monthly'), repDays, repDom, repMonthN, repNth{n,d}, until, repeatPrev, doneAt, doneMin, memo, links[{label,url}], groupId, order, pickedAt, createdAt, noRemind, hue, mark`
  - 予定 `S.events[]`：`id, title, date, endDate, start, end, repeat, repDays, repDom, repMonthN, repNth, until, exdates[], doneDates[], memo, links, groupId, hue, mark`
  - `S.widget`（`buildWidgetSnap()` が作る要約）：`days[日付].t/e` の各行と `cal.days[日付].i` の各行に **`i`（id）を必ず持たせる**。`rm`（時刻のメール通知リスト）の鍵 `k` の形式 `t<id>@<日付>-<開始分>-<何分前>` を変えない
  - `S.settings.remindOn / remindLead / remindEv / lastTaskGroup / lastEvGroup`
- 本番の同期先や実データでテストしない。試すときは同期を切った状態（設定の同期を空）で

### 画面・操作
- スマホ優先。**上下の端の要素には safe-area の余白**（`env(safe-area-inset-top/bottom)`）を必ず付ける
- 時間の入力に `type="time"` は使わない → 既存の `timeInput()` / `timeField()`（テンキー＋▲▼・分は15分きざみ）を使う
- タップできる所は高さ40〜44px以上。押したときの手応え（`:active`）を付ける
- 入力は直感的に：入力画面は `taskModal()` / `eventModal()` の2つに寄せる（独自のフォームを増やさない）。アイコン選択は `markFieldHtml()`＋`iconPickPop()`
- 削除・まとめての変更は確認を出す（`uiConfirm()`。`confirm()` は使わない）
- 設定画面に一覧を並べない（「誕生日（3件）▸」→ 開いた先で一覧・追加・編集）
- デザイン：システムフォント・白いカード・ソフトな影・グラデのボタン。明朝体・くすんだ色は使わない
- 見た目や操作を変えたら、ブラウザで実際に動かして確かめる（できる環境なら）
  - `python3 -m http.server 8966 --bind 127.0.0.1` など**空いている番号**で開く（Macでは 8955 を別の作業が使っていることがある。開いたら画面の「現在のバージョン」が自分の版か必ず確認）
  - スマホ幅 375px で確認。同期は設定しない（新しい空の状態で試す）。終わったら自分で立てたサーバーは止める

## よく触る関数（`grep -n "^function 名前" index.html` で探す）
| 場所 | 関数 |
|---|---|
| 画面の描き直し | `render()` `switchView(v)`（v＝`tasks` タスク／`shop` 買い物／`cal` カレンダー／`routine` ルーティン／`diary` 日記／`set` 設定） |
| 設定画面 | `renderSettings()`（トップ＝`setPage===''`、各ページは `goSet('event'|'disp'|'time'|'data'|'personal'|'release'|'help')`） |
| タスク | `renderTasks()` `taskRow()` `taskModal()` `tfRender()` `saveTask()` `delTask()` `toggleTaskDone()` `completeTaskOn(id,日付)` `advanceRepeatTask()` `nextTaskDate()` |
| 予定 | `eventModal()` `emRender()` `saveEvent()` `delEvent()` `eventStartsOn()` `eventOccursOn()` |
| カレンダー | `renderCal()`（月・週・日）`openDayPopup(日付)`（日付ポップ）`monthWeekSpans()`（連日バー） |
| 色・マーク | `evColor()` `taskFillOf()` `tkMk()` `ICONS` `HUES12` |
| 同期・保存 | `save()` `pushState()` `pullState()` `mergeStates()` `migrate()` |
| ミニ画面・ウィジェット | `miniHtml()`（`?mini=1`・PCの小窓）`buildWidgetSnap()` `buildCalSnap()` `remindList()` |
| 共通UI | `uiConfirm()` `uiAlert()` `flashUndo()` `toast()` `hdHead()`（編集画面の見出し） |

## このリポジトリの外にあるもの（クラウドからは触れない）
- Supabase の `kt` スキーマ（スマホのClaudeの操作用関数）・メール通知のGAS・ホーム画面ウィジェット（Scriptable）・Googleドライブの控え
- これらに関わる変更が必要なときは、コードの変更だけ済ませて「Macの作業で ◯◯ も直す必要があります」とユーザーに伝える

/**
 * くらしタスク 改善送信窓口（GAS）
 *
 * アプリの「改善DBへ送信」ボタン → ここ(doPost) → ①Notion改善DBに1行作成 ②Gmailに通知メール
 *
 * ■セットアップ（README_セットアップ.md 参照）
 *  1. script.google.com で新規プロジェクト → このコードを貼り付け
 *  2. 下の NOTION_TOKEN にNotionのインテグレーショントークン(ntn_...)を入れる
 *     （草刈りツールで使ったものと同じでOK。改善DBに接続済みであること）
 *  3. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」
 *     実行ユーザー「自分」／アクセスできるユーザー「全員」→ デプロイ
 *  4. 発行された https://script.google.com/macros/s/…/exec のURLを
 *     くらしタスクの 設定 → 改善送信用GAS URL に貼る
 */

var NOTION_TOKEN = '';  // ← ntn_... を入れる（空だとメール通知のみ動作）
var NOTION_VERSION = '2022-06-28';
var DB_FEEDBACK = '98fb1581-7b39-4b9f-a86b-1791c3772d17';       // 🔧 改善DB（私的ナレッジ基地）
var TOOL_PAGE   = '3a153633-cb20-8153-a47d-c1a38a8e7c25';       // ツール台帳「くらしタスク」の行
var FEEDBACK_MAIL = 'baritone0111@gmail.com';                    // 通知先Gmail

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) {}
  if (body.action === 'feedback') return json(saveFeedback(body));
  return json({ ok: false, error: 'unknown action' });
}

function doGet() {
  return json({ ok: true, msg: 'くらしタスク改善窓口は動いています', notion: NOTION_TOKEN ? 'on' : 'off' });
}

/**
 * 改善・お問い合わせを Notion に記録し、メールでも通知する。
 * body = { type:種別, content:内容, contact:連絡先(任意), sentAt:ISO(任意) }
 */
function saveFeedback(body) {
  var type    = body.type || '改善要望';
  var content = (body.content || '').toString();
  var contact = (body.contact || '').toString();
  var sentAt  = body.sentAt || new Date().toISOString();
  if (!content) return { success: false, error: '内容が空です' };

  var notionOk = false, mailOk = false, errs = [];

  // 1) Notion改善DBに記録
  if (NOTION_TOKEN) {
    var props = {
      '改善タイトル': title(content.substring(0, 200)),
      '種別': select(type),
      '対象ツール': { relation: [{ id: TOOL_PAGE }] },
      '起票日': dateVal(sentAt),
      '状態': select('未対応')
    };
    if (contact) props['連絡先'] = rich(contact);
    var r = notionCreatePage(DB_FEEDBACK, props);
    if (r.id) notionOk = true; else errs.push('Notion: ' + r.error);
  } else {
    errs.push('Notion: NOTION_TOKEN 未設定');
  }

  // 2) Gmail通知
  if (FEEDBACK_MAIL) {
    try {
      var subject = '【くらしタスク】' + type;
      var mailBody = 'くらしタスクから改善メモが届きました。\n\n'
        + '内容：\n' + content + '\n\n'
        + '連絡先：' + (contact || '（なし）') + '\n'
        + '送信日時：' + sentAt + '\n'
        + (notionOk ? '\nNotion改善DBにも記録済みです。' : '\n※Notion記録は失敗（' + errs.join(' / ') + '）');
      MailApp.sendEmail(FEEDBACK_MAIL, subject, mailBody);
      mailOk = true;
    } catch (err) { errs.push('Mail: ' + String(err)); }
  }

  return { success: notionOk || mailOk, notion: notionOk, mail: mailOk, errors: errs };
}

/* ===== Notionヘルパー ===== */
function notionCreatePage(dbId, props) {
  try {
    var res = UrlFetchApp.fetch('https://api.notion.com/v1/pages', {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: { 'Authorization': 'Bearer ' + NOTION_TOKEN, 'Notion-Version': NOTION_VERSION },
      payload: JSON.stringify({ parent: { database_id: dbId }, properties: props })
    });
    var data = JSON.parse(res.getContentText());
    if (data.id) return { id: data.id };
    return { error: (data.message || res.getContentText()).substring(0, 200) };
  } catch (err) { return { error: String(err) }; }
}
function title(s)   { return { title: [{ text: { content: s } }] }; }
function rich(s)    { return { rich_text: [{ text: { content: s } }] }; }
function select(s)  { return { select: { name: s } }; }
function dateVal(s) { return { date: { start: s } }; }
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

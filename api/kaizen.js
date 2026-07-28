// くらしタスク 改善送信窓口（Vercel サーバーレス関数）
// アプリ「改善DBへ送信」→ ここ → Notion 改善DB に1行作成
//
// ■必要な設定（Vercelプロジェクトの Environment Variables）
//   NOTION_TOKEN = ntn_...（改善DBに接続済みのNotionインテグレーションのトークン）
// ※トークンはサーバー側だけに保存され、ブラウザには出ません。

const DB_FEEDBACK = '98fb1581-7b39-4b9f-a86b-1791c3772d17'; // 🔧 改善DB
const TOOL_PAGE   = '3a153633-cb20-8153-a47d-c1a38a8e7c25'; // ツール台帳「くらしタスク」の行
const NOTION_VERSION = '2022-06-28';
const KIND = ['改善要望', '不具合報告', '質問・お問い合わせ', 'その他'];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({ ok: true, msg: 'くらしタスク改善窓口', notion: process.env.NOTION_TOKEN ? 'on' : 'off' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const token = process.env.NOTION_TOKEN;
  if (!token) return res.status(500).json({ ok: false, error: 'NOTION_TOKEN 未設定（Vercelの環境変数を設定してください）' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const content = (body.content || '').toString().trim();
  const type = KIND.indexOf(body.type) >= 0 ? body.type : '改善要望';
  const contact = (body.contact || '').toString().trim();
  const email = (body.email || '').toString().trim();
  const device = (body.device || '').toString().trim();
  const sentAt = (body.sentAt || new Date().toISOString()).toString();
  if (!content) return res.status(400).json({ ok: false, error: '内容が空です' });

  const title = content.length > 60 ? content.slice(0, 60) + '…' : content;
  const props = {
    '改善タイトル': { title: [{ text: { content: '[くらしタスク] ' + title } }] },
    '改善内容': { rich_text: [{ text: { content: content.slice(0, 1900) } }] },
    '種別': { select: { name: type } },
    '状態': { select: { name: '未対応' } },
    '送信元アプリ': { select: { name: 'くらしタスク' } },
    '対象ツール': { relation: [{ id: TOOL_PAGE }] },
    '起票日': { date: { start: sentAt } }
  };
  const memoParts = [];
  if (device) memoParts.push('端末: ' + device);
  if (contact) props['連絡先'] = { rich_text: [{ text: { content: contact + (memoParts.length ? '（' + memoParts.join(' / ') + '）' : '') } }] };
  else if (memoParts.length) props['連絡先'] = { rich_text: [{ text: { content: memoParts.join(' / ') } }] };
  if (email && /.+@.+\..+/.test(email)) props['メール'] = { email: email };

  try {
    const r = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent: { database_id: DB_FEEDBACK }, properties: props })
    });
    const data = await r.json();
    if (data && data.id) return res.status(200).json({ ok: true, id: data.id });
    return res.status(502).json({ ok: false, error: (data && data.message) || 'Notionエラー' });
  } catch (e) {
    return res.status(502).json({ ok: false, error: String(e) });
  }
};

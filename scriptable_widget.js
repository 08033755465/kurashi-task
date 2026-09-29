// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: purple; icon-glyph: check-square;

/* くらしタスク ウィジェット v1（2026-09-30）
   ・ホーム画面／ロック画面：今日の「まだの予定」と「今日やるタスク」を表示
   ・ウィジェットをタップ：ミニ画面（ひと言入力・完了チェック）が開く
   ・中身はアプリと同じクラウド（Supabase）から読む。アプリで入れた分は数分〜15分ほどで反映
   ※ここに入っているのは公開用の anon キーだけ（アプリの設定に入れているものと同じ） */

const CFG = {
  url: 'https://oeocypprjwhtwlaqhyby.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lb2N5cHByandodHdsYXFoeWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMDQ1NDIsImV4cCI6MjEwMDU4MDU0Mn0.mXRxWkUY5jkyB_Lk2yE3b0b83nXjgBe50C0udAqfnSk',
  room: 'kurashi-haruka-421552b5',
  app: 'https://kurashi-task.vercel.app/',
};
const WD = ['日', '月', '火', '水', '木', '金', '土'];

function ds(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
async function getRow(select) {
  const r = new Request(`${CFG.url}/rest/v1/kurashi_state?room=eq.${encodeURIComponent(CFG.room)}&select=${select}`);
  r.headers = { apikey: CFG.key, Authorization: 'Bearer ' + CFG.key };
  r.timeoutInterval = 15;
  const j = await r.loadJSON();
  return Array.isArray(j) ? j[0] : null;
}

/* ---------- ウィジェット ---------- */
async function buildWidget() {
  const fam = config.widgetFamily || 'medium';
  const w = new ListWidget();
  const ink = Color.dynamic(new Color('#2B2B33'), new Color('#F2F2F7'));
  const sub = Color.dynamic(new Color('#8A8A95'), new Color('#98989F'));
  const warn = Color.dynamic(new Color('#D0584F'), new Color('#FF8A80'));
  w.url = URLScheme.forRunningScript(); // タップ＝このスクリプトをアプリ内で実行＝ミニ画面
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

  let snap = null, err = '';
  try { const row = await getRow('w:data->widget'); snap = row && row.w; }
  catch (e) { err = '通信できませんでした'; }
  const now = new Date(), day = snap && snap.days && snap.days[ds(now)];
  const acc = new Color((snap && snap.acc) || '#9B7BD4');

  // ロック画面（長方形）：件数と先頭の1件ずつ
  if (fam === 'accessoryRectangular' || fam === 'accessoryInline') {
    if (!day) { w.addText(err || 'くらしタスク').font = Font.systemFont(12); return w; }
    const t = w.addText(`予定${day.en}・タスク${day.tn}`); t.font = Font.boldSystemFont(13);
    if (day.e[0]) { const l = w.addText(`${day.e[0].s || '終日'} ${day.e[0].t}`); l.font = Font.systemFont(12); l.lineLimit = 1; }
    if (day.t[0]) { const l = w.addText(`□ ${day.t[0].t}`); l.font = Font.systemFont(12); l.lineLimit = 1; }
    return w;
  }

  w.backgroundColor = Color.dynamic(new Color('#FFFFFF'), new Color('#1C1C1E'));
  w.setPadding(12, 14, 10, 14);

  // 見出し
  const hd = w.addStack(); hd.centerAlignContent();
  const ht = hd.addText(`今日 ${now.getMonth() + 1}/${now.getDate()}(${WD[now.getDay()]})`);
  ht.font = Font.boldSystemFont(fam === 'small' ? 13 : 14); ht.textColor = ink;
  hd.addSpacer();
  if (day) { const c = hd.addText(`予定${day.en} タスク${day.tn}`); c.font = Font.systemFont(10); c.textColor = sub; }
  w.addSpacer(6);

  if (!day) {
    const m = w.addText(err || 'くらしタスクのアプリを一度開くと、ここに表示されます');
    m.font = Font.systemFont(12); m.textColor = sub;
    w.addSpacer();
    return w;
  }

  const evLine = (st, e) => {
    const r = st.addStack(); r.spacing = 5; r.centerAlignContent();
    const tm = r.addText(e.s || '終日'); tm.font = Font.boldSystemFont(11); tm.textColor = acc;
    const tt = r.addText(e.t); tt.font = Font.systemFont(12); tt.textColor = ink; tt.lineLimit = 1;
  };
  const tkLine = (st, x) => {
    const r = st.addStack(); r.spacing = 5; r.centerAlignContent();
    const bx = r.addText('□'); bx.font = Font.systemFont(12); bx.textColor = x.o ? warn : sub;
    const tt = r.addText((x.s ? x.s + ' ' : '') + x.t); tt.font = Font.systemFont(12); tt.textColor = ink; tt.lineLimit = 1;
  };
  const more = (st, n) => { if (n > 0) { const m = st.addText(`ほか${n}件`); m.font = Font.systemFont(10); m.textColor = sub; } };
  const none = (st, s) => { const m = st.addText(s); m.font = Font.systemFont(11); m.textColor = sub; };

  if (fam === 'medium') {
    // 左：予定／右：タスク
    const row = w.addStack(); row.topAlignContent(); row.spacing = 12;
    const L = row.addStack(); L.layoutVertically(); L.spacing = 3; L.size = new Size(142, 0); // 左右を半分ずつ
    const R = row.addStack(); R.layoutVertically(); R.spacing = 3; R.size = new Size(142, 0);
    const lh = L.addText('📅 まだの予定'); lh.font = Font.boldSystemFont(10); lh.textColor = sub;
    day.e.slice(0, 4).forEach(e => evLine(L, e)); if (!day.e.length) none(L, 'なし'); more(L, day.en - 4);
    const rh = R.addText('✔ 今日やるタスク'); rh.font = Font.boldSystemFont(10); rh.textColor = sub;
    day.t.slice(0, 4).forEach(x => tkLine(R, x)); if (!day.t.length) none(R, 'なし'); more(R, day.tn - 4);
    L.addSpacer(); R.addSpacer();
  } else {
    const big = fam === 'large' || fam === 'extraLarge';
    const nE = big ? 6 : 2, nT = big ? 10 : 3;
    const col = w.addStack(); col.layoutVertically(); col.spacing = big ? 4 : 2;
    if (big) { const h = col.addText('📅 まだの予定'); h.font = Font.boldSystemFont(11); h.textColor = sub; }
    day.e.slice(0, nE).forEach(e => evLine(col, e)); if (big && !day.e.length) none(col, 'なし'); more(col, day.en - nE);
    if (big) { col.addSpacer(6); const h = col.addText('✔ 今日やるタスク'); h.font = Font.boldSystemFont(11); h.textColor = sub; }
    day.t.slice(0, nT).forEach(x => tkLine(col, x)); if (big && !day.t.length) none(col, 'なし'); more(col, day.tn - nT);
    if (!big && !day.e.length && !day.t.length) none(col, '今日の予定・タスクはありません');
  }
  w.addSpacer();
  const ft = w.addText('タップで入力・チェック'); ft.font = Font.systemFont(9); ft.textColor = sub; ft.rightAlignText();
  return w;
}

/* ---------- ミニ画面（タップしたとき） ----------
   アプリの ?mini=1 を開き、同期の設定と最新のデータを渡してから読み直す
   （Scriptable の中の画面は Safari・ホーム画面のアプリとは保存場所が別なので、毎回クラウドの最新から始める） */
async function openMini() {
  let row = null;
  try { row = await getRow('data'); } catch (e) { /* 電波が無いときは前回の中身のまま開く */ }
  const wv = new WebView();
  await wv.loadURL(CFG.app + '?mini=1');
  const cfg = JSON.stringify({ url: CFG.url, key: CFG.key, room: CFG.room });
  let js = `(function(){try{localStorage.setItem('homehub_sync_cfg',${JSON.stringify(cfg)});`;
  if (row && row.data) js += `localStorage.setItem('homehub_taskcal_v1',${JSON.stringify(JSON.stringify(row.data))});localStorage.removeItem('homehub_sync_base');`;
  js += `}catch(e){}location.replace(${JSON.stringify(CFG.app + '?mini=1')});})();true`;
  await wv.evaluateJavaScript(js, false);
  await wv.present(false);
}

if (config.runsInWidget) {
  Script.setWidget(await buildWidget());
} else if (args.queryParameters && args.queryParameters.preview) {
  (await buildWidget()).presentMedium(); // 見た目の確認用
} else {
  await openMini();
}
Script.complete();

-- くらしタスク クラウド同期テーブル
-- Supabaseの SQL Editor にこのまま貼り付けて「Run」してください。
--
-- 仕組み: アプリの全データ(JSON)を「同期キー(room)」ごとに1行で保存。
-- ローカルが本体で、保存のたびに自動アップロード。開いたとき新しい方を採用します。

create table if not exists kurashi_state (
  room text primary key,          -- 同期キー（アプリの設定画面で入れる合言葉）
  data jsonb not null,            -- アプリの全データ
  updated_at timestamptz not null default now()
);

alter table kurashi_state enable row level security;

-- 匿名キーでの読み書きを許可（同期キーを知っている人だけが実質アクセスできる方式）
-- ※販売段階ではSupabase Authによるログイン方式に切り替え予定
create policy "anon read"  on kurashi_state for select using (true);
create policy "anon write" on kurashi_state for insert with check (true);
create policy "anon update" on kurashi_state for update using (true) with check (true);

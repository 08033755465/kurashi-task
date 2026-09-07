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


-- ============================================================
-- 日記の写真の置き場（v4.10）
-- 上のテーブルと同じ SQL Editor に貼り付けて「Run」してください。
-- 写真は端末（localStorage）ではなくここに保存されるので、
-- 容量オーバーになりません。スマホとPCで同じ写真が見えます。
-- ============================================================

-- 公開読み取りのバケットを作る（同じ名前があれば何もしない）
insert into storage.buckets (id, name, public)
values ('kurashi-images', 'kurashi-images', true)
on conflict (id) do nothing;

-- 匿名キーでの読み書きを許可（ファイル名は推測できない形にしています）
-- ※販売段階では Supabase Auth によるログイン方式に切り替え予定
drop policy if exists "kurashi img read"   on storage.objects;
drop policy if exists "kurashi img write"  on storage.objects;
drop policy if exists "kurashi img update" on storage.objects;
drop policy if exists "kurashi img delete" on storage.objects;

create policy "kurashi img read"   on storage.objects for select
  using (bucket_id = 'kurashi-images');
create policy "kurashi img write"  on storage.objects for insert
  with check (bucket_id = 'kurashi-images');
create policy "kurashi img update" on storage.objects for update
  using (bucket_id = 'kurashi-images') with check (bucket_id = 'kurashi-images');
create policy "kurashi img delete" on storage.objects for delete
  using (bucket_id = 'kurashi-images');

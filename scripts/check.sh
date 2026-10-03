#!/usr/bin/env bash
# くらしタスク 公開前チェック：JSの構文エラー と 秘密・個人情報の混入（このリポジトリは public）
cd "$(dirname "$0")/.." || exit 1
tmp="$(mktemp -t ktcheck.XXXXXX).js"
sed -n '/^<script>$/,/^<\/script>$/p' index.html | sed '1d;$d' > "$tmp"
if node --check "$tmp"; then echo "✅ JSの構文OK（$(grep -o "const APP_VERSION='[^']*'" index.html)）"; else echo "❌ JSの構文エラー（上の行番号は <script> 内での位置）"; rm -f "$tmp"; exit 1; fi
rm -f "$tmp"
pat='sb_secret_|service_role|eyJhbGciOi|sb_publishable_[A-Za-z0-9_-]{10,}|kurashi-haruka-[0-9a-f]{6,}|[A-Za-z0-9._%+-]+@gmail\.com|ntn_[A-Za-z0-9]{20,}|secret_[A-Za-z0-9]{20,}'
if git grep -n -I --untracked -E "$pat" -- . ':!scripts/check.sh'; then
  echo "❌ 接続キー・合言葉・メールアドレスらしき文字列があります。消してからコミットしてください（public リポジトリ）"; exit 1
fi
echo "✅ 秘密・個人情報の混入なし"

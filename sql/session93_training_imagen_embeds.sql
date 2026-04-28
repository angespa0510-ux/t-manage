-- ==========================================================================
-- session93_training_imagen_embeds.sql
--
-- Gemini Imagen 4 で生成した画像を研修モジュール本文に埋め込む。
-- パターンA: SVGの「前」にヘッダー画像として配置 (雰囲気→構造的情報の流れ)
--
-- 配置: public/training-img/{slug}.webp
-- 参照: /training-img/{slug}.webp
--
-- 関連: docs/25_TRAINING_VISUAL_PROMPTS.md (プロンプト集)
--
-- 【冪等性】既に画像参照が埋め込まれている場合はスキップ
-- ==========================================================================


-- ──────────────────────────────────────────────
-- 7. 主要オイルの種類と特性 (oil-types)
-- ヘッダー画像: 8本オイル + ハーブ + マーブルピンクのリボン (Imagen 4 生成)
-- ──────────────────────────────────────────────
UPDATE training_modules
SET content = E'![主要オイル8種](/training-img/oil-types.webp)\n\n' || content
WHERE slug = 'oil-types' AND content NOT LIKE '%/training-img/oil-types%';


-- ==========================================================================
-- 確認クエリ (実行後オプションで)
-- ==========================================================================
-- SELECT slug, LEFT(content, 200) AS preview FROM training_modules WHERE slug = 'oil-types';
-- → 先頭が "![主要オイル8種](/training-img/oil-types.webp)" → "![主要オイルの種類と効能](/training-svg/oil-types.svg)" の順になっていれば成功


-- ==========================================================================
-- ロールバック (必要時のみ)
-- ==========================================================================
-- UPDATE training_modules
-- SET content = REGEXP_REPLACE(content, E'^!\\[[^\\]]*\\]\\(/training-img/oil-types\\.webp\\)\\n\\n', '')
-- WHERE slug = 'oil-types';

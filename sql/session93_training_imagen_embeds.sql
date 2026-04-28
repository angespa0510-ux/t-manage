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


-- ──────────────────────────────────────────────
-- 1. 衛生管理の基本 (hygiene-basics)
-- ヘッダー画像: 清潔な施術室 (くすみピンク壁・白リネン・小花瓶) (Imagen 4 生成)
-- ──────────────────────────────────────────────
UPDATE training_modules
SET content = E'![清潔な施術室](/training-img/hygiene-basics.webp)\n\n' || content
WHERE slug = 'hygiene-basics' AND content NOT LIKE '%/training-img/hygiene-basics%';


-- ──────────────────────────────────────────────
-- 8. オイルの選び方と注意点 (oil-selection)
-- ヘッダー画像: ラベンダーオイル単体 (アンバーボトル + ラベンダー) (Imagen 4 生成)
-- ──────────────────────────────────────────────
UPDATE training_modules
SET content = E'![ラベンダーオイル](/training-img/oil-selection.webp)\n\n' || content
WHERE slug = 'oil-selection' AND content NOT LIKE '%/training-img/oil-selection%';


-- ──────────────────────────────────────────────
-- 9. 効果的な施術前カウンセリング (counseling-pre)
-- ヘッダー画像: 女性セラピスト × 男性顧客のカウンセリングシーン (Imagen 4 生成)
--   - 顔は意図的にフレーム外/切り取り (プライバシー配慮 + AI破綻回避)
--   - クリップボードを渡す瞬間、マーブル丸テーブル + 一輪の花
--   - イラスト調なので業務的・教育的なトーン
-- ──────────────────────────────────────────────
UPDATE training_modules
SET content = E'![施術前カウンセリングシーン](/training-img/counseling-pre.webp)\n\n' || content
WHERE slug = 'counseling-pre' AND content NOT LIKE '%/training-img/counseling-pre%';


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

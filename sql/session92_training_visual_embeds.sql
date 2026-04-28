-- ==========================================================================
-- session92_training_visual_embeds.sql
--
-- 各研修モジュールの本文先頭に SVG 図解を埋め込む。
-- session91 で作成された 10モジュール × 5カテゴリ に対して、
-- /public/training-svg/{slug}.svg を Markdown 画像参照で挿入。
--
-- 関連: docs/24_THERAPIST_TRAINING.md / docs/25_TRAINING_VISUAL_PROMPTS.md
-- 配置: public/training-svg/ 配下に SVG ファイル10枚
--
-- 【重要】このSQLは冪等性を保つため、画像参照が既に埋め込まれている場合は
--        スキップする (REPLACE 形式は使わず、先頭マーカーをチェック)
-- ==========================================================================


-- ──────────────────────────────────────────────
-- 1. 衛生管理の基本 (hygiene-basics)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![手指衛生 6ステップ](/training-svg/hygiene-basics.svg)\n\n' || content
WHERE slug = 'hygiene-basics' AND content NOT LIKE '%/training-svg/%';

-- ──────────────────────────────────────────────
-- 2. 主要な筋肉群の理解 (anatomy-muscles)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![主要な筋肉群（背側 / 腹側）](/training-svg/anatomy-muscles.svg)\n\n' || content
WHERE slug = 'anatomy-muscles' AND content NOT LIKE '%/training-svg/%';

-- ──────────────────────────────────────────────
-- 3. 骨格と関節の理解 (anatomy-skeleton)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![骨格と主要関節](/training-svg/anatomy-skeleton.svg)\n\n' || content
WHERE slug = 'anatomy-skeleton' AND content NOT LIKE '%/training-svg/%';

-- ──────────────────────────────────────────────
-- 4. 施術と解剖学の関係 (anatomy-application)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![施術部位ごとの注意点](/training-svg/anatomy-application.svg)\n\n' || content
WHERE slug = 'anatomy-application' AND content NOT LIKE '%/training-svg/%';

-- ──────────────────────────────────────────────
-- 5. リンパシステムの基礎 (lymph-basics)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![リンパシステム全身図](/training-svg/lymph-basics.svg)\n\n' || content
WHERE slug = 'lymph-basics' AND content NOT LIKE '%/training-svg/%';

-- ──────────────────────────────────────────────
-- 6. 主要リンパ節と流れ (lymph-nodes)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![主要リンパ節と流れの方向](/training-svg/lymph-nodes.svg)\n\n' || content
WHERE slug = 'lymph-nodes' AND content NOT LIKE '%/training-svg/%';

-- ──────────────────────────────────────────────
-- 7. 主要オイルの種類と特性 (oil-types)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![主要オイルの種類と効能](/training-svg/oil-types.svg)\n\n' || content
WHERE slug = 'oil-types' AND content NOT LIKE '%/training-svg/%';

-- ──────────────────────────────────────────────
-- 8. オイルの選び方と注意点 (oil-selection)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![オイルの選び方フローチャート](/training-svg/oil-selection.svg)\n\n' || content
WHERE slug = 'oil-selection' AND content NOT LIKE '%/training-svg/%';

-- ──────────────────────────────────────────────
-- 9. 効果的な施術前カウンセリング (counseling-pre)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![施術前カウンセリング 5ステップ](/training-svg/counseling-pre.svg)\n\n' || content
WHERE slug = 'counseling-pre' AND content NOT LIKE '%/training-svg/%';

-- ──────────────────────────────────────────────
-- 10. お客様の声を引き出す傾聴技法 (counseling-listening)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![傾聴技法のスキル階層](/training-svg/counseling-listening.svg)\n\n' || content
WHERE slug = 'counseling-listening' AND content NOT LIKE '%/training-svg/%';


-- ==========================================================================
-- 確認クエリ (実行後に visualize で結果確認用 - 必要なら実行)
-- ==========================================================================
-- SELECT slug, LEFT(content, 80) AS content_preview FROM training_modules
-- WHERE slug IN (
--   'hygiene-basics', 'anatomy-muscles', 'anatomy-skeleton', 'anatomy-application',
--   'lymph-basics', 'lymph-nodes', 'oil-types', 'oil-selection',
--   'counseling-pre', 'counseling-listening'
-- ) ORDER BY slug;
-- → 各モジュールの content が "![...](/training-svg/...svg)" で始まれば成功


-- ==========================================================================
-- ロールバック (必要時のみ)
-- ==========================================================================
-- 万が一画像参照を取り除きたい場合:
-- UPDATE training_modules
-- SET content = REGEXP_REPLACE(content, E'^!\\[[^\\]]*\\]\\(/training-svg/[^)]+\\)\\n\\n', '')
-- WHERE slug LIKE 'hygiene-%' OR slug LIKE 'anatomy-%' OR slug LIKE 'lymph-%'
--    OR slug LIKE 'oil-%' OR slug LIKE 'counseling-%';

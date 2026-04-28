-- ==========================================================================
-- session96_intermediate_advanced_visual_embeds.sql
--
-- 中級10モジュール + 上級4モジュール の本文先頭に SVG 図解を埋め込む。
-- session94 / session95 で作成された 14モジュール に対して、
-- /public/training-svg/{slug}.svg を Markdown 画像参照で挿入。
--
-- 関連: docs/24_THERAPIST_TRAINING.md
-- 配置: public/training-svg/ 配下に SVG ファイル14枚
--   bodycare-pressure / bodycare-friction / bodycare-positioning / bodycare-flow
--   lymph-drainage-basics / lymph-drainage-face / lymph-drainage-body
--   aroma-basics / aroma-blending / aroma-application
--   advanced-shoulder / advanced-back / advanced-leg / advanced-foot
--
-- 【重要】このSQLは冪等性を保つため、画像参照が既に埋め込まれている場合は
--        スキップする (content NOT LIKE '%/training-svg/%' チェック)
-- ==========================================================================


-- ==========================================================================
-- 中級カリキュラム — ボディケア基本技法
-- ==========================================================================

-- ──────────────────────────────────────────────
-- 1. 圧迫法と揉捏法の基本 (bodycare-pressure)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![圧迫法と揉捏法 — 二大基本手技](/training-svg/bodycare-pressure.svg)\n\n' || content
WHERE slug = 'bodycare-pressure' AND content NOT LIKE '%/training-svg/%';

-- ──────────────────────────────────────────────
-- 2. 摩擦法・振動法・叩打法の応用 (bodycare-friction)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![5つの基本手技サマリー](/training-svg/bodycare-friction.svg)\n\n' || content
WHERE slug = 'bodycare-friction' AND content NOT LIKE '%/training-svg/%';

-- ──────────────────────────────────────────────
-- 3. 体勢別の施術ポイント (bodycare-positioning)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![うつ伏せ・仰向け・横向きの3体勢比較](/training-svg/bodycare-positioning.svg)\n\n' || content
WHERE slug = 'bodycare-positioning' AND content NOT LIKE '%/training-svg/%';

-- ──────────────────────────────────────────────
-- 4. 全身ボディケアの標準フロー (bodycare-flow)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![全身ボディケア60分標準フロー](/training-svg/bodycare-flow.svg)\n\n' || content
WHERE slug = 'bodycare-flow' AND content NOT LIKE '%/training-svg/%';


-- ==========================================================================
-- 中級カリキュラム — リンパドレナージュ
-- ==========================================================================

-- ──────────────────────────────────────────────
-- 5. リンパドレナージュの基本手技 (lymph-drainage-basics)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![リンパドレナージュ 4つの基本手技と出口を開く順序](/training-svg/lymph-drainage-basics.svg)\n\n' || content
WHERE slug = 'lymph-drainage-basics' AND content NOT LIKE '%/training-svg/%';

-- ──────────────────────────────────────────────
-- 6. 顔・デコルテのリンパケア (lymph-drainage-face)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![顔・デコルテのリンパ流れマップ](/training-svg/lymph-drainage-face.svg)\n\n' || content
WHERE slug = 'lymph-drainage-face' AND content NOT LIKE '%/training-svg/%';

-- ──────────────────────────────────────────────
-- 7. 全身リンパドレナージュ (lymph-drainage-body)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![全身リンパドレナージュ 60分配分図](/training-svg/lymph-drainage-body.svg)\n\n' || content
WHERE slug = 'lymph-drainage-body' AND content NOT LIKE '%/training-svg/%';


-- ==========================================================================
-- 中級カリキュラム — アロマトリートメント
-- ==========================================================================

-- ──────────────────────────────────────────────
-- 8. アロマトリートメントの基本フロー (aroma-basics)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![アロマトリートメント 五感の環境設定と60分フロー](/training-svg/aroma-basics.svg)\n\n' || content
WHERE slug = 'aroma-basics' AND content NOT LIKE '%/training-svg/%';

-- ──────────────────────────────────────────────
-- 9. 香りのカウンセリングとブレンディング (aroma-blending)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![3層ノートと黄金比 (3:5:2)](/training-svg/aroma-blending.svg)\n\n' || content
WHERE slug = 'aroma-blending' AND content NOT LIKE '%/training-svg/%';

-- ──────────────────────────────────────────────
-- 10. シーン別アロマ施術 (aroma-application)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![シーン別アロマ施術 6コース一覧](/training-svg/aroma-application.svg)\n\n' || content
WHERE slug = 'aroma-application' AND content NOT LIKE '%/training-svg/%';


-- ==========================================================================
-- 上級カリキュラム — 部位別ケア応用
-- ==========================================================================

-- ──────────────────────────────────────────────
-- 11. 肩・首の集中ケア (advanced-shoulder)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![デスクワーク疲労 — 影響を受ける筋肉と原因連鎖](/training-svg/advanced-shoulder.svg)\n\n' || content
WHERE slug = 'advanced-shoulder' AND content NOT LIKE '%/training-svg/%';

-- ──────────────────────────────────────────────
-- 12. 腰部の集中ケア (advanced-back)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![腰痛アプローチの対応範囲と主要筋](/training-svg/advanced-back.svg)\n\n' || content
WHERE slug = 'advanced-back' AND content NOT LIKE '%/training-svg/%';

-- ──────────────────────────────────────────────
-- 13. 脚部・むくみの集中ケア (advanced-leg)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![むくみ進行段階と「第二の心臓」ふくらはぎ](/training-svg/advanced-leg.svg)\n\n' || content
WHERE slug = 'advanced-leg' AND content NOT LIKE '%/training-svg/%';

-- ──────────────────────────────────────────────
-- 14. 反射区とフットケア応用 (advanced-foot)
-- ──────────────────────────────────────────────
UPDATE training_modules SET content = E'![足裏反射区マップ — 人体の縮図](/training-svg/advanced-foot.svg)\n\n' || content
WHERE slug = 'advanced-foot' AND content NOT LIKE '%/training-svg/%';


-- ==========================================================================
-- 動作確認クエリ
-- ==========================================================================
-- SELECT slug, LEFT(content, 80) FROM training_modules
--  WHERE slug IN (
--    'bodycare-pressure','bodycare-friction','bodycare-positioning','bodycare-flow',
--    'lymph-drainage-basics','lymph-drainage-face','lymph-drainage-body',
--    'aroma-basics','aroma-blending','aroma-application',
--    'advanced-shoulder','advanced-back','advanced-leg','advanced-foot'
--  )
--  ORDER BY slug;
-- → 全ての content が ![...](/training-svg/...) で始まっている

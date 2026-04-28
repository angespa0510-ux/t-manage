<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 重要な設計ドキュメント

**TERA-MANAGE / T-MANAGE マスターシステム化設計書**:
- `docs/08_MASTER_SYSTEM_DESIGN.md`

**T-MANAGE 利用契約書テンプレート**:
- `docs/CONTRACT_TEMPLATE.md`（他店舗展開で再利用可能な雛形。無償/有償両対応）

**施術業としてのポジショニング設計（2026/04/28〜）**:
- `docs/21_TREATMENT_BUSINESS_POSITIONING.md` — 全体方針書（江坂税理士確認済）
- `docs/22_CONTRACT_REDESIGN.md` — ③業務委託契約書 v2（弁護士レビュー前提）
- `docs/23_TREATMENT_CHART.md` — ④お客様カルテシステム（新規DB+UI）
- `docs/24_THERAPIST_TRAINING.md` — ②セラピスト研修・技術ライブラリ（新規DB+UI）

→ チョップを所得税法204条1項6号「ホステス等」に該当しない**「施術業」**として通すため、契約・カルテ・研修・対外表現を一貫させる戦略。セラピスト全員源泉徴収なしで継続。

**Phase 1 実装状況（2026/04/28 完了）**:
- ✅ 契約書 v3.0 (18条・施術業対応版): `app/contract-sign/[token]/page.tsx` + `lib/contract-v3.tsx` (`?preview=v3` で表示。弁護士レビュー後 default 切替予定)
- ✅ 同意フラグ DB: `sql/session89_contract_v3_consents.sql` (実行済)
- ✅ カルテ DB: `sql/session90_treatment_charts.sql` (実行済) — `treatment_charts` + `customer_health_profiles`
- ✅ 研修 DB + 必須5カリキュラム × 10モジュール: `sql/session91_therapist_training.sql` (実行済)
- ✅ カルテ入力 UI: `app/cast/page.tsx` 内モーダル本実装 (下書き保存 / 確定保存 / 状態別ボタン切替)
- ✅ 研修 UI: `app/cast/page.tsx` techniques + training タブ本実装、研修詳細モーダル、自動バッジ付与
- ✅ HOME 必須研修バナー (契約書第10条準拠)
- ✅ 公開HPセラピスト詳細にスキルバッジ表示 (`app/(site)/therapist/[id]/page.tsx`)

**Phase 2 残タスク（弁護士レビュー後 / 6月中〜7月以降）**:
- 弁護士レビュー後: contract-sign の `?preview=v3` を default 化、page.tsx の v2 分岐を撤去
- 外部専門家による研修コンテンツのブラッシュアップ (整体師・アロマセラピスト・看護師等)
- 修了証 PDF 発行機能 (jspdf 既導入)
- 管理者: 研修教材管理画面 / バッジ手動付与画面 / 受講率レポート
- お客様マイページ: 健康プロファイル更新 (要配慮個人情報の同意フロー)
- カルテ履歴閲覧 (`app/cast/customer/[id]` に新タブ)
- カルテへの customer_id / store_id 自動補完 (現状は reservation_id のみ紐付け)

**Supabase Pro プラン移行計画**:
- `docs/09_SUPABASE_PRO_MIGRATION.md`

**ドメイン設定手順書（Vercel + お名前.com）**:
- `docs/19_URL_STRUCTURE.md`（**最新・正規版** - 3ドメイン構成 ange-spa.jp / t-manage.jp / tera-manage.jp）
- `docs/10_DOMAIN_SETUP_GUIDE.md`（古い構成案、参考程度）

**URL 構造の要点**:
- `ange-spa.jp/` → 公開HP / `/mypage` → お客様 / `/cast` → セラピスト / `/admin` → 管理スタッフ
- `tera-manage.jp/` → 法人サイト
- `admin.tera-manage.jp/` → SaaS全体管理(`/tera-admin` 配下を rewrite)
- `t-manage.jp/` → 製品紹介LP
- `*.t-manage.jp/` → 独自ドメインなしテナント(将来)
- `middleware.ts` がホストで振り分け、ange-spa.jp 等での `/admin/*` は内部 rewrite

今後、T-MANAGE を複数店舗向けのマルチインスタンスSaaS（**TERA-MANAGE**）として発展させる構想がある。
新機能を実装する際は、将来的な `instance_id` による分離を考慮した設計にすること。

現時点では Phase 0（チョップ単独運用、2026/6/1本番開始）。マルチインスタンス化の本格実装は 2026/8月以降。
リゼクシー（RESEXY GROUP 内の2号案件）の稼働目標は **2027/1/1**。

詳細な方針・データモデル・実装フェーズ・リゼクシー情報は上記設計書を参照。

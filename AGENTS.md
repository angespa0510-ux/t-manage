<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 重要な設計ドキュメント

**TERA-MANAGE / T-MANAGE マスターシステム化設計書**:
- `docs/08_MASTER_SYSTEM_DESIGN.md`

**T-MANAGE 利用契約書テンプレート**:
- `docs/CONTRACT_TEMPLATE.md`（他店舗展開で再利用可能な雛形。無償/有償両対応）

**Supabase Pro プラン移行計画**:
- `docs/09_SUPABASE_PRO_MIGRATION.md`

**ドメイン設定手順書（Vercel + お名前.com）**:
- `docs/10_DOMAIN_SETUP_GUIDE.md`（取得済みドメイン `ange-spa.com` / `tera-manage.jp` / `t-manage.jp` のVercel連携手順）

今後、T-MANAGE を複数店舗向けのマルチインスタンスSaaS（**TERA-MANAGE**）として発展させる構想がある。
新機能を実装する際は、将来的な `instance_id` による分離を考慮した設計にすること。

現時点では Phase 0（チョップ単独運用、2026/6/1本番開始）。マルチインスタンス化の本格実装は 2026/8月以降。
リゼクシー（RESEXY GROUP 内の2号案件）の稼働目標は **2027/1/1**。

詳細な方針・データモデル・実装フェーズ・リゼクシー情報は上記設計書を参照。

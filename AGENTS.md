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

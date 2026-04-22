<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 重要な設計ドキュメント

**TERA-MANAGE / T-MANAGE マスターシステム化設計書**:
- `docs/08_MASTER_SYSTEM_DESIGN.md`

今後、T-MANAGE を複数店舗向けのマルチインスタンスSaaS（**TERA-MANAGE**）として発展させる構想がある。
新機能を実装する際は、将来的な `instance_id` による分離を考慮した設計にすること。

現時点では Phase 0（チョップ単独運用、2026/6/1本番開始）。マルチインスタンス化の本格実装は 2026/8月以降。
詳細な方針・データモデル・実装フェーズは上記設計書を参照。

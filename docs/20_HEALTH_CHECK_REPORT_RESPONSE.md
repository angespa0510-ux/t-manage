# 健康診断レポート対応 完了サマリー & 保守ロードマップ

**実施日**: 2026-04-26 〜 27
**スコープ**: 健康診断レポート（資金フロー / 権限 / 税務系画面）
**対応者**: Claude (チャット側)
**実施者**: アンジュスパ + Claude

---

## 完了済み修正（main 反映済み）

### 重要度: 高（Phase 0 必須、5 件）

| Fix | 内容 | 主な変更 |
|---|---|---|
| #1 | gift_bonus_amount 税務統一 | `lib/settlement-calc.ts` 新設、4 ファイルで SSOT 化、TaxBookkeeping の P&L バグ修正 |
| #2 | fetchClosingReport エラーハンドリング | 22 クエリを `expectOk()` ヘルパー + try/catch + Promise.all 並列化 |
| #3 | 精算保存トランザクション化 | `sql/session77_confirm_settlement_rpc.sql`、PostgreSQL RPC で真の ACID 化 |
| #4 | 金庫回収・取消の楽観的ロック | dashboard の 3 ボタンに `WHERE safe_collected_date IS [NOT] NULL` 条件追加 |
| #5 | 指名バック過払い防止 | nomination_fee フォールバック撤去、デッドコード削除 |

### 重要度: 中（Phase 0 までに完了、4 件）

| Fix | 内容 | 主な変更 |
|---|---|---|
| #6 | cash-dashboard エラー処理 / ログサイレント / use-role 削除 | useToast 導入、staff_login_logs の sync/async エラーを console.warn 化 |
| #7 | 権限 SSOT 化 | `lib/staff-permissions.ts` 新設、3 ファイルで重複していた判定ロジックを統一 |
| #8 | 金庫フロー集計 SSOT 化 | `lib/cash-aggregation.ts` 新設、dashboard の 2 箇所重複インライン処理を helper に集約 |
| #9 | N+1 問題解消 | dashboard `fetchClosingReport` と `fetchSafeListData` を `.in(...)` + Map lookup に最適化 |

---

## 未対応の保守 ToDo（Phase 0 後に段階対応）

### 重要度: 中（保守フェーズ）

#### M-1: timechart 3,154 行のコンポーネント分割
- **理由**: 単一ファイルにタイムチャート / 精算モーダル / セラピスト編集 / 予約管理 / 設定管理が混在
- **推奨**: 最低限 `SettlementModal.tsx` / `useSettlementCalc.ts` / `useFetchTimechartData.ts` に分割
- **着手タイミング**: 本番運用が安定した 6/15 以降。Phase 0 中はデグレリスクが大きすぎるため避ける
- **見積**: 中規模（半日〜1日）

#### M-2: セラピスト名解決関数の `lib/therapist-utils.ts` 集約
- **理由**: dashboard L240, L324, L748 で `getThName` / `getName2` の 2 系統が分散
- **着手タイミング**: いつでも可、ただし影響箇所多数
- **見積**: 小規模（1〜2 時間）

#### M-3: `Therapist` 型に `salary_type` / `welfare_fee_orders_threshold` 等のスキーマ整合
- **理由**: timechart で `(th as any).salary_type` のような any キャストが多発
- **着手タイミング**: 全体型整理プロジェクトの一環として
- **見積**: 中規模（半日）

#### M-4: スキーマ SSOT 不在
- **理由**: `therapist_daily_settlements` の CREATE TABLE 文がコードベース内に見つからない
- **推奨**: 現状スキーマのスナップショットを `sql/_schema_snapshot.sql` に出力（Supabase の `pg_dump` で取得可能）
- **着手タイミング**: いつでも可
- **見積**: 小規模（30 分）

### 重要度: 低（性能・コード品質）

#### L-1: 精算モーダルの useState 12 個 → useReducer
- **場所**: `app/timechart/page.tsx` L265-278
- **見積**: 中規模

#### L-2: `select("*")` の多用
- **場所**: cash-dashboard L154, cast L311 ほか
- **推奨**: 必要なカラムのみ列挙
- **見積**: 中規模

#### L-3: 命名統一
- **場所**: UI state の `settleUseReserve` / `settleUseReplenish` と DB 側の `toyohashi_reserve_movements` / `room_cash_replenishments` で語彙が揃っていない
- **見積**: 中規模

#### L-4: 絵文字コメント記号の正式名称化
- **場所**: `app/timechart/page.tsx` L275-276 の 🏛 / 💰
- **見積**: 小規模

---

## 着手判断のフレームワーク

| 状況 | 推奨アクション |
|---|---|
| 本番開始直後（〜6/15） | **手を入れない**。バグ報告対応に専念 |
| 本番運用安定（6/15〜7/31） | M-2, M-4, L-4 など低リスクな掃除から |
| Phase 2（リゼクシー）準備期（8/1〜） | M-1, M-3, L-1, L-2 など型・分割の根本対応 |
| TERA-MANAGE SaaS 化（Phase 5+） | 全体型整理 + マルチテナント対応の一環として |

---

## 教訓（Phase 0 で得た知見）

1. **SSOT 化は破壊的変更の保険になる**
   Fix #1 で `lib/settlement-calc.ts` を新設し、3 つの税務系画面と仕訳帳が
   同じ計算式を参照するようにしたことで、Phase 2（リゼクシー）で
   税率や控除区分を変更する際の影響範囲が限定的になった。

2. **PostgreSQL 関数 = 1 トランザクション** という事実は ACID 化の最短経路
   Fix #3 で Edge Function や client-side rollback と比較した結果、
   RPC が最もシンプルで確実だった。Phase 2 の精算ロジックでも踏襲。

3. **Supabase クエリは error チェック必須**
   Fix #2 / #6 で発見したように、`{ data }` のみ destructure するパターンは
   エラーをサイレント化する。今後は `expectOk()` ヘルパーまたは明示的な
   `if (error) {...}` チェックを徹底する。

4. **N+1 の根本治療は `.in()` + Map**
   Fix #9 で dashboard の N+1 を 15 ラウンドトリップから 1 ラウンドトリップに
   最適化した。`.in("room_id", ids).in("date", dates)` の組合せ + クライアント
   側 Map lookup が定石。

5. **JS の `||` フォールバックは 0 を弾く罠**
   Fix #5 で `nom?.therapist_back || nomination_fee` の挙動から発見。
   今後は `??` (nullish coalescing) を意識的に使う、または `|| 0` で
   フォールバック先を明示する。

# 14b. レビュー/アンケートシステム 実装ロードマップ

> 設計: `docs/14_REVIEW_SYSTEM.md` (967行)
> 期間: 21日（2026-04-27 〜 2026-05-17）
> 想定: ローンチ 6/1 までに完全運用可能な状態にする

## 🗺️ Phase別タスク一覧

### Phase 1A: DB基盤構築（Day 1-2 = 4/27-4/28）

**SQL** (`sql/session82_review_system_tables.sql`):
- [ ] `customer_surveys` テーブル作成
- [ ] `survey_notifications` テーブル作成
- [ ] `survey_coupons` テーブル作成
- [ ] `customers.survey_opt_out` `survey_response_count` 追加
- [ ] `point_settings.survey_coupon_amount` `survey_coupon_valid_months` `hp_publish_bonus` 追加
- [ ] `therapists.avg_rating` `survey_count` `nps_score` 追加
- [ ] `stores.google_place_id` `google_review_url` 追加
- [ ] `reservations.survey_coupon_id` `survey_coupon_discount` 追加

**コード**:
- [ ] `lib/survey-types.ts` (型定義)
- [ ] `/api/survey/list/route.ts` (顧客のアンケート一覧)

---

### Phase 1B: マイページ回答UI（Day 3-5 = 4/29-5/1）

- [ ] `/mypage` に「アンケートに答える」セクション追加
- [ ] `/mypage/survey/[reservationId]` 回答画面
  - [ ] 5段階星評価
  - [ ] 各項目3段階（セラピスト/サービス/雰囲気/清潔感/コース）
  - [ ] 印象ポイントチェックボックス（複数選択）
  - [ ] 自由記述（良かった点/改善点/セラピストへのメッセージ）
- [ ] `/api/survey/submit` 保存API
- [ ] クーポン発行ロジック（SV-XXXXXX 6文字、衝突チェック）

---

### Phase 1C: AI言語化補助（Day 6-7 = 5/2-5/3）

- [ ] `/api/survey/ai-compose` Claude API統合
- [ ] プロンプト設計（創作禁止、お客様の入力のみベース）
- [ ] 再生成機能（最大3回、`ai_regenerate_count`）
- [ ] 編集UI + ローディング演出

---

### Phase 2A: 完了画面 + Google誘導（Day 8-10 = 5/4-5/6）

- [ ] アンケート完了画面UI
  - [ ] クーポンコード表示（コピーボタン）
  - [ ] AI生成文章表示
  - [ ] Google投稿誘導ボタン（コピー → 新タブ）
  - [ ] HP掲載承認ボタン（+500pt）
- [ ] `/mypage/google-review-guide` 身バレ配慮ガイド
- [ ] `stores.google_place_id` `google_review_url` の管理画面

---

### Phase 2B: バックオフィス `/survey-dashboard`（Day 11-13 = 5/7-5/9）

- [ ] タブ1: 📊 総合サマリー（NPS、月次推移）
- [ ] タブ2: 👤 セラピスト別（avg_rating、ランキング）
- [ ] タブ3: 📝 個別回答閲覧（HP掲載承認ワークフロー）
- [ ] タブ4: 🏢 店舗別比較
- [ ] タブ5: 🚨 アラート（低評価ピックアップ）
- [ ] HP掲載承認時の +500pt 付与ロジック
- [ ] 表示名カスタマイズ（「30代男性 Aさん」等）

---

### Phase 3A: HP公開「お客様の声」（Day 14-15 = 5/10-5/11）

- [ ] HP に「お客様の声」セクション追加（場所未定）
- [ ] `hp_published = true` の最新100件、星4以上
- [ ] レスポンシブ対応（PC: グリッド / モバイル: カルーセル）
- [ ] 表示名・評価・本文・日付・店舗

---

### Phase 3B: 非登録者対応（Day 16-18 = 5/12-5/14）

- [ ] `/survey/[token]` トークン認証フォーム
- [ ] 電話番号下4桁認証
- [ ] トークン生成ロジック（予約IDベース、1回のみ有効）
- [ ] QRコード生成画面（バックオフィス）
- [ ] ルーム内カード印刷用PDF出力

---

### Phase 4A: 配信通知（Day 19-20 = 5/15-5/16）

- [ ] Vercel Cron Job（15分ごと）
- [ ] 施術後2時間遅延配信ロジック
- [ ] `/api/cron/dispatch-survey-notifications`
- [ ] マイページ通知バッジ
- [ ] 配信停止希望者管理（`survey_opt_out`）

---

### Phase 4B: アラート + レポート（Day 21 = 5/17）

- [ ] 低評価即時アラート（Slack/LINE Webhook）
- [ ] 月次レポート自動生成
- [ ] セラピストマイページの評価閲覧UI
- [ ] AGENTS.md 更新（運用ガイドライン）

---

## 🎯 マイルストーン

- **5/3 (Day 7)**: アンケート単体動作（マイページから回答→クーポン発行）
- **5/9 (Day 13)**: 管理ダッシュボード稼働
- **5/11 (Day 15)**: HP掲載稼働
- **5/14 (Day 18)**: QRコード経由でも回答可能に
- **5/17 (Day 21)**: 全機能稼働 → ローンチ前最終調整期間（5/18-5/31）

## 🚦 ローンチ判定

- **6/1 ローンチ時**: お客様にHPで「お客様の声」を見せられる、施術後にアンケート配信が動く
- **6/1〜6/14**: 運用安定化 + 初期データ蓄積
- **6/15以降**: 通常運用 + 改善サイクル

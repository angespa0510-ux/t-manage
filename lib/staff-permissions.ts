/**
 * スタッフ権限判定の SSOT (Single Source of Truth)
 *
 * lib/staff-session.tsx と app/staff/page.tsx の権限マトリクスで
 * 同じロジックが重複していたため、本ファイルの純関数を共有して
 * 同期漏れを防ぐ。
 *
 * 健康診断レポート 2026-04-26 「重要度: 中 - 権限判定ロジックの再実装」対応。
 */

/**
 * 権限判定に必要な最小限のスタッフ情報。
 * 完全な Staff 型は app/staff/page.tsx 等に定義されているが、
 * 本モジュールはスキーマに依存しないよう必要最小限のフィールドだけを使う。
 */
export type StaffPermissionInput = {
  role?: string | null;
  company_position?: string | null;
  override_is_manager?: boolean | null;
  override_can_tax_portal?: boolean | null;
  override_can_cash_dashboard?: boolean | null;
};

/* ─── デフォルト判定 (ロール/法人ポジションベース、override 適用前) ─── */

/** 管理系操作: デフォルトで全ログインスタッフが有効 */
export function defaultIsManager(_s: StaffPermissionInput): boolean {
  return true;
}

/** 税理士ポータル: 社長 / 経営責任者 / 税理士、または supervisor ロール */
export function defaultCanTaxPortal(s: StaffPermissionInput): boolean {
  return (
    s.company_position === "社長" ||
    s.company_position === "経営責任者" ||
    s.company_position === "税理士" ||
    s.role === "supervisor"
  );
}

/** 資金管理: 社長 / 経営責任者のみ (税理士は除外) */
export function defaultCanCashDashboard(s: StaffPermissionInput): boolean {
  return (
    s.company_position === "社長" ||
    s.company_position === "経営責任者"
  );
}

/** 通話AIアシスタント: 社長 / 経営責任者のみ（最も厳しい設定） */
export function defaultCanCallAssistant(s: StaffPermissionInput): boolean {
  return (
    s.company_position === "社長" ||
    s.company_position === "経営責任者"
  );
}

/* ─── 実効権限 (override があれば優先、なければ default) ─── */

export function effectiveIsManager(s: StaffPermissionInput): boolean {
  return s.override_is_manager ?? defaultIsManager(s);
}

export function effectiveCanTaxPortal(s: StaffPermissionInput): boolean {
  return s.override_can_tax_portal ?? defaultCanTaxPortal(s);
}

export function effectiveCanCashDashboard(s: StaffPermissionInput): boolean {
  return s.override_can_cash_dashboard ?? defaultCanCashDashboard(s);
}

export function effectiveCanCallAssistant(s: StaffPermissionInput): boolean {
  // 通話AIは override 未設定（最も厳しい）
  return defaultCanCallAssistant(s);
}

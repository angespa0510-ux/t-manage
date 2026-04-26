/**
 * セラピスト関連ユーティリティの SSOT (Single Source of Truth)
 *
 * 「ID から名前を引く」ロジックが dashboard / cash-dashboard / analytics /
 * sales / shifts / room-assignments で類似実装が散在していたため、
 * 本モジュールに集約してフォールバック文字列のばらつきも吸収する。
 *
 * 健康診断レポート 2026-04-26 「重要度: 中 M-2: セラピスト名解決の集約」対応。
 */

/** 名前解決に必要な最小限のセラピスト情報 */
export type TherapistLike = {
  id: number;
  name?: string | null;
};

/**
 * セラピストID から名前を引く純関数。見つからない場合は fallback を返す。
 *
 * ─ フォールバック方針（既存呼び出し元の慣習を維持） ─
 *   - "不明"  : dashboard / analytics / sales（売上系レポート）
 *   - "—"     : shifts / 上位 dashboard（操作画面）
 *   - ""      : room-assignments / cash-dashboard（null は空欄）
 *   - "ID:42" : cash-dashboard（デバッグ寄り）
 *
 * 既存挙動を壊さないため、fallback は呼び出し側が引き続き選択する。
 */
export function findTherapistName(
  therapists: readonly TherapistLike[] | null | undefined,
  id: number | null | undefined,
  fallback: string = "",
): string {
  if (id == null) return fallback;
  return (therapists || []).find((t) => t.id === id)?.name || fallback;
}

/**
 * 「ID -> 名前」の関数を 1 度だけ作って使い回したい場面用のファクトリ。
 * fetchClosingReport の中など、ローカル変数として束ねる用途を想定。
 *
 *   const getThName = makeTherapistNameResolver(thList, "不明");
 *   getThName(42); // → 名前 or "不明"
 */
export function makeTherapistNameResolver(
  therapists: readonly TherapistLike[] | null | undefined,
  fallback: string = "",
): (id: number | null | undefined) => string {
  return (id) => findTherapistName(therapists, id, fallback);
}

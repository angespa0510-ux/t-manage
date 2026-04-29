/**
 * ═══════════════════════════════════════════════════════════
 * 並び替え用ユーティリティ
 *
 * セラピスト名・スタッフ名のような「ふりがな付きの源氏名」を、
 * 自然な「あいうえお順」で並べ替えるためのキー抽出関数を提供する。
 * ═══════════════════════════════════════════════════════════
 */

/**
 * セラピスト名／スタッフ名から、あいうえお順ソート用のキーを抽出する。
 *
 * - 「愛花【あいか】」のように【】や[]内にふりがながある場合は、その中身を採用
 * - ふりがながない場合は名前そのまま
 * - カタカナはひらがなに変換（「ルナ」と「るな」を同じ位置に並べるため）
 *
 * これにより、漢字で始まる源氏名が一覧の最後に固まらず、
 * 読みベースで自然な「あいうえお順」になる。
 *
 * 使い方:
 *   list.sort((a, b) => getReadingKey(a.name).localeCompare(getReadingKey(b.name), "ja"))
 */
export function getReadingKey(name: string | null | undefined): string {
  const s = (name ?? "").trim();
  if (!s) return "";
  // 全角【】 / 半角[] のいずれにも対応
  const m = s.match(/[【\[]([^】\]]+)[】\]]/);
  const base = m && m[1] ? m[1].trim() : s;
  // カタカナ → ひらがな（コードポイント差 0x60）
  return base.replace(/[\u30A1-\u30F6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

/**
 * ふりがなベースの「あいうえお順」比較関数。
 * Array.prototype.sort の比較関数として直接渡せる便利版。
 *
 * 使い方:
 *   list.sort((a, b) => compareByReading(a.name, b.name))
 */
export function compareByReading(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  return getReadingKey(a).localeCompare(getReadingKey(b), "ja");
}

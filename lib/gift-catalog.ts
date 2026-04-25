/**
 * ギフトカタログ
 *
 * 投げ銭で使えるアイテム一覧。
 * UIとAPIで共有する。
 */

export type GiftKind =
  | "sakura"
  | "dango"
  | "cake"
  | "taiyaki"
  | "flower"
  | "ribbon"
  | "crown"
  | "diamond";

export type GiftItem = {
  kind: GiftKind;
  label: string;
  emoji: string;
  pointAmount: number;
  description: string;
  /** UI表示時の色テーマ (hex色) */
  color: string;
};

export const GIFT_CATALOG: GiftItem[] = [
  {
    kind: "sakura",
    label: "桜",
    emoji: "🌸",
    pointAmount: 10,
    description: "お気持ちをひとひら",
    color: "#f7c4d4",
  },
  {
    kind: "dango",
    label: "だんご",
    emoji: "🍡",
    pointAmount: 30,
    description: "ほっこり甘いひととき",
    color: "#f0c4a8",
  },
  {
    kind: "cake",
    label: "ケーキ",
    emoji: "🍰",
    pointAmount: 50,
    description: "今日も素敵♡",
    color: "#fcd5d5",
  },
  {
    kind: "taiyaki",
    label: "たい焼き",
    emoji: "🐟",
    pointAmount: 80,
    description: "あんこたっぷり🐟",
    color: "#e0c896",
  },
  {
    kind: "flower",
    label: "花束",
    emoji: "💐",
    pointAmount: 100,
    description: "花束で大きな応援",
    color: "#f5b8c8",
  },
  {
    kind: "ribbon",
    label: "リボン",
    emoji: "🎀",
    pointAmount: 300,
    description: "プレミアムリボン✨",
    color: "#dc3250",
  },
  {
    kind: "crown",
    label: "王冠",
    emoji: "👑",
    pointAmount: 500,
    description: "VIP応援👑",
    color: "#e0b240",
  },
  {
    kind: "diamond",
    label: "ダイヤ",
    emoji: "💎",
    pointAmount: 1000,
    description: "最大級の応援💎",
    color: "#7eb8e0",
  },
];

export function findGift(kind: GiftKind): GiftItem | undefined {
  return GIFT_CATALOG.find((g) => g.kind === kind);
}

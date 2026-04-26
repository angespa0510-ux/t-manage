/**
 * Mode A（手動分析）用：データを Claude.ai 貼付け用のプレーンテキストに整形
 *
 * 「📋 全データをコピー」ボタンが呼ぶ。
 * 整形済みテキストをクリップボードに入れて、Maxプランのclaude.aiに貼り付け。
 */

import type { Ga4Summary } from "./ga4-client";
import type { ClaritySummary } from "./clarity-client";
import type { TmanageSummary } from "./tmanage-data";

type FormatInput = {
  date: string;
  ga4: Ga4Summary | null;
  clarity: ClaritySummary | null;
  tmanage: TmanageSummary | null;
};

export function formatForClaudeMax({ date, ga4, clarity, tmanage }: FormatInput): string {
  const lines: string[] = [];

  lines.push(`【アンジュスパ アクセス解析データ ${date}】`);
  lines.push("");

  // ── GA4 ──
  if (ga4) {
    lines.push("■ GA4（訪問・流入分析）");
    lines.push(`- 訪問数: ${ga4.totalUsers}人 / 新規: ${ga4.newUsers}人`);
    lines.push(`- セッション: ${ga4.sessions} / ページビュー: ${ga4.pageViews}`);
    lines.push(`- 平均滞在: ${Math.round(ga4.averageSessionDuration)}秒 / 直帰率: ${(ga4.bounceRate * 100).toFixed(1)}%`);
    if (ga4.trafficByChannel.length > 0) {
      lines.push("- チャネル別:");
      ga4.trafficByChannel.slice(0, 5).forEach((c) => {
        lines.push(`  ・${c.channel}: ${c.users}人`);
      });
    }
    if (ga4.topPages.length > 0) {
      lines.push("- 人気ページ TOP5:");
      ga4.topPages.slice(0, 5).forEach((p) => {
        lines.push(`  ・${p.path}: ${p.views}回`);
      });
    }
    if (ga4.topReferrers.length > 0) {
      lines.push("- 流入元 TOP5:");
      ga4.topReferrers.slice(0, 5).forEach((r) => {
        lines.push(`  ・${r.source}: ${r.users}人`);
      });
    }
    if (ga4.deviceBreakdown.length > 0) {
      lines.push("- デバイス: " + ga4.deviceBreakdown.map((d) => `${d.device}=${d.users}`).join(", "));
    }
    lines.push("");
  } else {
    lines.push("■ GA4: データ取得不可（API未設定または取得失敗）");
    lines.push("");
  }

  // ── Clarity ──
  if (clarity) {
    lines.push("■ Microsoft Clarity（行動異常分析）");
    lines.push(`- セッション: ${clarity.totalSessions} / PV: ${clarity.totalPageViews} / ユーザー: ${clarity.totalDistinctUsers}人`);
    lines.push(`- ⚠ Rage Click: ${clarity.rageClicks}件（イライラクリック）`);
    lines.push(`- ⚠ Dead Click: ${clarity.deadClicks}件（無反応クリック）`);
    lines.push(`- ⚠ Quick Back: ${clarity.quickBacks}件（迷子）`);
    lines.push(`- 過剰スクロール: ${clarity.excessiveScroll}件`);
    lines.push("");
  } else {
    lines.push("■ Microsoft Clarity: データ取得不可（API未設定または取得失敗）");
    lines.push("");
  }

  // ── T-MANAGE 実績 ──
  if (tmanage) {
    const diff = tmanage.reservationCount - tmanage.reservationCountPrevDay;
    const diffSign = diff >= 0 ? `+${diff}` : `${diff}`;
    lines.push("■ T-MANAGE 実績");
    lines.push(`- 予約数: ${tmanage.reservationCount}件（前日比 ${diffSign}件）`);
    lines.push(`- 売上: ¥${tmanage.totalSales.toLocaleString()}`);
    lines.push(`- 平均単価: ¥${tmanage.averageUnitPrice.toLocaleString()}`);
    lines.push(`- 店取概算: ¥${tmanage.shopReceived.toLocaleString()}`);
    lines.push(`- 新規顧客: ${tmanage.newCustomerCount}名`);
    if (tmanage.topCourses.length > 0) {
      lines.push("- 人気コース TOP5: " + tmanage.topCourses.map((c) => `${c.name}(${c.count})`).join(", "));
    }
    if (tmanage.topTherapists.length > 0) {
      lines.push("- 指名上位 TOP5: " + tmanage.topTherapists.map((t) => `${t.name}(${t.count})`).join(", "));
    }
    lines.push("");
  } else {
    lines.push("■ T-MANAGE 実績: データ取得不可");
    lines.push("");
  }

  // ── プロンプト ──
  lines.push("---");
  lines.push("");
  lines.push("このデータを分析して、以下の観点で報告してください。");
  lines.push("");
  lines.push("【分析の観点】");
  lines.push("1. 📈 良いニュース: 数字から見える明るい兆候・成功事例");
  lines.push("2. ⚠️ 要対応: 早急に対応すべき問題（特にRage Click/Dead Clickの発生箇所）");
  lines.push("3. 💡 機会発見: 数字から読み取れる改善・成長のチャンス");
  lines.push("4. 🎯 今日のおすすめアクション: 1日のうちに着手すべき具体的タスク3つ");
  lines.push("");
  lines.push("文体は親しみやすく、社長への朝の挨拶のようにお願いします。");

  return lines.join("\n");
}

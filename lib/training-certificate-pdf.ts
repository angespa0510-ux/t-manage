/**
 * 修了証PDF生成ユーティリティ (Phase 2)
 *
 * セラピストが研修カリキュラムを修了した際の修了証を発行する。
 * window.open + document.write のパターンで HTML を新規タブに流し込み、
 * ユーザーがブラウザの「印刷 → PDFとして保存」で書き出す方式。
 * (日本語フォント問題を CSS の font-family で回避できる)
 *
 * 関連:
 *   docs/22_CONTRACT_REDESIGN.md  第10条 研修受講義務
 *   docs/24_THERAPIST_TRAINING.md  Phase 2 修了証PDF発行
 */

type CompanyInfo = {
  company_name: string;        // 例: 合同会社テラスライフ
  brand_name?: string;         // 例: Ange Spa
  representative?: string;     // 代表者名
  company_address?: string;
};

type TherapistInfo = {
  id: number | string;
  real_name: string;           // 本名 (修了証には本名で記載)
  name?: string;               // 源氏名 (副情報として表示しない)
};

type ModuleInfo = {
  id: number;
  title: string;
  duration_minutes: number;
  completed_at?: string;       // ISO date
};

type CategoryInfo = {
  id: number;
  name: string;
  slug: string;
  emoji?: string;
  level: "basic" | "intermediate" | "advanced" | "master" | string;
};

type BadgeInfo = {
  id: number;
  acquired_at: string;
  level: string;
};

/* ═══════════════════════════════════════════════════════════════
 * カテゴリ別修了証
 *   - 1カテゴリの全モジュールを完了したセラピスト向け
 *   - バッジが付与されたタイミングで発行可能
 * ═══════════════════════════════════════════════════════════════ */
export function generateCategoryCertificate(opts: {
  company: CompanyInfo;
  therapist: TherapistInfo;
  category: CategoryInfo;
  badge: BadgeInfo;
  modules: ModuleInfo[];
}) {
  const { company, therapist, category, badge, modules } = opts;
  const w = window.open("", "_blank");
  if (!w) {
    alert("ポップアップがブロックされています。ブラウザの設定で当サイトのポップアップを許可してください。");
    return;
  }
  w.document.write(buildCategoryCertificateHtml(company, therapist, category, badge, modules));
  w.document.close();
}

/* ═══════════════════════════════════════════════════════════════
 * 必須5カリキュラム総合修了証
 *   - 必須5カテゴリすべてのバッジを取得したセラピスト向け
 *   - 業務委託契約書 第10条 の達成を証する特別版
 * ═══════════════════════════════════════════════════════════════ */
export function generateMasterCertificate(opts: {
  company: CompanyInfo;
  therapist: TherapistInfo;
  basicCategories: CategoryInfo[];
  basicBadges: BadgeInfo[];
  totalModules: number;
  totalHours: number;
  earliestDate: string;
  latestDate: string;
}) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("ポップアップがブロックされています。ブラウザの設定で当サイトのポップアップを許可してください。");
    return;
  }
  w.document.write(buildMasterCertificateHtml(opts));
  w.document.close();
}

/* ═══════════════════════════════════════════════════════════════
 * HTML 生成 — カテゴリ別修了証
 * ═══════════════════════════════════════════════════════════════ */
function buildCategoryCertificateHtml(
  company: CompanyInfo,
  therapist: TherapistInfo,
  category: CategoryInfo,
  badge: BadgeInfo,
  modules: ModuleInfo[],
): string {
  const certNo = `TM-CERT-${String(therapist.id).padStart(4, "0")}-${String(category.id).padStart(2, "0")}-${String(badge.id).padStart(4, "0")}`;
  const issueDate = formatJpDate(badge.acquired_at);
  const reiwa = toReiwa(badge.acquired_at);
  const totalMinutes = modules.reduce((s, m) => s + (m.duration_minutes || 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const levelLabel = levelToLabel(category.level);
  const brand = company.brand_name || company.company_name;
  const rep = company.representative || "代表社員";

  const moduleList = modules.map((m, i) => {
    const completedAt = m.completed_at ? formatJpDate(m.completed_at) : "";
    return `<li class="mod-row">
      <span class="mod-no">${String(i + 1).padStart(2, "0")}</span>
      <span class="mod-title">${escapeHtml(m.title)}</span>
      <span class="mod-min">${m.duration_minutes}分</span>
      <span class="mod-date">${completedAt}</span>
    </li>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>修了証 — ${escapeHtml(category.name)} — ${escapeHtml(therapist.real_name)} 様</title>
<style>${certificateBaseStyle()}</style>
</head>
<body>
  <div class="page">
    <div class="frame">
      <div class="frame-inner">

        <header class="cert-header">
          <p class="brand-line">${escapeHtml(brand)}　THERAPIST TRAINING PROGRAM</p>
          <div class="rule-double"></div>

          <h1 class="cert-title">修了証</h1>
          <p class="cert-title-en">Certificate of Completion</p>

          <div class="rule-double"></div>
          <p class="cert-no">No. ${certNo}</p>
        </header>

        <main class="cert-body">
          <p class="recipient-label">— RECIPIENT —</p>
          <p class="recipient-name">${escapeHtml(therapist.real_name)} <span class="recipient-honorific">殿</span></p>

          <div class="cert-statement">
            <p>貴殿は当社の業務委託契約に基づく</p>
            <p>施術技術研修において</p>
          </div>

          <div class="category-display">
            <p class="category-emoji">${category.emoji || "🌿"}</p>
            <p class="category-level">${levelLabel}</p>
            <p class="category-name">${escapeHtml(category.name)}</p>
          </div>

          <div class="cert-statement">
            <p>のカリキュラム全 ${modules.length} モジュールを修了され</p>
            <p>所定の技術習得基準を満たしたことを証明します</p>
          </div>

          <div class="modules-section">
            <p class="section-label">— COMPLETED MODULES —</p>
            <ul class="modules-list">${moduleList}</ul>
          </div>

          <div class="metrics-row">
            <div class="metric">
              <p class="metric-label">TOTAL MODULES</p>
              <p class="metric-value">${modules.length}</p>
              <p class="metric-jp">モジュール</p>
            </div>
            <div class="metric">
              <p class="metric-label">STUDY HOURS</p>
              <p class="metric-value">${totalHours}</p>
              <p class="metric-jp">時間</p>
            </div>
            <div class="metric">
              <p class="metric-label">CERTIFIED ON</p>
              <p class="metric-value-small">${issueDate}</p>
              <p class="metric-jp">修了日</p>
            </div>
          </div>
        </main>

        <footer class="cert-footer">
          <p class="issue-date">${reiwa}</p>

          <div class="signature-block">
            <p class="company-name">${escapeHtml(company.company_name)}</p>
            ${company.brand_name ? `<p class="brand-name">「${escapeHtml(company.brand_name)}」</p>` : ""}
            <p class="rep-line">${escapeHtml(rep)}</p>
            <div class="seal-circle">代表者印</div>
          </div>

          <p class="footer-note">
            ※ 本書は業務委託契約書 第10条（研修受講義務）に基づき発行されるものであり、<br>
            　 受託者の継続的な技術習得を証する書面です。確定申告時の研修費経費計上の証憑としてもご活用いただけます。
          </p>
        </footer>

      </div>
    </div>

    <div class="actions no-print">
      <button onclick="window.print()" class="btn-print">📄 印刷 / PDF として保存</button>
      <button onclick="window.close()" class="btn-close">閉じる</button>
    </div>
  </div>
</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════════════
 * HTML 生成 — 必須5総合修了証
 * ═══════════════════════════════════════════════════════════════ */
function buildMasterCertificateHtml(opts: {
  company: CompanyInfo;
  therapist: TherapistInfo;
  basicCategories: CategoryInfo[];
  basicBadges: BadgeInfo[];
  totalModules: number;
  totalHours: number;
  earliestDate: string;
  latestDate: string;
}): string {
  const { company, therapist, basicCategories, basicBadges, totalModules, totalHours, latestDate } = opts;
  const certNo = `TM-CERT-${String(therapist.id).padStart(4, "0")}-MASTER-BASIC`;
  const issueDate = formatJpDate(latestDate);
  const reiwa = toReiwa(latestDate);
  const brand = company.brand_name || company.company_name;
  const rep = company.representative || "代表社員";

  const categoryGrid = basicCategories.map(cat => {
    const badge = basicBadges.find(b => (b as unknown as { category_id: number }).category_id === cat.id);
    const dateStr = badge ? formatJpDate(badge.acquired_at) : "—";
    return `<div class="cat-tile">
      <p class="cat-tile-emoji">${cat.emoji || "🌿"}</p>
      <p class="cat-tile-name">${escapeHtml(cat.name)}</p>
      <p class="cat-tile-date">${dateStr}</p>
    </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>必須カリキュラム総合修了証 — ${escapeHtml(therapist.real_name)} 様</title>
<style>${certificateBaseStyle()}
  /* マスター証専用のオーバーライド */
  .cert-title { font-size: 56px; }
  .cert-title-en { font-size: 14px; letter-spacing: 0.4em; }
  .frame-inner { background: linear-gradient(180deg, #fdf5f7 0%, #faecef 100%); }
  .recipient-name { font-size: 32px; }
  .master-banner { text-align: center; margin: 32px 0 28px; }
  .master-banner-en { font-family: 'Cormorant Garamond', serif; font-size: 11px; letter-spacing: 0.4em; color: #c96b83; font-weight: 500; margin: 0 0 6px; }
  .master-banner-jp { font-family: 'Noto Serif JP', serif; font-size: 22px; color: #3a2e30; letter-spacing: 0.2em; margin: 0; }
  .cat-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 22px 0; }
  .cat-tile { padding: 14px 6px; background: #ffffff; border: 1px solid #e8849a55; text-align: center; }
  .cat-tile-emoji { font-size: 28px; margin: 0 0 6px; line-height: 1; }
  .cat-tile-name { font-family: 'Noto Serif JP', serif; font-size: 11px; color: #3a2e30; margin: 0 0 4px; letter-spacing: 0.05em; line-height: 1.4; min-height: 30px; }
  .cat-tile-date { font-family: 'Cormorant Garamond', serif; font-size: 10px; color: #9a7d83; margin: 0; }
</style>
</head>
<body>
  <div class="page">
    <div class="frame">
      <div class="frame-inner">

        <header class="cert-header">
          <p class="brand-line">${escapeHtml(brand)}　THERAPIST TRAINING PROGRAM</p>
          <div class="rule-double"></div>

          <h1 class="cert-title">修了証</h1>
          <p class="cert-title-en">Master Certificate of Completion</p>

          <div class="rule-double"></div>
          <p class="cert-no">No. ${certNo}</p>
        </header>

        <main class="cert-body">
          <p class="recipient-label">— RECIPIENT —</p>
          <p class="recipient-name">${escapeHtml(therapist.real_name)} <span class="recipient-honorific">殿</span></p>

          <div class="master-banner">
            <p class="master-banner-en">REQUIRED CURRICULUM — ALL FIVE CATEGORIES</p>
            <p class="master-banner-jp">必 須 全 修 了</p>
          </div>

          <div class="cert-statement">
            <p>貴殿は当社の業務委託契約に基づく</p>
            <p>必須施術技術研修の全カリキュラムを修了され</p>
            <p>セラピストとして十分な基礎技術を習得されたことを証明します</p>
          </div>

          <div class="cat-grid">${categoryGrid}</div>

          <div class="metrics-row">
            <div class="metric">
              <p class="metric-label">CATEGORIES</p>
              <p class="metric-value">5</p>
              <p class="metric-jp">必須カテゴリ</p>
            </div>
            <div class="metric">
              <p class="metric-label">MODULES</p>
              <p class="metric-value">${totalModules}</p>
              <p class="metric-jp">完了モジュール</p>
            </div>
            <div class="metric">
              <p class="metric-label">STUDY HOURS</p>
              <p class="metric-value">${totalHours}</p>
              <p class="metric-jp">学習時間</p>
            </div>
            <div class="metric">
              <p class="metric-label">CERTIFIED ON</p>
              <p class="metric-value-small">${issueDate}</p>
              <p class="metric-jp">修了日</p>
            </div>
          </div>
        </main>

        <footer class="cert-footer">
          <p class="issue-date">${reiwa}</p>

          <div class="signature-block">
            <p class="company-name">${escapeHtml(company.company_name)}</p>
            ${company.brand_name ? `<p class="brand-name">「${escapeHtml(company.brand_name)}」</p>` : ""}
            <p class="rep-line">${escapeHtml(rep)}</p>
            <div class="seal-circle">代表者印</div>
          </div>

          <p class="footer-note">
            ※ 本書は業務委託契約書 第10条（研修受講義務）に定める必須研修の全課程修了を証する書面です。<br>
            　 セラピストとしての継続的な技術研鑽の起点として、また確定申告時の研修費経費計上の証憑としてもご活用いただけます。
          </p>
        </footer>

      </div>
    </div>

    <div class="actions no-print">
      <button onclick="window.print()" class="btn-print">📄 印刷 / PDF として保存</button>
      <button onclick="window.close()" class="btn-close">閉じる</button>
    </div>
  </div>
</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════════════
 * 共通スタイル
 * ═══════════════════════════════════════════════════════════════ */
function certificateBaseStyle(): string {
  return `
  *{margin:0;padding:0;box-sizing:border-box}
  @page { size: A4 portrait; margin: 0; }
  html,body{font-family:'Noto Serif JP','Yu Mincho','Hiragino Mincho ProN',serif;color:#3a2e30;background:#f5edef;}
  body{padding:30px 20px;min-height:100vh;}

  .page{max-width:794px;margin:0 auto;}

  .frame{
    background: linear-gradient(135deg, #fdf6f7 0%, #f9eef0 100%);
    padding:14px;
    border:1px solid #c96b8344;
    box-shadow: 0 2px 12px rgba(201,107,131,0.08);
    position:relative;
  }
  .frame::before{
    content:'';
    position:absolute;
    top:6px; left:6px; right:6px; bottom:6px;
    border:1px solid #c96b8322;
    pointer-events:none;
  }
  .frame-inner{
    background: #ffffff;
    padding:48px 56px 40px;
    position:relative;
    min-height:1080px;
  }

  /* HEADER */
  .cert-header{ text-align:center; margin-bottom:32px; }
  .brand-line{
    font-family:'Cormorant Garamond',serif;
    font-size:11px;
    letter-spacing:0.45em;
    color:#c96b83;
    font-weight:500;
    margin:0 0 14px;
  }
  .rule-double{
    border-top:1px solid #c96b8388;
    border-bottom:1px solid #c96b8388;
    height:3px;
    margin:14px auto;
    width:80%;
  }
  .cert-title{
    font-family:'Noto Serif JP',serif;
    font-size:48px;
    letter-spacing:0.6em;
    color:#3a2e30;
    font-weight:500;
    margin:18px 0 8px;
    padding-left:0.6em; /* compensate letter-spacing right tail */
  }
  .cert-title-en{
    font-family:'Cormorant Garamond',serif;
    font-size:13px;
    letter-spacing:0.35em;
    color:#9a7d83;
    font-weight:500;
    font-style:italic;
    margin:0 0 18px;
  }
  .cert-no{
    font-family:'Cormorant Garamond',serif;
    font-size:10px;
    letter-spacing:0.3em;
    color:#9a7d83;
    margin:8px 0 0;
  }

  /* BODY */
  .cert-body{ padding:0 0 24px; }
  .recipient-label{
    font-family:'Cormorant Garamond',serif;
    font-size:10px;
    letter-spacing:0.4em;
    color:#c96b83;
    text-align:center;
    margin:0 0 8px;
    font-weight:500;
  }
  .recipient-name{
    font-family:'Noto Serif JP',serif;
    font-size:28px;
    letter-spacing:0.4em;
    color:#3a2e30;
    text-align:center;
    margin:0 0 32px;
    font-weight:500;
    border-bottom:1px solid #c96b8333;
    padding-bottom:14px;
    padding-left:0.4em;
  }
  .recipient-honorific{
    font-size:18px;
    letter-spacing:0.1em;
    color:#5a4a4d;
    margin-left:8px;
  }

  .cert-statement{
    text-align:center;
    margin:18px 0;
    line-height:2.2;
  }
  .cert-statement p{
    font-family:'Noto Serif JP',serif;
    font-size:14px;
    letter-spacing:0.15em;
    color:#3a2e30;
    margin:0;
  }

  .category-display{
    text-align:center;
    margin:24px auto;
    padding:24px 32px;
    background: linear-gradient(180deg, #fdf6f7 0%, #fbe7ea 100%);
    border:1px solid #e8849a55;
    max-width:480px;
  }
  .category-emoji{ font-size:42px; line-height:1; margin:0 0 8px; }
  .category-level{
    font-family:'Cormorant Garamond',serif;
    font-size:11px;
    letter-spacing:0.4em;
    color:#c96b83;
    font-weight:500;
    margin:0 0 4px;
  }
  .category-name{
    font-family:'Noto Serif JP',serif;
    font-size:24px;
    letter-spacing:0.2em;
    color:#3a2e30;
    margin:0;
    font-weight:500;
  }

  /* MODULES */
  .modules-section{ margin:28px 0 20px; }
  .section-label{
    font-family:'Cormorant Garamond',serif;
    font-size:10px;
    letter-spacing:0.35em;
    color:#c96b83;
    text-align:center;
    margin:0 0 12px;
    font-weight:500;
  }
  .modules-list{
    list-style:none;
    margin:0;
    padding:0;
    border-top:1px solid #c96b8333;
  }
  .mod-row{
    display:grid;
    grid-template-columns: 36px 1fr 60px 100px;
    gap:12px;
    padding:9px 8px;
    border-bottom:1px solid #c96b8322;
    align-items:center;
  }
  .mod-no{
    font-family:'Cormorant Garamond',serif;
    font-size:11px;
    color:#c96b83;
    letter-spacing:0.1em;
    font-weight:500;
  }
  .mod-title{
    font-family:'Noto Serif JP',serif;
    font-size:12px;
    color:#3a2e30;
    letter-spacing:0.05em;
  }
  .mod-min{
    font-family:'Cormorant Garamond',serif;
    font-size:11px;
    color:#9a7d83;
    text-align:right;
  }
  .mod-date{
    font-family:'Cormorant Garamond',serif;
    font-size:11px;
    color:#9a7d83;
    text-align:right;
  }

  /* METRICS */
  .metrics-row{
    display:grid;
    grid-template-columns: repeat(4, 1fr);
    gap:8px;
    margin:24px 0 16px;
  }
  .metric{
    text-align:center;
    padding:12px 6px;
    border:1px solid #c96b8333;
    background: #fdfafa;
  }
  .metric-label{
    font-family:'Cormorant Garamond',serif;
    font-size:9px;
    letter-spacing:0.3em;
    color:#c96b83;
    margin:0 0 4px;
    font-weight:500;
  }
  .metric-value{
    font-family:'Cormorant Garamond',serif;
    font-size:28px;
    color:#3a2e30;
    margin:0 0 2px;
    font-weight:500;
  }
  .metric-value-small{
    font-family:'Noto Serif JP',serif;
    font-size:13px;
    color:#3a2e30;
    margin:6px 0 4px;
    letter-spacing:0.05em;
  }
  .metric-jp{
    font-family:'Noto Serif JP',serif;
    font-size:9px;
    letter-spacing:0.1em;
    color:#9a7d83;
    margin:0;
  }

  /* FOOTER */
  .cert-footer{
    margin-top:30px;
    padding-top:24px;
    border-top:1px solid #c96b8333;
    text-align:center;
  }
  .issue-date{
    font-family:'Noto Serif JP',serif;
    font-size:14px;
    letter-spacing:0.3em;
    color:#3a2e30;
    margin:0 0 18px;
  }
  .signature-block{
    margin:18px 0 22px;
    position:relative;
  }
  .company-name{
    font-family:'Noto Serif JP',serif;
    font-size:16px;
    color:#3a2e30;
    letter-spacing:0.2em;
    margin:0 0 4px;
    font-weight:500;
  }
  .brand-name{
    font-family:'Noto Serif JP',serif;
    font-size:11px;
    color:#9a7d83;
    letter-spacing:0.15em;
    margin:0 0 6px;
  }
  .rep-line{
    font-family:'Noto Serif JP',serif;
    font-size:13px;
    color:#3a2e30;
    letter-spacing:0.15em;
    margin:0 0 12px;
  }
  .seal-circle{
    width:64px;
    height:64px;
    border:2px solid #c45555;
    border-radius:50%;
    display:flex;
    align-items:center;
    justify-content:center;
    color:#c45555;
    font-family:'Noto Serif JP',serif;
    font-size:9px;
    font-weight:500;
    letter-spacing:0.1em;
    margin:0 auto;
    background:#ffffff;
    transform: rotate(-3deg);
  }
  .footer-note{
    font-family:'Noto Serif JP',serif;
    font-size:9px;
    color:#9a7d83;
    line-height:1.9;
    margin:18px 0 0;
    letter-spacing:0.05em;
    text-align:left;
  }

  /* ACTIONS (画面のみ・印刷時は非表示) */
  .actions{
    text-align:center;
    margin-top:24px;
    display:flex;
    gap:12px;
    justify-content:center;
  }
  .btn-print, .btn-close{
    padding:10px 22px;
    border:1px solid #c96b83;
    background:#ffffff;
    color:#c96b83;
    font-family:'Noto Serif JP',serif;
    font-size:12px;
    letter-spacing:0.1em;
    cursor:pointer;
    border-radius:0;
  }
  .btn-print{ background:#c96b83; color:#ffffff; }
  .btn-print:hover{ background:#b35870; }
  .btn-close:hover{ background:#fdf0f3; }

  @media print{
    body{ padding:0; background:#ffffff; }
    .no-print{ display:none !important; }
    .frame{ box-shadow:none; }
    .page{ max-width:none; }
    .frame-inner{ min-height:auto; }
  }
  `;
}

/* ═══════════════════════════════════════════════════════════════
 * Helpers
 * ═══════════════════════════════════════════════════════════════ */
function escapeHtml(s: string): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatJpDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function toReiwa(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  // 令和元年 = 2019年
  const reiwaYear = d.getFullYear() - 2018;
  const yearStr = reiwaYear === 1 ? "元" : String(reiwaYear);
  return `令和${yearStr}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function levelToLabel(level: string): string {
  switch (level) {
    case "basic":        return "BASIC ESSENTIAL — 必 須 課 程";
    case "intermediate": return "INTERMEDIATE — 中 級 課 程";
    case "advanced":     return "ADVANCED — 上 級 課 程";
    case "master":       return "MASTER — マ ス タ ー 課 程";
    default:             return "TRAINING PROGRAM — 研 修 課 程";
  }
}

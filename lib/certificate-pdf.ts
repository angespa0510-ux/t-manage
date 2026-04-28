/**
 * 証明書PDF生成ユーティリティ
 * 3種類の証明書をHTML形式で新しいタブに開き、印刷/PDF保存可能にする
 */

type StoreInfo = {
  company_name: string;
  company_address: string;
  company_phone: string;
  representative?: string;
};

type PersonInfo = {
  real_name: string;
  name: string;
  address: string;
  entry_date: string;
};

/** セラピスト / スタッフの区別。契約文面の業務内容と支払項目の表記に影響 */
type PersonKind = "therapist" | "staff";

/** 業務内容の既定値。PersonKind に応じて切り替える */
const BUSINESS_DESCRIPTION: Record<PersonKind, string> = {
  therapist: "リラクゼーション施術業務",
  staff: "店舗運営業務（予約管理・受付対応・施設管理ほか）",
};

/** 後方互換: 既存コードは TherapistInfo という名前で import しているケースがあるため alias を残す */
export type TherapistInfo = PersonInfo;

type PaymentInfo = {
  year: number;
  totalGross: number;
  totalDays: number;
  months: { month: number; amount: number; days: number }[];
};

const fmt = (n: number) => n.toLocaleString("ja-JP");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

const baseStyle = `
  *{margin:0;padding:0;box-sizing:border-box}
  @page{size:A4;margin:20mm}
  body{font-family:'Hiragino Sans','Yu Gothic','Meiryo','Noto Sans JP',sans-serif;color:#1a1a2e;background:#fff;padding:40px 50px;max-width:800px;margin:0 auto;line-height:1.8}
  h1{text-align:center;font-size:22px;letter-spacing:6px;border-bottom:3px double #1a1a2e;padding-bottom:12px;margin-bottom:6px}
  h2{text-align:center;font-size:11px;color:#888;font-weight:normal;margin-bottom:30px}
  .seal-area{display:flex;justify-content:flex-end;gap:24px;margin:30px 0 10px}
  .seal-box{width:90px;text-align:center}
  .seal-circle{width:60px;height:60px;border:2px solid #c33;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#c33;font-size:11px;font-weight:bold;margin:0 auto 4px;letter-spacing:2px}
  .seal-label{font-size:9px;color:#888}
  .info-table{width:100%;border-collapse:collapse;margin:20px 0}
  .info-table td,.info-table th{padding:10px 14px;font-size:12px;border:1px solid #ccc}
  .info-table th{background:#f5f3ee;font-weight:600;width:140px;text-align:left;color:#555}
  .info-table td{background:#fff}
  .section-title{font-size:14px;font-weight:700;margin:28px 0 12px;padding-left:10px;border-left:4px solid #1a1a2e}
  .text-block{font-size:12px;line-height:2;margin:12px 0;text-indent:1em}
  .right{text-align:right}
  .center{text-align:center}
  .company-block{margin:30px 0;text-align:right;font-size:12px;line-height:2.2}
  .note{font-size:9px;color:#888;margin-top:30px;line-height:2;border-top:1px solid #ddd;padding-top:10px}
  .doc-number{font-size:10px;color:#999;text-align:right;margin-bottom:20px}
  .date-block{text-align:right;font-size:12px;margin:20px 0}
  @media print{body{padding:0}button{display:none!important}}
`;

const docHeader = (title: string, subtitle: string, docNo: string) => `
  <p class="doc-number">文書番号：${docNo}</p>
  <h1>${title}</h1>
  <h2>${subtitle}</h2>
  <p class="date-block">発行日：${today()}</p>
`;

const companyBlock = (store: StoreInfo) => `
  <div class="company-block">
    <strong>${store.company_name}</strong><br>
    所在地：${store.company_address}<br>
    電話：${store.company_phone}<br>
    ${store.representative ? `代表者：${store.representative}` : ""}
  </div>
  <div class="seal-area">
    <div class="seal-box">
      <div class="seal-circle">代表印</div>
      <div class="seal-label">印</div>
    </div>
  </div>
`;

const noteBlock = `
  <div class="note">
    ※ 本証明書は発行日時点の情報に基づき作成されています。<br>
    ※ 本証明書の有効期限は発行日から3ヶ月です。<br>
    ※ 不正利用が判明した場合は法的措置を講じることがあります。
  </div>
`;

function genDocNo(prefix: string): string {
  const d = new Date();
  const num = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}${String(Math.floor(Math.random()*1000)).padStart(3,"0")}`;
  return `${prefix}-${num}`;
}

/** ① 業務委託契約証明書（在籍証明） */
export function generateContractCertificate(store: StoreInfo, th: PersonInfo, kind: PersonKind = "therapist") {
  const entryDate = th.entry_date ? new Date(th.entry_date) : null;
  const entryStr = entryDate ? `${entryDate.getFullYear()}年${entryDate.getMonth()+1}月${entryDate.getDate()}日` : "—";
  const businessDesc = BUSINESS_DESCRIPTION[kind];
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>業務委託契約証明書_${th.real_name}</title><style>${baseStyle}</style></head><body>
    ${docHeader("業務委託契約証明書", "Certificate of Consignment Contract", genDocNo("CC"))}

    <p class="section-title">証明対象者</p>
    <table class="info-table">
      <tr><th>氏名</th><td>${th.real_name}</td></tr>
      <tr><th>住所</th><td>${th.address || "—"}</td></tr>
      <tr><th>契約開始日</th><td>${entryStr}</td></tr>
      <tr><th>契約形態</th><td>業務委託契約</td></tr>
      <tr><th>業務内容</th><td>${businessDesc}</td></tr>
      <tr><th>契約状況</th><td>現在有効</td></tr>
    </table>

    <p class="text-block">
      上記の者は、当社と業務委託契約を締結し、現在も契約関係が継続していることを証明いたします。
      なお、当該契約は雇用契約ではなく、業務委託契約（準委任契約）に基づくものです。
    </p>

    <p class="text-block">
      以上、関係機関からの求めに応じ、本証明書を発行いたします。
    </p>

    ${companyBlock(store)}
    ${noteBlock}
  </body></html>`);
  w.document.close();
}

/** ② 報酬支払証明書（収入証明） */
/** ② 報酬支払証明書（収入証明）HTMLを返す */
export function generatePaymentCertificateHtml(store: StoreInfo, th: PersonInfo, payment: PaymentInfo, _kind: PersonKind = "therapist"): string {
  const monthRows = payment.months.map(m =>
    `<tr><td class="center">${payment.year}年${m.month}月</td><td class="right">${fmt(m.amount)}円</td><td class="center">${m.days}日</td></tr>`
  ).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>報酬支払証明書_${payment.year}_${th.real_name}</title><style>${baseStyle}</style></head><body>
    ${docHeader("報酬支払証明書", "Certificate of Remuneration Payment", genDocNo("RP"))}

    <p class="section-title">証明対象者</p>
    <table class="info-table">
      <tr><th>氏名</th><td>${th.real_name}</td></tr>
      <tr><th>住所</th><td>${th.address || "—"}</td></tr>
      <tr><th>契約形態</th><td>業務委託契約</td></tr>
    </table>

    <p class="section-title">報酬支払実績（${payment.year}年）</p>
    <table class="info-table">
      <tr><th>対象期間</th><td>${payment.year}年1月〜${payment.year}年12月</td></tr>
      <tr><th>年間支払総額</th><td><strong style="font-size:16px">${fmt(payment.totalGross)}円</strong></td></tr>
      <tr><th>年間稼働日数</th><td>${payment.totalDays}日</td></tr>
    </table>

    <p class="section-title">月別支払内訳</p>
    <table class="info-table">
      <tr><th class="center">月</th><th class="center">支払額</th><th class="center">稼働日数</th></tr>
      ${monthRows}
      <tr style="background:#f9f6f0;font-weight:bold"><td class="center">合計</td><td class="right">${fmt(payment.totalGross)}円</td><td class="center">${payment.totalDays}日</td></tr>
    </table>

    <p class="text-block">
      上記の者に対し、業務委託契約に基づき、上記金額の報酬を支払ったことを証明いたします。
    </p>

    ${companyBlock(store)}
    ${noteBlock}
  </body></html>`;
}

export function generatePaymentCertificate(store: StoreInfo, th: PersonInfo, payment: PaymentInfo, kind: PersonKind = "therapist") {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(generatePaymentCertificateHtml(store, th, payment, kind));
  w.document.close();
}

/** ③ 取引実績証明書 */
export function generateTransactionCertificate(store: StoreInfo, th: PersonInfo, payment: PaymentInfo, _kind: PersonKind = "therapist") {
  const entryDate = th.entry_date ? new Date(th.entry_date) : null;
  const entryStr = entryDate ? `${entryDate.getFullYear()}年${entryDate.getMonth()+1}月` : "—";
  const monthCount = payment.months.filter(m => m.amount > 0).length;
  const avgMonthly = monthCount > 0 ? Math.round(payment.totalGross / monthCount) : 0;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>取引実績証明書_${payment.year}_${th.real_name}</title><style>${baseStyle}</style></head><body>
    ${docHeader("取引実績証明書", "Certificate of Transaction Record", genDocNo("TR"))}

    <p class="section-title">取引先情報</p>
    <table class="info-table">
      <tr><th>氏名（屋号）</th><td>${th.real_name}</td></tr>
      <tr><th>住所</th><td>${th.address || "—"}</td></tr>
      <tr><th>取引開始</th><td>${entryStr}</td></tr>
      <tr><th>取引形態</th><td>業務委託契約に基づく継続取引</td></tr>
    </table>

    <p class="section-title">取引実績（${payment.year}年）</p>
    <table class="info-table">
      <tr><th>年間取引金額</th><td><strong style="font-size:16px">${fmt(payment.totalGross)}円</strong></td></tr>
      <tr><th>取引月数</th><td>${monthCount}ヶ月 / 12ヶ月</td></tr>
      <tr><th>月平均取引金額</th><td>${fmt(avgMonthly)}円</td></tr>
      <tr><th>年間稼働日数</th><td>${payment.totalDays}日</td></tr>
      <tr><th>取引状況</th><td>継続中</td></tr>
    </table>

    <p class="text-block">
      上記の者との間で、業務委託契約に基づき上記の取引実績があることを証明いたします。
      当社との取引関係は良好に継続しており、今後も取引を継続する意向であることを申し添えます。
    </p>

    ${companyBlock(store)}
    ${noteBlock}
  </body></html>`);
  w.document.close();
}

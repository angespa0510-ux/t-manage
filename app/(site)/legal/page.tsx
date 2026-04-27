"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { SITE, MARBLE } from "../../../lib/site-theme";
import { PageHero } from "../../../components/site/SiteLayoutParts";

/**
 * /legal — 特定商取引法に基づく表記
 *
 * 方針:
 *  - 屋号「Ange Spa」を主役とし、運営会社（合同会社テラスライフ）は
 *    法律上の必須開示として最小限のサブ表記に留める
 *  - HP共通の Noto Serif JP・マーブル背景・ピンク細罫線で統一
 *  - /corporate（TERA DXコーポレートサイト）への導線は一切作らない
 *
 * データソース: stores テーブルから運営会社情報を動的取得
 *  （未登録の場合は固定値でフォールバック）
 */

type Store = {
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  representative_name?: string;
  representative_title?: string;
};

export default function LegalPage() {
  const [co, setCo] = useState<Store>({});

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("stores")
          .select(
            "company_name,company_address,company_phone,representative_name,representative_title",
          )
          .order("id")
          .limit(1)
          .single();
        if (data) setCo(data);
      } catch (e) {
        console.log("legal fetch error:", e);
      }
    })();
  }, []);

  const companyName = co.company_name || "合同会社テラスライフ";
  const representative = co.representative_name
    ? `${co.representative_title || "代表社員"} ${co.representative_name}`
    : "—";
  const address = co.company_address || "愛知県安城市";

  // 表記項目（屋号主役・法人名はサブ）
  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: "販売事業者",
      value: (
        <>
          <span style={{ fontSize: "15px", fontWeight: 500 }}>Ange Spa</span>
          <span
            style={{
              display: "block",
              marginTop: 6,
              fontSize: "11px",
              color: SITE.color.textMuted,
            }}
          >
            運営：{companyName}
          </span>
        </>
      ),
    },
    { label: "代表者", value: representative },
    { label: "所在地", value: address },
    {
      label: "電話番号",
      value: "070-1675-5900",
    },
    {
      label: "メールアドレス",
      value: "info@ange-spa.jp",
    },
    {
      label: "サービス内容",
      value: "メンズリラクゼーションサロンの運営（リンパマッサージ・ボディケア等の役務提供）",
    },
    {
      label: "販売価格",
      value: (
        <>
          各コースの料金は<a
            href="/system"
            style={{ color: SITE.color.pinkDeep, textDecoration: "underline" }}
          >料金ページ</a>に記載しております。表示価格に消費税は含まれます。
        </>
      ),
    },
    {
      label: "代金以外の必要料金",
      value: "なし（指名料・延長料金等が発生する場合は事前にご案内いたします）",
    },
    {
      label: "代金の支払時期および方法",
      value: "サービス提供後の現地でのお支払い。現金・各種クレジットカード・電子マネー（PayPay 等）に対応しております。",
    },
    {
      label: "役務の提供時期",
      value: "ご予約いただいた日時にサービスを提供いたします。",
    },
    {
      label: "キャンセル・返金について",
      value:
        "ご予約のキャンセル・変更は前日までに上記電話番号またはメールにてご連絡をお願いいたします。サービス提供後のキャンセル・返金はお受けできません。",
    },
    {
      label: "未成年の利用について",
      value: "本サービスは18歳未満の方はご利用いただけません。",
    },
  ];

  return (
    <>
      <PageHero
        label="LEGAL"
        title="特定商取引法に基づく表記"
        subtitle="「特定商取引に関する法律」第11条に基づき、以下のとおり表記いたします。"
      />

      <div
        style={{
          ...MARBLE.warm,
          marginBottom: `calc(-1 * ${SITE.sp.section})`,
          paddingBottom: SITE.sp.section,
          minHeight: "60vh",
        }}
      >
        <section
          style={{
            padding: `${SITE.sp.xxl} ${SITE.sp.lg}`,
          }}
        >
          <div
            style={{
              maxWidth: SITE.layout.maxWidthNarrow,
              margin: "0 auto",
            }}
          >
            <div
              style={{
                background: SITE.color.surface,
                border: `1px solid ${SITE.color.border}`,
                padding: `${SITE.sp.xl} ${SITE.sp.lg}`,
              }}
            >
              <dl style={{ margin: 0 }}>
                {rows.map((r, i) => (
                  <div
                    key={i}
                    className="legal-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr",
                      gap: 8,
                      padding: `${SITE.sp.md} 0`,
                      borderBottom:
                        i === rows.length - 1
                          ? "none"
                          : `1px solid ${SITE.color.borderSoft}`,
                    }}
                  >
                    <dt
                      style={{
                        fontFamily: SITE.font.display,
                        fontSize: "11px",
                        letterSpacing: SITE.ls.wide,
                        color: SITE.color.pink,
                        fontWeight: 500,
                      }}
                    >
                      {r.label}
                    </dt>
                    <dd
                      style={{
                        margin: 0,
                        fontFamily: SITE.font.serif,
                        fontSize: "13px",
                        color: SITE.color.text,
                        lineHeight: SITE.lh.body,
                        letterSpacing: SITE.ls.normal,
                      }}
                    >
                      {r.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <p
              style={{
                marginTop: SITE.sp.xl,
                fontSize: "11px",
                color: SITE.color.textMuted,
                lineHeight: SITE.lh.body,
                letterSpacing: SITE.ls.normal,
                textAlign: "center",
              }}
            >
              本表記の記載事項に関するお問い合わせは、上記メールアドレスまたはお電話までご連絡ください。
            </p>
          </div>
        </section>
      </div>

      <style>{`
        @media (min-width: 640px) {
          .legal-row {
            grid-template-columns: 200px 1fr !important;
            gap: 24px !important;
            align-items: baseline !important;
          }
        }
      `}</style>
    </>
  );
}

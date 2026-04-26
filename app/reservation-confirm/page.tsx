"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

function ReservationConfirmInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [renderedText, setRenderedText] = useState("");
  const [mapEmbedUrl, setMapEmbedUrl] = useState("");

  useEffect(() => {
    if (!token) { setStatus("error"); return; }

    (async () => {
      try {
        // 1. トークンで予約を検索
        const { data: res, error } = await supabase
          .from("reservations").select("*").eq("confirmation_token", token).maybeSingle();
        if (error || !res) { setStatus("error"); return; }

        // 2. customer_statusが未読なら既読に更新
        const cs = res.customer_status || "";
        let newCs = cs;
        if (cs === "summary_unread") newCs = "summary_read";
        else if (cs === "detail_unread") newCs = "detail_read";
        if (newCs !== cs) {
          await supabase.from("reservations").update({ customer_status: newCs }).eq("id", res.id);
        }

        // 3. 関連データ取得
        const [therapistRes, roomAssignRes, roomsRes, buildingsRes, settingsRes, templateRes] = await Promise.all([
          supabase.from("therapists").select("name").eq("id", res.therapist_id).maybeSingle(),
          supabase.from("room_assignments").select("room_id").eq("date", res.date).eq("therapist_id", res.therapist_id).maybeSingle(),
          supabase.from("rooms").select("id,name,store_id,building_id"),
          supabase.from("buildings").select("id,name"),
          supabase.from("store_settings").select("key,value").in("key", ["notify_loc_toyohashi","notify_loc_mycourt","notify_loc_oasis","notify_url_days","notify_map_toyohashi","notify_map_mycourt","notify_map_oasis"]),
          supabase.from("notification_templates").select("template_key,body"),
        ]);

        const therapistName = therapistRes.data?.name || "";
        const roomId = roomAssignRes.data?.room_id;
        const room = roomId ? (roomsRes.data || []).find((r: any) => r.id === roomId) : null;
        const building = room ? (buildingsRes.data || []).find((b: any) => b.id === room.building_id) : null;
        const roomName = room?.name || "";
        const buildingName = building?.name || "";

        // 場所URL判定
        const stg: Record<string, string> = {};
        (settingsRes.data || []).forEach((s: any) => { stg[s.key] = s.value; });
        const locUrl = (res.store_name || "").includes("豊橋") ? (stg.notify_loc_toyohashi || "")
          : buildingName.includes("マイコート") ? (stg.notify_loc_mycourt || "")
          : (stg.notify_loc_oasis || "");

        // 地図埋め込みURL判定
        const mapUrl = (res.store_name || "").includes("豊橋") ? (stg.notify_map_toyohashi || "")
          : buildingName.includes("マイコート") ? (stg.notify_map_mycourt || "")
          : (stg.notify_map_oasis || "");
        if (mapUrl) setMapEmbedUrl(mapUrl);

        // URL付き/なし判定
        const urlDays = parseInt(stg.notify_url_days || "1") || 1;
        const today = new Date(); today.setHours(0,0,0,0);
        const resDate = new Date(res.date + "T00:00:00");
        const diffDays = Math.floor((resDate.getTime() - today.getTime()) / 86400000);
        const isUrlIncluded = diffDays <= urlDays;

        // 4. テンプレート選択（詳細テンプレート）
        const templates = templateRes.data || [];
        const tplKey = isUrlIncluded ? "customer_detail_url" : "customer_detail_no_url";
        const tpl = templates.find((t: any) => t.template_key === tplKey);

        // 5. テンプレート変数適用
        const d = new Date(res.date + "T00:00:00");
        const dayNames = ["日","月","火","水","木","金","土"];
        const dateStr = `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}（${dayNames[d.getDay()]}）`;
        const dateFull = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${dayNames[d.getDay()]}）`;
        const custName = (res.customer_name || "").replace(/\s*L$/i, "").replace(/\d{2,4}$/, "").trim();
        const nomLine = res.nomination && res.nomination !== "フリー" ? "\n指名 : " + res.nomination : "";
        const discLine = res.discount_name ? "\n割引 : " + res.discount_name : "";
        const thLine = res.nomination !== "フリー" && therapistName ? "\n" + therapistName + "セラピスト" : "";
        const course = res.course + (res.extension_name ? "＋" + res.extension_name : "");
        const storeName = res.store_name || "Ange Spa";

        let text: string;
        if (tpl) {
          text = tpl.body;
          const vars: Record<string, string> = {
            "{お客様名}": custName, "{日時}": dateFull, "{日付}": dateStr,
            "{開始時刻}": (res.start_time || "").slice(0,5), "{終了時刻}": (res.end_time || "").slice(0,5),
            "{コース}": course, "{指名}": res.nomination || "指名なし", "{割引}": res.discount_name || "なし",
            "{店舗名}": storeName, "{金額}": (res.total_price || 0).toLocaleString(),
            "{セラピスト名}": therapistName, "{場所URL}": locUrl,
            "{ルーム名}": roomName, "{ビル名}": buildingName,
          };
          text = text.replace(/\{指名行\}/g, nomLine);
          text = text.replace(/\{割引行\}/g, discLine);
          text = text.replace(/\{セラピスト行\}/g, thLine);
          text = text.replace(/\{送信者行\}/g, "");
          for (const [k, v] of Object.entries(vars)) { text = text.split(k).join(v); }
        } else {
          text = "ご予約内容\n\nお時間 : " + dateStr + " " + (res.start_time || "").slice(0,5) + "～" + (res.end_time || "").slice(0,5) +
            "\nコース : " + course + nomLine + discLine +
            "\n店舗名 : " + storeName + "\n金額 : " + (res.total_price || 0).toLocaleString() + "円" + thLine;
          if (isUrlIncluded && locUrl) text += "\n\n場所はこちら\n" + locUrl;
          if (roomName) text += "\nルーム : " + roomName;
          if (buildingName) text += "\nビル : " + buildingName;
        }

        setRenderedText(text);
        setStatus("success");
      } catch (e) {
        console.error("確認ページエラー:", e);
        setStatus("error");
      }
    })();
  }, [token]);

  // URLをクリック可能なリンクに変換
  const renderWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (urlRegex.test(part)) {
        const isLocationUrl = part.includes("notion.site") || part.includes("google.com/maps");
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            style={{
              color: "#c96b83",
              textDecoration: "underline",
              wordBreak: "break-all",
              letterSpacing: "0.02em",
              ...(isLocationUrl ? {
                display: "inline-block",
                marginTop: 8,
                padding: "10px 20px",
                backgroundColor: "transparent",
                textDecoration: "none",
                border: "1px solid #c96b83",
                fontSize: 12,
                fontFamily: "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif",
                letterSpacing: "0.1em",
                fontWeight: 500,
              } : {})
            }}>
            {isLocationUrl ? "📍 場所・アクセスを確認する" : part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const FONT_SERIF = "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif";
  const FONT_DISPLAY = "'Cormorant Garamond', 'Noto Serif JP', 'Yu Mincho', serif";
  const marbleBg = {
    background: `
      radial-gradient(at 20% 15%, rgba(232,132,154,0.10) 0, transparent 50%),
      radial-gradient(at 85% 20%, rgba(196,162,138,0.08) 0, transparent 50%),
      radial-gradient(at 40% 85%, rgba(247,227,231,0.6) 0, transparent 50%),
      linear-gradient(180deg, #fbf7f3 0%, #f8f2ec 100%)
    `,
  };

  return (
    <div style={{ minHeight: "100vh", ...marbleBg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: FONT_SERIF, color: "#2b2b2b" }}>
      <div style={{ maxWidth: 440, width: "100%", backgroundColor: "#ffffff", border: "1px solid #e5ded6", padding: "40px 32px" }}>
        {status === "loading" && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <p style={{ fontSize: 28, margin: "0 0 12px" }}>⏳</p>
            <p style={{ margin: 0, fontSize: 12, color: "#8a8a8a", letterSpacing: "0.1em" }}>確認中…</p>
          </div>
        )}
        {status === "error" && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <p style={{ fontSize: 28, margin: "0 0 12px" }}>⚠️</p>
            <p style={{ margin: 0, fontSize: 13, color: "#c96b83", letterSpacing: "0.05em" }}>リンクが無効か、予約が見つかりません</p>
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "#8a8a8a", letterSpacing: "0.03em" }}>お手数ですがお店にお問い合わせください</p>
          </div>
        )}
        {status === "success" && (
          <>
            {/* ヘッダー */}
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              {/* 装飾細線 */}
              <div style={{ width: 1, height: 32, backgroundColor: "#e8849a", margin: "0 auto 18px" }} />
              <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.3em", color: "#c96b83", fontWeight: 500 }}>RESERVATION</p>
              <h1 style={{ margin: "6px 0 10px", fontFamily: FONT_SERIF, fontSize: 18, fontWeight: 500, letterSpacing: "0.12em", color: "#2b2b2b" }}>ご予約内容の確認</h1>
              {/* ピンク細罫線 */}
              <div style={{ width: 36, height: 1, backgroundColor: "#e8849a", margin: "0 auto 10px" }} />
              <p style={{ margin: 0, fontSize: 11, color: "#8a8a8a", letterSpacing: "0.08em" }}>ご確認ありがとうございます</p>
            </div>

            {/* 予約内容カード */}
            <div style={{ backgroundColor: "#faf6f1", border: "1px solid #e5ded6", padding: "22px 22px", marginBottom: 18, fontSize: 13, color: "#2b2b2b", lineHeight: 2.1, whiteSpace: "pre-wrap", letterSpacing: "0.03em" }}>
              {renderWithLinks(renderedText)}
            </div>

            {mapEmbedUrl && (
              <div style={{ marginBottom: 18 }}>
                <p style={{ margin: "0 0 8px", fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.25em", color: "#c96b83", fontWeight: 500, textAlign: "center" }}>MAP — 地図</p>
                <div style={{ overflow: "hidden", border: "1px solid #e5ded6" }}>
                  <iframe
                    src={mapEmbedUrl}
                    width="100%" height="220" style={{ border: 0, display: "block" }} loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
                </div>
              </div>
            )}

            {/* フッター */}
            <div style={{ textAlign: "center", marginTop: 20, paddingTop: 20, borderTop: "1px solid #e5ded6" }}>
              <p style={{ margin: 0, fontSize: 11, color: "#8a8a8a", letterSpacing: "0.1em", lineHeight: 1.9 }}>
                当日のご来店を<br />心よりお待ちしております
              </p>
              <div style={{ width: 24, height: 1, backgroundColor: "#e8849a", margin: "14px auto 0" }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ReservationConfirm() {
  const loadingBg = {
    background: `
      radial-gradient(at 20% 15%, rgba(232,132,154,0.10) 0, transparent 50%),
      radial-gradient(at 85% 20%, rgba(196,162,138,0.08) 0, transparent 50%),
      radial-gradient(at 40% 85%, rgba(247,227,231,0.6) 0, transparent 50%),
      linear-gradient(180deg, #fbf7f3 0%, #f8f2ec 100%)
    `,
  };
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", ...loadingBg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif" }}>
        <div style={{ color: "#8a8a8a", fontSize: 13, letterSpacing: "0.15em" }}>読み込み中…</div>
      </div>
    }>
      <ReservationConfirmInner />
    </Suspense>
  );
}

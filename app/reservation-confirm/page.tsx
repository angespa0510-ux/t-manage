"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

function ReservationConfirmInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [renderedText, setRenderedText] = useState("");

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
          supabase.from("store_settings").select("key,value").in("key", ["notify_loc_toyohashi","notify_loc_mycourt","notify_loc_oasis","notify_url_days"]),
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
        const storeName = res.store_name || "チョップ";

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

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 440, width: "100%", background: "#1e1e30", borderRadius: 20, padding: 32, color: "#e0e0e0" }}>
        {status === "loading" && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>⏳</p>
            <p style={{ fontSize: 14, color: "#999" }}>確認中...</p>
          </div>
        )}
        {status === "error" && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>⚠️</p>
            <p style={{ fontSize: 14, color: "#c45555" }}>リンクが無効か、予約が見つかりません</p>
            <p style={{ fontSize: 12, color: "#888", marginTop: 8 }}>お手数ですがお店にお問い合わせください</p>
          </div>
        )}
        {status === "success" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <p style={{ fontSize: 36, marginBottom: 8 }}>✅</p>
              <h1 style={{ fontSize: 18, fontWeight: 600, color: "#c3a782", margin: 0 }}>ご予約内容の確認</h1>
              <p style={{ fontSize: 12, color: "#999", marginTop: 4 }}>ご確認ありがとうございます</p>
            </div>
            <div style={{ background: "#2a2a40", borderRadius: 14, padding: 20, marginBottom: 16, fontSize: 13, color: "#ddd", lineHeight: 2, whiteSpace: "pre-wrap" }}>
              {renderedText}
            </div>
            <p style={{ textAlign: "center", fontSize: 11, color: "#666", marginTop: 16 }}>
              当日のご来店を心よりお待ちしております
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function ReservationConfirm() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#999", fontSize: 14 }}>読み込み中...</div>
      </div>
    }>
      <ReservationConfirmInner />
    </Suspense>
  );
}

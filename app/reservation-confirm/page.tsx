"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

function ReservationConfirmInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [res, setRes] = useState<any>(null);

  useEffect(() => {
    if (!token) { setStatus("error"); return; }

    (async () => {
      try {
        // トークンで予約を検索
        const { data, error } = await supabase
          .from("reservations")
          .select("*")
          .eq("confirmation_token", token)
          .maybeSingle();

        if (error || !data) { setStatus("error"); return; }

        setRes(data);

        // customer_statusが未読なら既読に更新
        const cs = data.customer_status || "";
        let newStatus = cs;
        if (cs === "summary_unread") newStatus = "summary_read";
        else if (cs === "detail_unread") newStatus = "detail_read";

        if (newStatus !== cs) {
          await supabase
            .from("reservations")
            .update({ customer_status: newStatus })
            .eq("id", data.id);
        }

        setStatus("success");
      } catch {
        setStatus("error");
      }
    })();
  }, [token]);

  const fmt = (n: number) => "¥" + (n || 0).toLocaleString();
  const d = res ? new Date(res.date + "T00:00:00") : null;
  const days = ["日","月","火","水","木","金","土"];
  const dateStr = d ? `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}(${days[d.getDay()]})` : "";

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

        {status === "success" && res && (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <p style={{ fontSize: 36, marginBottom: 8 }}>✅</p>
              <h1 style={{ fontSize: 18, fontWeight: 600, color: "#c3a782", margin: 0 }}>ご予約内容の確認</h1>
              <p style={{ fontSize: 12, color: "#999", marginTop: 4 }}>ご確認ありがとうございます</p>
            </div>

            <div style={{ background: "#2a2a40", borderRadius: 14, padding: 20, marginBottom: 16 }}>
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ color: "#999", padding: "8px 0", verticalAlign: "top", width: 80 }}>日時</td>
                    <td style={{ padding: "8px 0", fontWeight: 500 }}>{dateStr} {res.start_time?.slice(0,5)}〜{res.end_time?.slice(0,5)}</td>
                  </tr>
                  <tr>
                    <td style={{ color: "#999", padding: "8px 0", verticalAlign: "top" }}>コース</td>
                    <td style={{ padding: "8px 0" }}>{res.course}{res.extension_name ? `＋${res.extension_name}` : ""}</td>
                  </tr>
                  {res.nomination && (
                    <tr>
                      <td style={{ color: "#999", padding: "8px 0", verticalAlign: "top" }}>指名</td>
                      <td style={{ padding: "8px 0" }}>{res.nomination}</td>
                    </tr>
                  )}
                  {res.options_text && (
                    <tr>
                      <td style={{ color: "#999", padding: "8px 0", verticalAlign: "top" }}>オプション</td>
                      <td style={{ padding: "8px 0" }}>{res.options_text}</td>
                    </tr>
                  )}
                  <tr style={{ borderTop: "1px solid #3a3a55" }}>
                    <td style={{ color: "#c3a782", padding: "12px 0 4px", fontWeight: 600 }}>合計</td>
                    <td style={{ padding: "12px 0 4px", fontWeight: 600, color: "#c3a782", fontSize: 16 }}>{fmt(res.total_price)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ background: "#2a2a40", borderRadius: 14, padding: 16, fontSize: 12, color: "#bbb", lineHeight: 1.8, textAlign: "center" }}>
              <p style={{ margin: 0 }}>ご確認ありがとうございます。</p>
              <p style={{ margin: "4px 0 0" }}>詳細につきましては別途ご連絡いたします。</p>
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

"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ConfirmContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error" | "already">("loading");
  const [name, setName] = useState("");

  useEffect(() => {
    const verify = async () => {
      if (!token) { setStatus("error"); return; }
      const { data } = await supabase.from("therapists").select("id, name, email_verified").eq("email_token", token).maybeSingle();
      if (!data) { setStatus("error"); return; }
      if (data.email_verified) { setName(data.name); setStatus("already"); return; }
      await supabase.from("therapists").update({ email_verified: true }).eq("id", data.id);
      setName(data.name);
      setStatus("success");
    };
    verify();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf8f5] p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-lg p-8 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: status === "success" || status === "already" ? "#22c55e18" : status === "error" ? "#c4555518" : "#c3a78218" }}>
          <span className="text-[28px]">{status === "loading" ? "⏳" : status === "success" ? "✅" : status === "already" ? "✅" : "❌"}</span>
        </div>
        {status === "loading" && <><h1 className="text-[18px] font-medium mb-2 text-[#333]">確認中...</h1><p className="text-[13px] text-[#888]">少々お待ちください</p></>}
        {status === "success" && <><h1 className="text-[18px] font-medium mb-2 text-[#333]">確認完了！</h1><p className="text-[13px] text-[#888]">{name} 様のメールアドレスが確認されました</p><p className="text-[12px] mt-4 text-[#aaa]">このページを閉じてください</p></>}
        {status === "already" && <><h1 className="text-[18px] font-medium mb-2 text-[#333]">確認済みです</h1><p className="text-[13px] text-[#888]">{name} 様のメールアドレスは既に確認されています</p></>}
        {status === "error" && <><h1 className="text-[18px] font-medium mb-2 text-[#333]">確認できませんでした</h1><p className="text-[13px] text-[#888]">リンクが無効か、期限が切れている可能性があります</p></>}
        <div className="mt-6 pt-4" style={{ borderTop: "1px solid #eee" }}>
          <div className="flex items-center justify-center gap-2">
            <div className="w-7 h-7 rounded-[6px] bg-gradient-to-br from-[#c3a782] to-[#a8895e] flex items-center justify-center"><span className="text-white text-[10px] font-semibold">C</span></div>
            <span className="text-[11px] text-[#bbb]">チョップ salon management</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmEmailPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#faf8f5]"><p>読み込み中...</p></div>}><ConfirmContent /></Suspense>;
}

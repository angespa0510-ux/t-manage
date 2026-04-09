"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";

type Tab = "camera" | "lock" | "minipc" | "gdrive" | "guide";

export default function IotSettings() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const [tab, setTab] = useState<Tab>("camera");

  // Camera settings
  const [camName, setCamName] = useState("");
  const [camIp, setCamIp] = useState("");
  const [camUser, setCamUser] = useState("");
  const [camPass, setCamPass] = useState("");
  const [camModel, setCamModel] = useState("Pan/Tilt Cam Plus 2K");
  const [camSaving, setCamSaving] = useState(false);
  const [camMsg, setCamMsg] = useState("");

  // SwitchBot API
  const [sbToken, setSbToken] = useState("");
  const [sbSecret, setSbSecret] = useState("");
  const [sbLockId, setSbLockId] = useState("");
  const [sbLockName, setSbLockName] = useState("");
  const [sbSaving, setSbSaving] = useState(false);
  const [sbMsg, setSbMsg] = useState("");

  // Mini PC / go2rtc
  const [go2rtcUrl, setGo2rtcUrl] = useState("");
  const [cfTunnelUrl, setCfTunnelUrl] = useState("");
  const [minipcNote, setMinipcNote] = useState("");
  const [minipcSaving, setMinipcSaving] = useState(false);
  const [minipcMsg, setMinipcMsg] = useState("");

  // Google Drive
  const [gdriveFolder, setGdriveFolder] = useState("");
  const [gdriveRecordPath, setGdriveRecordPath] = useState("");
  const [gdriveSaving, setGdriveSaving] = useState(false);
  const [gdriveMsg, setGdriveMsg] = useState("");

  // Guide step tracking
  const [guideStep, setGuideStep] = useState(0);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push("/");
    };
    check();
    loadSettings();
  }, [router]);

  const loadSettings = async () => {
    const keys = [
      "iot_cam_name", "iot_cam_ip", "iot_cam_user", "iot_cam_pass", "iot_cam_model",
      "iot_sb_token", "iot_sb_secret", "iot_sb_lock_id", "iot_sb_lock_name",
      "iot_go2rtc_url", "iot_cf_tunnel_url", "iot_minipc_note",
      "iot_gdrive_folder", "iot_gdrive_record_path"
    ];
    const { data } = await supabase.from("store_settings").select("key,value").in("key", keys);
    if (data) {
      for (const s of data) {
        if (s.key === "iot_cam_name") setCamName(s.value);
        if (s.key === "iot_cam_ip") setCamIp(s.value);
        if (s.key === "iot_cam_user") setCamUser(s.value);
        if (s.key === "iot_cam_pass") setCamPass(s.value);
        if (s.key === "iot_cam_model") setCamModel(s.value);
        if (s.key === "iot_sb_token") setSbToken(s.value);
        if (s.key === "iot_sb_secret") setSbSecret(s.value);
        if (s.key === "iot_sb_lock_id") setSbLockId(s.value);
        if (s.key === "iot_sb_lock_name") setSbLockName(s.value);
        if (s.key === "iot_go2rtc_url") setGo2rtcUrl(s.value);
        if (s.key === "iot_cf_tunnel_url") setCfTunnelUrl(s.value);
        if (s.key === "iot_minipc_note") setMinipcNote(s.value);
        if (s.key === "iot_gdrive_folder") setGdriveFolder(s.value);
        if (s.key === "iot_gdrive_record_path") setGdriveRecordPath(s.value);
      }
    }
  };

  const savePairs = async (pairs: [string, string][]) => {
    for (const [key, value] of pairs) {
      await supabase.from("store_settings").upsert({ key, value }, { onConflict: "key" });
    }
  };

  const saveCam = async () => {
    setCamSaving(true); setCamMsg("");
    await savePairs([
      ["iot_cam_name", camName], ["iot_cam_ip", camIp],
      ["iot_cam_user", camUser], ["iot_cam_pass", camPass], ["iot_cam_model", camModel]
    ]);
    setCamSaving(false); setCamMsg("✅ 保存しました！");
    setTimeout(() => setCamMsg(""), 3000);
  };

  const saveSb = async () => {
    setSbSaving(true); setSbMsg("");
    await savePairs([
      ["iot_sb_token", sbToken], ["iot_sb_secret", sbSecret],
      ["iot_sb_lock_id", sbLockId], ["iot_sb_lock_name", sbLockName]
    ]);
    setSbSaving(false); setSbMsg("✅ 保存しました！");
    setTimeout(() => setSbMsg(""), 3000);
  };

  const saveMinipc = async () => {
    setMinipcSaving(true); setMinipcMsg("");
    await savePairs([
      ["iot_go2rtc_url", go2rtcUrl], ["iot_cf_tunnel_url", cfTunnelUrl], ["iot_minipc_note", minipcNote]
    ]);
    setMinipcSaving(false); setMinipcMsg("✅ 保存しました！");
    setTimeout(() => setMinipcMsg(""), 3000);
  };

  const saveGdrive = async () => {
    setGdriveSaving(true); setGdriveMsg("");
    await savePairs([
      ["iot_gdrive_folder", gdriveFolder], ["iot_gdrive_record_path", gdriveRecordPath]
    ]);
    setGdriveSaving(false); setGdriveMsg("✅ 保存しました！");
    setTimeout(() => setGdriveMsg(""), 3000);
  };

  const tabs: { key: Tab; icon: string; label: string }[] = [
    { key: "camera", icon: "📷", label: "カメラ" },
    { key: "lock", icon: "🔐", label: "スマートロック" },
    { key: "minipc", icon: "🖥️", label: "ミニPC" },
    { key: "gdrive", icon: "📁", label: "Google Drive" },
    { key: "guide", icon: "📖", label: "セットアップ" },
  ];

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: `1px solid ${T.border}`, backgroundColor: dark ? "#1e1e2e" : "#fff",
    color: T.text, fontSize: 14, outline: "none",
  };

  const labelStyle: React.CSSProperties = { fontSize: 12, color: T.textSub, marginBottom: 4, display: "block" };
  const sectionStyle: React.CSSProperties = { padding: 16, borderRadius: 12, backgroundColor: T.card, marginBottom: 12 };
  const btnStyle: React.CSSProperties = {
    padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer",
    fontWeight: 600, fontSize: 14, background: "linear-gradient(135deg, #c3a782, #a8895e)", color: "#fff",
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.bg, color: T.text }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <NavMenu T={T} />
          <h1 style={{ fontSize: 16, fontWeight: 700 }}>📡 IoTデバイス設定</h1>
        </div>
        <button onClick={toggle} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>{dark ? "☀️" : "🌙"}</button>
      </header>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, padding: "12px 16px", overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "8px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
            backgroundColor: tab === t.key ? (dark ? "#c3a782" : "#a8895e") : (dark ? "#2a2a3e" : "#f0f0f0"),
            color: tab === t.key ? "#fff" : T.textSub,
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 16px 80px" }}>

        {/* ── カメラ設定 ── */}
        {tab === "camera" && (
          <div>
            <div style={sectionStyle}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📷 SwitchBot カメラ設定</h3>
              <p style={{ fontSize: 11, color: T.textSub, marginBottom: 16 }}>SwitchBotアプリで作成したカメラアカウント情報を入力してください。</p>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>カメラ名（任意）</label>
                <input style={inputStyle} value={camName} onChange={e => setCamName(e.target.value)} placeholder="例: 店舗メインカメラ" />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>カメラモデル</label>
                <select style={inputStyle} value={camModel} onChange={e => setCamModel(e.target.value)}>
                  <option>Pan/Tilt Cam Plus 2K</option>
                  <option>Pan/Tilt Cam Plus 3K</option>
                  <option>Video Doorbell</option>
                  <option>その他（RTSP対応モデル）</option>
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>カメラIPアドレス（ローカル）</label>
                <input style={inputStyle} value={camIp} onChange={e => setCamIp(e.target.value)} placeholder="例: 192.168.1.100" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>カメラアカウント ユーザー名</label>
                  <input style={inputStyle} value={camUser} onChange={e => setCamUser(e.target.value)} placeholder="例: admin" />
                </div>
                <div>
                  <label style={labelStyle}>カメラアカウント パスワード</label>
                  <input style={inputStyle} type="password" value={camPass} onChange={e => setCamPass(e.target.value)} placeholder="パスワード" />
                </div>
              </div>

              {/* RTSP URL preview */}
              {camIp && camUser && (
                <div style={{ padding: 12, borderRadius: 8, backgroundColor: dark ? "#1a1a2e" : "#f8f6f0", marginBottom: 12 }}>
                  <label style={{ ...labelStyle, fontWeight: 600 }}>📺 RTSP URL（自動生成）</label>
                  <code style={{ fontSize: 11, color: "#c3a782", wordBreak: "break-all" }}>
                    rtsp://{camUser}:{camPass || "****"}@{camIp}:554/live0
                  </code>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={saveCam} disabled={camSaving} style={btnStyle}>
                  {camSaving ? "保存中..." : "保存"}
                </button>
                {camMsg && <span style={{ fontSize: 12, color: "#4caf50" }}>{camMsg}</span>}
              </div>
            </div>

            {/* カメラビューアへのリンク */}
            <div style={sectionStyle}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>📺 カメラビューア</h3>
              <p style={{ fontSize: 12, color: T.textSub, marginBottom: 12 }}>
                ミニPCのgo2rtcとCloudflare Tunnelの設定が完了すると、ブラウザから映像を視聴できます。
              </p>
              <button onClick={() => router.push("/camera")} style={{ ...btnStyle, background: "linear-gradient(135deg, #2196f3, #1976d2)" }}>
                📺 カメラビューアを開く
              </button>
            </div>
          </div>
        )}

        {/* ── スマートロック設定 ── */}
        {tab === "lock" && (
          <div>
            <div style={sectionStyle}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🔐 SwitchBot スマートロック設定</h3>
              <p style={{ fontSize: 11, color: T.textSub, marginBottom: 16 }}>
                SwitchBotアプリの「開発者向けオプション」からAPIトークンとシークレットを取得してください。
              </p>

              <div style={{ padding: 12, borderRadius: 8, backgroundColor: dark ? "#1a1a2e" : "#f8f6f0", marginBottom: 16, fontSize: 12, color: T.textSub }}>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>🔑 APIトークンの取得方法</p>
                <p>① SwitchBotアプリ →「プロフィール」→「設定」</p>
                <p>② 「アプリバージョン」を5〜15回連続タップ</p>
                <p>③ 「開発者向けオプション」が表示される</p>
                <p>④ トークンとクライアントシークレットをコピー</p>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>APIトークン</label>
                <input style={inputStyle} value={sbToken} onChange={e => setSbToken(e.target.value)} placeholder="SwitchBot APIトークン" />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>クライアントシークレット</label>
                <input style={inputStyle} type="password" value={sbSecret} onChange={e => setSbSecret(e.target.value)} placeholder="クライアントシークレット" />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>ロック デバイスID</label>
                <input style={inputStyle} value={sbLockId} onChange={e => setSbLockId(e.target.value)} placeholder="SwitchBotアプリのデバイス情報から取得" />
                <p style={{ fontSize: 10, color: T.textSub, marginTop: 4 }}>※ スマートロックの設定 → デバイス情報 → BLE MAC（コロンを除外）</p>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>ロック名（任意）</label>
                <input style={inputStyle} value={sbLockName} onChange={e => setSbLockName(e.target.value)} placeholder="例: 店舗玄関" />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={saveSb} disabled={sbSaving} style={btnStyle}>
                  {sbSaving ? "保存中..." : "保存"}
                </button>
                {sbMsg && <span style={{ fontSize: 12, color: "#4caf50" }}>{sbMsg}</span>}
              </div>
            </div>

            {/* ロック操作テスト */}
            <div style={sectionStyle}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>🧪 ロック操作テスト</h3>
              <p style={{ fontSize: 12, color: T.textSub, marginBottom: 12 }}>
                APIトークンとデバイスIDを設定後、こちらで動作確認できます。
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...btnStyle, background: "linear-gradient(135deg, #4caf50, #388e3c)" }} disabled={!sbToken || !sbLockId}>
                  🔓 解錠テスト
                </button>
                <button style={{ ...btnStyle, background: "linear-gradient(135deg, #f44336, #d32f2f)" }} disabled={!sbToken || !sbLockId}>
                  🔒 施錠テスト
                </button>
              </div>
              {(!sbToken || !sbLockId) && (
                <p style={{ fontSize: 11, color: "#ff9800", marginTop: 8 }}>⚠️ APIトークンとデバイスIDを先に設定してください</p>
              )}
            </div>
          </div>
        )}

        {/* ── ミニPC / go2rtc ── */}
        {tab === "minipc" && (
          <div>
            <div style={sectionStyle}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🖥️ ミニPC / go2rtc 設定</h3>
              <p style={{ fontSize: 11, color: T.textSub, marginBottom: 16 }}>
                店舗に設置するミニPCのgo2rtcとCloudflare Tunnel情報を入力してください。
              </p>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>go2rtc 管理画面URL（ローカル）</label>
                <input style={inputStyle} value={go2rtcUrl} onChange={e => setGo2rtcUrl(e.target.value)} placeholder="例: http://192.168.1.200:1984" />
                <p style={{ fontSize: 10, color: T.textSub, marginTop: 4 }}>※ ミニPCのIPアドレス + go2rtcのポート（デフォルト1984）</p>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Cloudflare Tunnel URL（外部公開用）</label>
                <input style={inputStyle} value={cfTunnelUrl} onChange={e => setCfTunnelUrl(e.target.value)} placeholder="例: https://camera.yourdomain.com" />
                <p style={{ fontSize: 10, color: T.textSub, marginTop: 4 }}>※ Cloudflare Tunnelで設定した公開URL。このURLでブラウザから映像を視聴します。</p>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>メモ</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={minipcNote} onChange={e => setMinipcNote(e.target.value)} placeholder="ミニPCの機種名、設置場所など" />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={saveMinipc} disabled={minipcSaving} style={btnStyle}>
                  {minipcSaving ? "保存中..." : "保存"}
                </button>
                {minipcMsg && <span style={{ fontSize: 12, color: "#4caf50" }}>{minipcMsg}</span>}
              </div>
            </div>

            {/* go2rtc設定ファイル例 */}
            <div style={sectionStyle}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>📝 go2rtc.yaml 設定例</h3>
              <p style={{ fontSize: 11, color: T.textSub, marginBottom: 8 }}>ミニPCに保存するgo2rtcの設定ファイルです。コピーして使ってください。</p>
              <div style={{ padding: 12, borderRadius: 8, backgroundColor: dark ? "#0d0d1a" : "#1a1a2e", color: "#c3a782", fontSize: 11, fontFamily: "monospace", whiteSpace: "pre-wrap", position: "relative" }}>
                <button onClick={() => {
                  const yaml = `streams:\n  shop_camera:\n    - rtsp://${camUser || "admin"}:${camPass || "password"}@${camIp || "192.168.1.100"}:554/live0\n\napi:\n  listen: ":1984"\n  origin: "*"\n\nwebrtc:\n  listen: ":8555"`;
                  navigator.clipboard.writeText(yaml);
                }} style={{ position: "absolute", top: 8, right: 8, background: "rgba(195,167,130,0.2)", border: "none", color: "#c3a782", borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: 10 }}>
                  コピー
                </button>
{`streams:
  shop_camera:
    - rtsp://${camUser || "admin"}:${camPass || "****"}@${camIp || "192.168.1.100"}:554/live0

api:
  listen: ":1984"
  origin: "*"

webrtc:
  listen: ":8555"`}
              </div>
            </div>
          </div>
        )}

        {/* ── Google Drive ── */}
        {tab === "gdrive" && (
          <div>
            <div style={sectionStyle}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📁 Google Drive 録画設定</h3>
              <p style={{ fontSize: 11, color: T.textSub, marginBottom: 16 }}>
                go2rtcの録画データをGoogle Driveに自動保存する設定です。ミニPCにGoogle Driveデスクトップアプリをインストールして同期します。
              </p>

              <div style={{ padding: 12, borderRadius: 8, backgroundColor: dark ? "#1a1a2e" : "#f8f6f0", marginBottom: 16, fontSize: 12, color: T.textSub }}>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>💡 録画→Google Drive保存の仕組み</p>
                <p>① go2rtcが録画データをミニPCのフォルダに保存</p>
                <p>② Google Driveデスクトップアプリがそのフォルダを自動同期</p>
                <p>③ Google Drive上で録画データがいつでも閲覧可能</p>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Google Drive 共有フォルダURL</label>
                <input style={inputStyle} value={gdriveFolder} onChange={e => setGdriveFolder(e.target.value)} placeholder="https://drive.google.com/drive/folders/xxxxx" />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>ミニPC側の録画保存パス</label>
                <input style={inputStyle} value={gdriveRecordPath} onChange={e => setGdriveRecordPath(e.target.value)} placeholder="例: G:\マイドライブ\カメラ録画" />
                <p style={{ fontSize: 10, color: T.textSub, marginTop: 4 }}>※ Google Driveデスクトップアプリの同期フォルダ内に作成</p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={saveGdrive} disabled={gdriveSaving} style={btnStyle}>
                  {gdriveSaving ? "保存中..." : "保存"}
                </button>
                {gdriveFolder && (
                  <a href={gdriveFolder} target="_blank" rel="noopener noreferrer" style={{ ...btnStyle, background: "linear-gradient(135deg, #4285f4, #1a73e8)", textDecoration: "none", display: "inline-block" }}>
                    📂 Google Driveを開く
                  </a>
                )}
                {gdriveMsg && <span style={{ fontSize: 12, color: "#4caf50" }}>{gdriveMsg}</span>}
              </div>
            </div>
          </div>
        )}

        {/* ── セットアップガイド ── */}
        {tab === "guide" && (
          <div>
            {/* ステップ概要 */}
            <div style={sectionStyle}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📖 セットアップガイド</h3>
              <p style={{ fontSize: 11, color: T.textSub, marginBottom: 16 }}>上から順に進めてください。完了したステップをタップするとチェックが入ります。</p>

              {[
                { step: 1, icon: "🛒", title: "機器の購入", desc: "SwitchBot Pan/Tilt Cam Plus 2K、スマートロック+指紋認証パッド、ハブ2、ミニPC（Intel N100クラス）を購入" },
                { step: 2, icon: "📱", title: "SwitchBotアプリ設定", desc: "ハブ2のWiFi接続 → カメラ登録 → スマートロック登録 → 指紋認証パッド設定" },
                { step: 3, icon: "🔑", title: "カメラアカウント作成", desc: "SwitchBotアプリ → カメラ設定 → 詳細設定 → カメラアカウント → ユーザー名とパスワードを作成（RTSP用）" },
                { step: 4, icon: "🔐", title: "SwitchBot APIトークン取得", desc: "SwitchBotアプリ → プロフィール → 設定 → アプリバージョンを15回タップ → 開発者向けオプション → トークンとシークレットをコピー" },
                { step: 5, icon: "🖥️", title: "ミニPCにgo2rtcインストール", desc: "go2rtcをGitHubからダウンロード → go2rtc.yaml設定ファイルを作成（上のタブの設定例を使用）→ 起動確認" },
                { step: 6, icon: "☁️", title: "Cloudflare Tunnel設定", desc: "Cloudflareアカウント作成（無料）→ Zero Trust → Tunnels → トンネル作成 → ミニPCにcloudflaredをインストール → go2rtcのポートを公開" },
                { step: 7, icon: "📁", title: "Google Driveデスクトップアプリ", desc: "ミニPCにGoogle Driveデスクトップアプリをインストール → 録画フォルダをDrive内に作成 → go2rtcの録画先をそのフォルダに設定" },
                { step: 8, icon: "⚙️", title: "T-MANAGE設定入力", desc: "このページの各タブにカメラ情報、APIトークン、Tunnel URLなどを入力して保存" },
                { step: 9, icon: "🏪", title: "店舗に設置", desc: "ミニPCを店舗のWiFiに接続してコンセントに挿す → カメラ・ロックが正常に動作するか確認" },
                { step: 10, icon: "✅", title: "動作確認", desc: "T-MANAGEのカメラビューアで映像確認 → スマートロックの解錠/施錠テスト → 録画の開始とGoogle Driveへの同期確認" },
              ].map(({ step, icon, title, desc }) => (
                <div key={step} onClick={() => setGuideStep(prev => prev === step ? 0 : step)} style={{
                  display: "flex", gap: 12, padding: "12px", borderRadius: 8, marginBottom: 6, cursor: "pointer",
                  backgroundColor: guideStep >= step ? (dark ? "rgba(76,175,80,0.1)" : "rgba(76,175,80,0.05)") : "transparent",
                  border: `1px solid ${guideStep >= step ? "rgba(76,175,80,0.3)" : T.border}`,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                    backgroundColor: guideStep >= step ? "#4caf50" : (dark ? "#2a2a3e" : "#e0e0e0"),
                    color: guideStep >= step ? "#fff" : T.textSub,
                  }}>
                    {guideStep >= step ? "✓" : step}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{icon} {title}</p>
                    <p style={{ fontSize: 11, color: T.textSub, lineHeight: 1.5 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 必要機器一覧 */}
            <div style={sectionStyle}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🛒 購入リスト</h3>
              {[
                { name: "SwitchBot Pan/Tilt Cam Plus 2K", price: "約5,000円", note: "RTSP対応の「Plus」モデルを選ぶこと" },
                { name: "SwitchBot スマートロック + 指紋認証パッド", price: "約19,000円", note: "セットがお得" },
                { name: "SwitchBot ハブ2", price: "約5,500円", note: "全デバイスのWiFi中継に必須" },
                { name: "ミニPC（Intel N100 / 8GB / 128GB）", price: "約15,000〜25,000円", note: "GMKtec / MINISFORUM / GEEKOM推奨" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < 3 ? `1px solid ${T.border}` : "none" }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</p>
                    <p style={{ fontSize: 10, color: T.textSub }}>{item.note}</p>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#c3a782", whiteSpace: "nowrap", marginLeft: 8 }}>{item.price}</span>
                </div>
              ))}
              <div style={{ marginTop: 12, padding: "10px", borderRadius: 8, backgroundColor: dark ? "#1a1a2e" : "#f8f6f0", textAlign: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#c3a782" }}>合計: 約44,500〜54,500円</span>
                <p style={{ fontSize: 10, color: T.textSub, marginTop: 4 }}>ランニングコスト: 月額約200〜300円（電気代のみ）</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";

type Store = { id: number; name: string };
type Building = { id: number; store_id: number; name: string };
type Room = { id: number; store_id: number; building_id: number; name: string; key_number?: string };
type ParkingSpot = { id: number; store_id: number; building_id: number; number: string; type: string };

export default function RoomManagement() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const [stores, setStores] = useState<Store[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>([]);

  const [newStoreName, setNewStoreName] = useState("");
  const [newBuildingName, setNewBuildingName] = useState("");
  const [newBuildingStoreId, setNewBuildingStoreId] = useState<number>(0);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomBuildingId, setNewRoomBuildingId] = useState<number>(0);
  const [newRoomKeyNumber, setNewRoomKeyNumber] = useState("");
  const [newParkingNumber, setNewParkingNumber] = useState("");
  const [newParkingBuildingId, setNewParkingBuildingId] = useState<number>(0);
  const [newParkingType, setNewParkingType] = useState<string>("therapist");

  const [editStore, setEditStore] = useState<Store | null>(null);
  const [editStoreName, setEditStoreName] = useState("");
  const [editBuilding, setEditBuilding] = useState<Building | null>(null);
  const [editBuildingName, setEditBuildingName] = useState("");
  const [editRoom, setEditRoom] = useState<Room | null>(null);
  const [editRoomName, setEditRoomName] = useState("");
  const [editRoomKeyNumber, setEditRoomKeyNumber] = useState("");

  const fetchData = useCallback(async () => {
    const { data: s } = await supabase.from("stores").select("*").order("id"); if (s) setStores(s);
    const { data: b } = await supabase.from("buildings").select("*").order("id"); if (b) setBuildings(b);
    const { data: r } = await supabase.from("rooms").select("*").order("id"); if (r) setRooms(r);
    const { data: p } = await supabase.from("parking_spots").select("*").order("id"); if (p) setParkingSpots(p);
  }, []);

  useEffect(() => { const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); }; check(); fetchData(); }, [router, fetchData]);

  const addStore = async () => { if (!newStoreName.trim()) return; await supabase.from("stores").insert({ name: newStoreName.trim() }); setNewStoreName(""); fetchData(); };
  const updateStore = async () => { if (!editStore || !editStoreName.trim()) return; await supabase.from("stores").update({ name: editStoreName.trim() }).eq("id", editStore.id); setEditStore(null); fetchData(); };
  const deleteStore = async (id: number) => { if (!confirm("このルームを削除しますか？関連する建物・部屋・駐車場も削除されます。")) return; const bIds = buildings.filter((b) => b.store_id === id).map((b) => b.id); if (bIds.length > 0) { await supabase.from("rooms").delete().in("building_id", bIds); await supabase.from("parking_spots").delete().in("building_id", bIds); await supabase.from("buildings").delete().eq("store_id", id); } await supabase.from("stores").delete().eq("id", id); fetchData(); };

  const addBuilding = async () => { if (!newBuildingName.trim() || !newBuildingStoreId) return; await supabase.from("buildings").insert({ name: newBuildingName.trim(), store_id: newBuildingStoreId }); setNewBuildingName(""); fetchData(); };
  const updateBuilding = async () => { if (!editBuilding || !editBuildingName.trim()) return; await supabase.from("buildings").update({ name: editBuildingName.trim() }).eq("id", editBuilding.id); setEditBuilding(null); fetchData(); };
  const deleteBuilding = async (id: number) => { if (!confirm("この建物を削除しますか？関連する部屋・駐車場も削除されます。")) return; await supabase.from("rooms").delete().eq("building_id", id); await supabase.from("parking_spots").delete().eq("building_id", id); await supabase.from("buildings").delete().eq("id", id); fetchData(); };

  const addRoom = async () => { if (!newRoomName.trim() || !newRoomBuildingId) return; const bld = buildings.find((b) => b.id === newRoomBuildingId); await supabase.from("rooms").insert({ name: newRoomName.trim(), building_id: newRoomBuildingId, store_id: bld?.store_id || 0, key_number: newRoomKeyNumber.trim() }); setNewRoomName(""); setNewRoomKeyNumber(""); fetchData(); };
  const updateRoom = async () => { if (!editRoom || !editRoomName.trim()) return; await supabase.from("rooms").update({ name: editRoomName.trim(), key_number: editRoomKeyNumber.trim() }).eq("id", editRoom.id); setEditRoom(null); fetchData(); };
  const deleteRoom = async (id: number) => { if (!confirm("この部屋を削除しますか？")) return; await supabase.from("rooms").delete().eq("id", id); fetchData(); };

  const addParking = async () => { if (!newParkingNumber.trim() || !newParkingBuildingId) return; const bld = buildings.find((b) => b.id === newParkingBuildingId); await supabase.from("parking_spots").insert({ number: newParkingNumber.trim(), store_id: bld?.store_id || 0, building_id: newParkingBuildingId, type: newParkingType }); setNewParkingNumber(""); fetchData(); };
  const deleteParking = async (id: number) => { if (!confirm("この駐車場を削除しますか？")) return; await supabase.from("parking_spots").delete().eq("id", id); fetchData(); };

  const colors = ["#c3a782", "#7ab88f", "#85a8c4", "#c49885", "#a885c4"];
  const inputStyle = { backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" };

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* Header */}
      <div className="h-[64px] backdrop-blur-xl border-b flex items-center justify-between px-6 flex-shrink-0" style={{ backgroundColor: dark ? T.card + "cc" : "rgba(255,255,255,0.8)", borderColor: T.border }}>
        <div className="flex items-center gap-4">
          <NavMenu T={T} dark={dark} />
          <button onClick={() => router.push("/dashboard")} className="p-2 rounded-lg cursor-pointer" style={{ color: T.textSub }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
          <div>
            <h1 className="text-[15px] font-medium">利用場所登録</h1>
            <p className="text-[11px]" style={{ color: T.textMuted }}>ルーム・建物・部屋・駐車場の管理</p>
          </div>
        </div>
        <button onClick={toggle} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6 animate-[fadeIn_0.4s]">

          {/* Store */}
          <div className="rounded-2xl border p-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#c3a78218" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c3a782" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
              </div>
              <div><h2 className="text-[15px] font-medium">ルーム</h2><p className="text-[11px]" style={{ color: T.textFaint }}>三河安城ルーム、豊橋ルームなど</p></div>
            </div>
            <div className="flex gap-3 mt-4 mb-4">
              <input type="text" value={newStoreName} onChange={(e) => setNewStoreName(e.target.value)} placeholder="ルーム名（例：三河安城ルーム）" className="flex-1 px-4 py-3 rounded-xl text-[13px] outline-none transition-all" style={inputStyle} onKeyDown={(e) => e.key === "Enter" && addStore()} />
              <button onClick={addStore} className="px-5 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">追加</button>
            </div>
            {stores.length === 0 ? <p className="text-[12px] text-center py-4" style={{ color: T.textFaint }}>ルームが登録されていません</p> : (
              <div className="space-y-2">{stores.map((s, si) => (
                <div key={s.id} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ backgroundColor: colors[si % colors.length] + "12" }}>
                  <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[si % colors.length] }} /><span className="text-[13px] font-medium">{s.name}</span><span className="text-[10px]" style={{ color: T.textMuted }}>（建物 {buildings.filter((b) => b.store_id === s.id).length}件）</span></div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditStore(s); setEditStoreName(s.name); }} className="px-3 py-1 text-[10px] rounded-lg cursor-pointer" style={{ color: "#3d6b9f", backgroundColor: "#3d6b9f18" }}>編集</button>
                    <button onClick={() => deleteStore(s.id)} className="px-3 py-1 text-[10px] rounded-lg cursor-pointer" style={{ color: "#c45555", backgroundColor: "#c4555518" }}>削除</button>
                  </div>
                </div>
              ))}</div>
            )}
          </div>

          {/* Building */}
          <div className="rounded-2xl border p-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#7ab88f18" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7ab88f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><path d="M9 18h6"/></svg>
              </div>
              <div><h2 className="text-[15px] font-medium">建物</h2><p className="text-[11px]" style={{ color: T.textFaint }}>オアシス、マイコート、リングセレクトなど</p></div>
            </div>
            <div className="flex gap-3 mt-4 mb-4">
              <select value={newBuildingStoreId} onChange={(e) => setNewBuildingStoreId(Number(e.target.value))} className="px-4 py-3 rounded-xl text-[13px] outline-none cursor-pointer min-w-[160px]" style={inputStyle}><option value={0}>ルームを選択</option>{stores.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}</select>
              <input type="text" value={newBuildingName} onChange={(e) => setNewBuildingName(e.target.value)} placeholder="建物名（例：オアシス）" className="flex-1 px-4 py-3 rounded-xl text-[13px] outline-none transition-all" style={inputStyle} onKeyDown={(e) => e.key === "Enter" && addBuilding()} />
              <button onClick={addBuilding} className="px-5 py-3 bg-gradient-to-r from-[#7ab88f] to-[#5a9e6f] text-white text-[12px] rounded-xl cursor-pointer">追加</button>
            </div>
            {stores.map((s, si) => { const sb = buildings.filter((b) => b.store_id === s.id); if (sb.length === 0) return null; return (
              <div key={s.id} className="mb-4"><p className="text-[11px] mb-2 flex items-center gap-2" style={{ color: T.textMuted }}><span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[si % colors.length] }} />{s.name}</p>
                <div className="space-y-2 ml-4">{sb.map((b) => (
                  <div key={b.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                    <div className="flex items-center gap-2"><span className="text-[13px] font-medium">{b.name}</span><span className="text-[10px]" style={{ color: T.textMuted }}>（{rooms.filter((r) => r.building_id === b.id).length}部屋）</span></div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setEditBuilding(b); setEditBuildingName(b.name); }} className="px-3 py-1 text-[10px] rounded-lg cursor-pointer" style={{ color: "#3d6b9f", backgroundColor: "#3d6b9f18" }}>編集</button>
                      <button onClick={() => deleteBuilding(b.id)} className="px-3 py-1 text-[10px] rounded-lg cursor-pointer" style={{ color: "#c45555", backgroundColor: "#c4555518" }}>削除</button>
                    </div>
                  </div>
                ))}</div>
              </div>
            ); })}
            {buildings.length === 0 && <p className="text-[12px] text-center py-4" style={{ color: T.textFaint }}>建物が登録されていません</p>}
          </div>

          {/* Room */}
          <div className="rounded-2xl border p-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#85a8c418" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#85a8c4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              </div>
              <div><h2 className="text-[15px] font-medium">部屋</h2><p className="text-[11px]" style={{ color: T.textFaint }}>201号室、703号室など</p></div>
            </div>
            <div className="flex gap-3 mt-4 mb-4">
              <select value={newRoomBuildingId} onChange={(e) => setNewRoomBuildingId(Number(e.target.value))} className="px-4 py-3 rounded-xl text-[13px] outline-none cursor-pointer min-w-[200px]" style={inputStyle}><option value={0}>建物を選択</option>{stores.map((s) => buildings.filter((b) => b.store_id === s.id).map((b) => (<option key={b.id} value={b.id}>{s.name} / {b.name}</option>)))}</select>
              <input type="text" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="部屋名（例：201号室）" className="flex-1 px-4 py-3 rounded-xl text-[13px] outline-none transition-all" style={inputStyle} onKeyDown={(e) => e.key === "Enter" && addRoom()} />
              <input type="text" value={newRoomKeyNumber} onChange={(e) => setNewRoomKeyNumber(e.target.value)} placeholder="🔑 鍵番号（任意）" className="w-36 px-4 py-3 rounded-xl text-[13px] outline-none transition-all" style={inputStyle} onKeyDown={(e) => e.key === "Enter" && addRoom()} />
              <button onClick={addRoom} className="px-5 py-3 bg-gradient-to-r from-[#85a8c4] to-[#6890b0] text-white text-[12px] rounded-xl cursor-pointer">追加</button>
            </div>
            {stores.map((s, si) => { const sb = buildings.filter((b) => b.store_id === s.id); const has = sb.some((b) => rooms.some((r) => r.building_id === b.id)); if (!has) return null; return (
              <div key={s.id} className="mb-5"><p className="text-[12px] font-medium mb-2 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[si % colors.length] }} />{s.name}</p>
                {sb.map((b) => { const br = rooms.filter((r) => r.building_id === b.id); if (br.length === 0) return null; return (
                  <div key={b.id} className="ml-4 mb-3"><p className="text-[11px] font-medium mb-1.5" style={{ color: T.textSub }}>{b.name}</p>
                    <div className="flex flex-wrap gap-2 ml-2">{br.map((r) => (
                      <div key={r.id} className="flex items-center gap-1.5 px-3 py-2 rounded-xl group transition-colors" style={{ backgroundColor: T.cardAlt }}>
                        <span className="text-[12px]">{r.name}</span>
                        {r.key_number && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#c3a78218", color: "#c3a782" }}>🔑 {r.key_number}</span>}
                        <button onClick={() => { setEditRoom(r); setEditRoomName(r.name); setEditRoomKeyNumber(r.key_number || ""); }} className="w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#3d6b9f" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                        <button onClick={() => deleteRoom(r.id)} className="w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#c45555" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                      </div>
                    ))}</div>
                  </div>
                ); })}
              </div>
            ); })}
            {rooms.length === 0 && <p className="text-[12px] text-center py-4" style={{ color: T.textFaint }}>部屋が登録されていません</p>}
          </div>

          {/* Parking */}
          <div className="rounded-2xl border p-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#c4988518" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c49885" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><text x="12" y="16" textAnchor="middle" fill="#c49885" fontSize="12" fontWeight="bold" stroke="none">P</text></svg>
              </div>
              <div><h2 className="text-[15px] font-medium">駐車場</h2><p className="text-[11px]" style={{ color: T.textFaint }}>建物ごとにセラピスト用・お客様用を登録</p></div>
            </div>
            <div className="flex gap-3 mt-4 mb-4">
              <select value={newParkingBuildingId} onChange={(e) => setNewParkingBuildingId(Number(e.target.value))} className="px-4 py-3 rounded-xl text-[13px] outline-none cursor-pointer min-w-[200px]" style={inputStyle}><option value={0}>建物を選択</option>{stores.map((s) => buildings.filter((b) => b.store_id === s.id).map((b) => (<option key={b.id} value={b.id}>{s.name} / {b.name}</option>)))}</select>
              <select value={newParkingType} onChange={(e) => setNewParkingType(e.target.value)} className="px-4 py-3 rounded-xl text-[13px] outline-none cursor-pointer min-w-[140px]" style={inputStyle}><option value="therapist">セラピスト用</option><option value="customer">お客様用</option></select>
              <input type="text" value={newParkingNumber} onChange={(e) => setNewParkingNumber(e.target.value)} placeholder="番号（例：P1）" className="flex-1 px-4 py-3 rounded-xl text-[13px] outline-none transition-all" style={inputStyle} onKeyDown={(e) => e.key === "Enter" && addParking()} />
              <button onClick={addParking} className="px-5 py-3 bg-gradient-to-r from-[#c49885] to-[#b08472] text-white text-[12px] rounded-xl cursor-pointer">追加</button>
            </div>
            {stores.map((s, si) => { const sb = buildings.filter((b) => b.store_id === s.id); const has = sb.some((b) => parkingSpots.some((p) => p.building_id === b.id)); if (!has) return null; return (
              <div key={s.id} className="mb-5"><p className="text-[12px] font-medium mb-2 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[si % colors.length] }} />{s.name}</p>
                {sb.map((b) => { const tp = parkingSpots.filter((p) => p.building_id === b.id && p.type === "therapist"); const cp = parkingSpots.filter((p) => p.building_id === b.id && p.type === "customer"); if (tp.length === 0 && cp.length === 0) return null; return (
                  <div key={b.id} className="ml-4 mb-3"><p className="text-[11px] font-medium mb-1.5" style={{ color: T.textSub }}>{b.name}</p>
                    {tp.length > 0 && (<div className="ml-2 mb-2"><p className="text-[10px] mb-1" style={{ color: "#7ab88f" }}>セラピスト用</p><div className="flex flex-wrap gap-2">{tp.map((p) => (<div key={p.id} className="flex items-center gap-1.5 px-3 py-2 rounded-xl group transition-colors" style={{ backgroundColor: "#4a7c5918" }}><span className="text-[12px] font-medium" style={{ color: "#4a7c59" }}>{p.number}</span><button onClick={() => deleteParking(p.id)} className="w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#c45555" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>))}</div></div>)}
                    {cp.length > 0 && (<div className="ml-2 mb-2"><p className="text-[10px] mb-1" style={{ color: "#3d6b9f" }}>お客様用</p><div className="flex flex-wrap gap-2">{cp.map((p) => (<div key={p.id} className="flex items-center gap-1.5 px-3 py-2 rounded-xl group transition-colors" style={{ backgroundColor: "#3d6b9f18" }}><span className="text-[12px] font-medium" style={{ color: "#3d6b9f" }}>{p.number}</span><button onClick={() => deleteParking(p.id)} className="w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#c45555" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>))}</div></div>)}
                  </div>
                ); })}
              </div>
            ); })}
            {parkingSpots.length === 0 && <p className="text-[12px] text-center py-4" style={{ color: T.textFaint }}>駐車場が登録されていません</p>}
          </div>

          {/* Summary */}
          {stores.length > 0 && (buildings.length > 0 || parkingSpots.length > 0) && (
            <div className="rounded-2xl border p-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <h2 className="text-[15px] font-medium mb-4">全体構成</h2>
              {stores.map((s, si) => (
                <div key={s.id} className="mb-4">
                  <div className="flex items-center gap-2 mb-2"><div className="w-4 h-4 rounded" style={{ backgroundColor: colors[si % colors.length] + "30" }} /><span className="text-[13px] font-medium">{s.name}</span></div>
                  {buildings.filter((b) => b.store_id === s.id).map((b) => (
                    <div key={b.id} className="ml-6 mb-2">
                      <div className="flex items-center gap-2 mb-1"><div className="w-1 h-4 rounded-full" style={{ backgroundColor: colors[si % colors.length] }} /><span className="text-[12px] font-medium" style={{ color: T.textSub }}>{b.name}</span></div>
                      <div className="flex flex-wrap gap-1.5 ml-3 mb-1">{rooms.filter((r) => r.building_id === b.id).map((r) => (<span key={r.id} className="px-2.5 py-1 rounded-lg text-[11px]" style={{ backgroundColor: T.cardAlt, color: T.textSub }}>{r.name}</span>))}</div>
                      {parkingSpots.filter((p) => p.building_id === b.id).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 ml-3">
                          {parkingSpots.filter((p) => p.building_id === b.id && p.type === "therapist").map((p) => (<span key={p.id} className="px-2.5 py-1 rounded-lg text-[10px]" style={{ backgroundColor: "#4a7c5918", color: "#4a7c59" }}>{p.number}(セラピスト)</span>))}
                          {parkingSpots.filter((p) => p.building_id === b.id && p.type === "customer").map((p) => (<span key={p.id} className="px-2.5 py-1 rounded-lg text-[10px]" style={{ backgroundColor: "#3d6b9f18", color: "#3d6b9f" }}>{p.number}(お客様)</span>))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modals */}
      {editStore && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditStore(null)}>
          <div className="rounded-2xl border p-8 w-full max-w-sm animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium mb-4">ルーム名を変更</h2>
            <input type="text" value={editStoreName} onChange={(e) => setEditStoreName(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none mb-4" style={inputStyle} />
            <div className="flex gap-3"><button onClick={updateStore} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">更新</button><button onClick={() => setEditStore(null)} className="px-7 py-3 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button></div>
          </div>
        </div>
      )}
      {editBuilding && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditBuilding(null)}>
          <div className="rounded-2xl border p-8 w-full max-w-sm animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium mb-4">建物名を変更</h2>
            <input type="text" value={editBuildingName} onChange={(e) => setEditBuildingName(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none mb-4" style={inputStyle} />
            <div className="flex gap-3"><button onClick={updateBuilding} className="px-7 py-3 bg-gradient-to-r from-[#7ab88f] to-[#5a9e6f] text-white text-[12px] rounded-xl cursor-pointer">更新</button><button onClick={() => setEditBuilding(null)} className="px-7 py-3 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button></div>
          </div>
        </div>
      )}
      {editRoom && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditRoom(null)}>
          <div className="rounded-2xl border p-8 w-full max-w-sm animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium mb-4">部屋情報を変更</h2>
            <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>部屋名</label>
            <input type="text" value={editRoomName} onChange={(e) => setEditRoomName(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none mb-3" style={inputStyle} />
            <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>🔑 鍵番号（任意）</label>
            <input type="text" value={editRoomKeyNumber} onChange={(e) => setEditRoomKeyNumber(e.target.value)} placeholder="例: A-12" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none mb-4" style={inputStyle} />
            <div className="flex gap-3"><button onClick={updateRoom} className="px-7 py-3 bg-gradient-to-r from-[#85a8c4] to-[#6890b0] text-white text-[12px] rounded-xl cursor-pointer">更新</button><button onClick={() => setEditRoom(null)} className="px-7 py-3 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button></div>
          </div>
        </div>
      )}

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

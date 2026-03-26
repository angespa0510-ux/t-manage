"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

type Store = { id: number; name: string };
type Room = { id: number; store_id: number; name: string };
type Therapist = { id: number; name: string };
type Reservation = {
  id: number; customer_name: string; therapist_id: number;
  date: string; start_time: string; end_time: string; course: string; room_id: number;
};

const HOURS = Array.from({ length: 15 }, (_, i) => i + 9);

export default function RoomManagement() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedStore, setSelectedStore] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [tab, setTab] = useState<"assign" | "settings">("assign");

  const [newStoreName, setNewStoreName] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomStoreId, setNewRoomStoreId] = useState<number>(0);

  const fetchData = useCallback(async () => {
    const { data: s } = await supabase.from("stores").select("*").order("id");
    if (s) { setStores(s); if (s.length > 0 && !selectedStore) setSelectedStore(s[0].id); }
    const { data: r } = await supabase.from("rooms").select("*").order("id");
    if (r) setRooms(r);
    const { data: t } = await supabase.from("therapists").select("*").order("id");
    if (t) setTherapists(t);
  }, [selectedStore]);

  const fetchReservations = useCallback(async () => {
    const { data: res } = await supabase.from("reservations").select("*").eq("date", selectedDate).order("start_time");
    if (res) setReservations(res);
  }, [selectedDate]);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push("/");
    };
    check();
    fetchData();
  }, [router, fetchData]);

  useEffect(() => { fetchReservations(); }, [fetchReservations]);

  const addStore = async () => {
    if (!newStoreName.trim()) return;
    await supabase.from("stores").insert({ name: newStoreName.trim() });
    setNewStoreName("");
    fetchData();
  };

  const deleteStore = async (id: number) => {
    if (!confirm("この店舗を削除しますか？関連する部屋も削除されます。")) return;
    await supabase.from("rooms").delete().eq("store_id", id);
    await supabase.from("stores").delete().eq("id", id);
    fetchData();
  };

  const addRoom = async () => {
    if (!newRoomName.trim() || !newRoomStoreId) return;
    await supabase.from("rooms").insert({ name: newRoomName.trim(), store_id: newRoomStoreId });
    setNewRoomName("");
    fetchData();
  };

  const deleteRoom = async (id: number) => {
    if (!confirm("この部屋を削除しますか？")) return;
    await supabase.from("rooms").delete().eq("id", id);
    fetchData();
  };

  const assignRoom = async (reservationId: number, roomId: number) => {
    await supabase.from("reservations").update({ room_id: roomId || null }).eq("id", reservationId);
    fetchReservations();
  };

  const storeRooms = rooms.filter((r) => r.store_id === selectedStore);
  const dateDisplay = (() => {
    const d = new Date(selectedDate + "T00:00:00");
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
  })();

  const prevDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toISOString().split("T")[0]); };
  const nextDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d.toISOString().split("T")[0]); };

  const colors = ["#c3a782", "#7ab88f", "#85a8c4", "#c49885", "#a885c4", "#85c4b8", "#c4a685", "#8599c4"];

  const getResForRoomCell = (roomId: number, hour: number) => {
    return reservations.filter((r) => {
      const startH = parseInt(r.start_time.split(":")[0]);
      const endH = parseInt(r.end_time.split(":")[0]);
      return r.room_id === roomId && hour >= startH && hour < endH;
    });
  };

  const isStartHourForRoom = (r: Reservation, hour: number) => parseInt(r.start_time.split(":")[0]) === hour;
  const getResSpan = (r: Reservation) => parseInt(r.end_time.split(":")[0]) - parseInt(r.start_time.split(":")[0]);

  const getTherapistName = (id: number) => therapists.find((t) => t.id === id)?.name || "不明";

  return (
    <div className="h-screen flex flex-col bg-[#f8f6f3]">
      {/* Header */}
      <div className="h-[64px] bg-white/80 backdrop-blur-xl border-b border-[#e8e4df] flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="p-2 rounded-lg hover:bg-[#f8f6f3] transition-colors cursor-pointer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9c9a92" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-[15px] font-medium text-[#2c2c2a]">部屋割り管理</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTab("assign")} className={`px-4 py-2 text-[11px] rounded-xl transition-all cursor-pointer ${tab === "assign" ? "bg-[#c3a782] text-white" : "border border-[#e8e4df] text-[#888780] hover:bg-[#f8f6f3]"}`}>部屋割り表</button>
          <button onClick={() => setTab("settings")} className={`px-4 py-2 text-[11px] rounded-xl transition-all cursor-pointer ${tab === "settings" ? "bg-[#c3a782] text-white" : "border border-[#e8e4df] text-[#888780] hover:bg-[#f8f6f3]"}`}>店舗・部屋設定</button>
        </div>
      </div>

      {tab === "settings" && (
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl mx-auto space-y-8 animate-[fadeIn_0.4s_ease-out]">
            {/* Stores */}
            <div className="bg-white rounded-2xl border border-[#f0ece4] p-6">
              <h2 className="text-[15px] font-medium text-[#2c2c2a] mb-1">店舗管理</h2>
              <p className="text-[11px] text-[#d3d1c7] mb-6">店舗の追加・削除</p>
              <div className="flex gap-3 mb-6">
                <input type="text" value={newStoreName} onChange={(e) => setNewStoreName(e.target.value)} placeholder="店舗名（例：三河安城ルーム）"
                  className="flex-1 px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]"
                  onKeyDown={(e) => e.key === "Enter" && addStore()} />
                <button onClick={addStore} className="px-5 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer hover:shadow-[0_4px_16px_rgba(195,167,130,0.25)] transition-all">追加</button>
              </div>
              {stores.length === 0 ? (
                <p className="text-[12px] text-[#d3d1c7] text-center py-8">店舗が登録されていません</p>
              ) : (
                <div className="space-y-2">
                  {stores.map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-4 py-3 bg-[#f8f6f3] rounded-xl">
                      <span className="text-[13px] text-[#2c2c2a]">{s.name}</span>
                      <button onClick={() => deleteStore(s.id)} className="text-[11px] text-[#c45555] hover:text-[#a33] cursor-pointer">削除</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rooms */}
            <div className="bg-white rounded-2xl border border-[#f0ece4] p-6">
              <h2 className="text-[15px] font-medium text-[#2c2c2a] mb-1">部屋管理</h2>
              <p className="text-[11px] text-[#d3d1c7] mb-6">各店舗の部屋を追加・削除</p>
              <div className="flex gap-3 mb-6">
                <select value={newRoomStoreId} onChange={(e) => setNewRoomStoreId(Number(e.target.value))}
                  className="px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer">
                  <option value={0}>店舗を選択</option>
                  {stores.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
                <input type="text" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="部屋名（例：Room A）"
                  className="flex-1 px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]"
                  onKeyDown={(e) => e.key === "Enter" && addRoom()} />
                <button onClick={addRoom} className="px-5 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer hover:shadow-[0_4px_16px_rgba(195,167,130,0.25)] transition-all">追加</button>
              </div>
              {stores.map((s) => {
                const sRooms = rooms.filter((r) => r.store_id === s.id);
                if (sRooms.length === 0) return null;
                return (
                  <div key={s.id} className="mb-4">
                    <p className="text-[11px] text-[#b4b2a9] mb-2 tracking-wide">{s.name}</p>
                    <div className="space-y-2">
                      {sRooms.map((r) => (
                        <div key={r.id} className="flex items-center justify-between px-4 py-2.5 bg-[#f8f6f3] rounded-xl">
                          <span className="text-[13px] text-[#2c2c2a]">{r.name}</span>
                          <button onClick={() => deleteRoom(r.id)} className="text-[11px] text-[#c45555] hover:text-[#a33] cursor-pointer">削除</button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {rooms.length === 0 && <p className="text-[12px] text-[#d3d1c7] text-center py-8">部屋が登録されていません。まず店舗を追加してください。</p>}
            </div>
          </div>
        </div>
      )}

      {tab === "assign" && (
        <>
          {/* Date & Store Nav */}
          <div className="h-[52px] bg-white border-b border-[#e8e4df] flex items-center justify-center gap-4 flex-shrink-0 px-6">
            <button onClick={prevDay} className="p-1.5 rounded-lg hover:bg-[#f8f6f3] transition-colors cursor-pointer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888780" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])} className="px-3 py-1 text-[11px] text-[#888780] border border-[#e8e4df] rounded-lg hover:bg-[#f8f6f3] cursor-pointer">今日</button>
            <span className="text-[14px] font-medium text-[#2c2c2a] min-w-[180px] text-center">{dateDisplay}</span>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
              className="text-[12px] text-[#888780] border border-[#e8e4df] rounded-lg px-2 py-1 outline-none cursor-pointer" />
            <button onClick={nextDay} className="p-1.5 rounded-lg hover:bg-[#f8f6f3] transition-colors cursor-pointer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888780" strokeWidth="1.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <div className="w-px h-5 bg-[#e8e4df] mx-2" />
            <select value={selectedStore} onChange={(e) => setSelectedStore(Number(e.target.value))}
              className="px-3 py-1.5 text-[12px] text-[#2c2c2a] border border-[#e8e4df] rounded-lg outline-none cursor-pointer font-medium">
              {stores.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>

          {/* Room Chart */}
          <div className="flex-1 overflow-auto">
            {stores.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <p className="text-[14px] text-[#b4b2a9] mb-4">店舗が登録されていません</p>
                <button onClick={() => setTab("settings")} className="px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">店舗・部屋を設定する</button>
              </div>
            ) : storeRooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <p className="text-[14px] text-[#b4b2a9] mb-4">この店舗に部屋がありません</p>
                <button onClick={() => setTab("settings")} className="px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">部屋を追加する</button>
              </div>
            ) : (
              <div className="min-w-[800px]">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="w-[120px] bg-[#f0ece4] border-b border-r border-[#e8e4df] p-3 text-[11px] text-[#888780] font-normal text-left sticky left-0 z-20">部屋</th>
                      {HOURS.map((h) => (
                        <th key={h} className="bg-[#f0ece4] border-b border-r border-[#e8e4df] p-2 text-[11px] text-[#888780] font-normal min-w-[80px]">{h}:00</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {storeRooms.map((room, ri) => (
                      <tr key={room.id} className="hover:bg-[#faf9f7]">
                        <td className="bg-white border-b border-r border-[#e8e4df] p-3 sticky left-0 z-10">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: colors[ri % colors.length], opacity: 0.6 }} />
                            <span className="text-[12px] text-[#2c2c2a] font-medium">{room.name}</span>
                          </div>
                        </td>
                        {HOURS.map((h) => {
                          const cellRes = getResForRoomCell(room.id, h);
                          const startRes = cellRes.find((r) => isStartHourForRoom(r, h));
                          if (cellRes.length > 0 && !startRes) return null;
                          return (
                            <td key={h} colSpan={startRes ? getResSpan(startRes) : 1}
                              className="border-b border-r border-[#e8e4df] p-1 bg-white">
                              {startRes && (
                                <div className="rounded-lg p-2 h-full min-h-[48px]" style={{ backgroundColor: colors[ri % colors.length] + "18", borderLeft: `3px solid ${colors[ri % colors.length]}` }}>
                                  <p className="text-[11px] font-medium text-[#2c2c2a] truncate">{startRes.customer_name}</p>
                                  <p className="text-[10px] text-[#888780] truncate">{getTherapistName(startRes.therapist_id)} / {startRes.start_time}〜{startRes.end_time}</p>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Unassigned Reservations */}
          {tab === "assign" && stores.length > 0 && (
            <div className="border-t border-[#e8e4df] bg-white p-4 flex-shrink-0">
              <p className="text-[11px] text-[#b4b2a9] mb-3 tracking-wide">未割当の予約（部屋を選択してください）</p>
              <div className="flex flex-wrap gap-3">
                {reservations.filter((r) => !r.room_id).length === 0 ? (
                  <p className="text-[12px] text-[#d3d1c7]">すべての予約が割り当て済みです</p>
                ) : (
                  reservations.filter((r) => !r.room_id).map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 bg-[#f8f6f3] rounded-xl">
                      <div>
                        <p className="text-[12px] text-[#2c2c2a] font-medium">{r.customer_name}</p>
                        <p className="text-[10px] text-[#888780]">{getTherapistName(r.therapist_id)} / {r.start_time}〜{r.end_time}</p>
                      </div>
                      <select value={r.room_id || ""} onChange={(e) => assignRoom(r.id, Number(e.target.value))}
                        className="px-3 py-1.5 text-[11px] border border-[#e8e4df] rounded-lg outline-none cursor-pointer bg-white">
                        <option value="">部屋を選択</option>
                        {storeRooms.map((room) => (<option key={room.id} value={room.id}>{room.name}</option>))}
                      </select>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

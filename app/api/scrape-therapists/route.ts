import { NextResponse } from "next/server";

export async function GET() {
  try {
    // セラピスト一覧ページを取得
    const res = await fetch("https://ange-spa.com/staff.php", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      next: { revalidate: 0 },
    });
    const html = await res.text();

    const therapists: {
      sid: string; name: string; age: string; height: string; cup: string;
      imageUrl: string; profileUrl: string; status: string; store: string;
    }[] = [];

    // <li> ブロック単位で分割（各セラピストが <li> 内に格納）
    const liBlocks = html.split(/<li[^>]*>/i).slice(1);

    for (const block of liBlocks) {
      // profile.php?sid=XXX を含むブロックのみ処理
      const sidMatch = block.match(/profile\.php\?sid=(\d+)/);
      if (!sidMatch) continue;

      const sid = sidMatch[1];

      // 名前: <img alt="名前"> から取得（images_staff内の画像のalt）
      const nameMatch = block.match(/<img[^>]*alt="([^"]+)"[^>]*src="[^"]*images_staff/i)
        || block.match(/src="[^"]*images_staff[^"]*"[^>]*alt="([^"]+)"/i);
      const nameMatch2 = block.match(/<img[^>]*alt="([^"]+)"/i);
      const name = nameMatch ? nameMatch[1] : (nameMatch2 ? nameMatch2[1] : "");

      // 画像URL: images_staff/SID/FILENAME
      const imgMatch = block.match(/src="((?:https?:\/\/ange-spa\.com\/)?images_staff\/[^"]+)"/i);
      let imageUrl = "";
      if (imgMatch) {
        imageUrl = imgMatch[1].startsWith("http")
          ? imgMatch[1]
          : `https://ange-spa.com/${imgMatch[1]}`;
      }

      // 年齢・身長・カップ（テキストノードから）
      const textContent = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const ageMatch = textContent.match(/(\d+)\s*歳/);
      const heightMatch = textContent.match(/(\d{2,3})\s*cm/i);
      const cupMatch = textContent.match(/([A-K])\s*cup/i);

      // 出勤状況
      const isWorking = block.includes("出勤中");

      // 出勤時間
      const timeMatch = textContent.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2}|LAST)/);
      const workTime = timeMatch ? `${timeMatch[1]}-${timeMatch[2]}` : "";

      // 店舗
      let store = "";
      if (block.includes("icon_shop_03") || block.includes("三河安城")) store = "三河安城";
      else if (block.includes("icon_shop_05") || block.includes("豊橋")) store = "豊橋";

      const cleanName = name.replace(/[\s　]+/g, "").trim();

      if (cleanName && sid) {
        if (!therapists.some(t => t.sid === sid)) {
          therapists.push({
            sid,
            name: cleanName,
            age: ageMatch ? ageMatch[1] : "",
            height: heightMatch ? heightMatch[1] : "",
            cup: cupMatch ? cupMatch[1].toUpperCase() : "",
            imageUrl,
            profileUrl: `https://ange-spa.com/profile.php?sid=${sid}`,
            status: isWorking ? `出勤中${workTime ? ` ${workTime}` : ""}` : "お休み",
            store,
          });
        }
      }
    }

    return NextResponse.json({ therapists, count: therapists.length });
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json({ error: "スクレイピングに失敗しました", therapists: [] }, { status: 500 });
  }
}

// プロフィールページから複数画像を取得
export async function POST(req: Request) {
  try {
    const { sid } = await req.json();
    if (!sid) return NextResponse.json({ error: "sid is required" }, { status: 400 });

    const res = await fetch(`https://ange-spa.com/profile.php?sid=${sid}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      next: { revalidate: 0 },
    });
    const html = await res.text();

    const images: string[] = [];
    const imgPattern = /src="((?:https?:\/\/ange-spa\.com\/)?images_staff\/[^"]+)"/gi;
    let m;
    while ((m = imgPattern.exec(html)) !== null) {
      const url = m[1].startsWith("http") ? m[1] : `https://ange-spa.com/${m[1]}`;
      if (!images.includes(url)) images.push(url);
    }

    return NextResponse.json({ images, sid });
  } catch (error) {
    console.error("Profile scrape error:", error);
    return NextResponse.json({ error: "プロフィール取得に失敗しました", images: [] }, { status: 500 });
  }
}

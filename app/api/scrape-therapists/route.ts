import { NextResponse } from "next/server";

export async function GET() {
  try {
    // セラピスト一覧ページを取得
    const res = await fetch("https://ange-spa.com/staff.php", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      next: { revalidate: 0 },
    });
    const html = await res.text();

    // HTMLパース（正規表現ベース — 軽量、外部ライブラリ不要）
    const therapists: {
      sid: string; name: string; age: string; height: string; cup: string;
      imageUrl: string; profileUrl: string; status: string;
    }[] = [];

    // 各セラピストの <li> ブロックを抽出
    // profile.php?sid=XXX のリンクを基準に個別エントリを検出
    const linkPattern = /href="profile\.php\?sid=(\d+)"[^>]*>([\s\S]*?)(?=href="profile\.php\?sid=|\<\/ul|\<\/div\s*>\s*<\/div\s*>\s*$)/gi;

    // より確実なパターン: <a> タグ全体を探す
    const entryPattern = /<a[^>]*href="profile\.php\?sid=(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = entryPattern.exec(html)) !== null) {
      const sid = match[1];
      const block = match[2];

      // 名前: alt属性 or テキスト
      const nameMatch = block.match(/alt="([^"]+)"/);
      const name = nameMatch ? nameMatch[1] : "";

      // 画像URL
      const imgMatch = block.match(/src="(images_staff\/[^"]+)"/);
      const imageUrl = imgMatch ? `https://ange-spa.com/${imgMatch[1]}` : "";

      // 年齢・身長・カップ（テキストから抽出）
      const textContent = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const ageMatch = textContent.match(/(\d+)歳/);
      const heightMatch = textContent.match(/(\d+)cm/);
      const cupMatch = textContent.match(/([A-Z])cup/i);

      // 出勤状況
      const isWorking = block.includes("出勤中") || block.includes("shukkin");
      const status = isWorking ? "出勤中" : "お休み";

      if (name && sid) {
        therapists.push({
          sid,
          name,
          age: ageMatch ? ageMatch[1] : "",
          height: heightMatch ? heightMatch[1] : "",
          cup: cupMatch ? cupMatch[1].toUpperCase() : "",
          imageUrl,
          profileUrl: `https://ange-spa.com/profile.php?sid=${sid}`,
          status,
        });
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

    // プロフィールページの画像を抽出
    const images: string[] = [];
    const imgPattern = /src="(images_staff\/[^"]+)"/gi;
    let m;
    while ((m = imgPattern.exec(html)) !== null) {
      const url = `https://ange-spa.com/${m[1]}`;
      if (!images.includes(url)) images.push(url);
    }

    return NextResponse.json({ images, sid });
  } catch (error) {
    console.error("Profile scrape error:", error);
    return NextResponse.json({ error: "プロフィール取得に失敗しました", images: [] }, { status: 500 });
  }
}

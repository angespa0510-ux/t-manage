/**
 * 愛知県市区町村マスターデータ
 * 副業の普通徴収に関する問い合わせ先（市民税課）を集約。
 *
 * セラピストの登録住所（therapists.address）テキストから
 * 該当市を判定して、自動で問い合わせ先を表示するために使う。
 */

export type CityTaxInfo = {
  city: string;           // "安城市"
  prefecture: string;     // "愛知県"
  taxOffice: string;      // 担当部署名
  phone: string;          // 問い合わせ電話番号（普通徴収関連）
  websiteUrl?: string;    // 市区町村の市民税ページ
  note?: string;          // 補足情報
};

/**
 * 愛知県内の主要市区町村マスター
 * phone は市民税課（普通徴収担当）直通を優先。取得できない場合は市役所代表。
 * 最終確認: 2026年4月
 */
export const AICHI_CITIES: CityTaxInfo[] = [
  // ─── 西三河（特別徴収徹底地域）───
  {
    city: "安城市",
    prefecture: "愛知県",
    taxOffice: "安城市役所 市民税課 市民税係",
    phone: "0566-71-2214",
    websiteUrl: "https://www.city.anjo.aichi.jp/kurasu/zeikin/shiminzei/",
    note: "西三河8市町（特別徴収徹底地域）ですが、副業分（事業所得・雑所得）は確定申告で「自分で納付」を選択すれば普通徴収にできます。",
  },
  {
    city: "岡崎市",
    prefecture: "愛知県",
    taxOffice: "岡崎市役所 市民税課（普通徴収担当）",
    phone: "0564-23-6082",
    websiteUrl: "https://www.city.okazaki.lg.jp/1500/1502/",
    note: "西三河8市町（特別徴収徹底地域）ですが、副業分は普通徴収可能です。",
  },
  {
    city: "刈谷市",
    prefecture: "愛知県",
    taxOffice: "刈谷市役所 市民税課",
    phone: "0566-62-1011",
    websiteUrl: "https://www.city.kariya.lg.jp/kurashi/zeikin/",
    note: "西三河8市町（特別徴収徹底地域）ですが、副業分は普通徴収可能です。",
  },
  {
    city: "碧南市",
    prefecture: "愛知県",
    taxOffice: "碧南市役所 税務課",
    phone: "0566-41-3311",
    note: "西三河8市町（特別徴収徹底地域）ですが、副業分は普通徴収可能です。",
  },
  {
    city: "西尾市",
    prefecture: "愛知県",
    taxOffice: "西尾市役所 税務課",
    phone: "0563-65-2124",
    websiteUrl: "https://www.city.nishio.aichi.jp/kurashi/zeikin/",
    note: "西三河8市町（特別徴収徹底地域）ですが、副業分は普通徴収可能です。",
  },
  {
    city: "知立市",
    prefecture: "愛知県",
    taxOffice: "知立市役所 税務課",
    phone: "0566-95-0116",
    note: "西三河8市町（特別徴収徹底地域）ですが、副業分は普通徴収可能です。",
  },
  {
    city: "高浜市",
    prefecture: "愛知県",
    taxOffice: "高浜市役所 税務グループ",
    phone: "0566-52-1111",
    note: "西三河8市町（特別徴収徹底地域）ですが、副業分は普通徴収可能です。",
  },
  {
    city: "幸田町",
    prefecture: "愛知県",
    taxOffice: "幸田町役場 税務課",
    phone: "0564-62-1111",
    note: "西三河8市町（特別徴収徹底地域）ですが、副業分は普通徴収可能です。",
  },

  // ─── 東三河 ───
  {
    city: "豊橋市",
    prefecture: "愛知県",
    taxOffice: "豊橋市役所 市民税課",
    phone: "0532-51-2111",
    websiteUrl: "https://www.city.toyohashi.lg.jp/",
    note: "副業分は確定申告で「自分で納付」を選択すれば普通徴収にできます。",
  },
  {
    city: "豊川市",
    prefecture: "愛知県",
    taxOffice: "豊川市役所 市民税課",
    phone: "0533-89-2128",
    websiteUrl: "https://www.city.toyokawa.lg.jp/",
  },
  {
    city: "蒲郡市",
    prefecture: "愛知県",
    taxOffice: "蒲郡市役所 税務課",
    phone: "0533-66-1119",
  },
  {
    city: "新城市",
    prefecture: "愛知県",
    taxOffice: "新城市役所 税務課",
    phone: "0536-23-7620",
  },
  {
    city: "田原市",
    prefecture: "愛知県",
    taxOffice: "田原市役所 税務課",
    phone: "0531-23-3512",
  },

  // ─── 名古屋市 ───
  {
    city: "名古屋市",
    prefecture: "愛知県",
    taxOffice: "名古屋市 財政局 税務部 市民税課",
    phone: "052-972-2352",
    websiteUrl: "https://www.city.nagoya.jp/zaisei/",
    note: "名古屋市は各区の市税事務所でも対応しています。詳しくは「名古屋おしえてダイヤル 052-953-7584」へ。",
  },

  // ─── 尾張 ───
  {
    city: "一宮市",
    prefecture: "愛知県",
    taxOffice: "一宮市役所 市民税課",
    phone: "0586-28-8962",
  },
  {
    city: "瀬戸市",
    prefecture: "愛知県",
    taxOffice: "瀬戸市役所 税務課",
    phone: "0561-88-2674",
  },
  {
    city: "春日井市",
    prefecture: "愛知県",
    taxOffice: "春日井市役所 市民税課",
    phone: "0568-85-6093",
  },
  {
    city: "犬山市",
    prefecture: "愛知県",
    taxOffice: "犬山市役所 税務課",
    phone: "0568-44-0324",
  },
  {
    city: "江南市",
    prefecture: "愛知県",
    taxOffice: "江南市役所 税務課",
    phone: "0587-54-1111",
  },
  {
    city: "小牧市",
    prefecture: "愛知県",
    taxOffice: "小牧市役所 市民税課",
    phone: "0568-76-1115",
  },
  {
    city: "稲沢市",
    prefecture: "愛知県",
    taxOffice: "稲沢市役所 市民税課",
    phone: "0587-32-1311",
  },
  {
    city: "岩倉市",
    prefecture: "愛知県",
    taxOffice: "岩倉市役所 税務課",
    phone: "0587-38-5808",
  },
  {
    city: "尾張旭市",
    prefecture: "愛知県",
    taxOffice: "尾張旭市役所 税務課",
    phone: "0561-76-8127",
  },
  {
    city: "清須市",
    prefecture: "愛知県",
    taxOffice: "清須市役所 税務課",
    phone: "052-400-2911",
  },
  {
    city: "北名古屋市",
    prefecture: "愛知県",
    taxOffice: "北名古屋市役所 税務課",
    phone: "0568-22-1111",
  },
  {
    city: "豊明市",
    prefecture: "愛知県",
    taxOffice: "豊明市役所 税務課",
    phone: "0562-92-1111",
  },
  {
    city: "日進市",
    prefecture: "愛知県",
    taxOffice: "日進市役所 税務課",
    phone: "0561-73-2975",
  },
  {
    city: "愛西市",
    prefecture: "愛知県",
    taxOffice: "愛西市役所 税務課",
    phone: "0567-55-7110",
  },
  {
    city: "弥富市",
    prefecture: "愛知県",
    taxOffice: "弥富市役所 税務課",
    phone: "0567-65-1111",
  },
  {
    city: "あま市",
    prefecture: "愛知県",
    taxOffice: "あま市役所 税務課",
    phone: "052-444-1011",
  },
  {
    city: "長久手市",
    prefecture: "愛知県",
    taxOffice: "長久手市役所 税務課",
    phone: "0561-56-0605",
  },
  {
    city: "東郷町",
    prefecture: "愛知県",
    taxOffice: "東郷町役場 税務課",
    phone: "0561-38-3111",
  },

  // ─── 知多 ───
  {
    city: "半田市",
    prefecture: "愛知県",
    taxOffice: "半田市役所 市民税課",
    phone: "0569-84-0651",
  },
  {
    city: "常滑市",
    prefecture: "愛知県",
    taxOffice: "常滑市役所 税務課",
    phone: "0569-47-6118",
  },
  {
    city: "東海市",
    prefecture: "愛知県",
    taxOffice: "東海市役所 税務課",
    phone: "052-603-2211",
  },
  {
    city: "大府市",
    prefecture: "愛知県",
    taxOffice: "大府市役所 税務課",
    phone: "0562-45-6215",
  },
  {
    city: "知多市",
    prefecture: "愛知県",
    taxOffice: "知多市役所 税務課",
    phone: "0562-36-2627",
  },
  {
    city: "阿久比町",
    prefecture: "愛知県",
    taxOffice: "阿久比町役場 税務課",
    phone: "0569-48-1111",
  },
  {
    city: "東浦町",
    prefecture: "愛知県",
    taxOffice: "東浦町役場 税務課",
    phone: "0562-83-3111",
  },
  {
    city: "南知多町",
    prefecture: "愛知県",
    taxOffice: "南知多町役場 税務課",
    phone: "0569-65-0711",
  },
  {
    city: "美浜町",
    prefecture: "愛知県",
    taxOffice: "美浜町役場 税務課",
    phone: "0569-82-1111",
  },
  {
    city: "武豊町",
    prefecture: "愛知県",
    taxOffice: "武豊町役場 税務課",
    phone: "0569-72-1111",
  },

  // ─── 西三河（追加）───
  {
    city: "豊田市",
    prefecture: "愛知県",
    taxOffice: "豊田市役所 市民税課",
    phone: "0565-34-6617",
    websiteUrl: "https://www.city.toyota.aichi.jp/kurashi/zeikin/",
  },
  {
    city: "みよし市",
    prefecture: "愛知県",
    taxOffice: "みよし市役所 税務課",
    phone: "0561-32-8011",
  },
];

/**
 * 住所テキストから該当する市区町村情報を抽出
 *
 * @param address "愛知県安城市桜町1-2-3" のような住所テキスト
 * @returns マッチした CityTaxInfo、マッチしなければ null
 */
export function findCityByAddress(address: string | null | undefined): CityTaxInfo | null {
  if (!address) return null;
  const normalized = address.trim();
  if (!normalized) return null;

  // 長い市名から順にマッチングを試みる（"北名古屋市" が "名古屋市" より先にマッチするように）
  const sortedCities = [...AICHI_CITIES].sort((a, b) => b.city.length - a.city.length);

  for (const ci of sortedCities) {
    if (normalized.includes(ci.city)) return ci;
  }
  return null;
}

/**
 * 都市名（部分一致）でフィルタリング
 */
export function searchCities(keyword: string): CityTaxInfo[] {
  const kw = keyword.trim();
  if (!kw) return AICHI_CITIES;
  return AICHI_CITIES.filter((c) => c.city.includes(kw));
}

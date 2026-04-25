/**
 * Bluesky AT Protocol クライアント (fetch ベース、依存ゼロ)
 *
 * 公式SDK @atproto/api を使わず、純粋fetch で必要最小限の機能を実装
 * これにより npm 依存を増やさずに済む & デプロイサイズも小さい
 *
 * 参考:
 *   https://docs.bsky.app/docs/api/com-atproto-server-create-session
 *   https://docs.bsky.app/docs/api/com-atproto-repo-create-record
 *   https://docs.bsky.app/docs/api/com-atproto-repo-upload-blob
 */

const BSKY_HOST = "https://bsky.social";

export type BlueskySession = {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
};

export type BlueskyPostResult = {
  uri: string;        // at://did:plc:xxxx/app.bsky.feed.post/xxxx
  cid: string;        // コンテンツID
  url: string;        // https://bsky.app/profile/handle/post/postId
};

/**
 * セッション作成 (ログイン)
 *
 * @param identifier - handle (例: "yume.bsky.social") または email
 * @param password - App Password (推奨) or アカウントパスワード
 */
export async function createSession(
  identifier: string,
  password: string
): Promise<BlueskySession> {
  const cleanIdentifier = identifier.trim().replace(/^@/, "");
  const cleanPassword = password.trim();

  const res = await fetch(`${BSKY_HOST}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: cleanIdentifier,
      password: cleanPassword,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || "Bluesky認証に失敗しました");
  }

  return {
    did: data.did,
    handle: data.handle,
    accessJwt: data.accessJwt,
    refreshJwt: data.refreshJwt,
  };
}

/**
 * 画像をアップロード (Blob 取得)
 *
 * @param session - createSession で取得した認証情報
 * @param imageBuffer - 画像のArrayBuffer
 * @param mimeType - 例: "image/jpeg", "image/webp"
 *
 * @returns blobRef - 投稿時に embed.images[].image に渡す
 */
export async function uploadBlob(
  session: BlueskySession,
  imageBuffer: ArrayBuffer,
  mimeType: string
): Promise<{
  $type: "blob";
  ref: { $link: string };
  mimeType: string;
  size: number;
}> {
  const res = await fetch(`${BSKY_HOST}/xrpc/com.atproto.repo.uploadBlob`, {
    method: "POST",
    headers: {
      "Content-Type": mimeType,
      Authorization: `Bearer ${session.accessJwt}`,
    },
    body: imageBuffer,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || "画像アップロードに失敗しました");
  }
  return data.blob;
}

/**
 * テキスト中の URL とハッシュタグの位置を facets として算出
 *
 * Bluesky では URL/タグ/メンションは facets で位置(byteStart, byteEnd) を指定する必要あり
 */
export function extractFacets(text: string): Array<{
  index: { byteStart: number; byteEnd: number };
  features: Array<Record<string, unknown>>;
}> {
  const facets: Array<{
    index: { byteStart: number; byteEnd: number };
    features: Array<Record<string, unknown>>;
  }> = [];

  // 文字列 → UTF-8 byte indexer
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);

  // UTF-8 byte 位置を返すための補助関数
  const charPosToBytePos = (charPos: number) => {
    const before = text.substring(0, charPos);
    return encoder.encode(before).length;
  };

  // URL 検出 (簡易)
  const urlRegex = /https?:\/\/[^\s\u3000]+/g;
  let m: RegExpExecArray | null;
  while ((m = urlRegex.exec(text)) !== null) {
    const start = charPosToBytePos(m.index);
    const end = charPosToBytePos(m.index + m[0].length);
    facets.push({
      index: { byteStart: start, byteEnd: end },
      features: [
        {
          $type: "app.bsky.richtext.facet#link",
          uri: m[0],
        },
      ],
    });
  }

  // ハッシュタグ検出 (#日本語/英数 OK)
  const tagRegex = /#([^\s\u3000#]+)/g;
  while ((m = tagRegex.exec(text)) !== null) {
    const tag = m[1];
    if (!tag) continue;
    const start = charPosToBytePos(m.index);
    const end = charPosToBytePos(m.index + m[0].length);
    facets.push({
      index: { byteStart: start, byteEnd: end },
      features: [
        {
          $type: "app.bsky.richtext.facet#tag",
          tag,
        },
      ],
    });
  }

  // bytes は予約 (将来 byteEnd チェック用)
  void bytes;

  return facets;
}

type ImageEmbed = {
  $type: "blob";
  ref: { $link: string };
  mimeType: string;
  size: number;
};

/**
 * 投稿を作成
 *
 * @param session - 認証セッション
 * @param text - 投稿テキスト (300文字推奨)
 * @param image - 添付画像 (任意、最大1枚で良い)
 *   - alt: 代替テキスト (アクセシビリティ用)
 *   - blob: uploadBlob の戻り値
 */
export async function createPost(
  session: BlueskySession,
  text: string,
  image?: { alt: string; blob: ImageEmbed }
): Promise<BlueskyPostResult> {
  const facets = extractFacets(text);

  type PostRecord = {
    $type: "app.bsky.feed.post";
    text: string;
    createdAt: string;
    langs: string[];
    facets?: Array<{
      index: { byteStart: number; byteEnd: number };
      features: Array<Record<string, unknown>>;
    }>;
    embed?: {
      $type: "app.bsky.embed.images";
      images: Array<{ alt: string; image: ImageEmbed }>;
    };
  };

  const record: PostRecord = {
    $type: "app.bsky.feed.post",
    text,
    createdAt: new Date().toISOString(),
    langs: ["ja"],
  };

  if (facets.length > 0) {
    record.facets = facets;
  }

  if (image) {
    record.embed = {
      $type: "app.bsky.embed.images",
      images: [{ alt: image.alt, image: image.blob }],
    };
  }

  const res = await fetch(`${BSKY_HOST}/xrpc/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({
      repo: session.did,
      collection: "app.bsky.feed.post",
      record,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || "Bluesky投稿に失敗しました");
  }

  // post URL: https://bsky.app/profile/{handle}/post/{rkey}
  const uri = data.uri as string;
  const cid = data.cid as string;
  const rkey = uri.split("/").pop() || "";
  const url = `https://bsky.app/profile/${session.handle}/post/${rkey}`;

  return { uri, cid, url };
}

/**
 * 画像URLからArrayBufferに変換 (Supabase Storageの画像を取得して投稿用に)
 */
export async function fetchImageAsBuffer(
  url: string,
  maxBytes = 1024 * 1024
): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`画像取得失敗 (${res.status})`);
  }
  const blob = await res.blob();
  if (blob.size > maxBytes) {
    throw new Error(`画像が大きすぎます (${(blob.size / 1024 / 1024).toFixed(1)}MB > ${(maxBytes / 1024 / 1024).toFixed(1)}MB)`);
  }
  const buffer = await blob.arrayBuffer();
  const mimeType = blob.type || "image/jpeg";
  return { buffer, mimeType };
}

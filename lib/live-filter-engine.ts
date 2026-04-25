"use client";

/**
 * ═══════════════════════════════════════════════════════════════
 * ライブフィルターエンジン
 * ═══════════════════════════════════════════════════════════════
 *
 * 3モードに対応:
 *   1. beauty: 美顔フィルター (肌スムージング + 軽い目強調)
 *   2. stamp:  スタンプ顔隠し (桜/ハート/うさ耳/猫/リボン/黒帯/全面ぼかし)
 *   3. mosaic: モザイク/ぼかし (顔全体 or 目元のみ)
 *
 * 仕組み:
 *   1. getUserMedia でカメラ映像取得 → <video> 要素
 *   2. MediaPipe Tasks Vision の FaceLandmarker で顔ランドマーク (468ポイント)を毎フレーム検出
 *   3. <canvas> に描画
 *      - ベース: video の現在フレーム
 *      - フィルター適用 (Canvas 2D operations)
 *   4. canvas.captureStream() で MediaStream 化 → LiveKit に渡せる
 *
 * 美顔フィルター (beauty):
 *   - 肌部分にガウシアンブラー (CSS filter: blur)
 *   - 顔の形をマスクとしてブラー領域を制限
 *   - 目元に軽い拡大 (1.05倍程度、自然さ重視)
 *
 * スタンプ (stamp):
 *   - 顔の中心 (鼻のランドマーク) と顔の幅 (耳のランドマーク間) を計算
 *   - 絵文字/SVGスタンプを顔サイズに合わせて配置
 *   - スタンプの種類: 'sakura' | 'heart' | 'usagi' | 'cat' | 'ribbon' | 'blackbar' | 'fullblur'
 *
 * モザイク (mosaic):
 *   - 顔のバウンディングボックスを取得
 *   - その範囲をピクセル化 (mosaic) or ガウシアンブラー
 *   - target: 'face' (顔全体) | 'eyes' (目元のみ)
 */

import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

export type FilterMode = "none" | "beauty" | "stamp" | "mosaic";

export type StampKind =
  // 既存 7 種
  | "sakura" | "heart" | "usagi" | "cat" | "ribbon" | "blackbar" | "fullblur"
  // 新規 8 種
  | "star" | "crown" | "sunglasses" | "mask" | "kira" | "flower" | "kiss" | "halo";

export type MosaicTarget = "face" | "eyes";

export type FilterOptions = {
  mode: FilterMode;
  stamp?: StampKind;
  mosaicTarget?: MosaicTarget;
  beautyStrength?: number; // 0-1
  /** スタンプ拡大率 0.5(50%) 〜 2.0(200%)、デフォルト 1.0 */
  stampSize?: number;
  /** スタンプ横位置オフセット(顔幅の比率) -0.5 〜 +0.5、デフォルト 0 */
  stampOffsetX?: number;
  /** スタンプ縦位置オフセット(顔高さの比率) -0.5 〜 +0.5、デフォルト 0 */
  stampOffsetY?: number;
};

// MediaPipe Face Landmarker のCDN
const VISION_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const FACE_LANDMARKER_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// ランドマークインデックス (MediaPipe Face Mesh の468ポイント仕様)
const FACE_LANDMARK_INDICES = {
  // 顔の輪郭 (顎・額の境界)
  faceOutline: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
  // 鼻の中心
  noseTip: 1,
  noseBridge: 168,
  // 左右の頬骨
  leftCheek: 234,
  rightCheek: 454,
  // あご
  chin: 152,
  // 額の最上部
  forehead: 10,
  // 左目 (中心と外側)
  leftEyeInner: 133,
  leftEyeOuter: 33,
  leftEyeTop: 159,
  leftEyeBottom: 145,
  // 右目
  rightEyeInner: 362,
  rightEyeOuter: 263,
  rightEyeTop: 386,
  rightEyeBottom: 374,
  // 口の左右端
  mouthLeft: 61,
  mouthRight: 291,
};

let faceLandmarkerInstance: FaceLandmarker | null = null;

export async function initFaceLandmarker(): Promise<FaceLandmarker> {
  if (faceLandmarkerInstance) return faceLandmarkerInstance;
  const filesetResolver = await FilesetResolver.forVisionTasks(VISION_WASM_URL);
  faceLandmarkerInstance = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: FACE_LANDMARKER_MODEL,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numFaces: 1, // 配信者は1人想定 (パフォーマンス重視)
    outputFacialTransformationMatrixes: false,
    outputFaceBlendshapes: false,
  });
  return faceLandmarkerInstance;
}

// 顔のバウンディングボックスを計算
function computeFaceBox(
  landmarks: { x: number; y: number }[],
  videoWidth: number,
  videoHeight: number,
  padding = 1.3
): { x: number; y: number; w: number; h: number; cx: number; cy: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const lm of landmarks) {
    if (lm.x < minX) minX = lm.x;
    if (lm.y < minY) minY = lm.y;
    if (lm.x > maxX) maxX = lm.x;
    if (lm.y > maxY) maxY = lm.y;
  }
  const cx = ((minX + maxX) / 2) * videoWidth;
  const cy = ((minY + maxY) / 2) * videoHeight;
  const baseW = (maxX - minX) * videoWidth;
  const baseH = (maxY - minY) * videoHeight;
  const w = baseW * padding;
  const h = baseH * padding;
  return {
    x: cx - w / 2,
    y: cy - h / 2,
    w,
    h,
    cx,
    cy,
  };
}

// ─────────────────────────────────────────────────────────────
// 美顔フィルター: 肌スムージング + 軽い目強調
// ─────────────────────────────────────────────────────────────
function applyBeauty(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  landmarks: { x: number; y: number }[] | null,
  options: { strength: number }
) {
  const canvas = ctx.canvas;
  const w = canvas.width;
  const h = canvas.height;

  // 1. ベース描画
  ctx.drawImage(video, 0, 0, w, h);

  if (!landmarks) return;

  // 2. 顔範囲のみブラーをかける (offscreenにブラーかけてから合成)
  const box = computeFaceBox(landmarks, w, h, 1.2);
  const blurRadius = Math.max(2, options.strength * 8);

  // 顔エリアを切り出してブラー
  ctx.save();
  ctx.beginPath();
  // 楕円形クリップ (顔の形に近い)
  ctx.ellipse(box.cx, box.cy, box.w / 2, box.h / 2, 0, 0, Math.PI * 2);
  ctx.clip();
  // CSSフィルターでブラー
  ctx.filter = `blur(${blurRadius}px) saturate(1.05) brightness(1.05)`;
  ctx.drawImage(video, 0, 0, w, h);
  ctx.filter = "none";
  ctx.restore();

  // 3. ブラー部分のエッジを馴染ませる (軽くオーバーレイで肌の柔らかさ)
  ctx.save();
  ctx.globalAlpha = 0.15 * options.strength;
  ctx.fillStyle = "#ffe5d4";
  ctx.beginPath();
  ctx.ellipse(box.cx, box.cy, box.w / 2, box.h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
// スタンプフィルター: 顔追従するスタンプを描画
// ─────────────────────────────────────────────────────────────
function applyStamp(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  landmarks: { x: number; y: number }[] | null,
  stamp: StampKind,
  /** 全体スケール (1.0=デフォルト, 0.5〜2.0) */
  sizeMul: number = 1.0,
  /** 横オフセット (顔幅比、0=中心、負=左、正=右) */
  offsetX: number = 0,
  /** 縦オフセット (顔高さ比、0=中心、負=上、正=下) */
  offsetY: number = 0
) {
  const canvas = ctx.canvas;
  const w = canvas.width;
  const h = canvas.height;
  ctx.drawImage(video, 0, 0, w, h);

  if (!landmarks) return;

  const noseTip = landmarks[FACE_LANDMARK_INDICES.noseTip];
  const leftCheek = landmarks[FACE_LANDMARK_INDICES.leftCheek];
  const rightCheek = landmarks[FACE_LANDMARK_INDICES.rightCheek];
  const chin = landmarks[FACE_LANDMARK_INDICES.chin];
  const forehead = landmarks[FACE_LANDMARK_INDICES.forehead];

  if (!noseTip || !leftCheek || !rightCheek || !chin || !forehead) return;

  const faceWidth = Math.abs(rightCheek.x - leftCheek.x) * w;
  const faceHeight = Math.abs(chin.y - forehead.y) * h;

  // 鼻先 + ユーザー指定オフセット (offsetは顔サイズに対する比率なので顔の大きさで自動スケール)
  const cx = noseTip.x * w + faceWidth * offsetX;
  const cy = noseTip.y * h + faceHeight * offsetY;

  // ヘルパー: スタンプの相対位置 (顔基準) にオフセットを乗せる
  const dx = faceWidth * offsetX;
  const dy = faceHeight * offsetY;

  if (stamp === "sakura") {
    // 顔全体に桜マーク (大きめ)
    ctx.save();
    ctx.font = `${Math.round(faceWidth * 1.4 * sizeMul)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🌸", cx, cy);
    ctx.restore();
  } else if (stamp === "heart") {
    // 目元にハート (小さめ、目の上に配置)
    const leftEyeTop = landmarks[FACE_LANDMARK_INDICES.leftEyeTop];
    const rightEyeTop = landmarks[FACE_LANDMARK_INDICES.rightEyeTop];
    if (leftEyeTop && rightEyeTop) {
      const eyeY = ((leftEyeTop.y + rightEyeTop.y) / 2) * h;
      const heartSize = faceWidth * 0.35 * sizeMul;
      ctx.save();
      ctx.font = `${Math.round(heartSize)}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("💗", leftEyeTop.x * w + dx, eyeY + dy);
      ctx.fillText("💗", rightEyeTop.x * w + dx, eyeY + dy);
      ctx.restore();
    }
  } else if (stamp === "usagi") {
    // 顔全体マスク + 上にうさ耳
    ctx.save();
    ctx.font = `${Math.round(faceWidth * 1.3 * sizeMul)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // 顔
    ctx.fillText("🐰", cx, cy);
    // 耳 (顔の上)
    const earSize = faceWidth * 0.5 * sizeMul;
    ctx.font = `${Math.round(earSize)}px serif`;
    ctx.fillText("🌸", forehead.x * w - earSize * 0.7 + dx, forehead.y * h - earSize * 0.5 + dy);
    ctx.fillText("🌸", forehead.x * w + earSize * 0.7 + dx, forehead.y * h - earSize * 0.5 + dy);
    ctx.restore();
  } else if (stamp === "cat") {
    // 鼻〜口を覆う猫マスク
    const mouthLeft = landmarks[FACE_LANDMARK_INDICES.mouthLeft];
    const mouthRight = landmarks[FACE_LANDMARK_INDICES.mouthRight];
    if (mouthLeft && mouthRight) {
      const mouthCx = ((mouthLeft.x + mouthRight.x) / 2) * w;
      const mouthCy = ((mouthLeft.y + mouthRight.y) / 2) * h;
      // 鼻〜口エリアに猫
      ctx.save();
      ctx.font = `${Math.round(faceWidth * 0.8 * sizeMul)}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("😺", noseTip.x * w + dx, (noseTip.y * h + mouthCy) / 2 + dy);
      ctx.restore();
    }
  } else if (stamp === "ribbon") {
    // 装飾系: 目の周りに星、頭にリボン (顔は見える)
    ctx.save();
    const decoSize = faceWidth * 0.2 * sizeMul;
    ctx.font = `${Math.round(decoSize)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // 頬の星
    ctx.fillText("✨", leftCheek.x * w + decoSize * 0.5 + dx, leftCheek.y * h + dy);
    ctx.fillText("✨", rightCheek.x * w - decoSize * 0.5 + dx, rightCheek.y * h + dy);
    // 頭のリボン
    ctx.font = `${Math.round(faceWidth * 0.4 * sizeMul)}px serif`;
    ctx.fillText("🎀", forehead.x * w + dx, forehead.y * h - decoSize + dy);
    ctx.restore();
  } else if (stamp === "blackbar") {
    // 目元に黒帯
    const leftEyeOuter = landmarks[FACE_LANDMARK_INDICES.leftEyeOuter];
    const rightEyeOuter = landmarks[FACE_LANDMARK_INDICES.rightEyeOuter];
    if (leftEyeOuter && rightEyeOuter) {
      const x1 = Math.min(leftEyeOuter.x, rightEyeOuter.x) * w - faceWidth * 0.05 * sizeMul + dx;
      const x2 = Math.max(leftEyeOuter.x, rightEyeOuter.x) * w + faceWidth * 0.05 * sizeMul + dx;
      const y = ((leftEyeOuter.y + rightEyeOuter.y) / 2) * h + dy;
      const barH = faceHeight * 0.12 * sizeMul;
      ctx.fillStyle = "#000";
      ctx.fillRect(x1, y - barH / 2, x2 - x1, barH);
    }
  } else if (stamp === "star") {
    // ⭐ 顔全体に大きな星
    ctx.save();
    ctx.font = `${Math.round(faceWidth * 1.3 * sizeMul)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⭐", cx, cy);
    ctx.restore();
  } else if (stamp === "crown") {
    // 👑 頭の上に王冠 + 顔は隠さない
    ctx.save();
    ctx.font = `${Math.round(faceWidth * 0.7 * sizeMul)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("👑", forehead.x * w + dx, forehead.y * h - faceHeight * 0.25 + dy);
    ctx.restore();
  } else if (stamp === "sunglasses") {
    // 🕶 目元にサングラス
    const leftEyeOuter = landmarks[FACE_LANDMARK_INDICES.leftEyeOuter];
    const rightEyeOuter = landmarks[FACE_LANDMARK_INDICES.rightEyeOuter];
    if (leftEyeOuter && rightEyeOuter) {
      const eyeCx = ((leftEyeOuter.x + rightEyeOuter.x) / 2) * w;
      const eyeCy = ((leftEyeOuter.y + rightEyeOuter.y) / 2) * h;
      ctx.save();
      ctx.font = `${Math.round(faceWidth * 0.85 * sizeMul)}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🕶", eyeCx + dx, eyeCy + dy);
      ctx.restore();
    }
  } else if (stamp === "mask") {
    // 😷 マスクで口元を隠す
    const mouthLeft = landmarks[FACE_LANDMARK_INDICES.mouthLeft];
    const mouthRight = landmarks[FACE_LANDMARK_INDICES.mouthRight];
    if (mouthLeft && mouthRight) {
      const mouthCy = ((mouthLeft.y + mouthRight.y) / 2) * h;
      ctx.save();
      ctx.font = `${Math.round(faceWidth * 0.9 * sizeMul)}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("😷", noseTip.x * w + dx, (noseTip.y * h + mouthCy) / 2 + faceHeight * 0.05 + dy);
      ctx.restore();
    }
  } else if (stamp === "kira") {
    // ✨ 顔の周りに複数のキラキラ
    ctx.save();
    const decoSize = faceWidth * 0.25 * sizeMul;
    ctx.font = `${Math.round(decoSize)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✨", leftCheek.x * w - decoSize * 0.3 + dx, leftCheek.y * h - decoSize * 0.3 + dy);
    ctx.fillText("✨", rightCheek.x * w + decoSize * 0.3 + dx, rightCheek.y * h - decoSize * 0.3 + dy);
    ctx.fillText("⭐", forehead.x * w - faceWidth * 0.3 + dx, forehead.y * h + dy);
    ctx.fillText("⭐", forehead.x * w + faceWidth * 0.3 + dx, forehead.y * h + dy);
    ctx.fillText("💫", chin.x * w + dx, chin.y * h + decoSize * 0.3 + dy);
    ctx.restore();
  } else if (stamp === "flower") {
    // 🌷 顔全体をチューリップで覆う
    ctx.save();
    ctx.font = `${Math.round(faceWidth * 1.4 * sizeMul)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🌷", cx, cy);
    ctx.restore();
  } else if (stamp === "kiss") {
    // 💋 頬にキスマーク
    ctx.save();
    const kissSize = faceWidth * 0.28 * sizeMul;
    ctx.font = `${Math.round(kissSize)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("💋", leftCheek.x * w + kissSize * 0.3 + dx, leftCheek.y * h + dy);
    ctx.fillText("💋", rightCheek.x * w - kissSize * 0.3 + dx, rightCheek.y * h + dy);
    ctx.restore();
  } else if (stamp === "halo") {
    // 😇 頭の上に天使
    ctx.save();
    ctx.font = `${Math.round(faceWidth * 0.55 * sizeMul)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("😇", forehead.x * w + dx, forehead.y * h - faceHeight * 0.35 + dy);
    ctx.restore();
  } else if (stamp === "fullblur") {
    // 顔全体ぼかし
    applyMosaic(ctx, video, landmarks, "face");
  }
}

// ─────────────────────────────────────────────────────────────
// モザイクフィルター: 顔エリア or 目元をピクセル化/ぼかし
// ─────────────────────────────────────────────────────────────
function applyMosaic(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  landmarks: { x: number; y: number }[] | null,
  target: MosaicTarget
) {
  const canvas = ctx.canvas;
  const w = canvas.width;
  const h = canvas.height;
  ctx.drawImage(video, 0, 0, w, h);

  if (!landmarks) return;

  if (target === "face") {
    const box = computeFaceBox(landmarks, w, h, 1.25);
    // 強めのブラー (小さく描画→大きく拡大、で簡易モザイク)
    const blurRadius = 30;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(box.cx, box.cy, box.w / 2, box.h / 2, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.filter = `blur(${blurRadius}px)`;
    ctx.drawImage(video, 0, 0, w, h);
    ctx.filter = "none";
    ctx.restore();
  } else if (target === "eyes") {
    // 目元のみ (両目を含む横長矩形)
    const leftEyeOuter = landmarks[FACE_LANDMARK_INDICES.leftEyeOuter];
    const rightEyeOuter = landmarks[FACE_LANDMARK_INDICES.rightEyeOuter];
    const leftEyeTop = landmarks[FACE_LANDMARK_INDICES.leftEyeTop];
    const leftEyeBottom = landmarks[FACE_LANDMARK_INDICES.leftEyeBottom];
    if (leftEyeOuter && rightEyeOuter && leftEyeTop && leftEyeBottom) {
      const xMin = Math.min(leftEyeOuter.x, rightEyeOuter.x) * w - 20;
      const xMax = Math.max(leftEyeOuter.x, rightEyeOuter.x) * w + 20;
      const eyeCenterY = ((leftEyeTop.y + leftEyeBottom.y) / 2) * h;
      const eyeH = Math.abs(leftEyeBottom.y - leftEyeTop.y) * h * 4 + 20;

      ctx.save();
      ctx.beginPath();
      ctx.rect(xMin, eyeCenterY - eyeH / 2, xMax - xMin, eyeH);
      ctx.clip();
      ctx.filter = `blur(20px)`;
      ctx.drawImage(video, 0, 0, w, h);
      ctx.filter = "none";
      ctx.restore();
    }
  }
}

// ─────────────────────────────────────────────────────────────
// メインのフィルター適用関数
// ─────────────────────────────────────────────────────────────
export function applyFilter(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  result: FaceLandmarkerResult | null,
  options: FilterOptions
) {
  const landmarks = result?.faceLandmarks?.[0] || null;

  if (options.mode === "none" || !landmarks) {
    ctx.drawImage(video, 0, 0, ctx.canvas.width, ctx.canvas.height);
    return;
  }

  if (options.mode === "beauty") {
    applyBeauty(ctx, video, landmarks, { strength: options.beautyStrength ?? 0.6 });
  } else if (options.mode === "stamp") {
    applyStamp(
      ctx,
      video,
      landmarks,
      options.stamp || "sakura",
      options.stampSize ?? 1.0,
      options.stampOffsetX ?? 0,
      options.stampOffsetY ?? 0
    );
  } else if (options.mode === "mosaic") {
    applyMosaic(ctx, video, landmarks, options.mosaicTarget || "face");
  }
}

// ─────────────────────────────────────────────────────────────
// MediaStream 化ヘルパー (LiveKit に渡す用)
// ─────────────────────────────────────────────────────────────
export function canvasToMediaStream(canvas: HTMLCanvasElement, fps = 30): MediaStream {
  // captureStream は HTMLCanvasElement の標準機能 (Chrome/Edge/Firefox/Safari)
  // FrameRate を指定するとフレーム制御
  type CanvasWithStream = HTMLCanvasElement & {
    captureStream: (frameRate?: number) => MediaStream;
  };
  return (canvas as CanvasWithStream).captureStream(fps);
}

// ─────────────────────────────────────────────────────────────
// スタンプ一覧 (UI表示用)
// ─────────────────────────────────────────────────────────────
export const STAMP_OPTIONS: { kind: StampKind; label: string; emoji: string; description: string }[] = [
  // ─── 顔を隠すタイプ ───
  { kind: "sakura",     label: "桜",        emoji: "🌸", description: "顔全体を桜の花でカバー" },
  { kind: "flower",     label: "チューリップ", emoji: "🌷", description: "顔全体をチューリップでカバー" },
  { kind: "star",       label: "星",        emoji: "⭐", description: "顔全体を星でカバー" },
  { kind: "usagi",      label: "うさぎ",     emoji: "🐰", description: "顔全体うさぎ + 耳" },
  { kind: "fullblur",   label: "全面ぼかし", emoji: "🌫", description: "顔全体ぼかし" },

  // ─── 部分隠しタイプ ───
  { kind: "blackbar",   label: "黒帯",      emoji: "⬛", description: "目元のみ黒帯" },
  { kind: "sunglasses", label: "サングラス", emoji: "🕶", description: "目元にサングラス" },
  { kind: "mask",       label: "マスク",     emoji: "😷", description: "口元にマスク" },
  { kind: "cat",        label: "猫マスク",   emoji: "😺", description: "鼻〜口を猫マスクで隠す" },

  // ─── 装飾タイプ (顔は見える) ───
  { kind: "heart",      label: "ハート",     emoji: "💗", description: "両目の上にハート" },
  { kind: "ribbon",     label: "リボン",     emoji: "🎀", description: "頬に星 + 頭にリボン" },
  { kind: "crown",      label: "王冠",       emoji: "👑", description: "頭の上に王冠" },
  { kind: "halo",       label: "天使の輪",   emoji: "😇", description: "頭の上に天使" },
  { kind: "kira",       label: "キラキラ",   emoji: "✨", description: "顔の周りにキラキラ散布" },
  { kind: "kiss",       label: "キスマーク", emoji: "💋", description: "両頬にキスマーク" },
];

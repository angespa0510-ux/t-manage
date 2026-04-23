"""
T-MANAGE iPhone CTI Bridge (Beta)
==================================

Windows 10/11 の通知センターを監視し、iPhone からの着信通知から
電話番号を抽出して Supabase に送信する。

動作原理:
    iPhone 着信
      ↓ Bluetooth
    Windows Phone Link (or Intel Unison) が通知表示
      ↓ UserNotificationListener API
    このスクリプトが通知テキストを受信
      ↓ 正規表現で電話番号抽出
    Supabase cti_calls テーブルに INSERT (source='iphone_beta')
      ↓ Realtime
    T-MANAGE Web UI にポップアップ

制限事項:
    - Windows Phone Link または Intel Unison での iPhone ペアリング必須
    - 集中モード/サイレント中は通知が届かないため動作しない
    - iPhone 連絡先に登録された番号は「名前」で表示されるため番号抽出失敗
    - PC スリープ中は動作しない

依存:
    pip install -r requirements.txt
    (winrt-* / requests / python-dotenv)
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import signal
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

try:
    import requests
    from dotenv import load_dotenv
    # ⚠ Python 3.13 対応のため winsdk → winrt-* に移行 (2026/04)
    #   旧: from winsdk.windows.ui.notifications.management import ...
    #   新: from winrt.windows.ui.notifications.management import ...
    from winrt.windows.ui.notifications.management import (
        UserNotificationListener,
        UserNotificationListenerAccessStatus,
    )
    from winrt.windows.ui.notifications import NotificationKinds
except ImportError as e:
    print("=" * 60)
    print("依存ライブラリがインストールされていません。")
    print("以下のコマンドを実行してください:")
    print("  pip install -r requirements.txt")
    print("=" * 60)
    print(f"Error: {e}")
    sys.exit(1)


# ─── 設定読み込み ────────────────────────────────────────
BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
STORE_ID = int(os.getenv("STORE_ID", "1"))
DEVICE_ID = os.getenv("DEVICE_ID", os.environ.get("COMPUTERNAME", "unknown"))
POLL_INTERVAL_SEC = float(os.getenv("POLL_INTERVAL_SEC", "2.0"))
DEDUP_WINDOW_SEC = int(os.getenv("DEDUP_WINDOW_SEC", "30"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_FILE = BASE_DIR / "bridge.log"


# ─── ロガー設定 ──────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("iphone-cti-bridge")


# ─── 電話番号抽出 ────────────────────────────────────────
# 日本の電話番号のバリエーション:
#   090-1234-5678 / 09012345678 / 0422-12-3456 / 0120-123-456
#   03-1234-5678 / +81 90 1234 5678 / (090)1234-5678
PHONE_PATTERNS = [
    # +81 形式 (最優先、明確に電話番号と判定できる)
    re.compile(r"\+81[\s\-]?\d{1,4}[\s\-]?\d{1,4}[\s\-]?\d{3,4}"),
    # 国内標準 (0始まり + 10-11桁合計)
    re.compile(r"0\d{1,4}[\-\s\(\)]*\d{1,4}[\-\s\(\)]*\d{3,4}"),
    # ハイフン省略の連続数字 (0で始まる10-11桁)
    re.compile(r"\b0\d{9,10}\b"),
]


def extract_phone(text: str) -> Optional[str]:
    """通知テキストから電話番号を抽出。見つからなければ None。"""
    if not text:
        return None
    for pattern in PHONE_PATTERNS:
        m = pattern.search(text)
        if m:
            # ハイフン・空白・カッコを除去して正規化
            phone = re.sub(r"[\-\s\(\)]", "", m.group())
            # +81 を 0 に置換
            if phone.startswith("+81"):
                phone = "0" + phone[3:]
            # 最低桁数チェック (携帯11桁/固定10桁)
            if 10 <= len(phone) <= 11 and phone.startswith("0"):
                return phone
    return None


# ─── 着信判定 ────────────────────────────────────────────
# Phone Link / Intel Unison の通知で「着信」を示すキーワード
INCOMING_KEYWORDS = [
    "着信",
    "incoming",
    "calling",
    "から着信",
    "電話",
    "phone",
]

# 無視すべき通知 (SMS、メール、アプリ通知など)
IGNORE_KEYWORDS_APPS = [
    "@",  # メールアドレス
    "SMS",
    "メッセージ",
    "Message",
]


def looks_like_incoming_call(title: str, body: str) -> bool:
    """通知が「電話着信」っぽいか判定。"""
    combined = f"{title} {body}".lower()
    # 明らかにSMSやメールなら除外
    # ただし「電話着信」などのキーワードがあれば通す
    has_incoming_kw = any(kw.lower() in combined for kw in INCOMING_KEYWORDS)
    if has_incoming_kw:
        return True
    # キーワードがなくても、通知に電話番号が含まれるなら着信の可能性あり
    if extract_phone(combined) and "@" not in combined:
        return True
    return False


# ─── Supabase 送信 ───────────────────────────────────────
@dataclass
class DeduplicationCache:
    """同一番号の短時間内連続送信を防ぐ。"""
    last_phone: str = ""
    last_time: float = 0.0

    def should_skip(self, phone: str) -> bool:
        now = time.time()
        if phone == self.last_phone and (now - self.last_time) < DEDUP_WINDOW_SEC:
            return True
        self.last_phone = phone
        self.last_time = now
        return False


dedup = DeduplicationCache()


def send_to_supabase(phone: Optional[str], raw_text: str) -> bool:
    """Supabase cti_calls に INSERT。phone が None なら raw_text のみ送信。"""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        log.warning("⚠ Supabase URL/KEY 未設定。.env を確認してください。")
        return False

    # 重複チェック
    if phone and dedup.should_skip(phone):
        log.info(f"⏭ 重複スキップ: {phone}")
        return False

    url = f"{SUPABASE_URL}/rest/v1/cti_calls"
    headers = {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Prefer": "return=minimal",
    }
    payload = {
        "phone": phone or "unknown",
        "source": "iphone_beta",
        "store_id": STORE_ID,
        "device_id": DEVICE_ID,
        "raw_text": raw_text[:500],  # 念のため500文字制限
    }
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=5)
        if 200 <= resp.status_code < 300:
            if phone:
                log.info(f"✅ 送信成功: {phone}")
            else:
                log.warning(f"⚠ 番号抽出失敗 (名前のみ?): {raw_text[:60]}")
            return True
        log.error(f"❌ 送信失敗 HTTP {resp.status_code}: {resp.text[:200]}")
        return False
    except Exception as e:
        log.error(f"❌ Supabase 送信エラー: {e}")
        return False


# ─── 通知監視ループ ──────────────────────────────────────
async def request_access() -> bool:
    """ユーザーに通知アクセス許可を求める。"""
    # winrt では UserNotificationListener.current プロパティではなく
    # UserNotificationListener.get_current() メソッド呼び出しが必要
    listener = UserNotificationListener.get_current()
    status = await listener.request_access_async()

    if status == UserNotificationListenerAccessStatus.ALLOWED:
        log.info("✅ 通知アクセス許可 OK")
        return True

    log.error("❌ 通知アクセスが許可されていません。")
    log.error("Windows の [設定 > プライバシーとセキュリティ > 通知] で")
    log.error("「アプリに通知へのアクセスを許可」を有効にしてください。")
    return False


# 処理済み通知ID (メモリ内)
seen_ids: set[int] = set()
MAX_SEEN_IDS = 1000  # メモリ上限


async def poll_notifications() -> None:
    """通知を定期的にポーリングして処理。"""
    listener = UserNotificationListener.get_current()

    log.info(f"🎧 通知監視開始 (間隔 {POLL_INTERVAL_SEC}s, store_id={STORE_ID}, device={DEVICE_ID})")

    while True:
        try:
            notifications = await listener.get_notifications_async(NotificationKinds.TOAST)
            for n in notifications:
                nid = n.id
                if nid in seen_ids:
                    continue
                seen_ids.add(nid)

                # メモリ上限管理
                if len(seen_ids) > MAX_SEEN_IDS:
                    seen_ids.clear()
                    log.debug("🧹 seen_ids クリア (上限到達)")

                # 通知内容抽出
                try:
                    toast = n.notification.visual.get_binding("ToastGeneric")
                    if toast is None:
                        continue
                    texts = [t.text for t in toast.get_text_elements()]
                    if not texts:
                        continue
                    title = texts[0] if len(texts) >= 1 else ""
                    body = " ".join(texts[1:]) if len(texts) >= 2 else ""
                    combined = f"{title} | {body}"
                except Exception as e:
                    log.debug(f"通知パース失敗: {e}")
                    continue

                log.debug(f"📨 通知: {combined[:100]}")

                # 着信判定
                if not looks_like_incoming_call(title, body):
                    continue

                phone = extract_phone(combined)
                log.info(f"📞 着信検出: title='{title[:40]}' phone={phone}")
                send_to_supabase(phone, combined)

        except Exception as e:
            log.error(f"ポーリングエラー: {e}")

        await asyncio.sleep(POLL_INTERVAL_SEC)


# ─── シグナルハンドラ ───────────────────────────────────
def handle_sigterm(signum, frame):
    log.info("🛑 終了シグナル受信、停止します")
    sys.exit(0)


# ─── エントリポイント ────────────────────────────────────
async def main():
    print("=" * 60)
    print(" T-MANAGE iPhone CTI Bridge (Beta)")
    print("=" * 60)
    print(f" Supabase URL: {SUPABASE_URL[:40] + '...' if len(SUPABASE_URL) > 40 else SUPABASE_URL}")
    print(f" Store ID:     {STORE_ID}")
    print(f" Device ID:    {DEVICE_ID}")
    print(f" Log file:     {LOG_FILE}")
    print("=" * 60)

    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        log.error("❌ .env ファイルで SUPABASE_URL と SUPABASE_ANON_KEY を設定してください")
        log.error(f"   テンプレート: {BASE_DIR / '.env.example'}")
        sys.exit(1)

    # 通知アクセス許可
    if not await request_access():
        sys.exit(1)

    # シグナルハンドラ
    signal.signal(signal.SIGINT, handle_sigterm)
    signal.signal(signal.SIGTERM, handle_sigterm)

    # 起動メッセージ
    log.info("🚀 T-MANAGE iPhone CTI Bridge 起動")

    # 監視ループ開始
    await poll_notifications()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("👋 ユーザーにより終了")
    except Exception as e:
        log.exception(f"💥 予期せぬエラー: {e}")
        sys.exit(1)

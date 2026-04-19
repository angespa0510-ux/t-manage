"use client";
import { useEffect } from "react";

/**
 * PIN 入力 UI のキーボード対応フック。
 *
 * 有効な間、0-9 / Backspace / Delete キーを対応する data-pin-key 属性の
 * ボタンクリックに変換する。これにより各ページの既存 onClick ロジックを
 * そのまま流用できる。
 *
 * 使い方:
 *   1. usePinKeyboard(showPinModal) のようにフックを呼ぶ
 *   2. PIN ボタンに data-pin-key 属性を付ける
 *      <button data-pin-key="1">1</button>
 *      <button data-pin-key="del">⌫</button>
 *
 * 注意:
 *   - input / textarea にフォーカスがあるときはキー入力を奪わない
 *   - 複数の PIN モーダルが同時に開くケースは想定していない
 */
export function usePinKeyboard(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      // テキスト入力中は PIN キー扱いしない
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

      let key: string | null = null;
      if (/^[0-9]$/.test(e.key)) key = e.key;
      else if (e.key === "Backspace" || e.key === "Delete") key = "del";

      if (key !== null) {
        const btn = document.querySelector(`[data-pin-key="${key}"]`) as HTMLButtonElement | null;
        if (btn) {
          e.preventDefault();
          btn.click();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);
}

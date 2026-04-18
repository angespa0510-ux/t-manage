"use client";
import { useEffect, useRef, useState } from "react";

type ModalEntry = {
  /** モーダルが開いているか */
  isOpen: boolean;
  /** モーダルを閉じる関数 */
  close: () => void;
};

/**
 * タブ/ビュー切替とモーダル表示でマウス戻るボタン・スワイプバック・ブラウザ戻るに対応する共通フック。
 *
 * 優先順位: モーダル → タブ履歴 → 前のページ
 *   1. モーダルが開いていれば閉じる（配列末尾を優先）
 *   2. タブ履歴があれば1つ戻す
 *   3. どちらもなければブラウザに任せる（前のページへ遷移）
 *
 * @param current   現在のタブ/ビュー値
 * @param setCurrent タブ/ビューを切替える setState 関数
 * @param modals    追跡するモーダルの配列（省略可）。末尾のものが先に閉じる
 * @param enabled   有効フラグ（例: PIN認証前は false）
 */
export function useBackNav<T>(
  current: T,
  setCurrent: (v: T) => void,
  modals: ModalEntry[] = [],
  enabled: boolean = true,
) {
  const [history, setHistory] = useState<T[]>([]);
  const currentRef = useRef(current);
  const prevCurrentRef = useRef(current);
  const historyRef = useRef(history);
  const enabledRef = useRef(enabled);
  const modalsRef = useRef(modals);
  const isPopstateRef = useRef(false);
  const prevModalOpensRef = useRef<boolean[]>(modals.map(m => m.isOpen));

  // 最新値をrefに同期
  useEffect(() => {
    currentRef.current = current;
    historyRef.current = history;
    enabledRef.current = enabled;
    modalsRef.current = modals;
  });

  // タブ変更時に履歴にpush（popstate経由の変更はスキップ）
  useEffect(() => {
    if (!enabledRef.current) { prevCurrentRef.current = current; return; }
    const prev = prevCurrentRef.current;
    if (prev !== current) {
      if (isPopstateRef.current) {
        isPopstateRef.current = false;
      } else {
        setHistory(h => [...h, prev]);
        window.history.pushState({ backNav: true }, "");
      }
      prevCurrentRef.current = current;
    }
  }, [current]);

  // モーダルが開いた瞬間に履歴にpush
  const modalsOpenKey = modals.map(m => m.isOpen ? "1" : "0").join("");
  useEffect(() => {
    if (!enabledRef.current) {
      prevModalOpensRef.current = modals.map(m => m.isOpen);
      return;
    }
    const curr = modals.map(m => m.isOpen);
    const prev = prevModalOpensRef.current;
    for (let i = 0; i < curr.length; i++) {
      if (!prev[i] && curr[i]) {
        window.history.pushState({ backNavModal: i }, "");
        break;
      }
    }
    prevModalOpensRef.current = curr;
  }, [modalsOpenKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // popstate統合ハンドラ
  useEffect(() => {
    const handlePopState = () => {
      if (!enabledRef.current) return;
      // Priority 1: モーダルが開いていれば末尾から閉じる
      const currentModals = modalsRef.current;
      for (let i = currentModals.length - 1; i >= 0; i--) {
        if (currentModals[i].isOpen) {
          currentModals[i].close();
          return;
        }
      }
      // Priority 2: タブ履歴を1つ戻す
      const h = historyRef.current;
      if (h.length > 0) {
        const prev = h[h.length - 1];
        setHistory(hist => hist.slice(0, -1));
        isPopstateRef.current = true;
        setCurrent(prev);
        return;
      }
      // Priority 3: ブラウザに任せる（前のページへ遷移）
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setCurrent]);
}

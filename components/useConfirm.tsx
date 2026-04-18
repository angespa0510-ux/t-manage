"use client";
import { useState, useCallback, ReactNode } from "react";
import ConfirmModal, { ConfirmModalProps } from "./ConfirmModal";

type ConfirmOptions = Omit<ConfirmModalProps, "open" | "onCancel" | "onConfirm">;

/**
 * Promise ベースで確認モーダルを呼び出せるフック。
 *
 * 使い方:
 *   const { confirm, ConfirmModalNode } = useConfirm();
 *
 *   const handleDelete = async () => {
 *     const ok = await confirm({
 *       title: "このスタッフを削除しますか？",
 *       message: "この操作は取り消せません",
 *       variant: "danger",
 *       typeToConfirm: staff.name, // オプション
 *     });
 *     if (!ok) return;
 *     await supabase.from("staff").delete().eq("id", staff.id);
 *   };
 *
 *   // JSX: return <>{ConfirmModalNode}...</>
 */
export function useConfirm() {
  const [state, setState] = useState<{
    options: ConfirmOptions;
    resolve: (confirmed: boolean) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ options, resolve });
    });
  }, []);

  const handleCancel = () => {
    state?.resolve(false);
    setState(null);
  };

  const handleConfirm = async () => {
    state?.resolve(true);
    setState(null);
  };

  const ConfirmModalNode: ReactNode = state ? (
    <ConfirmModal
      open
      {...state.options}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
    />
  ) : null;

  return { confirm, ConfirmModalNode };
}

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={close} aria-label={title}>
      <div className="modal-head">
        <h3>{title}</h3>
        <button onClick={close} aria-label="关闭">
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <img src="/assets/whyduck/characters/butler.webp" alt="管家鸭" />
      <h3>{text}</h3>
      <p>你的材料、事实与进展会保存在同一件案件中。</p>
    </div>
  );
}

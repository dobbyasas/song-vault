import { useEffect } from "react";
import { createPortal } from "react-dom";

export function CoverModal({
  open,
  src,
  title,
  loading,
  onClose,
}: {
  open: boolean;
  src: string;
  title: string;
  loading: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ display: "grid", placeItems: "center", padding: "2vh 2vw" }}
    >
      {loading && (
        <div
          style={{
            position: "fixed",
            top: 14,
            left: 14,
            padding: "8px 10px",
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(10px)",
            fontSize: 13,
            opacity: 0.95,
          }}
        >
          Loading HQ…
        </div>
      )}

      <img
        src={src}
        alt={title}
        onClick={onClose}
        style={{
          width: "100%",
          height: "100%",
          maxWidth: "100vw",
          maxHeight: "100vh",
          objectFit: "contain",
          cursor: "zoom-out",
          userSelect: "none",
        }}
      />
    </div>,
    document.body
  );
}

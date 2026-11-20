import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function Sheet({
  label,
  titleId,
  onClose,
  className = "",
  children,
}) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    const overflow = document.body.style.overflow;
    const app = document.getElementById("root");
    const previouslyInert = app?.inert;
    if (app) app.inert = true;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (app) app.inert = previouslyInert;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialog}
      className={`glass-sheet ${className}`}
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [
          ...event.currentTarget.querySelectorAll(
            "a[href], button, input, select, textarea, summary, [tabindex='0']",
          ),
        ].filter(
          (item) => !item.matches(":disabled") && item.getClientRects().length,
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sheet-content">
        <button
          type="button"
          className="sheet-close"
          aria-label={label}
          onClick={onClose}
          autoFocus
        >
          <X size={20} />
        </button>
        {children}
      </div>
    </dialog>,
    document.body,
  );
}

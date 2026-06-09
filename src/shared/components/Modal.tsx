import { ReactNode, useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-[450px] bg-brand-panel border border-brand-border rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[85vh] transform transition-all scale-100"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 bg-brand-panel-header border-b border-brand-border">
          <span className="font-semibold text-sm text-brand-text">{title}</span>
          <button 
            className="text-brand-muted hover:text-brand-text text-sm cursor-pointer transition-colors duration-150"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-4 py-3 bg-brand-panel-header border-t border-brand-border flex justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

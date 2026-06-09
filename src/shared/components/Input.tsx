import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">
          {label}
        </span>
      )}
      <input
        className={`w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-xs font-mono text-brand-text outline-none focus:border-brand-primary transition-colors duration-150 ${
          error ? "border-brand-danger" : ""
        } ${className}`}
        {...props}
      />
      {error && <span className="text-[10px] text-brand-danger font-medium">{error}</span>}
    </div>
  );
}

import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "success" | "ghost";
  isLoading?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Button({
  children,
  variant = "primary",
  isLoading = false,
  size = "md",
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseStyle = "font-medium rounded-md transition-all duration-150 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-1.5";
  
  const sizeStyles = {
    sm: "py-1 px-3 text-xs",
    md: "py-2 px-4 text-sm",
    lg: "py-2.5 px-5 text-base",
  };

  const variantStyles = {
    primary: "bg-brand-primary hover:bg-brand-primary-hover text-white hover:-translate-y-0.5 shadow-sm",
    secondary: "border border-brand-border hover:bg-brand-panel-header text-brand-text",
    danger: "bg-brand-danger hover:bg-brand-danger/90 text-white hover:-translate-y-0.5",
    success: "bg-brand-success hover:bg-brand-success/90 text-white hover:-translate-y-0.5",
    ghost: "py-0.5 px-2 text-[10px] border border-brand-border bg-transparent hover:bg-brand-panel-header text-brand-text rounded font-medium",
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyle} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
}

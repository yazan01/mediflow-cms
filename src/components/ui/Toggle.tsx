"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      dir="ltr"
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex w-11 h-6 rounded-full flex-shrink-0",
        "transition-colors duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1960a3] focus-visible:ring-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        checked ? "bg-[#002045]" : "bg-[#c4c6cf]",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm",
          "transition-transform duration-200",
          checked ? "translate-x-[1.375rem]" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}

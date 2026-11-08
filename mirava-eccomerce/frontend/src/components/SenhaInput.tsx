// Campo de senha com o olho para mostrar ou esconder o que foi digitado.

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function SenhaInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visivel, setVisivel] = useState(false);
  return (
    <span className="relative grid">
      <input {...props} type={visivel ? "text" : "password"} className={`w-full pr-12 ${className}`} />
      <button
        type="button"
        aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visivel}
        onClick={() => setVisivel((v) => !v)}
        className="absolute top-1/2 right-2 grid h-9 w-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-none bg-transparent text-muted transition-colors hover:bg-mist hover:text-teal"
      >
        {visivel ? <EyeOff size={18} strokeWidth={1.7} /> : <Eye size={18} strokeWidth={1.7} />}
      </button>
    </span>
  );
}

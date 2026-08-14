import { MessageCircle } from "lucide-react";

export default function WhatsAppButton() {
  return (
    <button
      type="button"
      className="fixed right-6 bottom-6 z-50 flex items-center gap-2.5 rounded-full border-none bg-plum px-5 py-3.5 font-serif text-sm font-semibold tracking-[0.2em] text-blush uppercase shadow-[0_12px_30px_-16px_rgba(92,42,70,0.45)] cursor-pointer"
    >
      <MessageCircle className="pointer-events-none flex h-[17px] w-[17px]" strokeWidth={1.6} />
      Tirar uma dúvida
    </button>
  );
}

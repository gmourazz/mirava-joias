import { ANNOUNCEMENTS } from "../data/content";

export default function AnnouncementBar() {
  return (
    <div className="relative h-10 overflow-hidden bg-plum">
      {ANNOUNCEMENTS.map((msg, i) => (
        <div
          key={i}
          className="absolute inset-0 flex items-center justify-center gap-2.5 whitespace-nowrap text-[11.5px] tracking-[0.16em] text-blush/90 uppercase opacity-0 animate-ann-in"
          style={{ animationDelay: msg.delay }}
        >
          <span className="h-1 w-1 rotate-45 bg-blush-2" />
          {msg.text}
        </div>
      ))}
    </div>
  );
}

interface MonogramProps {
  className?: string;
  color?: string;
}

export default function Monogram({ className, color = "#D46A9F" }: MonogramProps) {
  return (
    <svg viewBox="0 0 220 150" fill="none" className={className}>
      <path
        d="M20 128 C20 32, 74 32, 116 100 C158 32, 200 32, 200 128"
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <circle cx="200" cy="128" r="9" fill={color} />
    </svg>
  );
}

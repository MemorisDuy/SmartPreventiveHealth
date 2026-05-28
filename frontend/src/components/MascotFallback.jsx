export default function MascotFallback() {
  return (
    <svg
      viewBox="0 0 100 120"
      className="w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="25" y="15" width="50" height="50" rx="5" fill="#10b981" stroke="#059669" strokeWidth="2" />
      <circle cx="35" cy="30" r="6" fill="#ffffff" />
      <circle cx="35" cy="30" r="3" fill="#000000" className="animate-pulse" />
      <circle cx="65" cy="30" r="6" fill="#ffffff" />
      <circle cx="65" cy="30" r="3" fill="#000000" className="animate-pulse" />
      <path
        d="M 40 50 Q 50 55 60 50"
        stroke="#059669"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="30" y="70" width="40" height="35" rx="3" fill="#0d9488" stroke="#047857" strokeWidth="2" />
      <rect x="10" y="80" width="20" height="12" rx="3" fill="#0d9488" stroke="#047857" strokeWidth="2" />
      <rect x="70" y="80" width="20" height="12" rx="3" fill="#0d9488" stroke="#047857" strokeWidth="2" />
      <circle cx="45" cy="90" r="3" fill="#fbbf24" />
      <circle cx="55" cy="90" r="3" fill="#60a5fa" />
      <rect x="38" y="102" width="24" height="3" rx="1" fill="#6b7280" />
    </svg>
  );
}

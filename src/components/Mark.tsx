// The logo and the hero art: three tiers of a steel tiffin under a lid handle, drawn here rather than taken from an icon set.
export function TierMark({ className = '' }: { className?: string }) {
  return (
    <svg className={`tier-mark ${className}`} viewBox="0 0 30 34" aria-hidden="true">
      <path d="M9 2.5h12" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
      <path d="M10 2.5v3M20 2.5v3" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
      <rect x="4" y="6" width="22" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="4" y="13.5" width="22" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="4" y="21" width="22" height="7" rx="1" fill="currentColor" />
    </svg>
  );
}

export function StackArt() {
  return (
    <svg className="stack-art" viewBox="0 0 320 300" role="img" aria-label="Three stacked tiffin tiers under a lid">
      <g className="tier">
        <rect x="72" y="18" width="176" height="46" rx="4" fill="#FFFBF5" stroke="#2B1020" strokeWidth="3" />
        <path d="M120 18 V6 H200 V18" fill="none" stroke="#2B1020" strokeWidth="3" />
        <circle cx="160" cy="40" r="8" fill="#FB8B24" stroke="#2B1020" strokeWidth="2.5" />
      </g>
      <g className="tier">
        <rect x="64" y="78" width="192" height="54" rx="4" fill="#FFFBF5" stroke="#2B1020" strokeWidth="3" />
        <path d="M80 105 H240" stroke="#E3D2BD" strokeWidth="3" />
        <rect x="104" y="92" width="22" height="26" rx="2" fill="#E36414" />
        <rect x="134" y="92" width="22" height="26" rx="2" fill="#0F4C5C" />
        <rect x="164" y="92" width="22" height="26" rx="2" fill="#9A031E" />
      </g>
      <g className="tier">
        <rect x="56" y="146" width="208" height="58" rx="4" fill="#FFFBF5" stroke="#2B1020" strokeWidth="3" />
        <path d="M74 174 H246" stroke="#E3D2BD" strokeWidth="3" />
        <circle cx="120" cy="174" r="14" fill="#FDE8D1" stroke="#2B1020" strokeWidth="2" />
        <circle cx="200" cy="174" r="14" fill="#F2E4EC" stroke="#2B1020" strokeWidth="2" />
      </g>
      <g className="tier">
        <rect x="48" y="220" width="224" height="58" rx="4" fill="#5F0F40" stroke="#2B1020" strokeWidth="3" />
        <rect x="132" y="236" width="56" height="8" rx="2" fill="#FB8B24" />
        <rect x="112" y="252" width="96" height="6" rx="2" fill="#FBF4EA" opacity="0.7" />
      </g>
    </svg>
  );
}

export function Mark({ kind }: { kind: 'veg' | 'nonveg' | string }) {
  const v = kind === 'veg' || kind === 'any' ? 'veg' : 'nonveg';
  return <span className={`mark ${v}`} role="img" aria-label={v === 'veg' ? 'Vegetarian' : 'Non-vegetarian'} />;
}

export default function D20Icon() {
  return (
    <svg width="1.2em" height="1.2em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', display: 'inline-block' }}>
      <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"></polygon>
      <polygon points="12 2 17 11 7 11"></polygon>
      <polygon points="17 11 22 8.5 22 15.5 12 17"></polygon>
      <polygon points="7 11 2 8.5 2 15.5 12 17"></polygon>
      <line x1="12" y1="17" x2="12" y2="22"></line>
      <text x="12" y="9.5" textAnchor="middle" fontSize="5px" fill="currentColor" stroke="none" fontWeight="bold">20</text>
    </svg>
  );
}

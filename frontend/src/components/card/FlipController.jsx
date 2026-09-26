export default function FlipController({ flipped, children }) {
  return (
    <div className="card-flip-wrapper w-full h-full">
      <div className={`card-flip-inner ${flipped ? 'flipped' : ''}`}>{children}</div>
    </div>
  );
}

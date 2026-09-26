export default function LoadingOverlay({ label = 'Generating your card…' }) {
  return (
    <div className="fixed inset-0 z-[70] bg-ink/90 flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-teal-light animate-spin" />
      <p className="font-body text-white/80 text-sm">{label}</p>
    </div>
  );
}

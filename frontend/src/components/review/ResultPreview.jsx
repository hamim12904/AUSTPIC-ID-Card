export default function ResultPreview({ frontImageUrl, backImageUrl }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
      <figure className="flex flex-col items-center gap-2">
        <img
          src={frontImageUrl}
          alt="Generated card — front"
          className="w-full max-w-[260px] rounded-xl shadow-lg"
        />
        <figcaption className="font-body text-xs text-ink/50">Front</figcaption>
      </figure>
      <figure className="flex flex-col items-center gap-2">
        <img
          src={backImageUrl}
          alt="Generated card — back"
          className="w-full max-w-[260px] rounded-xl shadow-lg"
        />
        <figcaption className="font-body text-xs text-ink/50">Back</figcaption>
      </figure>
    </div>
  );
}

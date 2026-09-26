const baseLink =
  'px-5 py-2.5 rounded-full font-body text-sm border transition-colors';

// The green variant needs none of linkClass's ink-on-paper hovers. It also
// adds no border/colour utilities of its own: .btn-green is unlayered CSS, so
// it outranks Tailwind's layered utilities and its dark green boundary and
// white label win regardless of what else is in the class list.
const ghostLink = baseLink + ' border-ink/15 text-ink hover:bg-ink hover:text-paper';
const greenLink = baseLink + ' btn-green';

export default function DownloadActions({ frontImageUrl, backImageUrl, pdfUrl }) {
  return (
    <div className="flex flex-wrap justify-center gap-3 mt-6">
      <a href={frontImageUrl} download className={ghostLink}>
        Download front PNG
      </a>
      <a href={backImageUrl} download className={ghostLink}>
        Download back PNG
      </a>
      {pdfUrl && (
        <a href={pdfUrl} download className={greenLink}>
          Download PDF
        </a>
      )}
    </div>
  );
}

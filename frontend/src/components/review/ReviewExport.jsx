import { useEffect, useRef } from 'react';
import { useCardStore } from '../../store/useCardStore.js';
import { createSubmission, updateSubmission, uploadPhoto, generateSubmission } from '../../api/submissionApi.js';
import LoadingOverlay from './LoadingOverlay.jsx';
import ResultPreview from './ResultPreview.jsx';
import DownloadActions from './DownloadActions.jsx';

/**
 * Runs once the user hits "Review & generate": creates/updates the
 * submission with the filled-in fields, calls generate, and shows the
 * result. Rendered by App once status !== 'idle'.
 */
export default function ReviewExport() {
  const status = useCardStore((s) => s.status);
  const setStatus = useCardStore((s) => s.setStatus);
  const setResult = useCardStore((s) => s.setResult);
  const setError = useCardStore((s) => s.setError);
  const setSubmissionId = useCardStore((s) => s.setSubmissionId);
  const reset = useCardStore((s) => s.reset);

  const templateConfig = useCardStore((s) => s.templateConfig);
  const submissionId = useCardStore((s) => s.submissionId);
  const fields = useCardStore((s) => s.fields);
  const photo = useCardStore((s) => s.photo);
  const setPhoto = useCardStore((s) => s.setPhoto);
  const error = useCardStore((s) => s.error);
  const result = useCardStore((s) => s.result);

  const ranRef = useRef(false);

  useEffect(() => {
    if (status !== 'submitting' || ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        let id = submissionId;
        if (!id) {
          const created = await createSubmission(templateConfig.templateId, fields);
          id = created.submissionId;
          setSubmissionId(id);
        } else {
          await updateSubmission(id, fields);
        }
        if (photo.file && photo.cropRect && !photo.processedUrl) {
          try {
            const uploaded = await uploadPhoto(id, photo.file, photo.cropRect);
            setPhoto({ processedUrl: uploaded.processedPhotoUrl });
          } catch (uploadError) {
            console.warn('[ReviewExport] photo upload failed:', uploadError);
          }
        }
        const generated = await generateSubmission(id);
        setResult(generated);
      } catch (err) {
        setError(err);
        setStatus('error');
      }
    })();
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'submitting') {
    return <LoadingOverlay />;
  }

  if (status !== 'done' || !result) {
    if (error) {
      return (
        <section className="px-6 py-16 flex flex-col items-center text-center gap-3">
          <p className="font-body text-sm text-red-500 max-w-sm">
            {error.message || "Couldn't generate your card. Please try again."}
          </p>
          <button
            type="button"
            onClick={() => {
              ranRef.current = false;
              setError(null);
              setStatus('submitting');
            }}
            className="btn-green px-6 py-2 rounded-full font-body text-sm"
          >
            Try again
          </button>
        </section>
      );
    }
    return null;
  }

  return (
    <section className="px-6 py-20 flex flex-col items-center gap-6">
      <h2 className="font-display font-extrabold text-2xl text-ink">Your card is ready</h2>
      <ResultPreview frontImageUrl={result.frontImageUrl} backImageUrl={result.backImageUrl} />
      <DownloadActions
        frontImageUrl={result.frontImageUrl}
        backImageUrl={result.backImageUrl}
        pdfUrl={result.pdfUrl}
      />
      <button
        type="button"
        onClick={() => {
          ranRef.current = false;
          reset();
        }}
        className="mt-4 font-body text-sm text-ink/50 underline"
      >
        Make another card
      </button>
    </section>
  );
}

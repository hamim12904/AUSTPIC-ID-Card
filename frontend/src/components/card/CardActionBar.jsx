import CardActionButton from '../ui/CardActionButton.jsx';
import { PreviewIcon } from '../ui/CardIcons.jsx';

/**
 * The three things you can do to the card: turn it over, preview it read-only,
 * or submit it.
 *
 * Flip and Submit are labelled pills. Preview is icon-only, which is why its
 * meaning is carried by the tooltip and the accessible name instead — the
 * button is the one place in the row where the glyph alone has to do the work.
 *
 * Preview stays visually muted while the card is incomplete; the click still
 * runs, because that is what surfaces the missing fields. Submit is only
 * disabled once a submit is actually in flight.
 */
export default function CardActionBar({ currentSide, ready, submitting, onFlip, onPreview, onSubmit }) {
  const nextSide = currentSide === 'front' ? 'back' : 'front';

  return (
    <div className="card-action-bar">
      <CardActionButton onClick={onFlip}>Flip to {nextSide}</CardActionButton>

      <CardActionButton
        shape="icon"
        icon={<PreviewIcon />}
        label={ready ? 'Preview your card' : 'Preview — fill in every field first'}
        tone={ready ? 'solid' : 'muted'}
        onClick={onPreview}
      />

      <CardActionButton tone="solid" onClick={onSubmit} disabled={submitting}>
        {submitting ? 'Submitting…' : 'Submit'}
      </CardActionButton>
    </div>
  );
}

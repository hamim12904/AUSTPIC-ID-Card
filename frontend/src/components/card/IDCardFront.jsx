import { forwardRef } from 'react';
import FieldOverlay from './FieldOverlay.jsx';
import PhotoUploadZone from '../photo/PhotoUploadZone.jsx';

// The ref lands on the face element itself, which is what the download
// rasterises — the export paints this node rather than rebuilding the card, so
// it cannot drift from what the preview shows. See utils/domRaster.js.
const IDCardFront = forwardRef(function IDCardFront({ template, showErrors, readOnly = false }, ref) {
  return (
    <div className="card-face" style={{ containerType: 'inline-size' }} ref={ref}>
      <div className="relative h-full w-full">
        <img
          src={template.frontImage}
          alt="AUST PIC membership card — front"
          className="card-art"
          draggable={false}
        />
        <PhotoUploadZone
          photo={template.photo}
          photoField={template.photoField}
          readOnly={readOnly}
        />
        {template.frontFields.map((field) => (
          <FieldOverlay
            key={field.key}
            field={field}
            showErrors={showErrors}
            side="front"
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
});

export default IDCardFront;

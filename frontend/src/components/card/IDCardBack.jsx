import { forwardRef } from 'react';
import FieldOverlay from './FieldOverlay.jsx';

// Ref lands on the face element for the download, as on the front. The export
// also clears the .card-back rotateY(180deg) on its clone, which only exists
// so both faces can share one 3D context. See utils/domRaster.js.
const IDCardBack = forwardRef(function IDCardBack({ template, showErrors, readOnly = false }, ref) {
  return (
    <div className="card-face card-back" style={{ containerType: 'inline-size' }} ref={ref}>
      <div className="relative h-full w-full">
        <img
          src={template.backImage}
          alt="AUST PIC membership card — back"
          className="card-art"
          draggable={false}
        />
        {template.backFields.map((field) => (
          <FieldOverlay
            key={field.key}
            field={field}
            showErrors={showErrors}
            side="back"
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
});

export default IDCardBack;

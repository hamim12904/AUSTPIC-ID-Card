import FieldOverlay from './FieldOverlay.jsx';
import PhotoUploadZone from '../photo/PhotoUploadZone.jsx';

export default function IDCardFront({ template, showErrors, readOnly = false }) {
  return (
    <div className="card-face" style={{ containerType: 'inline-size' }}>
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
}

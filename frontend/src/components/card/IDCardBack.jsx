import FieldOverlay from './FieldOverlay.jsx';

export default function IDCardBack({ template, showErrors, readOnly = false }) {
  return (
    <div className="card-face card-back" style={{ containerType: 'inline-size' }}>
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
}

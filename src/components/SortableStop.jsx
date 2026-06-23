import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function SortableStop({ stop, index, isDepot, onRemove, onSetDepot, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div className="stop-item" ref={setNodeRef} style={style}>
      {!disabled && (
        <span className="drag-handle" {...attributes} {...listeners} title="Drag to reorder">⠿</span>
      )}
      <span className="stop-index">{index + 1}</span>
      <span className="stop-name" title={stop.label}>{stop.label}</span>
      {isDepot && <span className="depot-badge">depot</span>}
      {!disabled && (
        <div className="stop-actions">
          {!isDepot && (
            <button className="btn-icon" title="Set as depot" onClick={() => onSetDepot(stop.id)}>⚑</button>
          )}
          <button className="btn-icon danger" title="Remove" onClick={() => onRemove(stop.id)}>✕</button>
        </div>
      )}
    </div>
  );
}

import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SortableRowProps {
  id: string;
  children: React.ReactNode;
  className: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function SortableRow({ id, children, className, onClick }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative' as const,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(className, isDragging && 'bg-theme-primary/10')}
      onClick={onClick}
    >
      <td className="w-2 px-1 py-3 border-b border-theme/30">
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="cursor-grab active:cursor-grabbing p-1 text-slate-600 hover:text-theme-primary transition-colors"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </td>
      {children}
    </tr>
  );
}

interface SortableTableProviderProps {
  items: any[];
  onReorder: (newOrder: any[]) => void;
  children: React.ReactNode;
}

export function SortableTableProvider({ items, onReorder, children }: SortableTableProviderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      onReorder(arrayMove(items, oldIndex, newIndex));
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map(item => item.id)}
        strategy={verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </DndContext>
  );
}

interface SortableTableBodyProps {
  items: any[];
  renderRow: (item: any) => React.ReactNode;
  onRowClick?: (item: any, e: React.MouseEvent) => void;
  rowClassName?: (item: any) => string;
}

export function SortableTableBody({ items, renderRow, onRowClick, rowClassName }: SortableTableBodyProps) {
  return (
    <tbody className="divide-y divide-slate-800/50">
      {items.map((item) => (
        <SortableRow
          key={item.id}
          id={item.id}
          className={cn("hover:bg-theme-primary/5 transition-colors group cursor-pointer", rowClassName?.(item))}
          onClick={(e) => onRowClick?.(item, e)}
        >
          {renderRow(item)}
        </SortableRow>
      ))}
    </tbody>
  );
}

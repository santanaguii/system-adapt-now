import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityFormLayoutBlock, ActivityFormLayoutSettings, CustomField } from '@/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Grip, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  clampActivityFormBlock,
  createActivityFormLayoutBlock,
  defaultActivityFormLayout,
  FORM_LAYOUT_COLUMNS,
  FORM_LAYOUT_EDITOR_ROW_HEIGHT,
  getActivityFormBlockStyle,
  getEmptyLayoutSegments,
  getFormContentOptions,
  getMaxFormLayoutRow,
  resolveActivityFormLayoutCollisions,
} from '@/lib/activity-form-layout';

interface ActivityFormLayoutSettingsProps {
  customFields: CustomField[];
  layout: ActivityFormLayoutSettings;
  onUpdate: (layout: ActivityFormLayoutSettings) => void;
}

type DragMode = 'move' | 'resize-x' | 'resize-y' | 'resize-both';

interface DragState {
  blockId: string;
  mode: DragMode;
  pointerX: number;
  pointerY: number;
  containerWidth: number;
  initialBlock: ActivityFormLayoutBlock;
}

function previewText(contentKey: string, labels: Record<string, string>) {
  return labels[contentKey] || contentKey;
}

export function ActivityFormLayoutSettingsTab({
  customFields,
  layout,
  onUpdate,
}: ActivityFormLayoutSettingsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const options = useMemo(() => getFormContentOptions(customFields), [customFields]);
  const optionLabels = useMemo(
    () => Object.fromEntries(options.map((option) => [option.value, option.label])),
    [options]
  );
  const [selectedBlockId, setSelectedBlockId] = useState(layout.blocks[0]?.id ?? '');
  const [dragState, setDragState] = useState<DragState | null>(null);

  useEffect(() => {
    if (!layout.blocks.some((block) => block.id === selectedBlockId)) {
      setSelectedBlockId(layout.blocks[0]?.id ?? '');
    }
  }, [layout.blocks, selectedBlockId]);

  const commitLayout = useCallback((blocks: ActivityFormLayoutBlock[], priorityBlockId?: string) => {
    onUpdate({
      blocks: resolveActivityFormLayoutCollisions(blocks.map(clampActivityFormBlock), priorityBlockId),
    });
  }, [onUpdate]);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const cellWidth = dragState.containerWidth / FORM_LAYOUT_COLUMNS;
      const deltaColumns = Math.round((event.clientX - dragState.pointerX) / cellWidth);
      const deltaRows = Math.round((event.clientY - dragState.pointerY) / FORM_LAYOUT_EDITOR_ROW_HEIGHT);

      commitLayout(
        layout.blocks.map((block) => {
          if (block.id !== dragState.blockId) {
            return block;
          }

          if (dragState.mode === 'move') {
            return {
              ...dragState.initialBlock,
              colStart: dragState.initialBlock.colStart + deltaColumns,
              rowStart: dragState.initialBlock.rowStart + deltaRows,
            };
          }

          if (dragState.mode === 'resize-x') {
            return {
              ...dragState.initialBlock,
              colSpan: dragState.initialBlock.colSpan + deltaColumns,
            };
          }

          if (dragState.mode === 'resize-y') {
            return {
              ...dragState.initialBlock,
              rowSpan: dragState.initialBlock.rowSpan + deltaRows,
            };
          }

          return {
            ...dragState.initialBlock,
            colSpan: dragState.initialBlock.colSpan + deltaColumns,
            rowSpan: dragState.initialBlock.rowSpan + deltaRows,
          };
        }),
        dragState.blockId
      );
    };

    const handlePointerUp = () => {
      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [commitLayout, dragState, layout.blocks]);

  const editorRowCount = Math.max(getMaxFormLayoutRow(layout.blocks) + 2, 8);
  const emptySegments = useMemo(
    () => getEmptyLayoutSegments(layout.blocks, editorRowCount),
    [editorRowCount, layout.blocks]
  );

  const updateBlockContent = (blockId: string, contentKey: string) => {
    commitLayout(
      layout.blocks.map((block) => (
        block.id === blockId ? { ...block, contentKey } : block
      )),
      blockId
    );
  };

  const removeBlock = (blockId: string) => {
    onUpdate({
      blocks: layout.blocks.filter((block) => block.id !== blockId),
    });
  };

  const addBlockAtSegment = (segment: { rowStart: number; colStart: number; colSpan: number }) => {
    const nextBlock = createActivityFormLayoutBlock(options[0]?.value ?? 'title');
    nextBlock.rowStart = segment.rowStart;
    nextBlock.colStart = segment.colStart;
    nextBlock.colSpan = Math.max(1, Math.min(6, segment.colSpan));
    nextBlock.rowSpan = 1;

    commitLayout([...layout.blocks, nextBlock], nextBlock.id);
    setSelectedBlockId(nextBlock.id);
  };

  const startDrag = (event: ReactPointerEvent, block: ActivityFormLayoutBlock, mode: DragMode) => {
    if (!containerRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const rect = containerRef.current.getBoundingClientRect();
    setSelectedBlockId(block.id);
    setDragState({
      blockId: block.id,
      mode,
      pointerX: event.clientX,
      pointerY: event.clientY,
      containerWidth: rect.width,
      initialBlock: block,
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        Monte o formulario em uma grade visual. Arraste pelo grip, redimensione pelas bordas e use os botoes de + nos espacos vazios para inserir novos campos.
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => onUpdate(defaultActivityFormLayout)}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Restaurar padrao
        </Button>
      </div>

      <div
        ref={containerRef}
        className="relative grid overflow-hidden rounded-xl border bg-muted/20 p-1.5"
        style={{
          gridTemplateColumns: `repeat(${FORM_LAYOUT_COLUMNS}, minmax(0, 1fr))`,
          gridAutoRows: `${FORM_LAYOUT_EDITOR_ROW_HEIGHT}px`,
          minHeight: editorRowCount * FORM_LAYOUT_EDITOR_ROW_HEIGHT,
          backgroundImage: `
            linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
          `,
          backgroundSize: `calc(100% / ${FORM_LAYOUT_COLUMNS}) ${FORM_LAYOUT_EDITOR_ROW_HEIGHT}px`,
        }}
      >
        {emptySegments.map((segment) => (
          <button
            key={segment.id}
            type="button"
            className="flex items-center justify-center rounded-md border border-dashed border-border/70 bg-background/55 text-muted-foreground transition hover:border-primary hover:text-primary"
            style={{
              gridColumn: `${segment.colStart} / span ${segment.colSpan}`,
              gridRow: `${segment.rowStart} / span 1`,
            }}
            onClick={() => addBlockAtSegment(segment)}
            aria-label="Adicionar novo bloco"
          >
            <Plus className="h-4 w-4" />
          </button>
        ))}

        {layout.blocks.map((block) => {
          const isSelected = block.id === selectedBlockId;

          return (
            <div
              key={block.id}
              style={getActivityFormBlockStyle(block)}
              className={`relative rounded-lg border bg-background shadow-sm transition ${
                isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border'
              }`}
              onClick={() => setSelectedBlockId(block.id)}
            >
              <div className="flex h-full items-start justify-between gap-1.5 p-1.5">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground transition hover:border-primary hover:text-primary"
                  onPointerDown={(event) => startDrag(event, block, 'move')}
                  aria-label="Mover bloco"
                >
                  <Grip className="h-4 w-4" />
                </button>

                <div className="min-w-0 flex-1">
                  <Select value={block.contentKey} onValueChange={(value) => updateBlockContent(block.id, value)}>
                    <SelectTrigger className="h-7">
                      <SelectValue>{previewText(block.contentKey, optionLabels)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground transition hover:border-destructive hover:text-destructive"
                  onClick={() => removeBlock(block.id)}
                  aria-label="Remover bloco"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r-lg bg-transparent transition hover:bg-primary/10"
                onPointerDown={(event) => startDrag(event, block, 'resize-x')}
                aria-label="Redimensionar largura"
              />
              <button
                type="button"
                className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize rounded-b-lg bg-transparent transition hover:bg-primary/10"
                onPointerDown={(event) => startDrag(event, block, 'resize-y')}
                aria-label="Redimensionar altura"
              />
              <button
                type="button"
                className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize rounded-br-lg border-l border-t bg-background/90"
                onPointerDown={(event) => startDrag(event, block, 'resize-both')}
                aria-label="Redimensionar bloco"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

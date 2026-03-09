import { ActivityFormLayoutBlock, ActivityFormLayoutSettings, CustomField } from '@/types';

export const FORM_LAYOUT_COLUMNS = 12;
export const FORM_LAYOUT_EDITOR_ROW_HEIGHT = 72;
export const FORM_LAYOUT_RENDER_ROW_HEIGHT = 44;
const LEGACY_WIDTH_SPANS = {
  full: 12,
  half: 6,
  third: 4,
  'two-thirds': 8,
} as const;

type LegacyWidth = keyof typeof LEGACY_WIDTH_SPANS;

function isLegacyWidth(value: unknown): value is LegacyWidth {
  return typeof value === 'string' && value in LEGACY_WIDTH_SPANS;
}

export const defaultActivityFormLayout: ActivityFormLayoutSettings = {
  blocks: [
    { id: 'title', contentKey: 'title', colStart: 1, rowStart: 1, colSpan: 12, rowSpan: 1 },
    { id: 'due-date', contentKey: 'dueDate', colStart: 1, rowStart: 2, colSpan: 6, rowSpan: 1 },
    { id: 'priority', contentKey: 'field:priority', colStart: 7, rowStart: 2, colSpan: 6, rowSpan: 1 },
    { id: 'description', contentKey: 'field:description', colStart: 1, rowStart: 3, colSpan: 12, rowSpan: 1 },
    { id: 'tags', contentKey: 'tags', colStart: 1, rowStart: 4, colSpan: 12, rowSpan: 1 },
    { id: 'dependencies', contentKey: 'dependencies', colStart: 1, rowStart: 5, colSpan: 12, rowSpan: 1 },
    { id: 'recurrence', contentKey: 'recurrence', colStart: 1, rowStart: 6, colSpan: 12, rowSpan: 1 },
    { id: 'observations', contentKey: 'observations', colStart: 1, rowStart: 7, colSpan: 12, rowSpan: 1 },
    { id: 'note-origin', contentKey: 'noteOrigin', colStart: 1, rowStart: 8, colSpan: 12, rowSpan: 1 },
  ],
};

export function clampActivityFormBlock(block: ActivityFormLayoutBlock): ActivityFormLayoutBlock {
  const colSpan = Math.max(1, Math.min(FORM_LAYOUT_COLUMNS, Math.round(block.colSpan)));
  const rowSpan = Math.max(1, Math.round(block.rowSpan));
  const colStart = Math.max(1, Math.min(FORM_LAYOUT_COLUMNS - colSpan + 1, Math.round(block.colStart)));
  const rowStart = Math.max(1, Math.round(block.rowStart));

  return {
    ...block,
    colStart,
    rowStart,
    colSpan,
    rowSpan,
  };
}

function normalizeLegacyBlocks(blocks: Array<Record<string, unknown>>) {
  let cursorColumn = 1;
  let cursorRow = 1;

  return blocks.flatMap((block, index) => {
    if (typeof block?.id !== 'string' || typeof block?.contentKey !== 'string' || !isLegacyWidth(block?.width)) {
      return [];
    }

    const colSpan = LEGACY_WIDTH_SPANS[block.width];
    if (cursorColumn + colSpan - 1 > FORM_LAYOUT_COLUMNS) {
      cursorColumn = 1;
      cursorRow += 1;
    }

    const normalized = clampActivityFormBlock({
      id: block.id || `legacy-${index}`,
      contentKey: block.contentKey,
      colStart: cursorColumn,
      rowStart: cursorRow,
      colSpan,
      rowSpan: 1,
    });

    cursorColumn += colSpan;
    if (cursorColumn > FORM_LAYOUT_COLUMNS) {
      cursorColumn = 1;
      cursorRow += 1;
    }

    return normalized;
  });
}

export function normalizeActivityFormLayout(layout: Partial<ActivityFormLayoutSettings> | null | undefined): ActivityFormLayoutSettings {
  if (!Array.isArray(layout?.blocks) || layout.blocks.length === 0) {
    return defaultActivityFormLayout;
  }

  const normalizedBlocks = layout.blocks.flatMap((block, index) => {
    if (
      typeof block?.id === 'string' &&
      typeof block?.contentKey === 'string' &&
      block.contentKey !== 'favorite' &&
      typeof block?.colStart === 'number' &&
      typeof block?.rowStart === 'number' &&
      typeof block?.colSpan === 'number' &&
      typeof block?.rowSpan === 'number'
    ) {
      return clampActivityFormBlock({
        id: block.id,
        contentKey: block.contentKey,
        colStart: block.colStart,
        rowStart: block.rowStart,
        colSpan: block.colSpan,
        rowSpan: block.rowSpan,
      });
    }

    return normalizeLegacyBlocks([block as Record<string, unknown>]).map((legacyBlock) => ({
      ...legacyBlock,
      id: legacyBlock.id || `block-${index}`,
    }));
  });

  if (normalizedBlocks.length === 0) {
    return defaultActivityFormLayout;
  }

  return { blocks: normalizedBlocks };
}

export function getActivityFormBlockStyle(block: ActivityFormLayoutBlock) {
  const normalized = clampActivityFormBlock(block);
  return {
    gridColumn: `${normalized.colStart} / span ${normalized.colSpan}`,
    gridRow: `${normalized.rowStart} / span ${normalized.rowSpan}`,
  };
}

export function getMaxFormLayoutRow(blocks: ActivityFormLayoutBlock[]) {
  return blocks.reduce((max, block) => Math.max(max, block.rowStart + block.rowSpan - 1), 1);
}

export function getNextFormLayoutRow(blocks: ActivityFormLayoutBlock[]) {
  return getMaxFormLayoutRow(blocks) + 1;
}

export function createActivityFormLayoutBlock(contentKey = 'title'): ActivityFormLayoutBlock {
  return {
    id: crypto.randomUUID(),
    contentKey,
    colStart: 1,
    rowStart: getNextFormLayoutRow(defaultActivityFormLayout.blocks),
    colSpan: 6,
    rowSpan: 1,
  };
}

function blocksOverlap(a: ActivityFormLayoutBlock, b: ActivityFormLayoutBlock) {
  const aColEnd = a.colStart + a.colSpan - 1;
  const bColEnd = b.colStart + b.colSpan - 1;
  const aRowEnd = a.rowStart + a.rowSpan - 1;
  const bRowEnd = b.rowStart + b.rowSpan - 1;

  return !(aColEnd < b.colStart || bColEnd < a.colStart || aRowEnd < b.rowStart || bRowEnd < a.rowStart);
}

function canPlaceBlock(candidate: ActivityFormLayoutBlock, placedBlocks: ActivityFormLayoutBlock[]) {
  return placedBlocks.every((block) => !blocksOverlap(candidate, block));
}

function findNextAvailablePosition(
  block: ActivityFormLayoutBlock,
  placedBlocks: ActivityFormLayoutBlock[],
  preferredColStart = block.colStart,
  preferredRowStart = block.rowStart
) {
  const maxColStart = FORM_LAYOUT_COLUMNS - block.colSpan + 1;
  const startingCol = Math.max(1, Math.min(maxColStart, preferredColStart));
  const searchLimit = Math.max(getMaxFormLayoutRow(placedBlocks) + block.rowSpan + 8, preferredRowStart + 8);

  for (let row = Math.max(1, preferredRowStart); row <= searchLimit; row += 1) {
    for (let col = row === preferredRowStart ? startingCol : 1; col <= maxColStart; col += 1) {
      const candidate = clampActivityFormBlock({
        ...block,
        rowStart: row,
        colStart: col,
      });

      if (canPlaceBlock(candidate, placedBlocks)) {
        return candidate;
      }
    }
  }

  return clampActivityFormBlock({
    ...block,
    rowStart: searchLimit + 1,
    colStart: 1,
  });
}

export function resolveActivityFormLayoutCollisions(
  blocks: ActivityFormLayoutBlock[],
  priorityBlockId?: string
) {
  const normalizedBlocks = blocks.map(clampActivityFormBlock);
  const priorityBlock = priorityBlockId
    ? normalizedBlocks.find((block) => block.id === priorityBlockId) ?? null
    : null;
  const remainingBlocks = normalizedBlocks.filter((block) => block.id !== priorityBlockId);
  const placedBlocks: ActivityFormLayoutBlock[] = [];
  const resolvedMap = new Map<string, ActivityFormLayoutBlock>();

  if (priorityBlock) {
    placedBlocks.push(priorityBlock);
    resolvedMap.set(priorityBlock.id, priorityBlock);
  }

  remainingBlocks.forEach((block) => {
    const resolved = canPlaceBlock(block, placedBlocks)
      ? block
      : findNextAvailablePosition(block, placedBlocks, block.colStart, block.rowStart);

    placedBlocks.push(resolved);
    resolvedMap.set(block.id, resolved);
  });

  return normalizedBlocks.map((block) => resolvedMap.get(block.id) ?? block);
}

export function getEmptyLayoutSegments(blocks: ActivityFormLayoutBlock[], rowCount: number) {
  const segments: Array<{ id: string; rowStart: number; colStart: number; colSpan: number }> = [];

  for (let row = 1; row <= rowCount; row += 1) {
    let col = 1;
    while (col <= FORM_LAYOUT_COLUMNS) {
      const occupied = blocks.some((block) => {
        const rowEnd = block.rowStart + block.rowSpan - 1;
        const colEnd = block.colStart + block.colSpan - 1;
        return row >= block.rowStart && row <= rowEnd && col >= block.colStart && col <= colEnd;
      });

      if (occupied) {
        col += 1;
        continue;
      }

      const startCol = col;
      while (col <= FORM_LAYOUT_COLUMNS) {
        const nextOccupied = blocks.some((block) => {
          const rowEnd = block.rowStart + block.rowSpan - 1;
          const colEnd = block.colStart + block.colSpan - 1;
          return row >= block.rowStart && row <= rowEnd && col >= block.colStart && col <= colEnd;
        });

        if (nextOccupied) {
          break;
        }
        col += 1;
      }

      segments.push({
        id: `empty-${row}-${startCol}`,
        rowStart: row,
        colStart: startCol,
        colSpan: col - startCol,
      });
    }
  }

  return segments;
}

export function getFormContentOptions(customFields: CustomField[]) {
  const baseOptions = [
    { value: 'title', label: 'Titulo' },
    { value: 'dueDate', label: 'Prazo' },
    { value: 'tags', label: 'Tags' },
    { value: 'dependencies', label: 'Predecessoras e sucessoras' },
    { value: 'recurrence', label: 'Recorrencia' },
    { value: 'observations', label: 'Observacoes' },
    { value: 'noteOrigin', label: 'Origem da nota' },
  ];

  const fieldOptions = customFields
    .filter((field) => field.enabled && field.display !== 'list' && field.key !== 'dueDate')
    .map((field) => ({
      value: `field:${field.key}`,
      label: `Campo: ${field.name}`,
    }));

  return [...baseOptions, ...fieldOptions];
}

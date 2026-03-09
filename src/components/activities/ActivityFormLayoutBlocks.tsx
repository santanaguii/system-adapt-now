import { ReactNode } from 'react';
import { ActivityFormLayoutSettings } from '@/types';
import {
  FORM_LAYOUT_RENDER_ROW_HEIGHT,
  getActivityFormBlockStyle,
  getMaxFormLayoutRow,
} from '@/lib/activity-form-layout';

interface ActivityFormLayoutBlocksProps {
  layout: ActivityFormLayoutSettings;
  contentByKey: Record<string, ReactNode | null>;
}

export function ActivityFormLayoutBlocks({
  layout,
  contentByKey,
}: ActivityFormLayoutBlocksProps) {
  const rowCount = getMaxFormLayoutRow(layout.blocks);

  return (
    <div
      className="grid gap-2 md:grid-cols-12"
      style={{
        gridAutoRows: `minmax(${FORM_LAYOUT_RENDER_ROW_HEIGHT}px, auto)`,
        minHeight: rowCount * FORM_LAYOUT_RENDER_ROW_HEIGHT,
      }}
    >
      {layout.blocks.map((block) => {
        const content = contentByKey[block.contentKey];
        if (!content) {
          return null;
        }

        return (
          <div key={block.id} style={getActivityFormBlockStyle(block)}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

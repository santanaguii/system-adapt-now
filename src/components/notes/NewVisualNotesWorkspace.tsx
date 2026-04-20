import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { format, addDays, subDays, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bold,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Heading1,
  Heading2,
  HelpCircle,
  Highlighter,
  X,
  Italic,
  List,
  Loader2,
  MessageSquare,
  PaintBucket,
  PanelLeftClose,
  PanelLeftOpen,
  Pilcrow,
  Quote,
  Redo2,
  Save,
  Underline,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DailyNote, NoteSearchResult, NoteTemplate } from '@/types';
import { SaveStatus } from '@/hooks/useNotes';
import { NotesSidebar } from './NotesSidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface NewVisualNotesWorkspaceProps {
  currentDate: Date;
  note: DailyNote;
  allDatesWithNotes: string[];
  onDateChange: (date: Date) => void;
  onSearch: (query: string) => NoteSearchResult[];
  onSelectSearchResult: (result: NoteSearchResult) => void;
  onReplaceContent: (date: Date, content: string) => void;
  onSave: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  autosaveEnabled: boolean;
  hasUnsavedChanges: boolean;
  saveStatus: SaveStatus;
  noteTemplates?: NoteTemplate[];
}

type RichBlockStyle = 'paragraph' | 'h1' | 'h2' | 'blockquote' | 'bullet' | 'comment';

const COLLAPSE_OPEN_ICON = '\u25BE';
const COLLAPSE_CLOSED_ICON = '\u25B8';
const PRESET_TEXT_COLORS = ['#2f241f', '#9f1239', '#1d4ed8', '#166534', '#7c3aed', '#b45309'];
const PRESET_BACKGROUND_COLORS = ['#fff4bf', '#fee2e2', '#dbeafe', '#dcfce7', '#ede9fe', '#fef3c7'];

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function looksLikeHtml(content: string) {
  return /<\/?[a-z][\s\S]*>/i.test(content);
}

function buildInitialHtml(note: DailyNote) {
  if (note.lines.length === 1 && looksLikeHtml(note.lines[0].content)) {
    return note.lines[0].content;
  }

  const paragraphs = note.lines.map((line) => `<p>${escapeHtml(line.content || '')}</p>`);
  return paragraphs.join('') || '<p></p>';
}

function templateToHtml(template: NoteTemplate): string {
  const parts: string[] = [];
  let i = 0;
  while (i < template.lines.length) {
    const line = template.lines[i];
    if (line.type === 'bullet') {
      const listItems: string[] = [];
      while (i < template.lines.length && template.lines[i].type === 'bullet') {
        listItems.push(`<li>${escapeHtml(template.lines[i].content)}</li>`);
        i++;
      }
      parts.push(`<ul>${listItems.join('')}</ul>`);
    } else if (line.type === 'title') {
      parts.push(`<h1>${escapeHtml(line.content)}</h1>`);
      i++;
    } else if (line.type === 'subtitle') {
      parts.push(`<h2>${escapeHtml(line.content)}</h2>`);
      i++;
    } else if (line.type === 'quote') {
      parts.push(`<blockquote>${escapeHtml(line.content)}</blockquote>`);
      i++;
    } else if (line.type === 'comment') {
      parts.push(`<p data-note-style="comment">${escapeHtml(line.content)}</p>`);
      i++;
    } else {
      parts.push(`<p>${escapeHtml(line.content)}</p>`);
      i++;
    }
  }
  return parts.join('') || '<p></p>';
}

function getSelectionBlock() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const anchorNode = selection.anchorNode;
  const element = anchorNode instanceof HTMLElement ? anchorNode : anchorNode?.parentElement;
  return element?.closest('h1, h2, blockquote, p, li, div') ?? null;
}

function getBlockTextContent(block: HTMLElement) {
  const clone = block.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[data-collapse-toggle]').forEach((node) => node.remove());
  return clone.textContent ?? '';
}

function isCommentBlock(block: HTMLElement) {
  return block.dataset.noteStyle === 'comment';
}

function clearCommentStyle(block: HTMLElement) {
  delete block.dataset.noteStyle;
  block.querySelectorAll<HTMLElement>('[data-note-style="comment"]').forEach((node) => {
    delete node.dataset.noteStyle;
  });
}

function getBaseBlockStyle(block: HTMLElement): Exclude<RichBlockStyle, 'comment'> {
  if (block.tagName === 'H1') return 'h1';
  if (block.tagName === 'H2') return 'h2';
  if (block.tagName === 'LI') return 'bullet';
  if (block.tagName === 'BLOCKQUOTE') return 'blockquote';
  return 'paragraph';
}

function supportsInlineFormatting(block: HTMLElement) {
  const baseStyle = getBaseBlockStyle(block);
  return baseStyle !== 'h1' && baseStyle !== 'h2';
}

function stripInlineFormatting(block: HTMLElement) {
  const formattingTags = ['B', 'STRONG', 'I', 'EM', 'U', 'FONT', 'MARK', 'SPAN'];

  Array.from(block.querySelectorAll('*')).forEach((node) => {
    if (!(node instanceof HTMLElement) || node.matches('[data-collapse-toggle]')) {
      return;
    }

    node.removeAttribute('style');

    if (!formattingTags.includes(node.tagName)) {
      return;
    }

    while (node.firstChild) {
      node.parentNode?.insertBefore(node.firstChild, node);
    }

    node.remove();
  });
}

function isBlockEmpty(block: HTMLElement) {
  return !getBlockTextContent(block).trim();
}

function getCaretOffsetWithinBlock(block: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(block);
  preRange.setEnd(range.endContainer, range.endOffset);
  return preRange.toString().length;
}

function getBlockTextLength(block: HTMLElement) {
  return getBlockTextContent(block).length;
}

function placeCaretInBlock(block: HTMLElement, position: 'start' | 'end') {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const range = document.createRange();
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parentElement = node.parentElement;
      if (parentElement?.closest('[data-collapse-toggle]')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let currentNode = walker.nextNode();
  while (currentNode) {
    textNodes.push(currentNode as Text);
    currentNode = walker.nextNode();
  }

  if (textNodes.length === 0) {
    range.selectNodeContents(block);
    range.collapse(position === 'start');
  } else {
    const targetNode = position === 'start' ? textNodes[0] : textNodes[textNodes.length - 1];
    const offset = position === 'start' ? 0 : targetNode.textContent?.length ?? 0;
    range.setStart(targetNode, offset);
    range.collapse(true);
  }

  selection.removeAllRanges();
  selection.addRange(range);
}

function extractBlockContent(block: HTMLElement) {
  const fragment = document.createDocumentFragment();
  Array.from(block.childNodes).forEach((child) => {
    if (child instanceof HTMLElement && child.matches('[data-collapse-toggle], [data-editor-placeholder]')) {
      return;
    }
    fragment.append(child.cloneNode(true));
  });
  return fragment;
}

function getHeadingLevel(element: Element | null) {
  if (!element) {
    return null;
  }

  if (element.tagName === 'H1') {
    return 1;
  }

  if (element.tagName === 'H2') {
    return 2;
  }

  return null;
}

function serializeEditorHtml(root: HTMLDivElement) {
  const clone = root.cloneNode(true) as HTMLDivElement;
  clone.querySelectorAll('[data-collapse-toggle]').forEach((node) => node.remove());
  clone.querySelectorAll('[data-editor-placeholder]').forEach((node) => node.remove());
  return clone.innerHTML.trim() || '<p></p>';
}

function unwrapBlockElement(block: HTMLElement) {
  const parent = block.parentNode;
  if (!parent) {
    return;
  }

  while (block.firstChild) {
    parent.insertBefore(block.firstChild, block);
  }
  parent.removeChild(block);
}

function replaceBlockTag(block: HTMLElement, nextTagName: 'p' | 'h1' | 'h2' | 'blockquote') {
  const replacement = document.createElement(nextTagName);

  Array.from(block.attributes).forEach((attribute) => {
    if (attribute.name === 'data-note-style' || attribute.name === 'data-collapsed' || attribute.name === 'data-collapsible-heading') {
      return;
    }
    replacement.setAttribute(attribute.name, attribute.value);
  });

  const content = extractBlockContent(block);
  replacement.append(content);
  block.replaceWith(replacement);
  return replacement;
}

function buildBlockFromSource(block: HTMLElement, nextTagName: 'p' | 'h1' | 'h2' | 'blockquote') {
  const replacement = document.createElement(nextTagName);

  Array.from(block.attributes).forEach((attribute) => {
    if (attribute.name === 'data-note-style' || attribute.name === 'data-collapsed' || attribute.name === 'data-collapsible-heading') {
      return;
    }
    replacement.setAttribute(attribute.name, attribute.value);
  });

  const content = extractBlockContent(block);
  replacement.append(content);
  return replacement;
}

function replaceListItemWithBlock(listItem: HTMLElement, nextTagName: 'p' | 'h1' | 'h2' | 'blockquote') {
  const list = listItem.parentElement;
  const parent = list?.parentElement;
  if (!list || !parent) {
    return null;
  }

  const replacement = buildBlockFromSource(listItem, nextTagName);
  const previousItems: HTMLElement[] = [];
  const nextItems: HTMLElement[] = [];

  Array.from(list.children).forEach((child) => {
    if (!(child instanceof HTMLElement) || child.tagName !== 'LI' || child === listItem) {
      return;
    }

    if (child.compareDocumentPosition(listItem) & Node.DOCUMENT_POSITION_FOLLOWING) {
      previousItems.push(child);
      return;
    }

    nextItems.push(child);
  });

  const createListClone = () => list.cloneNode(false) as HTMLElement;

  if (previousItems.length === 0 && nextItems.length === 0) {
    list.replaceWith(replacement);
    return replacement;
  }

  if (previousItems.length === 0) {
    listItem.remove();
    parent.insertBefore(replacement, list);
    return replacement;
  }

  if (nextItems.length === 0) {
    listItem.remove();
    parent.insertBefore(replacement, list.nextSibling);
    return replacement;
  }

  const trailingList = createListClone();
  nextItems.forEach((item) => trailingList.appendChild(item));
  listItem.remove();
  parent.insertBefore(replacement, list.nextSibling);
  parent.insertBefore(trailingList, replacement.nextSibling);
  return replacement;
}

function replaceBlockWithBullet(block: HTMLElement) {
  const list = document.createElement('ul');
  const listItem = document.createElement('li');
  const content = extractBlockContent(block);
  listItem.append(content);
  list.append(listItem);
  block.replaceWith(list);
  return listItem;
}

function getPreviousEditableBlock(block: HTMLElement) {
  if (block.tagName === 'LI') {
    const previousItem = block.previousElementSibling;
    if (previousItem instanceof HTMLElement) {
      return previousItem;
    }

    const list = block.parentElement;
    const previousBlock = list?.previousElementSibling;
    if (!previousBlock) {
      return null;
    }

    if ((previousBlock.tagName === 'UL' || previousBlock.tagName === 'OL') && previousBlock.lastElementChild instanceof HTMLElement) {
      return previousBlock.lastElementChild;
    }

    return previousBlock instanceof HTMLElement ? previousBlock : null;
  }

  const previousBlock = block.previousElementSibling;
  if (!previousBlock) {
    return null;
  }

  if ((previousBlock.tagName === 'UL' || previousBlock.tagName === 'OL') && previousBlock.lastElementChild instanceof HTMLElement) {
    return previousBlock.lastElementChild;
  }

  return previousBlock instanceof HTMLElement ? previousBlock : null;
}

function getNextEditableBlock(block: HTMLElement) {
  if (block.tagName === 'LI') {
    const nextItem = block.nextElementSibling;
    if (nextItem instanceof HTMLElement) {
      return nextItem;
    }

    const list = block.parentElement;
    const nextBlock = list?.nextElementSibling;
    if (!nextBlock) {
      return null;
    }

    if ((nextBlock.tagName === 'UL' || nextBlock.tagName === 'OL') && nextBlock.firstElementChild instanceof HTMLElement) {
      return nextBlock.firstElementChild;
    }

    return nextBlock instanceof HTMLElement ? nextBlock : null;
  }

  const nextBlock = block.nextElementSibling;
  if (!nextBlock) {
    return null;
  }

  if ((nextBlock.tagName === 'UL' || nextBlock.tagName === 'OL') && nextBlock.firstElementChild instanceof HTMLElement) {
    return nextBlock.firstElementChild;
  }

  return nextBlock instanceof HTMLElement ? nextBlock : null;
}

function insertParagraphAfterBlock(block: HTMLElement) {
  const paragraph = document.createElement('p');
  block.insertAdjacentElement('afterend', paragraph);
  return paragraph;
}

function insertListItemAfterBlock(listItem: HTMLElement) {
  const nextListItem = document.createElement('li');
  listItem.insertAdjacentElement('afterend', nextListItem);
  return nextListItem;
}

function normalizeEmptyStructuralBlocks(root: HTMLDivElement) {
  let changed = false;

  root.querySelectorAll('div').forEach((node) => {
    const block = node as HTMLElement;
    if (block.dataset.collapseToggle) {
      return;
    }

    replaceBlockTag(block, 'p');
    changed = true;
  });

  return changed;
}

function syncEditablePlaceholder(root: HTMLDivElement, activeBlock?: HTMLElement | null) {
  root.querySelectorAll('[data-editor-placeholder]').forEach((node) => node.remove());

  if (!activeBlock || !root.contains(activeBlock) || !isBlockEmpty(activeBlock)) {
    return;
  }

  const br = document.createElement('br');
  br.setAttribute('data-editor-placeholder', 'true');
  activeBlock.append(br);
}

function ensureHeadingControls(root: HTMLDivElement) {
  root.querySelectorAll('h1, h2').forEach((heading) => {
    const headingElement = heading as HTMLElement;
    if (!headingElement.hasAttribute('data-collapsed')) {
      headingElement.setAttribute('data-collapsed', 'false');
    }
    headingElement.setAttribute('data-collapsible-heading', 'true');

    const icon = headingElement.dataset.collapsed === 'true' ? COLLAPSE_CLOSED_ICON : COLLAPSE_OPEN_ICON;
    const existingToggle = headingElement.querySelector<HTMLElement>('[data-collapse-toggle]');
    if (existingToggle) {
      existingToggle.textContent = icon;
      return;
    }

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.setAttribute('contenteditable', 'false');
    toggle.setAttribute('data-collapse-toggle', 'true');
    toggle.className =
      'absolute -left-8 top-1/2 z-10 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md border border-transparent bg-transparent text-[10px] text-muted-foreground/65 transition hover:text-foreground/80';
    toggle.textContent = icon;
    headingElement.append(toggle);
  });
}

function applyCollapsedVisibility(root: HTMLDivElement, hideComments: boolean) {
  const directChildren = Array.from(root.children) as HTMLElement[];
  let collapsedHeading: { level: number } | null = null;

  directChildren.forEach((child) => {
    const headingLevel = getHeadingLevel(child);
    const isComment = isCommentBlock(child);
    const hiddenByComment = hideComments && isComment;

    if (headingLevel !== null) {
      if (collapsedHeading && headingLevel <= collapsedHeading.level) {
        collapsedHeading = null;
      }

      const isCollapsed = child.dataset.collapsed === 'true';
      child.hidden = hiddenByComment;

      const toggle = child.querySelector<HTMLElement>('[data-collapse-toggle]');
      if (toggle) {
        toggle.textContent = isCollapsed ? COLLAPSE_CLOSED_ICON : COLLAPSE_OPEN_ICON;
      }

      if (!hiddenByComment) {
        collapsedHeading = isCollapsed ? { level: headingLevel } : collapsedHeading;
      }
      return;
    }

    const hiddenByCollapse = collapsedHeading !== null;
    const isList = child.tagName === 'UL' || child.tagName === 'OL';

    if (isList) {
      const listItems = Array.from(child.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node.tagName === 'LI');

      if (hiddenByCollapse) {
        child.hidden = true;
        listItems.forEach((item) => {
          item.hidden = true;
        });
        return;
      }

      listItems.forEach((item) => {
        item.hidden = hideComments && isCommentBlock(item);
      });
      child.hidden = hiddenByComment || (listItems.length > 0 && listItems.every((item) => item.hidden));
      return;
    }

    child.hidden = hiddenByCollapse || hiddenByComment;
  });
}

function renderSaveStatus(saveStatus: SaveStatus, autosaveEnabled: boolean, hasUnsavedChanges: boolean) {
  if (!autosaveEnabled) {
    if (saveStatus === 'saving') {
      return (
        <span className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Salvando...
        </span>
      );
    }
    if (saveStatus === 'saved') {
      return <span className="text-green-600">Salvo</span>;
    }
    if (saveStatus === 'error') {
      return <span className="text-destructive">Erro ao salvar</span>;
    }
    return <span className="text-muted-foreground">{hasUnsavedChanges ? 'Alterações não salvas' : 'Salvamento manual'}</span>;
  }

  if (saveStatus === 'saving') {
    return (
      <span className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Salvando...
      </span>
    );
  }
  if (saveStatus === 'saved') {
    return <span className="text-green-600">Salvo</span>;
  }
  if (saveStatus === 'error') {
    return <span className="text-destructive">Erro ao salvar</span>;
  }
  return <span className="text-muted-foreground">Salvamento automático</span>;
}

export function NewVisualNotesWorkspace({
  currentDate,
  note,
  allDatesWithNotes,
  onDateChange,
  onSearch,
  onSelectSearchResult,
  onReplaceContent,
  onSave,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  autosaveEnabled,
  hasUnsavedChanges,
  saveStatus,
  noteTemplates = [],
}: NewVisualNotesWorkspaceProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const [activeStyle, setActiveStyle] = useState<RichBlockStyle>('paragraph');
  const [isBoldActive, setIsBoldActive] = useState(false);
  const [isItalicActive, setIsItalicActive] = useState(false);
  const [isUnderlineActive, setIsUnderlineActive] = useState(false);
  const [canUseInlineFormatting, setCanUseInlineFormatting] = useState(true);
  const [hideComments, setHideComments] = useState(false);
  const [textColor, setTextColor] = useState('#2f241f');
  const [backgroundColor, setBackgroundColor] = useState('#fff4bf');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const noteText = useMemo(() => buildInitialHtml(note), [note]);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    const currentSerializedContent = serializeEditorHtml(editorRef.current);
    if (currentSerializedContent !== noteText) {
      editorRef.current.innerHTML = noteText;
      const normalizedOnLoad = normalizeEmptyStructuralBlocks(editorRef.current);
      syncEditablePlaceholder(editorRef.current, null);
      ensureHeadingControls(editorRef.current);
      applyCollapsedVisibility(editorRef.current, hideComments);
      if (normalizedOnLoad) {
        const normalizedHtml = serializeEditorHtml(editorRef.current);
        if (normalizedHtml !== noteText) {
          onReplaceContent(currentDate, normalizedHtml);
        }
      }
    }
  }, [hideComments, note.date, noteText]);

  const handleChange = (value: string) => {
    onReplaceContent(currentDate, value);
  };

  const saveEditorSelection = () => {
    if (!editorRef.current) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    const commonAncestor =
      range.commonAncestorContainer instanceof HTMLElement
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;

    if (!commonAncestor || !editorRef.current.contains(commonAncestor)) {
      return;
    }

    savedSelectionRef.current = range.cloneRange();
  };

  const restoreEditorSelection = () => {
    const selection = window.getSelection();
    if (!selection || !savedSelectionRef.current) {
      return;
    }

    selection.removeAllRanges();
    selection.addRange(savedSelectionRef.current);
  };

  const handleToolbarMouseDown = (_event: React.MouseEvent<HTMLElement>) => {
    saveEditorSelection();
  };

  const updateToolbarState = () => {
    const block = getSelectionBlock();

    if (editorRef.current) {
      normalizeEmptyStructuralBlocks(editorRef.current);
      syncEditablePlaceholder(editorRef.current, block instanceof HTMLElement ? block : null);
      ensureHeadingControls(editorRef.current);
      applyCollapsedVisibility(editorRef.current, hideComments);
    }

    saveEditorSelection();
    if (!block) {
      return;
    }

    if (block instanceof HTMLElement && isCommentBlock(block)) {
      setActiveStyle('comment');
    } else if (block.tagName === 'H1') {
      setActiveStyle('h1');
    } else if (block.tagName === 'H2') {
      setActiveStyle('h2');
    } else if (block.tagName === 'LI') {
      setActiveStyle('bullet');
    } else if (block.tagName === 'BLOCKQUOTE') {
      setActiveStyle('blockquote');
    } else {
      setActiveStyle('paragraph');
    }

    const allowInlineFormatting = block instanceof HTMLElement && supportsInlineFormatting(block);
    setCanUseInlineFormatting(allowInlineFormatting);

    if (allowInlineFormatting) {
      setIsBoldActive(document.queryCommandState('bold'));
      setIsItalicActive(document.queryCommandState('italic'));
      setIsUnderlineActive(document.queryCommandState('underline'));
      return;
    }

    setIsBoldActive(false);
    setIsItalicActive(false);
    setIsUnderlineActive(false);
  };

  const persistEditorContent = () => {
    if (!editorRef.current) {
      handleChange('<p></p>');
      return;
    }

    handleChange(serializeEditorHtml(editorRef.current));
  };

  const runEditorCommand = (command: string, value?: string) => {
    restoreEditorSelection();
    editorRef.current?.focus();
    const currentBlock = getSelectionBlock();
    if (currentBlock instanceof HTMLElement && !supportsInlineFormatting(currentBlock)) {
      updateToolbarState();
      return;
    }
    document.execCommand(command, false, value);
    updateToolbarState();
    persistEditorContent();
  };

  const applyBlockStyle = (value: RichBlockStyle) => {
    saveEditorSelection();
    restoreEditorSelection();
    editorRef.current?.focus();

    const currentBlock = getSelectionBlock();
    if (!(currentBlock instanceof HTMLElement)) {
      return;
    }

    let targetBlock: HTMLElement | null = currentBlock;
    let shouldEnableComment = false;

    if (value === 'comment') {
      if (isCommentBlock(targetBlock)) {
        clearCommentStyle(targetBlock);
      } else {
        shouldEnableComment = true;
      }
    } else if (value === 'bullet') {
      clearCommentStyle(currentBlock);
      targetBlock = currentBlock.tagName === 'LI' ? currentBlock : replaceBlockWithBullet(currentBlock);
    } else {
      clearCommentStyle(currentBlock);

      if (currentBlock.tagName === 'LI') {
        const nextTagName = value === 'paragraph' ? 'p' : value;
        targetBlock = replaceListItemWithBlock(currentBlock, nextTagName);
      } else if (targetBlock instanceof HTMLElement) {
        const nextTagName = value === 'paragraph' ? 'p' : value;
        targetBlock = replaceBlockTag(targetBlock, nextTagName);
      }
    }

    if (targetBlock instanceof HTMLElement) {
      if (shouldEnableComment) {
        targetBlock.dataset.noteStyle = 'comment';
      } else if (value !== 'comment') {
        clearCommentStyle(targetBlock);
      }

      if (value === 'h1' || value === 'h2') {
        stripInlineFormatting(targetBlock);
      }

      placeCaretInBlock(targetBlock, 'end');
    }

    if (editorRef.current) {
      syncEditablePlaceholder(editorRef.current, targetBlock);
    }

    updateToolbarState();
    persistEditorContent();
  };

  const getPrefixFormatting = (text: string): { value: RichBlockStyle; prefixLength: number } | null => {
    const prefixMap: Array<[string, RichBlockStyle]> = [
      ['## ', 'h2'],
      ['# ', 'h1'],
      ['// ', 'comment'],
      ['> ', 'blockquote'],
      ['- ', 'bullet'],
      ['* ', 'bullet'],
    ];

    for (const [prefix, value] of prefixMap) {
      if (text.startsWith(prefix)) {
        return { value, prefixLength: prefix.length };
      }
    }

    return null;
  };

  const removePrefixText = (block: HTMLElement, count: number) => {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null);
    let currentNode = walker.nextNode() as Text | null;

    while (currentNode && count > 0) {
      const text = currentNode.textContent ?? '';
      if (text.length <= count) {
        currentNode.textContent = '';
        count -= text.length;
      } else {
        currentNode.textContent = text.slice(count);
        count = 0;
      }
      currentNode = walker.nextNode() as Text | null;
    }
  };

  const applyPrefixFormatting = (block: HTMLElement) => {
    const blockText = getBlockTextContent(block);
    const formatting = getPrefixFormatting(blockText);
    if (!formatting) {
      return false;
    }

    removePrefixText(block, formatting.prefixLength);
    applyBlockStyle(formatting.value);
    return true;
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      normalizeEmptyStructuralBlocks(editorRef.current);
      ensureHeadingControls(editorRef.current);

      const currentBlock = getSelectionBlock();
      syncEditablePlaceholder(editorRef.current, currentBlock instanceof HTMLElement ? currentBlock : null);
      if (currentBlock instanceof HTMLElement) {
        const transformed = applyPrefixFormatting(currentBlock);
        if (transformed) {
          ensureHeadingControls(editorRef.current);
        }
      }
    }
    persistEditorContent();
    updateToolbarState();
  };

  const handleCollapseToggle = (target: HTMLElement) => {
    const heading = target.closest('h1, h2') as HTMLElement | null;
    if (!heading || !editorRef.current) {
      return;
    }

    heading.dataset.collapsed = heading.dataset.collapsed === 'true' ? 'false' : 'true';
    applyCollapsedVisibility(editorRef.current, hideComments);
    persistEditorContent();
  };

  const handleApplyTemplate = (template: NoteTemplate) => {
    if (!editorRef.current) return;
    const html = templateToHtml(template);
    editorRef.current.innerHTML = html;
    normalizeEmptyStructuralBlocks(editorRef.current);
    ensureHeadingControls(editorRef.current);
    applyCollapsedVisibility(editorRef.current, hideComments);
    syncEditablePlaceholder(editorRef.current, null);
    persistEditorContent();
    updateToolbarState();
    editorRef.current.focus();
  };

  const handleEditorKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!editorRef.current) {
      return;
    }

    if (event.ctrlKey && !event.altKey && !event.metaKey) {
      const formattingShortcutMap: Record<string, { command: string; value?: string }> = {
        b: { command: 'bold' },
        i: { command: 'italic' },
        u: { command: 'underline' },
      };

      const formattingShortcut = formattingShortcutMap[event.key.toLowerCase()];
      if (formattingShortcut) {
        event.preventDefault();
        runEditorCommand(formattingShortcut.command, formattingShortcut.value);
        return;
      }

      const shortcutMap: Record<string, RichBlockStyle> = {
        '1': 'h1',
        '2': 'h2',
        '3': 'blockquote',
        '4': 'bullet',
        '5': 'comment',
        '0': 'paragraph',
      };

      const shortcutValue = shortcutMap[event.key];
      if (shortcutValue) {
        event.preventDefault();
        applyBlockStyle(shortcutValue);
        return;
      }

      if (event.key.toLowerCase() === 'z' && onUndo) {
        event.preventDefault();
        onUndo();
        return;
      }

      if (event.key.toLowerCase() === 'y' && onRedo) {
        event.preventDefault();
        onRedo();
        return;
      }
    }

    if (event.key === 'Enter') {
      const currentBlock = getSelectionBlock();
      if (!(currentBlock instanceof HTMLElement)) {
        return;
      }

      event.preventDefault();

      const blockIsEmpty = isBlockEmpty(currentBlock);
      const blockHasFormatting = currentBlock.tagName !== 'P' || isCommentBlock(currentBlock);

      if (blockIsEmpty && blockHasFormatting) {
        clearCommentStyle(currentBlock);
        let targetBlock: HTMLElement = currentBlock;
        if (currentBlock.tagName === 'LI') {
          targetBlock = replaceListItemWithBlock(currentBlock, 'p') ?? currentBlock;
        } else if (currentBlock.tagName !== 'P') {
          targetBlock = replaceBlockTag(currentBlock, 'p');
        }
        syncEditablePlaceholder(editorRef.current, targetBlock);
        ensureHeadingControls(editorRef.current);
        applyCollapsedVisibility(editorRef.current, hideComments);
        placeCaretInBlock(targetBlock, 'start');
        updateToolbarState();
        persistEditorContent();
        return;
      }

      const nextBlock =
        currentBlock.tagName === 'LI'
          ? insertListItemAfterBlock(currentBlock)
          : insertParagraphAfterBlock(currentBlock);

      clearCommentStyle(nextBlock);
      syncEditablePlaceholder(editorRef.current, nextBlock);
      ensureHeadingControls(editorRef.current);
      applyCollapsedVisibility(editorRef.current, hideComments);
      placeCaretInBlock(nextBlock, 'start');
      updateToolbarState();
      persistEditorContent();
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
      return;
    }

    const currentBlock = getSelectionBlock();
    if (!(currentBlock instanceof HTMLElement)) {
      return;
    }

    const caretOffset = getCaretOffsetWithinBlock(currentBlock);
    const blockLength = getBlockTextLength(currentBlock);
    const previousBlock = getPreviousEditableBlock(currentBlock);
    const nextBlock = getNextEditableBlock(currentBlock);

    if (event.key === 'Backspace' && isBlockEmpty(currentBlock)) {
      const hasFormatting = isCommentBlock(currentBlock) || getBaseBlockStyle(currentBlock) !== 'paragraph';

      if (hasFormatting) {
        event.preventDefault();
        clearCommentStyle(currentBlock);
        let targetBlock: HTMLElement = currentBlock;
        if (currentBlock.tagName === 'LI') {
          targetBlock = replaceListItemWithBlock(currentBlock, 'p') ?? currentBlock;
        } else if (currentBlock.tagName !== 'P') {
          targetBlock = replaceBlockTag(currentBlock, 'p');
        }
        syncEditablePlaceholder(editorRef.current, targetBlock);
        ensureHeadingControls(editorRef.current);
        applyCollapsedVisibility(editorRef.current, hideComments);
        placeCaretInBlock(targetBlock, 'start');
        updateToolbarState();
        persistEditorContent();
        return;
      }

      if (!previousBlock && !nextBlock) {
        return;
      }

      event.preventDefault();
      const focusTarget = previousBlock ?? nextBlock;
      const focusPosition = previousBlock ? 'end' : 'start';
      currentBlock.remove();
      syncEditablePlaceholder(editorRef.current, focusTarget);
      ensureHeadingControls(editorRef.current);
      applyCollapsedVisibility(editorRef.current, hideComments);
      if (focusTarget) {
        placeCaretInBlock(focusTarget, focusPosition);
      }
      updateToolbarState();
      persistEditorContent();
      return;
    }

    if (event.key === 'Backspace' && caretOffset === 0 && previousBlock) {
      const shouldResetFormatting = isCommentBlock(currentBlock) || getBaseBlockStyle(currentBlock) !== 'paragraph';
      if (shouldResetFormatting) {
        event.preventDefault();
        clearCommentStyle(currentBlock);

        let targetBlock = currentBlock;
        if (currentBlock.tagName === 'LI') {
          targetBlock = replaceListItemWithBlock(currentBlock, 'p') ?? currentBlock;
        } else if (currentBlock.tagName !== 'P') {
          targetBlock = replaceBlockTag(currentBlock, 'p');
        }

        syncEditablePlaceholder(editorRef.current, targetBlock);
        ensureHeadingControls(editorRef.current);
        applyCollapsedVisibility(editorRef.current, hideComments);
        placeCaretInBlock(targetBlock, 'start');
        updateToolbarState();
        persistEditorContent();
        return;
      }

      event.preventDefault();
      const contentToMove = extractBlockContent(currentBlock);
      const insertBeforeNode = previousBlock.querySelector('[data-collapse-toggle]');
      if (getBlockTextLength(previousBlock) > 0 && getBlockTextLength(currentBlock) > 0) {
        previousBlock.insertBefore(document.createTextNode(' '), insertBeforeNode);
      }
      previousBlock.insertBefore(contentToMove, insertBeforeNode);
      currentBlock.remove();
      syncEditablePlaceholder(editorRef.current, previousBlock);
      ensureHeadingControls(editorRef.current);
      applyCollapsedVisibility(editorRef.current, hideComments);
      placeCaretInBlock(previousBlock, 'end');
      updateToolbarState();
      persistEditorContent();
      return;
    }

    if (event.key === 'Delete' && caretOffset === blockLength && nextBlock) {
      event.preventDefault();
      const contentToMove = extractBlockContent(nextBlock);
      const insertBeforeNode = currentBlock.querySelector('[data-collapse-toggle]');
      if (getBlockTextLength(currentBlock) > 0 && getBlockTextLength(nextBlock) > 0) {
        currentBlock.insertBefore(document.createTextNode(' '), insertBeforeNode);
      }
      currentBlock.insertBefore(contentToMove, insertBeforeNode);
      const nextBlockParentList = nextBlock.tagName === 'LI' ? nextBlock.parentElement : null;
      nextBlock.remove();
      if (nextBlockParentList && !nextBlockParentList.hasChildNodes()) {
        nextBlockParentList.remove();
      }
      syncEditablePlaceholder(editorRef.current, currentBlock);
      ensureHeadingControls(editorRef.current);
      applyCollapsedVisibility(editorRef.current, hideComments);
      placeCaretInBlock(currentBlock, 'end');
      updateToolbarState();
      persistEditorContent();
    }
  };

  const isTodayDate = isToday(currentDate);
  const todayDate = new Date();

  return (
    <div className="min-h-0 flex flex-1 overflow-hidden bg-[#f6f1e8]">
      {/* Sidebar */}
      {!sidebarCollapsed && (
        <aside className="w-[300px] shrink-0 border-r bg-background">
          <NotesSidebar
            dates={allDatesWithNotes}
            currentDate={currentDate}
            onSelectDate={onDateChange}
            onSearch={onSearch}
            onSelectSearchResult={onSelectSearchResult}
            showDateButtons={false}
          />
        </aside>
      )}

      <main className="min-h-0 flex-1 overflow-auto p-3 md:p-4">
        <div className="flex min-h-full flex-col rounded-[28px] border bg-background shadow-sm">

          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div className="flex items-center gap-3">
              {/* Toggle sidebar */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground"
                onClick={() => setSidebarCollapsed((v) => !v)}
                title={sidebarCollapsed ? 'Mostrar calendário' : 'Ocultar calendário'}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </Button>

              {/* Date navigation */}
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onDateChange(subDays(currentDate, 1))}
                  title="Dia anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex flex-col items-center min-w-[140px]">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>{format(currentDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight leading-tight">
                    {format(currentDate, 'EEEE', { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase())}
                  </h2>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onDateChange(addDays(currentDate, 1))}
                  title="Próximo dia"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {!isTodayDate && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => onDateChange(todayDate)}
                >
                  Hoje
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm">
              <div>{renderSaveStatus(saveStatus, autosaveEnabled, hasUnsavedChanges)}</div>

              {/* Templates */}
              {noteTemplates.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full px-3">
                      <FileText className="h-4 w-4" />
                      Template
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Aplicar template</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {noteTemplates.map((template) => (
                      <DropdownMenuItem key={template.id} onClick={() => handleApplyTemplate(template)}>
                        {template.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {!autosaveEnabled && (
                <Button type="button" onClick={onSave} disabled={!hasUnsavedChanges} size="sm" className="h-8 rounded-full px-3">
                  <Save className="h-4 w-4" />
                  Salvar
                </Button>
              )}
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b px-5 py-2.5" onMouseDown={handleToolbarMouseDown}>

            {/* Grupo 1: Estilo de bloco */}
            <div className="flex flex-wrap items-center gap-0.5 rounded-xl border bg-muted/25 p-1">
              {([
                { id: 'paragraph', icon: Pilcrow, label: 'Texto' },
                { id: 'h1', icon: Heading1, label: 'Título' },
                { id: 'h2', icon: Heading2, label: 'Subtítulo' },
                { id: 'bullet', icon: List, label: 'Tópico' },
                { id: 'blockquote', icon: Quote, label: 'Citação' },
                { id: 'comment', icon: MessageSquare, label: 'Comentário' },
              ] as const).map(({ id, icon: Icon, label }) => (
                <Button
                  key={id}
                  type="button"
                  variant={activeStyle === id ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 rounded-lg px-2 text-xs gap-1"
                  onClick={() => applyBlockStyle(id as RichBlockStyle)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </Button>
              ))}
            </div>

            {/* Separador */}
            <div className="h-6 w-px bg-border" />

            {/* Grupo 2: Formatação inline */}
            <div className="flex items-center gap-0.5 rounded-xl border bg-muted/25 p-1">
              <Button
                type="button"
                variant={isBoldActive ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7 rounded-lg"
                disabled={!canUseInlineFormatting}
                onClick={() => runEditorCommand('bold')}
                title="Negrito (Ctrl+B)"
              >
                <Bold className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant={isItalicActive ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7 rounded-lg"
                disabled={!canUseInlineFormatting}
                onClick={() => runEditorCommand('italic')}
                title="Itálico (Ctrl+I)"
              >
                <Italic className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant={isUnderlineActive ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7 rounded-lg"
                disabled={!canUseInlineFormatting}
                onClick={() => runEditorCommand('underline')}
                title="Sublinhado (Ctrl+U)"
              >
                <Underline className="h-3.5 w-3.5" />
              </Button>

              <div className="mx-1 h-4 w-px bg-border" />

              {/* Cor do texto */}
              <div className="flex items-center gap-0.5">
                <label
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  title="Cor do texto"
                >
                  <PaintBucket className="h-3.5 w-3.5" />
                  <input
                    type="color"
                    value={textColor}
                    disabled={!canUseInlineFormatting}
                    onChange={(event) => {
                      setTextColor(event.target.value);
                      runEditorCommand('foreColor', event.target.value);
                    }}
                    className="sr-only"
                  />
                </label>
                {PRESET_TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="h-4 w-4 rounded-full border border-border/70 transition hover:scale-110"
                    disabled={!canUseInlineFormatting}
                    style={{ backgroundColor: color }}
                    title="Cor do texto"
                    onClick={() => {
                      setTextColor(color);
                      runEditorCommand('foreColor', color);
                    }}
                  />
                ))}
              </div>

              <div className="mx-1 h-4 w-px bg-border" />

              {/* Cor de fundo */}
              <div className="flex items-center gap-0.5">
                <label
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  title="Cor de fundo"
                >
                  <Highlighter className="h-3.5 w-3.5" />
                  <input
                    type="color"
                    value={backgroundColor}
                    disabled={!canUseInlineFormatting}
                    onChange={(event) => {
                      setBackgroundColor(event.target.value);
                      runEditorCommand('hiliteColor', event.target.value);
                    }}
                    className="sr-only"
                  />
                </label>
                {PRESET_BACKGROUND_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="h-4 w-4 rounded-full border border-border/70 transition hover:scale-110"
                    disabled={!canUseInlineFormatting}
                    style={{ backgroundColor: color }}
                    title="Cor de fundo"
                    onClick={() => {
                      setBackgroundColor(color);
                      runEditorCommand('hiliteColor', color);
                    }}
                  />
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg"
                  disabled={!canUseInlineFormatting}
                  onClick={() => runEditorCommand('hiliteColor', 'transparent')}
                  title="Remover cor de fundo"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Separador */}
            <div className="h-6 w-px bg-border" />

            {/* Grupo 3: Ações */}
            <div className="flex items-center gap-0.5 rounded-xl border bg-muted/25 p-1">
              {onUndo && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg"
                  disabled={!canUndo}
                  onClick={onUndo}
                  title="Desfazer (Ctrl+Z)"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
              )}
              {onRedo && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg"
                  disabled={!canRedo}
                  onClick={onRedo}
                  title="Refazer (Ctrl+Y)"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                type="button"
                variant={hideComments ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7 rounded-lg"
                onClick={() => {
                  const nextValue = !hideComments;
                  setHideComments(nextValue);
                  if (editorRef.current) {
                    applyCollapsedVisibility(editorRef.current, nextValue);
                  }
                }}
                title={hideComments ? 'Mostrar comentários' : 'Ocultar comentários'}
              >
                {hideComments ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </Button>
            </div>

            {/* Help popover */}
            <div className="ml-auto">
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground">
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 text-xs">
                  <p className="mb-2 font-semibold text-sm">Atalhos de teclado</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                    <span><kbd className="font-medium text-foreground">Ctrl+1</kbd> Título</span>
                    <span><kbd className="font-medium text-foreground">Ctrl+2</kbd> Subtítulo</span>
                    <span><kbd className="font-medium text-foreground">Ctrl+3</kbd> Citação</span>
                    <span><kbd className="font-medium text-foreground">Ctrl+4</kbd> Tópico</span>
                    <span><kbd className="font-medium text-foreground">Ctrl+5</kbd> Comentário</span>
                    <span><kbd className="font-medium text-foreground">Ctrl+0</kbd> Texto</span>
                    <span><kbd className="font-medium text-foreground">Ctrl+B</kbd> Negrito</span>
                    <span><kbd className="font-medium text-foreground">Ctrl+I</kbd> Itálico</span>
                    <span><kbd className="font-medium text-foreground">Ctrl+U</kbd> Sublinhado</span>
                    <span><kbd className="font-medium text-foreground">Ctrl+Z</kbd> Desfazer</span>
                    <span><kbd className="font-medium text-foreground">Ctrl+Y</kbd> Refazer</span>
                    <span><kbd className="font-medium text-foreground"># </kbd> → Título</span>
                    <span><kbd className="font-medium text-foreground">## </kbd> → Subtítulo</span>
                    <span><kbd className="font-medium text-foreground">- </kbd> → Tópico</span>
                    <span><kbd className="font-medium text-foreground">&gt; </kbd> → Citação</span>
                    <span><kbd className="font-medium text-foreground">// </kbd> → Comentário</span>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 px-5 py-4">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onKeyDown={handleEditorKeyDown}
              onInput={handleEditorInput}
              onFocus={updateToolbarState}
              onBlur={() => {
                if (editorRef.current) {
                  syncEditablePlaceholder(editorRef.current, null);
                }
              }}
              onKeyUp={updateToolbarState}
              onMouseUp={updateToolbarState}
              onClick={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest('[data-collapse-toggle]')) {
                  event.preventDefault();
                  handleCollapseToggle(target);
                  return;
                }
                updateToolbarState();
              }}
              className="rich-note-editor min-h-[calc(100vh-280px)] w-full rounded-2xl border border-transparent bg-transparent px-5 text-[17px] leading-6 text-foreground outline-none [&_[data-collapse-toggle]]:no-underline [&_[data-collapse-toggle]]:not-italic [&_blockquote]:my-1 [&_blockquote]:ml-0 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_h1]:mb-1 [&_h1]:mt-2 [&_h1]:ml-0 [&_h1]:px-0 [&_h1]:py-0 [&_h1]:text-[2.6rem] [&_h1]:font-bold [&_h1]:leading-tight [&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:ml-0 [&_h2]:px-0 [&_h2]:py-0 [&_h2]:text-[2rem] [&_h2]:font-semibold [&_h2]:leading-tight [&_h1[data-collapsible-heading='true']]:relative [&_h2[data-collapsible-heading='true']]:relative [&_ol]:my-1 [&_ol]:ml-0 [&_ol]:pl-8 [&_p]:my-1 [&_p]:ml-0[&_ul]:my-1 [&_ul]:ml-0 [&_ul]:list-disc [&_ul]:pl-8"
              data-placeholder="Escreva livremente aqui..."
            />
          </div>
        </div>
      </main>
    </div>
  );
}

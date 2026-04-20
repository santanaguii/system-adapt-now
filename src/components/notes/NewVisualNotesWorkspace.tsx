import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bold,
  CalendarDays,
  Eye,
  EyeOff,
  Heading1,
  Heading2,
  Highlighter,
  X,
  Italic,
  List,
  Loader2,
  MessageSquare,
  PaintBucket,
  Pilcrow,
  Quote,
  Save,
  Underline,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DailyNote, NoteSearchResult } from '@/types';
import { SaveStatus } from '@/hooks/useNotes';
import { NotesSidebar } from './NotesSidebar';

interface NewVisualNotesWorkspaceProps {
  currentDate: Date;
  note: DailyNote;
  allDatesWithNotes: string[];
  onDateChange: (date: Date) => void;
  onSearch: (query: string) => NoteSearchResult[];
  onSelectSearchResult: (result: NoteSearchResult) => void;
  onReplaceContent: (date: Date, content: string) => void;
  onSave: () => void;
  autosaveEnabled: boolean;
  hasUnsavedChanges: boolean;
  saveStatus: SaveStatus;
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
    if (child instanceof HTMLElement && child.matches('[data-collapse-toggle]')) {
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

  root.querySelectorAll('h1, h2, blockquote').forEach((node) => {
    const block = node as HTMLElement;
    if (!isBlockEmpty(block)) {
      return;
    }

    replaceBlockTag(block, 'p');
    changed = true;
  });

  return changed;
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
    const isComment = child.dataset.noteStyle === 'comment';

    if (headingLevel !== null) {
      if (collapsedHeading && headingLevel <= collapsedHeading.level) {
        collapsedHeading = null;
      }

      const isCollapsed = child.dataset.collapsed === 'true';
      child.hidden = false;

      const toggle = child.querySelector<HTMLElement>('[data-collapse-toggle]');
      if (toggle) {
        toggle.textContent = isCollapsed ? COLLAPSE_CLOSED_ICON : COLLAPSE_OPEN_ICON;
      }

      collapsedHeading = isCollapsed ? { level: headingLevel } : collapsedHeading;
      return;
    }

    const hiddenByCollapse = collapsedHeading !== null;
    const hiddenByComment = hideComments && isComment;
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
    return <span className="text-muted-foreground">{hasUnsavedChanges ? 'Alteracoes nao salvas' : 'Salvamento manual'}</span>;
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
  return <span className="text-muted-foreground">Salvamento automatico</span>;
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
  autosaveEnabled,
  hasUnsavedChanges,
  saveStatus,
}: NewVisualNotesWorkspaceProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const [activeStyle, setActiveStyle] = useState<RichBlockStyle>('paragraph');
  const [isBoldActive, setIsBoldActive] = useState(false);
  const [isItalicActive, setIsItalicActive] = useState(false);
  const [isUnderlineActive, setIsUnderlineActive] = useState(false);
  const [hideComments, setHideComments] = useState(false);
  const [textColor, setTextColor] = useState('#2f241f');
  const [backgroundColor, setBackgroundColor] = useState('#fff4bf');

  const noteText = useMemo(() => buildInitialHtml(note), [note]);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    const currentSerializedContent = serializeEditorHtml(editorRef.current);
    if (currentSerializedContent !== noteText) {
      editorRef.current.innerHTML = noteText;
      const normalizedOnLoad = normalizeEmptyStructuralBlocks(editorRef.current);
      ensureHeadingControls(editorRef.current);
      applyCollapsedVisibility(editorRef.current, hideComments);
      if (normalizedOnLoad) {
        onReplaceContent(currentDate, serializeEditorHtml(editorRef.current));
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

  const handleToolbarMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    saveEditorSelection();
  };

  const updateToolbarState = () => {
    if (editorRef.current) {
      normalizeEmptyStructuralBlocks(editorRef.current);
      ensureHeadingControls(editorRef.current);
      applyCollapsedVisibility(editorRef.current, hideComments);
    }

    saveEditorSelection();

    const block = getSelectionBlock();
    if (!block) {
      return;
    }

    if (block.tagName === 'H1') {
      setActiveStyle('h1');
    } else if (block.tagName === 'H2') {
      setActiveStyle('h2');
    } else if (block.tagName === 'LI') {
      setActiveStyle('bullet');
    } else if (block instanceof HTMLElement && block.dataset.noteStyle === 'comment') {
      setActiveStyle('comment');
    } else if (block.tagName === 'BLOCKQUOTE') {
      setActiveStyle('blockquote');
    } else {
      setActiveStyle('paragraph');
    }

    setIsBoldActive(document.queryCommandState('bold'));
    setIsItalicActive(document.queryCommandState('italic'));
    setIsUnderlineActive(document.queryCommandState('underline'));
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

    if (value === 'bullet') {
      if (currentBlock.tagName !== 'LI') {
        if (document.queryCommandState('insertUnorderedList')) {
          document.execCommand('insertUnorderedList');
        }
        placeCaretInBlock(currentBlock, 'end');
        document.execCommand('insertUnorderedList');
        targetBlock = getSelectionBlock() as HTMLElement | null;
      }
    } else {
      if (currentBlock.tagName === 'LI') {
        placeCaretInBlock(currentBlock, 'end');
        document.execCommand('insertUnorderedList');
        targetBlock = getSelectionBlock() as HTMLElement | null;
      }

      if (targetBlock instanceof HTMLElement) {
        const nextTagName = value === 'comment' || value === 'paragraph' ? 'p' : value;
        targetBlock = replaceBlockTag(targetBlock, nextTagName);
        placeCaretInBlock(targetBlock, 'end');
      }
    }

    if (targetBlock instanceof HTMLElement) {
      if (value === 'comment' && targetBlock.tagName === 'P') {
        targetBlock.dataset.noteStyle = 'comment';
      } else {
        delete targetBlock.dataset.noteStyle;
      }
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
    }

    if (event.key === 'Enter') {
      const currentBlock = getSelectionBlock();
      if (!(currentBlock instanceof HTMLElement)) {
        return;
      }

      if (currentBlock.tagName !== 'LI') {
        event.preventDefault();
        editorRef.current.focus();
        document.execCommand('insertParagraph');

        const nextBlock = getSelectionBlock();
        if (nextBlock instanceof HTMLElement) {
          if (document.queryCommandState('insertUnorderedList')) {
            document.execCommand('insertUnorderedList');
          }
          document.execCommand('formatBlock', false, 'p');
          delete nextBlock.dataset.noteStyle;
        }

        updateToolbarState();
        persistEditorContent();
      }
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
    const previousBlock = currentBlock.previousElementSibling instanceof HTMLElement ? currentBlock.previousElementSibling : null;
    const nextBlock = currentBlock.nextElementSibling instanceof HTMLElement ? currentBlock.nextElementSibling : null;

    if (event.key === 'Backspace' && isBlockEmpty(currentBlock)) {
      if (!previousBlock && !nextBlock) {
        return;
      }

      event.preventDefault();
      const focusTarget = previousBlock ?? nextBlock;
      const focusPosition = previousBlock ? 'end' : 'start';
      currentBlock.remove();
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
      event.preventDefault();
      const contentToMove = extractBlockContent(currentBlock);
      const insertBeforeNode = previousBlock.querySelector('[data-collapse-toggle]');
      if (getBlockTextLength(previousBlock) > 0 && getBlockTextLength(currentBlock) > 0) {
        previousBlock.insertBefore(document.createTextNode(' '), insertBeforeNode);
      }
      previousBlock.insertBefore(contentToMove, insertBeforeNode);
      currentBlock.remove();
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
      nextBlock.remove();
      ensureHeadingControls(editorRef.current);
      applyCollapsedVisibility(editorRef.current, hideComments);
      placeCaretInBlock(currentBlock, 'end');
      updateToolbarState();
      persistEditorContent();
    }
  };

  return (
    <div className="min-h-0 flex flex-1 overflow-hidden bg-[#f6f1e8]">
      <aside className="w-[320px] shrink-0 border-r bg-background">
        <NotesSidebar
          dates={allDatesWithNotes}
          currentDate={currentDate}
          onSelectDate={onDateChange}
          onSearch={onSearch}
          onSelectSearchResult={onSelectSearchResult}
          showDateButtons={false}
        />
      </aside>

      <main className="min-h-0 flex-1 overflow-auto p-3 md:p-4">
        <div className="flex min-h-full flex-col rounded-[28px] border bg-background shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                <span>{format(currentDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
              </div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">Anotacoes</h2>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <div>{renderSaveStatus(saveStatus, autosaveEnabled, hasUnsavedChanges)}</div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 rounded-full px-3"
                onClick={() => {
                  const nextValue = !hideComments;
                  setHideComments(nextValue);
                  if (editorRef.current) {
                    applyCollapsedVisibility(editorRef.current, nextValue);
                  }
                }}
              >
                {hideComments ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                {hideComments ? 'Mostrar comentarios' : 'Ocultar comentarios'}
              </Button>
              {!autosaveEnabled && (
                <Button type="button" onClick={onSave} disabled={!hasUnsavedChanges}>
                  <Save className="h-4 w-4" />
                  Salvar
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
            <div className="flex flex-wrap items-center gap-1 rounded-xl border bg-muted/25 p-1" onMouseDown={handleToolbarMouseDown}>
              <Button
                type="button"
                variant={activeStyle === 'paragraph' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 rounded-lg px-3"
                onClick={() => applyBlockStyle('paragraph')}
              >
                <Pilcrow className="h-4 w-4" />
                Texto
              </Button>
              <Button
                type="button"
                variant={activeStyle === 'h1' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 rounded-lg px-3"
                onClick={() => applyBlockStyle('h1')}
              >
                <Heading1 className="h-4 w-4" />
                Titulo
              </Button>
              <Button
                type="button"
                variant={activeStyle === 'h2' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 rounded-lg px-3"
                onClick={() => applyBlockStyle('h2')}
              >
                <Heading2 className="h-4 w-4" />
                Subtitulo
              </Button>
              <Button
                type="button"
                variant={activeStyle === 'bullet' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 rounded-lg px-3"
                onClick={() => applyBlockStyle('bullet')}
              >
                <List className="h-4 w-4" />
                Topico
              </Button>
              <Button
                type="button"
                variant={activeStyle === 'blockquote' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 rounded-lg px-3"
                onClick={() => applyBlockStyle('blockquote')}
              >
                <Quote className="h-4 w-4" />
                Citacao
              </Button>
              <Button
                type="button"
                variant={activeStyle === 'comment' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 rounded-lg px-3"
                onClick={() => applyBlockStyle('comment')}
              >
                <MessageSquare className="h-4 w-4" />
                Comentario
              </Button>
            </div>

            <div className="ml-auto flex items-center gap-1 rounded-xl border bg-muted/25 p-1" onMouseDown={handleToolbarMouseDown}>
              <Button
                type="button"
                variant={isBoldActive ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => runEditorCommand('bold')}
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={isItalicActive ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => runEditorCommand('italic')}
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={isUnderlineActive ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => runEditorCommand('underline')}
              >
                <Underline className="h-4 w-4" />
              </Button>
              <label className="flex h-8 items-center gap-2 rounded-lg px-2 text-xs text-muted-foreground hover:bg-background">
                <PaintBucket className="h-4 w-4" />
                <input
                  type="color"
                  value={textColor}
                  onChange={(event) => {
                    setTextColor(event.target.value);
                    runEditorCommand('foreColor', event.target.value);
                  }}
                  className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                  title="Cor do texto"
                />
              </label>
              <div className="flex items-center gap-1 rounded-lg px-1">
                {PRESET_TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="h-5 w-5 rounded-full border border-border/70 transition hover:scale-105"
                    style={{ backgroundColor: color }}
                    aria-label={`Aplicar cor de texto ${color}`}
                    title="Cor predefinida do texto"
                    onClick={() => {
                      setTextColor(color);
                      runEditorCommand('foreColor', color);
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1 rounded-lg px-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => runEditorCommand('hiliteColor', 'transparent')}
                  title="Remover cor de fundo"
                >
                  <X className="h-4 w-4" />
                </Button>
                <label className="flex h-8 items-center gap-2 rounded-lg px-2 text-xs text-muted-foreground hover:bg-background">
                  <Highlighter className="h-4 w-4" />
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(event) => {
                      setBackgroundColor(event.target.value);
                      runEditorCommand('hiliteColor', event.target.value);
                    }}
                    className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                    title="Cor de fundo"
                  />
                </label>
              </div>
              <div className="flex items-center gap-1 rounded-lg px-1">
                {PRESET_BACKGROUND_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="h-5 w-5 rounded-full border border-border/70 transition hover:scale-105"
                    style={{ backgroundColor: color }}
                    aria-label={`Aplicar cor de fundo ${color}`}
                    title="Cor predefinida do fundo"
                    onClick={() => {
                      setBackgroundColor(color);
                      runEditorCommand('hiliteColor', color);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 px-5 py-4">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onKeyDown={handleEditorKeyDown}
              onInput={handleEditorInput}
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
              className="min-h-[calc(100vh-250px)] w-full rounded-2xl border border-transparent bg-transparent px-5 text-[17px] leading-6 text-foreground outline-none [&_blockquote]:my-1 [&_blockquote]:ml-0 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_h1]:mb-1 [&_h1]:mt-2 [&_h1]:ml-0 [&_h1]:px-0 [&_h1]:py-0 [&_h1]:text-[2.6rem] [&_h1]:font-bold [&_h1]:leading-tight [&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:ml-0 [&_h2]:px-0 [&_h2]:py-0 [&_h2]:text-[2rem] [&_h2]:font-semibold [&_h2]:leading-tight [&_h1[data-collapsible-heading='true']]:relative [&_h2[data-collapsible-heading='true']]:relative [&_ol]:my-1 [&_ol]:ml-0 [&_ol]:pl-8 [&_p]:my-1 [&_p]:ml-0 [&_p[data-note-style='comment']]:text-slate-400 [&_p[data-note-style='comment']]:italic [&_p[data-note-style='comment']]:line-through [&_p[data-note-style='comment']]:opacity-80 [&_ul]:my-1 [&_ul]:ml-0 [&_ul]:list-disc [&_ul]:pl-8"
              data-placeholder="Escreva livremente aqui..."
            />
          </div>

          <div className="border-t px-5 py-2 text-xs text-muted-foreground">
            Atalhos: <span className="font-medium text-foreground">Ctrl+1</span> Título, <span className="font-medium text-foreground">Ctrl+2</span> Subtítulo, <span className="font-medium text-foreground">Ctrl+3</span> Citação, <span className="font-medium text-foreground">Ctrl+4</span> Tópico, <span className="font-medium text-foreground">Ctrl+5</span> Comentário, <span className="font-medium text-foreground">Ctrl+0</span> Texto normal, <span className="font-medium text-foreground">Ctrl+B</span> Negrito, <span className="font-medium text-foreground">Ctrl+I</span> Itálico, <span className="font-medium text-foreground">Ctrl+U</span> Sublinhado.
          </div>
        </div>
      </main>
    </div>
  );
}

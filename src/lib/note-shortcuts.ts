export const noteFormattingShortcutHints = [
  { shortcut: 'Ctrl + 1', prefix: '#', label: 'Titulo' },
  { shortcut: 'Ctrl + 2', prefix: '##', label: 'Subtitulo' },
  { shortcut: 'Ctrl + 3', prefix: '>', label: 'Citacao' },
  { shortcut: 'Ctrl + 4', prefix: '-', label: 'Topico' },
  { shortcut: 'Ctrl + 5', prefix: '//', label: 'Comentario' },
  { shortcut: 'Ctrl + 0', prefix: 'sem prefixo', label: 'Texto' },
] as const;

export const noteFormattingPrefixHints = [
  { prefix: '#', label: 'Converte a linha em titulo' },
  { prefix: '##', label: 'Converte a linha em subtitulo' },
  { prefix: '-', label: 'Converte a linha em topico' },
  { prefix: '*', label: 'Tambem converte a linha em topico' },
  { prefix: '>', label: 'Converte a linha em citacao' },
  { prefix: '//', label: 'Converte a linha em comentario' },
] as const;

export const noteFormattingBehaviorHints = [
  'Enter em topico, citacao e comentario continua no mesmo tipo.',
  'Enter em uma linha vazia volta para texto normal.',
  'Colar varias linhas com prefixos aplica a formatacao automaticamente.',
  'Os mesmos prefixos funcionam nos templates de notas.',
] as const;

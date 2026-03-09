const priorityRank: Record<string, number> = {
  alta: 3,
  média: 2,
  media: 2,
  baixa: 1,
};

export function getPriorityValue(value: unknown) {
  if (typeof value !== 'string') {
    return 0;
  }

  return priorityRank[value.toLowerCase().trim()] || 0;
}

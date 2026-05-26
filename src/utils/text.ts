export const normalizeText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const compactText = (value: string): string => normalizeText(value).replace(/[^a-z0-9]/g, "");

export const includesAny = (value: string, terms: string[]): boolean => {
  const normalized = normalizeText(value);
  const compact = compactText(value);

  return terms.some((term) => {
    const normalizedTerm = normalizeText(term);
    return normalized.includes(normalizedTerm) || compact.includes(compactText(normalizedTerm));
  });
};

// Kategorie-Akzentfarben (siehe index.css --color-cat-*), passend zu den Kategorien aus
// agentCatalog.js. Zentrale Zuordnung, damit Agenten-Karten, Prompt-Filter und Wissen-Seite
// dieselben Farben verwenden.
export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Strategie: { bg: "bg-cat-strategie", text: "text-cat-strategie", border: "border-cat-strategie" },
  Compliance: { bg: "bg-cat-compliance", text: "text-cat-compliance", border: "border-cat-compliance" },
  Betriebsrat: { bg: "bg-cat-betriebsrat", text: "text-cat-betriebsrat", border: "border-cat-betriebsrat" },
  Verhandlung: { bg: "bg-cat-verhandlung", text: "text-cat-verhandlung", border: "border-cat-verhandlung" },
  Arbeitsrecht: { bg: "bg-cat-arbeitsrecht", text: "text-cat-arbeitsrecht", border: "border-cat-arbeitsrecht" },
  "HR-Management": { bg: "bg-cat-hr-management", text: "text-cat-hr-management", border: "border-cat-hr-management" },
};

const FALLBACK = { bg: "bg-petrol-700", text: "text-petrol-700", border: "border-petrol-700" };

export function categoryColor(category: string) {
  return CATEGORY_COLORS[category] ?? FALLBACK;
}

// Erste 1-2 Buchstaben für den Icon-Platzhalter auf Agenten-/Kategorie-Karten.
export function initials(name: string) {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

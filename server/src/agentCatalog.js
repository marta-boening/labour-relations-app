// Kuratierte Bündelung der 33 Fach-Prompts (aus dem GitHub-Promptkatalog, siehe
// getMetadata() in pipeline.js) zu 14 fachlichen Agenten für die Agenten-Netzwerk-Ansicht.
//
// Reine Präsentations-/Gruppierungsschicht: greift nicht in Router, Executor oder
// MAIN_AGENTS (pipeline.js) ein. Jeder der 33 Prompt-IDs ist genau einem Agenten
// zugeordnet, meist als Quick/Full-Paar.
export const AGENT_CATALOG = [
  {
    id: "ar-lotse",
    name: "AR-Lotse",
    category: "Strategie",
    description: "Allgemeine arbeitsrechtliche Fallanalyse & Ersteinschätzung.",
    promptIds: ["ar-lotse", "quick-check"],
  },
  {
    id: "risiko-radar",
    name: "Risiko-Radar",
    category: "Compliance",
    description: "Risikobewertung und Entscheidungsvorlagen für Maßnahmen.",
    promptIds: ["risiko-radar", "entscheidungs-pilot"],
  },
  {
    id: "lr-taktiker",
    name: "LR-Taktiker",
    category: "Strategie",
    description: "Taktische Empfehlungen in arbeitsrechtlichen Konflikten.",
    promptIds: ["lr-taktiker"],
  },
  {
    id: "br-kompass",
    name: "BR-Kompass",
    category: "Betriebsrat",
    description: "Mitbestimmung und Betriebsvereinbarungen prüfen und gestalten.",
    promptIds: ["mbr-check", "mbr-architekt", "br-check", "br-kompass"],
  },
  {
    id: "br-konter",
    name: "BR-Konter",
    category: "Betriebsrat",
    description: "Umgang mit Betriebsratswiderspruch nach §99 BetrVG.",
    promptIds: ["br-konter-check", "br-konter"],
  },
  {
    id: "einigungsstellen-kompass",
    name: "Einigungsstellen-Kompass",
    category: "Verhandlung",
    description: "Einigungsstellenverfahren vorbereiten und durchführen.",
    promptIds: [
      "einigungsstellen-check",
      "einigungsstellen-kompass",
      "Einigungsstellen-pilot-check",
      "einigungsstellen-pilot",
      "drehbuch-check",
      "einigungsstellen-drehbuch",
    ],
  },
  {
    id: "verhandlungsfuehrer",
    name: "Verhandlungsführer",
    category: "Verhandlung",
    description: "Verhandlungsvorbereitung mit Betriebsrat/Gesamtbetriebsrat (BATNA/WATNA).",
    promptIds: ["verhandlungs-kompass"],
  },
  {
    id: "kuendigungs-pruefer",
    name: "Kündigungs-Prüfer",
    category: "Arbeitsrecht",
    description: "Kündigung, Abmahnung, Prozessführung und Vergleichsstrategie.",
    promptIds: ["abmahnungs-assistent", "kundigungs-prufer", "prozess-lotse", "vergleichs-stratege"],
  },
  {
    id: "agg-kompass",
    name: "AGG-Kompass",
    category: "Compliance",
    description: "Diskriminierungsrisiken erkennen und AGG-konform handeln.",
    promptIds: ["agg-check", "agg-kompass"],
  },
  {
    id: "arbeitszeit-kompass",
    name: "Arbeitszeit-Kompass",
    category: "Arbeitsrecht",
    description: "ArbZG-Compliance: Höchstarbeitszeit, Ruhezeiten, Zeiterfassung.",
    promptIds: ["arbeitszeit-kompass"],
  },
  {
    id: "befristungs-pilot",
    name: "Befristungs-Pilot",
    category: "Arbeitsrecht",
    description: "Befristungsrecht nach TzBfG prüfen (Sachgrund, Kettenbefristung).",
    promptIds: ["befristungs-pilot"],
  },
  {
    id: "versetzungs-navigator",
    name: "Versetzungs-Navigator",
    category: "Arbeitsrecht",
    description: "Versetzungen rechtssicher gestalten und umsetzen.",
    promptIds: ["versetzungs-check", "versetzungs-navigator"],
  },
  {
    id: "vertrags-verguetungs-pruefer",
    name: "Vertrags- & Vergütungsprüfer",
    category: "HR-Management",
    description: "Arbeitsvertragsklauseln und variable Vergütung prüfen.",
    promptIds: ["klausel-check", "boni-pruefer"],
  },
  {
    id: "lr-stratege",
    name: "LR-Stratege",
    category: "Strategie",
    description: "Change-Umsetzung und LR-Governance-Strategie entwickeln.",
    promptIds: ["massnahmen-architekt", "umsetzungs-radar", "lr-stratege", "lr-stratege-check"],
  },
];

export function findAgentByPromptId(promptId) {
  return AGENT_CATALOG.find((a) => a.promptIds.includes(promptId)) || null;
}

// Category from the biller's name and description, as a fallback when the model says "other"
// (or for QR-only reads), and from what the user chose before for the same biller.

import { payeeKey } from './recurring';
import type { Category } from './types';

/**
 * Lower-case word fragments per category, in the 8 app languages plus well-known billers.
 * Order matters: health comes before insurance so "Krankenversicherung" is health.
 */
const RULES: [Category, string[]][] = [
  [
    'health',
    [
      // health insurance (it's health, not general insurance)
      'krankenkasse', 'krankenversicherung', 'krankenkassen', 'caisse maladie', 'caisse-maladie', 'assurance maladie', 'assurance-maladie',
      'cassa malati', 'cassa malattia', 'assicurazione malattia', 'health insurance', 'zorgverzekering', 'seguro de salud', 'seguro médico',
      'seguro de saúde', 'ubezpieczenie zdrowotne', 'grundversicherung', 'zusatzversicherung', 'lamal', 'kvg',
      // Swiss and German health insurers
      'helsana', 'css', 'swica', 'sanitas', 'visana', 'concordia', 'groupe mutuel', 'assura', 'kpt', 'ökk', 'oekk', 'atupri', 'sympany',
      'egk', 'aquilana', 'sumiswalder', 'agrisano', 'vivao', 'tk ', 'techniker krankenkasse', 'barmer', 'aok', 'dak',
      // care
      'arzt', 'ärzt', 'praxis', 'zahnarzt', 'dental', 'apotheke', 'pharmacie', 'farmacia', 'pharmacy', 'apteka', 'spital', 'hôpital', 'hospital',
      'ospedale', 'klinik', 'clinique', 'clinic', 'labor', 'physio', 'médecin', 'medico', 'médico', 'doctor', 'huisarts', 'lekarz', 'tierarzt',
    ],
  ],
  [
    'insurance',
    [
      'versicherung', 'assurance', 'assicurazion', 'insurance', 'verzekering', 'seguro', 'ubezpiecz', 'mobiliar', 'axa', 'allianz', 'zurich',
      'generali', 'baloise', 'helvetia', 'vaudoise', 'smile.direct', 'tcs', 'allianz suisse', 'ergo', 'huk',
    ],
  ],
  [
    'telecom',
    [
      'swisscom', 'sunrise', 'salt', 'upc', 'wingo', 'yallo', 'quickline', 'init7', 'telekom', 'vodafone', 'o2', 'orange', 'telefonica', 'movistar',
      'tim ', 'wind', 'iliad', 'kpn', 'ziggo', 'play', 'plus', 'meo', 'nos ', 'mobile', 'mobil', 'internet', 'telecom', 'telefon', 'téléphone',
    ],
  ],
  [
    'utilities',
    [
      'ewz', 'ekz', 'bkw', 'iwb', 'axpo', 'romande energie', 'sig ', 'stadtwerke', 'werke', 'strom', 'electricity', 'électricité', 'elettricità',
      'electricidad', 'eletricidade', 'elektriciteit', 'energia', 'energie', 'énergie', 'gas', 'gaz', 'wasser', 'eau', 'acqua', 'agua', 'water',
      'woda', 'prąd', 'eon', 'e.on', 'enel', 'edf', 'engie', 'iberdrola', 'endesa', 'vattenfall', 'eneco', 'abfall', 'kehricht',
    ],
  ],
  [
    'housing',
    ['miete', 'mietzins', 'loyer', 'affitto', 'alquiler', 'renda', 'huur', 'czynsz', 'rent', 'verwaltung', 'immobilien', 'régie', 'hausverwaltung', 'nebenkosten', 'hypothek', 'mortgage'],
  ],
  [
    'taxes',
    ['steuer', 'steueramt', 'impôt', 'impot', 'imposta', 'impuesto', 'imposto', 'belasting', 'podatek', 'tax ', 'tax office', 'finanzamt', 'agenzia delle entrate', 'hacienda'],
  ],
  [
    'fees',
    ['serafe', 'billag', 'rundfunk', 'gebühr', 'redevance', 'canone', 'tasa', 'taxa', 'heffing', 'opłata', 'fee', 'parkbusse', 'busse', 'amende', 'multa'],
  ],
  [
    'transport',
    ['sbb', 'cff', 'ffs', 'bls', 'postauto', 'db ', 'deutsche bahn', 'trenitalia', 'renfe', 'ns ', 'pkp', 'öbb', 'parking', 'parkhaus', 'garage', 'auto', 'leasing', 'mobility', 'uber'],
  ],
  [
    'shopping',
    ['galaxus', 'digitec', 'zalando', 'amazon', 'migros', 'coop', 'manor', 'ikea', 'otto', 'klarna', 'paypal', 'ricardo', 'brack'],
  ],
];

/** A best guess from the text, or null when nothing matches. */
export function guessCategory(...texts: (string | null | undefined)[]): Category | null {
  const hay = ` ${texts.filter(Boolean).join(' ').toLowerCase()} `;
  for (const [category, words] of RULES) {
    if (words.some((w) => matchesWord(hay, w))) return category;
  }
  return null;
}

/** Short names ("css", "kpt", "tk ") must be whole words; longer fragments may sit inside a word ("krankenkasse" in "kpt krankenkasse ag"). */
function matchesWord(hay: string, w: string): boolean {
  const word = w.trim();
  if (word.length > 4) return hay.includes(word);
  return new RegExp(`(^|[^\\p{L}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}\\p{N}]|$)`, 'u').test(hay);
}

/** Picks the category for a new bill: what the user chose before for this biller, else the model's, else the keywords. */
export function pickCategory(args: { payee: string; description?: string | null; model?: Category | null; learned: Record<string, Category> }): Category {
  const remembered = args.learned[payeeKey(args.payee)];
  if (remembered) return remembered;
  if (args.model && args.model !== 'other') return args.model;
  return guessCategory(args.payee, args.description) ?? args.model ?? 'other';
}

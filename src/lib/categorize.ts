// Category from the biller's name and description, as a fallback when the model says "other"
// (or for QR-only reads), and from what the user chose before for the same biller.

import { payeeKey } from './recurring';
import type { Category, Kind } from './types';

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
      'arzt', 'ärzt', 'praxis', 'zahnarzt', 'dental', 'apotheke', 'pharmacie', 'farmacia', 'pharmacy', 'apteka', 'φαρμακείο', 'spital', 'hôpital', 'hospital',
      'ospedale', 'klinik', 'clinique', 'clinic', 'labor', 'physio', 'médecin', 'medico', 'médico', 'doctor', 'huisarts', 'lekarz', 'tierarzt',
    ],
  ],
  // Everyday spending: shops come before the general rules, so "Coop Pronto" is groceries, not shopping.
  [
    'fuel',
    [
      'tankstelle', 'station-service', 'gas station', 'petrol', 'benzin', 'diesel', 'carburant', 'carburante', 'gasolinera', 'combustível', 'paliwo',
      'shell', 'esso', 'bp ', 'avia', 'agrola', 'socar', 'eni ', 'q8', 'total energies', 'totalenergies', 'repsol', 'cepsa', 'galp', 'orlen', 'aral',
      'jet ', 'omv', 'eko ', 'aegean', 'avin', 'revoil', 'elin', 'καύσιμα', 'πρατήριο', 'βενζίνη',
    ],
  ],
  [
    'groceries',
    [
      'migros', 'coop', 'denner', 'aldi', 'lidl', 'spar', 'volg', 'rewe', 'edeka', 'kaufland', 'netto', 'penny', 'carrefour', 'auchan', 'leclerc',
      'intermarché', 'intermarche', 'monoprix', 'esselunga', 'conad', 'mercadona', 'dia ', 'continente', 'pingo doce', 'albert heijn',
      'biedronka', 'żabka', 'zabka', 'sklavenitis', 'σκλαβενίτης', 'ab vassilopoulos', 'βασιλόπουλος', 'masoutis', 'μασούτης', 'my market',
      'kritikos', 'κρητικός', 'galaxias', 'γαλαξίας', 'bazaar', 'market in', 'supermarket', 'supermarché', 'supermercato', 'supermercado',
      'σούπερ μάρκετ', 'φούρνος', 'bakery', 'bäckerei', 'boulangerie', 'panetteria', 'panadería', 'metzgerei', 'boucherie', 'κρεοπωλείο', 'λαϊκή',
    ],
  ],
  [
    'dining',
    [
      'restaurant', 'ristorante', 'restaurante', 'restauracja', 'trattoria', 'pizzeria', 'café', 'caffè', 'cafe ', 'kaffee', 'coffee', 'starbucks',
      'mcdonald', 'burger', 'kfc', 'subway', 'bar ', 'pub ', 'bistro', 'brasserie', 'taverna', 'ταβέρνα', 'εστιατόριο', 'καφέ', 'σουβλάκι', 'ψητοπωλείο',
      'everest', 'goody', 'gregorys', 'mikel', 'coffee island', 'wolt', 'efood', 'e-food', 'uber eats', 'just eat', 'deliveroo', 'lieferando',
    ],
  ],
  [
    'household',
    [
      'ikea', 'jumbo', 'leroy merlin', 'bauhaus', 'hornbach', 'obi ', 'brico', 'praktiker', 'kotsovolos', 'κωτσόβολος', 'public', 'plaisio',
      'πλαίσιο', 'mediamarkt', 'media markt', 'interdiscount', 'fust', 'dm ', 'rossmann', 'müller', 'hondos', 'my home', 'zara home', 'h&m home',
    ],
  ],
  [
    'kids',
    ['toys', 'spielwaren', 'jouets', 'giocattoli', 'juguetes', 'παιχνίδια', 'babyland', 'mothercare', 'prénatal', 'prenatal', 'kiddy', 'smyths', 'imaginarium', 'baby'],
  ],
  [
    'leisure',
    ['cinema', 'kino', 'cinéma', 'σινεμά', 'theater', 'théâtre', 'teatro', 'θέατρο', 'museum', 'musée', 'μουσείο', 'eventim', 'fitness', 'gym', 'γυμναστήριο', 'netflix', 'spotify'],
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
    ['galaxus', 'digitec', 'zalando', 'amazon', 'manor', 'otto', 'klarna', 'paypal', 'ricardo', 'brack', 'skroutz', 'zara', 'h&m', 'primark', 'decathlon', 'shop'],
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

/**
 * Picks the category for a new bill: what the user chose before for this biller, else the model's, else the keywords.
 * For a receipt the shop name says more than the reader's guess ("Lidl" is groceries, not just shopping), so keywords go first.
 */
export function pickCategory(args: { payee: string; description?: string | null; model?: Category | null; learned: Record<string, Category>; kind?: Kind }): Category {
  const remembered = args.learned[payeeKey(args.payee)];
  if (remembered) return remembered;
  if (args.kind === 'receipt') return guessCategory(args.payee, args.description) ?? (args.model && args.model !== 'other' ? args.model : 'other');
  if (args.model && args.model !== 'other') return args.model;
  return guessCategory(args.payee, args.description) ?? args.model ?? 'other';
}

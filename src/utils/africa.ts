// Détection des compétitions africaines (noms de pays tels que renvoyés par API-Football, ou en français pour la démo)
const AFRICAN_COUNTRIES = [
  'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina-Faso', 'Burundi', 'Cameroon', 'Cape-Verde', 'Central-African-Republic',
  'Chad', 'Comoros', 'Congo', 'Congo-DR', 'DR-Congo', 'Djibouti', 'Egypt', 'Equatorial-Guinea', 'Eritrea', 'Eswatini',
  'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Ivory-Coast', "Cote-d'Ivoire", 'Kenya', 'Lesotho',
  'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Mauritius', 'Morocco', 'Mozambique', 'Namibia',
  'Niger', 'Nigeria', 'Rwanda', 'Sao-Tome-and-Principe', 'Senegal', 'Seychelles', 'Sierra-Leone', 'Somalia', 'South-Africa',
  'South-Sudan', 'Sudan', 'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe', 'Afrique',
];

export const normCountry = (c: string): string =>
  c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s_-]+/g, '');

const AFRICAN_SET = new Set(AFRICAN_COUNTRIES.map(normCountry));

// Compétitions continentales ou régionales africaines (country = « World » ou « Africa » côté API)
const CONTINENTAL_RE = /\bCAF\b|africa|COSAFA|CECAFA|WAFU|UNAF|\bCHAN\b|afrique/i;

export function isAfricanLeague(country?: string, name?: string): boolean {
  if (country && AFRICAN_SET.has(normCountry(country))) return true;
  return Boolean(name && CONTINENTAL_RE.test(name) && (!country || /world|monde|africa|afrique/i.test(country)));
}

// Drapeau emoji à partir d'un code pays ISO (ex. « EG » -> 🇪🇬)
export function flagFromCode(code?: string): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return '🌍';
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

// Noms de pays en français (le reste est affiché tel que renvoyé par l'API)
const COUNTRY_FR: Record<string, string> = {
  algeria: 'Algérie', angola: 'Angola', benin: 'Bénin', botswana: 'Botswana', burkinafaso: 'Burkina Faso', burundi: 'Burundi',
  cameroon: 'Cameroun', capeverde: 'Cap-Vert', centralafricanrepublic: 'Centrafrique', chad: 'Tchad', comoros: 'Comores',
  congo: 'Congo', congodr: 'RD Congo', drcongo: 'RD Congo', djibouti: 'Djibouti', egypt: 'Égypte', equatorialguinea: 'Guinée équatoriale',
  eritrea: 'Érythrée', eswatini: 'Eswatini', ethiopia: 'Éthiopie', gabon: 'Gabon', gambia: 'Gambie', ghana: 'Ghana', guinea: 'Guinée',
  guineabissau: 'Guinée-Bissau', ivorycoast: "Côte d'Ivoire", kenya: 'Kenya', lesotho: 'Lesotho', liberia: 'Libéria', libya: 'Libye',
  madagascar: 'Madagascar', malawi: 'Malawi', mali: 'Mali', mauritania: 'Mauritanie', mauritius: 'Maurice', morocco: 'Maroc',
  mozambique: 'Mozambique', namibia: 'Namibie', niger: 'Niger', nigeria: 'Nigéria', rwanda: 'Rwanda', senegal: 'Sénégal',
  seychelles: 'Seychelles', sierraleone: 'Sierra Leone', somalia: 'Somalie', southafrica: 'Afrique du Sud', southsudan: 'Soudan du Sud',
  sudan: 'Soudan', tanzania: 'Tanzanie', togo: 'Togo', tunisia: 'Tunisie', uganda: 'Ouganda', zambia: 'Zambie', zimbabwe: 'Zimbabwe',
  world: 'Monde', africa: 'Afrique', europe: 'Europe', england: 'Angleterre', spain: 'Espagne', germany: 'Allemagne', italy: 'Italie',
  france: 'France', portugal: 'Portugal', netherlands: 'Pays-Bas', belgium: 'Belgique', brazil: 'Brésil', argentina: 'Argentine',
};

export const frCountry = (c?: string): string => (c ? COUNTRY_FR[normCountry(c)] ?? c : '');

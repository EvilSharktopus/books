// Normalises the free-text "Author country" field ("USA", "France ",
// "British", "england") into one canonical name per country, with a flag.

interface Country {
  name: string;
  code: string; // ISO 3166-1 alpha-2, for the flag emoji
}

// Canonical name, ISO code, then any aliases/demonyms people type.
const TABLE: [string, string, ...string[]][] = [
  ["United States", "US", "usa", "us", "u.s.", "u.s.a.", "america", "american", "united states of america"],
  ["Canada", "CA", "canadian"],
  ["Mexico", "MX", "mexican"],
  ["United Kingdom", "GB", "uk", "u.k.", "britain", "great britain", "british", "england", "english", "scotland", "scottish", "wales", "welsh", "northern ireland"],
  ["Ireland", "IE", "irish", "republic of ireland"],
  ["France", "FR", "french"],
  ["Germany", "DE", "german"],
  ["Austria", "AT", "austrian"],
  ["Switzerland", "CH", "swiss"],
  ["Italy", "IT", "italian"],
  ["Spain", "ES", "spanish"],
  ["Portugal", "PT", "portuguese"],
  ["Netherlands", "NL", "dutch", "holland", "the netherlands"],
  ["Belgium", "BE", "belgian"],
  ["Denmark", "DK", "danish"],
  ["Norway", "NO", "norwegian"],
  ["Sweden", "SE", "swedish"],
  ["Finland", "FI", "finnish"],
  ["Iceland", "IS", "icelandic"],
  ["Poland", "PL", "polish"],
  ["Czechia", "CZ", "czech", "czech republic"],
  ["Hungary", "HU", "hungarian"],
  ["Romania", "RO", "romanian"],
  ["Ukraine", "UA", "ukrainian"],
  ["Russia", "RU", "russian"],
  ["Greece", "GR", "greek"],
  ["Cyprus", "CY", "cypriot"],
  ["Turkey", "TR", "turkish", "türkiye"],
  ["Israel", "IL", "israeli"],
  ["Palestine", "PS", "palestinian"],
  ["Egypt", "EG", "egyptian"],
  ["Lebanon", "LB", "lebanese"],
  ["Iran", "IR", "iranian", "persian"],
  ["Iraq", "IQ", "iraqi"],
  ["Syria", "SY", "syrian"],
  ["Afghanistan", "AF", "afghan"],
  ["Pakistan", "PK", "pakistani"],
  ["India", "IN", "indian"],
  ["Sri Lanka", "LK", "sri lankan"],
  ["Bangladesh", "BD", "bangladeshi"],
  ["China", "CN", "chinese"],
  ["Hong Kong", "HK"],
  ["Taiwan", "TW", "taiwanese"],
  ["Japan", "JP", "japanese"],
  ["South Korea", "KR", "korea", "korean", "south korean"],
  ["Vietnam", "VN", "vietnamese", "viet nam"],
  ["Thailand", "TH", "thai"],
  ["Philippines", "PH", "filipino", "filipina", "philippine"],
  ["Indonesia", "ID", "indonesian"],
  ["Malaysia", "MY", "malaysian"],
  ["Singapore", "SG", "singaporean"],
  ["Australia", "AU", "australian"],
  ["New Zealand", "NZ", "nz", "kiwi", "new zealander"],
  ["Nigeria", "NG", "nigerian"],
  ["Ghana", "GH", "ghanaian"],
  ["Kenya", "KE", "kenyan"],
  ["Ethiopia", "ET", "ethiopian"],
  ["Somalia", "SO", "somali"],
  ["Sudan", "SD", "sudanese"],
  ["South Africa", "ZA", "south african"],
  ["Zimbabwe", "ZW", "zimbabwean"],
  ["Rwanda", "RW", "rwandan"],
  ["Morocco", "MA", "moroccan"],
  ["Algeria", "DZ", "algerian"],
  ["Brazil", "BR", "brazilian"],
  ["Argentina", "AR", "argentine", "argentinian"],
  ["Chile", "CL", "chilean"],
  ["Colombia", "CO", "colombian"],
  ["Peru", "PE", "peruvian"],
  ["Cuba", "CU", "cuban"],
  ["Haiti", "HT", "haitian"],
  ["Jamaica", "JM", "jamaican"],
  ["Trinidad and Tobago", "TT", "trinidadian", "trinidad"],
  ["Dominican Republic", "DO", "dominican"],
  ["Puerto Rico", "PR", "puerto rican"],
];

const LOOKUP = new Map<string, Country>();
for (const [name, code, ...aliases] of TABLE) {
  for (const key of [name, ...aliases]) LOOKUP.set(key.toLowerCase(), { name, code });
}

function flagFor(code: string): string {
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

/** Canonical country + flag for a typed value, or null if blank. Unknown
 *  values are kept (title-cased) with a globe instead of a flag. */
export function normaliseCountry(raw: string): { name: string; flag: string } | null {
  const key = raw.trim().replace(/\s+/g, " ").replace(/\.$/, "").toLowerCase();
  if (!key) return null;
  const hit = LOOKUP.get(key);
  if (hit) return { name: hit.name, flag: flagFor(hit.code) };
  return {
    name: key.replace(/\b\w/g, (c) => c.toUpperCase()),
    flag: "🌍",
  };
}

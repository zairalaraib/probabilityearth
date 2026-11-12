export type Country = {
  iso: string;
  name: string;
  flag: string;
  center: [number, number];
  aliases: string[];
};
export const countries: Country[] = [
  [
    "US",
    "United States",
    "🇺🇸",
    [-100, 39],
    [
      "united states",
      "u.s.",
      "usa",
      "american",
      "trump",
      "biden",
      "washington",
    ],
  ],
  ["RU", "Russia", "🇷🇺", [90, 60], ["russia", "russian", "putin", "kremlin"]],
  [
    "UA",
    "Ukraine",
    "🇺🇦",
    [31, 49],
    ["ukraine", "ukrainian", "zelensky", "zelenskyy"],
  ],
  [
    "CN",
    "China",
    "🇨🇳",
    [104, 35],
    ["china", "chinese", "beijing", "xi jinping"],
  ],
  ["TW", "Taiwan", "🇹🇼", [121, 24], ["taiwan", "taiwanese", "taipei"]],
  ["IR", "Iran", "🇮🇷", [54, 32], ["iran", "iranian", "tehran", "khamenei"]],
  ["IL", "Israel", "🇮🇱", [35, 31.5], ["israel", "israeli", "netanyahu"]],
  [
    "PS",
    "Palestine",
    "🇵🇸",
    [35.2, 31.9],
    ["palestine", "palestinian", "gaza", "hamas", "west bank"],
  ],
  [
    "LB",
    "Lebanon",
    "🇱🇧",
    [35.8, 34],
    ["lebanon", "lebanese", "hezbollah", "beirut"],
  ],
  ["SY", "Syria", "🇸🇾", [38, 35], ["syria", "syrian", "damascus"]],
  ["IN", "India", "🇮🇳", [79, 23], ["india", "indian", "modi"]],
  ["PK", "Pakistan", "🇵🇰", [69, 30], ["pakistan", "pakistani"]],
  ["KP", "North Korea", "🇰🇵", [127, 40], ["north korea", "kim jong un"]],
  ["KR", "South Korea", "🇰🇷", [128, 36], ["south korea", "seoul"]],
  ["JP", "Japan", "🇯🇵", [138, 37], ["japan", "japanese"]],
  [
    "GB",
    "United Kingdom",
    "🇬🇧",
    [-3, 55],
    ["united kingdom", "britain", "british", "starmer"],
  ],
  ["FR", "France", "🇫🇷", [2, 47], ["france", "french", "macron"]],
  ["DE", "Germany", "🇩🇪", [10, 51], ["germany", "german", "merz"]],
  ["TR", "Turkey", "🇹🇷", [35, 39], ["turkey", "türkiye", "turkish", "erdogan"]],
  ["SA", "Saudi Arabia", "🇸🇦", [45, 24], ["saudi arabia", "saudi"]],
  ["YE", "Yemen", "🇾🇪", [48, 16], ["yemen", "yemeni", "houthi"]],
  ["IQ", "Iraq", "🇮🇶", [44, 33], ["iraq", "iraqi"]],
  ["VE", "Venezuela", "🇻🇪", [-66, 8], ["venezuela", "venezuelan", "maduro"]],
  ["BR", "Brazil", "🇧🇷", [-52, -12], ["brazil", "brazilian", "lula"]],
  ["MX", "Mexico", "🇲🇽", [-102, 24], ["mexico", "mexican", "sheinbaum"]],
  ["CA", "Canada", "🇨🇦", [-106, 57], ["canada", "canadian", "carney"]],
  ["AU", "Australia", "🇦🇺", [134, -25], ["australia", "australian"]],
  ["PL", "Poland", "🇵🇱", [19, 52], ["poland", "polish"]],
  ["RO", "Romania", "🇷🇴", [25, 46], ["romania", "romanian"]],
  ["HU", "Hungary", "🇭🇺", [19, 47], ["hungary", "hungarian", "orban"]],
  ["AR", "Argentina", "🇦🇷", [-64, -35], ["argentina", "argentine", "milei"]],
  ["ZA", "South Africa", "🇿🇦", [25, -29], ["south africa"]],
  ["NG", "Nigeria", "🇳🇬", [8, 9], ["nigeria", "nigerian"]],
  ["EG", "Egypt", "🇪🇬", [30, 27], ["egypt", "egyptian"]],
  ["SD", "Sudan", "🇸🇩", [30, 16], ["sudan", "sudanese"]],
  ["MM", "Myanmar", "🇲🇲", [96, 21], ["myanmar", "burma"]],
  ["PH", "Philippines", "🇵🇭", [122, 12], ["philippines", "filipino"]],
  ["ID", "Indonesia", "🇮🇩", [118, -2], ["indonesia", "indonesian"]],
  ["ES", "Spain", "🇪🇸", [-4, 40], ["spain", "spanish"]],
  ["IT", "Italy", "🇮🇹", [12, 43], ["italy", "italian", "meloni"]],
  ["CO", "Colombia", "🇨🇴", [-74, 4], ["colombia", "colombian"]],
  ["CU", "Cuba", "🇨🇺", [-79, 22], ["cuba", "cuban"]],
  ["AF", "Afghanistan", "🇦🇫", [66, 34], ["afghanistan", "afghan", "taliban"]],
  ["BD", "Bangladesh", "🇧🇩", [90, 24], ["bangladesh", "bangladeshi"]],
  ["GE", "Georgia", "🇬🇪", [44, 42], ["georgian", "tbilisi"]],
  ["AM", "Armenia", "🇦🇲", [45, 40], ["armenia", "armenian"]],
  ["AZ", "Azerbaijan", "🇦🇿", [48, 40], ["azerbaijan", "azerbaijani"]],
].map(([iso, name, flag, center, aliases]) => ({
  iso,
  name,
  flag,
  center,
  aliases,
})) as Country[];
export const countryByIso = (iso: string) =>
  countries.find((c) => c.iso === iso) ?? (/^[A-Z]{2}$/.test(iso) ? {iso, name: new Intl.DisplayNames(["en"], {type: "region"}).of(iso) ?? iso, flag: String.fromCodePoint(...[...iso].map(c => 127397 + c.charCodeAt(0))), center: [0,0] as [number,number], aliases: []} : undefined);
export function classifyCountries(text: string): string[] {
  const t = text.toLowerCase();
  return countries
    .filter((c) =>
      c.aliases.some((a) =>
        new RegExp(
          `(^|[^a-z])${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`,
          "i",
        ).test(t),
      ),
    )
    .map((c) => c.iso);
}

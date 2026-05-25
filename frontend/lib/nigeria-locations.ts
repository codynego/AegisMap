export type AreaHub = {
  label: string;
  state: string;
  latitude: number;
  longitude: number;
};

const MAJOR_CITY_NAMES = new Set([
  "Lagos",
  "Ibadan",
  "Abeokuta",
  "Port Harcourt",
  "Benin City",
  "Enugu",
  "Awka",
  "Owerri",
  "Uyo",
  "Calabar",
  "Ilorin",
  "Lokoja",
  "Minna",
  "Makurdi",
  "Jos",
  "Bauchi",
  "Gombe",
  "Yola",
  "Maiduguri",
  "Damaturu",
  "Kano",
  "Sokoto",
  "Kaduna",
  "Kuje",
  "Gwagwalada",
  "Kubwa",
  "Ado-Ekiti",
  "Akure",
  "Osogbo",
]);

export const NIGERIA_STATE_NAMES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT Abuja",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
] as const;

export const NIGERIA_STATE_CENTERS: Record<string, { latitude: number; longitude: number }> = {
  "Abia": { latitude: 5.4167, longitude: 7.3667 },
  "Adamawa": { latitude: 9.3265, longitude: 12.3984 },
  "Akwa Ibom": { latitude: 4.9057, longitude: 7.8497 },
  "Anambra": { latitude: 6.2209, longitude: 6.9926 },
  "Bauchi": { latitude: 10.3158, longitude: 9.7492 },
  "Bayelsa": { latitude: 4.7719, longitude: 6.0671 },
  "Benue": { latitude: 7.1906, longitude: 8.7955 },
  "Borno": { latitude: 11.8333, longitude: 13.0781 },
  "Cross River": { latitude: 5.9631, longitude: 8.3267 },
  "Delta": { latitude: 5.4839, longitude: 6.1167 },
  "Ebonyi": { latitude: 6.3249, longitude: 8.0832 },
  "Edo": { latitude: 6.335, longitude: 5.6037 },
  "Ekiti": { latitude: 7.6222, longitude: 5.221 },
  "Enugu": { latitude: 6.4584, longitude: 7.485 },
  "FCT Abuja": { latitude: 9.0579, longitude: 7.4898 },
  "Gombe": { latitude: 10.2791, longitude: 11.1667 },
  "Imo": { latitude: 5.4966, longitude: 7.0498 },
  "Jigawa": { latitude: 12.228, longitude: 9.5582 },
  "Kaduna": { latitude: 10.5222, longitude: 7.444 },
  "Kano": { latitude: 12.0022, longitude: 8.5169 },
  "Katsina": { latitude: 12.9908, longitude: 7.6013 },
  "Kebbi": { latitude: 12.4539, longitude: 4.1975 },
  "Kogi": { latitude: 7.7337, longitude: 6.7387 },
  "Kwara": { latitude: 8.9669, longitude: 4.5539 },
  "Lagos": { latitude: 6.5244, longitude: 3.3792 },
  "Nasarawa": { latitude: 8.4966, longitude: 8.5259 },
  "Niger": { latitude: 9.9309, longitude: 5.5983 },
  "Ogun": { latitude: 7.16, longitude: 3.35 },
  "Ondo": { latitude: 6.9149, longitude: 4.8331 },
  "Osun": { latitude: 7.5629, longitude: 4.5584 },
  "Oyo": { latitude: 7.8504, longitude: 3.947 },
  "Plateau": { latitude: 9.2182, longitude: 8.8921 },
  "Rivers": { latitude: 4.8156, longitude: 6.998 },
  "Sokoto": { latitude: 13.0059, longitude: 5.2474 },
  "Taraba": { latitude: 7.8737, longitude: 11.4581 },
  "Yobe": { latitude: 12.2938, longitude: 11.5883 },
  "Zamfara": { latitude: 12.17, longitude: 6.237 },
};

export const AREA_HUBS: AreaHub[] = [
  { label: "Lagos", state: "Lagos", latitude: 6.5244, longitude: 3.3792 },
  { label: "Ikeja", state: "Lagos", latitude: 6.6018, longitude: 3.3515 },
  { label: "Epe", state: "Lagos", latitude: 6.5843, longitude: 3.9781 },
  { label: "Surulere", state: "Lagos", latitude: 6.5013, longitude: 3.3536 },
  { label: "Lekki", state: "Lagos", latitude: 6.4698, longitude: 3.5852 },
  { label: "Ibadan", state: "Oyo", latitude: 7.3775, longitude: 3.947 },
  { label: "Ogbomoso", state: "Oyo", latitude: 8.1339, longitude: 4.2405 },
  { label: "Oyo", state: "Oyo", latitude: 7.8527, longitude: 3.9312 },
  { label: "Okeho", state: "Oyo", latitude: 8.0298, longitude: 4.7722 },
  { label: "Iseyin", state: "Oyo", latitude: 7.9682, longitude: 3.5969 },
  { label: "Abeokuta", state: "Ogun", latitude: 7.1569, longitude: 3.3451 },
  { label: "Sagamu", state: "Ogun", latitude: 6.8485, longitude: 3.6463 },
  { label: "Ilaro", state: "Ogun", latitude: 6.8899, longitude: 3.0154 },
  { label: "Mowe", state: "Ogun", latitude: 6.8017, longitude: 3.4363 },
  { label: "Ijebu Ode", state: "Ogun", latitude: 6.8198, longitude: 3.9158 },
  { label: "Ota", state: "Ogun", latitude: 6.6609, longitude: 3.2346 },
  { label: "Benin City", state: "Edo", latitude: 6.335, longitude: 5.6037 },
  { label: "Auchi", state: "Edo", latitude: 7.0628, longitude: 6.2655 },
  { label: "Uromi", state: "Edo", latitude: 6.6964, longitude: 6.3384 },
  { label: "Asaba", state: "Delta", latitude: 6.2, longitude: 6.7333 },
  { label: "Warri", state: "Delta", latitude: 5.554, longitude: 5.7932 },
  { label: "Sapele", state: "Delta", latitude: 5.8941, longitude: 5.6767 },
  { label: "Ughelli", state: "Delta", latitude: 5.4896, longitude: 6.006 },
  { label: "Sapele Junction", state: "Delta", latitude: 5.9015, longitude: 5.7056 },
  { label: "Port Harcourt", state: "Rivers", latitude: 4.8156, longitude: 7.0498 },
  { label: "Oyigbo", state: "Rivers", latitude: 4.8833, longitude: 7.2333 },
  { label: "Ahoada", state: "Rivers", latitude: 5.0833, longitude: 6.65 },
  { label: "Uyo", state: "Akwa Ibom", latitude: 5.0302, longitude: 7.911 },
  { label: "Eket", state: "Akwa Ibom", latitude: 4.6361, longitude: 7.9167 },
  { label: "Ikot Ekpene", state: "Akwa Ibom", latitude: 5.1819, longitude: 7.7143 },
  { label: "Calabar", state: "Cross River", latitude: 4.9757, longitude: 8.3417 },
  { label: "Ogoja", state: "Cross River", latitude: 6.6558, longitude: 8.7992 },
  { label: "Ikom", state: "Cross River", latitude: 5.962, longitude: 8.7167 },
  { label: "Enugu", state: "Enugu", latitude: 6.4584, longitude: 7.5464 },
  { label: "Nsukka", state: "Enugu", latitude: 6.857, longitude: 7.3958 },
  { label: "Agbani", state: "Enugu", latitude: 6.3064, longitude: 7.5457 },
  { label: "Abakaliki", state: "Ebonyi", latitude: 6.3249, longitude: 8.1137 },
  { label: "Afikpo", state: "Ebonyi", latitude: 5.8926, longitude: 7.9324 },
  { label: "Awka", state: "Anambra", latitude: 6.2104, longitude: 7.0699 },
  { label: "Onitsha", state: "Anambra", latitude: 6.1454, longitude: 6.7885 },
  { label: "Nnewi", state: "Anambra", latitude: 6.0196, longitude: 6.9148 },
  { label: "Ogidi", state: "Anambra", latitude: 6.1614, longitude: 6.7374 },
  { label: "Owerri", state: "Imo", latitude: 5.485, longitude: 7.035 },
  { label: "Orlu", state: "Imo", latitude: 5.795, longitude: 7.035 },
  { label: "Umuahia", state: "Abia", latitude: 5.532, longitude: 7.486 },
  { label: "Aba", state: "Abia", latitude: 5.1066, longitude: 7.3667 },
  { label: "Ohafia", state: "Abia", latitude: 5.6145, longitude: 7.8396 },
  { label: "Bende", state: "Abia", latitude: 5.5607, longitude: 7.6333 },
  { label: "Ilorin", state: "Kwara", latitude: 8.4966, longitude: 4.5421 },
  { label: "Offa", state: "Kwara", latitude: 8.149, longitude: 4.7203 },
  { label: "Omu-Aran", state: "Kwara", latitude: 8.1386, longitude: 5.102 },
  { label: "Jebba", state: "Kwara", latitude: 9.1192, longitude: 4.8222 },
  { label: "Patigi", state: "Kwara", latitude: 8.7297, longitude: 5.7575 },
  { label: "Lokoja", state: "Kogi", latitude: 7.8023, longitude: 6.7333 },
  { label: "Okene", state: "Kogi", latitude: 7.5512, longitude: 6.2359 },
  { label: "Idah", state: "Kogi", latitude: 7.1192, longitude: 6.7389 },
  { label: "Ayingba", state: "Kogi", latitude: 7.6267, longitude: 7.1079 },
  { label: "Minna", state: "Niger", latitude: 9.6139, longitude: 6.5569 },
  { label: "Bida", state: "Niger", latitude: 9.08, longitude: 6.0163 },
  { label: "Suleja", state: "Niger", latitude: 9.1806, longitude: 7.1805 },
  { label: "Kontagora", state: "Niger", latitude: 10.4031, longitude: 5.4695 },
  { label: "New Bussa", state: "Niger", latitude: 9.8882, longitude: 4.5134 },
  { label: "Makurdi", state: "Benue", latitude: 7.7337, longitude: 8.536 },
  { label: "Gboko", state: "Benue", latitude: 7.3182, longitude: 9.0019 },
  { label: "Otukpo", state: "Benue", latitude: 7.191, longitude: 8.132 },
  { label: "Aliade", state: "Benue", latitude: 7.2927, longitude: 8.5367 },
  { label: "Jos", state: "Plateau", latitude: 9.8965, longitude: 8.8583 },
  { label: "Bukuru", state: "Plateau", latitude: 9.79, longitude: 8.863 },
  { label: "Shendam", state: "Plateau", latitude: 8.8813, longitude: 9.5357 },
  { label: "Bauchi", state: "Bauchi", latitude: 10.3142, longitude: 9.8469 },
  { label: "Azare", state: "Bauchi", latitude: 11.6748, longitude: 10.1907 },
  { label: "Misau", state: "Bauchi", latitude: 11.3133, longitude: 10.4667 },
  { label: "Gombe", state: "Gombe", latitude: 10.2897, longitude: 11.1673 },
  { label: "Kaltungo", state: "Gombe", latitude: 9.8167, longitude: 11.305 },
  { label: "Dukku", state: "Gombe", latitude: 10.7722, longitude: 10.8238 },
  { label: "Yola", state: "Adamawa", latitude: 9.2096, longitude: 12.4815 },
  { label: "Mubi", state: "Adamawa", latitude: 10.2676, longitude: 13.2644 },
  { label: "Numan", state: "Adamawa", latitude: 9.4639, longitude: 12.0319 },
  { label: "Ganye", state: "Adamawa", latitude: 8.435, longitude: 12.05 },
  { label: "Maiduguri", state: "Borno", latitude: 11.8311, longitude: 13.1509 },
  { label: "Biu", state: "Borno", latitude: 10.6128, longitude: 12.1946 },
  { label: "Bama", state: "Borno", latitude: 11.5221, longitude: 13.6854 },
  { label: "Monguno", state: "Borno", latitude: 12.6717, longitude: 13.6122 },
  { label: "Damaturu", state: "Yobe", latitude: 11.7462, longitude: 11.963 },
  { label: "Potiskum", state: "Yobe", latitude: 11.7139, longitude: 11.0811 },
  { label: "Gashua", state: "Yobe", latitude: 12.8739, longitude: 11.0397 },
  { label: "Nguru", state: "Yobe", latitude: 12.8791, longitude: 10.4554 },
  { label: "Kano", state: "Kano", latitude: 12.0022, longitude: 8.592 },
  { label: "Wudil", state: "Kano", latitude: 11.8091, longitude: 8.8417 },
  { label: "Rano", state: "Kano", latitude: 11.9952, longitude: 8.5649 },
  { label: "Gwarzo", state: "Kano", latitude: 11.9155, longitude: 8.5186 },
  { label: "Dutse", state: "Jigawa", latitude: 11.7589, longitude: 9.3385 },
  { label: "Hadejia", state: "Jigawa", latitude: 12.4535, longitude: 10.0414 },
  { label: "Kazaure", state: "Jigawa", latitude: 12.6539, longitude: 8.4114 },
  { label: "Katsina", state: "Katsina", latitude: 12.9908, longitude: 7.6013 },
  { label: "Daura", state: "Katsina", latitude: 13.0326, longitude: 8.3235 },
  { label: "Funtua", state: "Katsina", latitude: 11.5235, longitude: 7.3117 },
  { label: "Sokoto", state: "Sokoto", latitude: 13.0059, longitude: 5.2474 },
  { label: "Wamakko", state: "Sokoto", latitude: 13.03, longitude: 5.261 },
  { label: "Tambuwal", state: "Sokoto", latitude: 12.4039, longitude: 4.6497 },
  { label: "Birnin Kebbi", state: "Kebbi", latitude: 12.4539, longitude: 4.1975 },
  { label: "Argungu", state: "Kebbi", latitude: 12.744, longitude: 4.5253 },
  { label: "Yauri", state: "Kebbi", latitude: 10.557, longitude: 4.7388 },
  { label: "Gusau", state: "Zamfara", latitude: 12.1705, longitude: 6.6641 },
  { label: "Kaura Namoda", state: "Zamfara", latitude: 12.5933, longitude: 6.5864 },
  { label: "Talata Mafara", state: "Zamfara", latitude: 12.5682, longitude: 6.0699 },
  { label: "Kaduna", state: "Kaduna", latitude: 10.5222, longitude: 7.4384 },
  { label: "Zaria", state: "Kaduna", latitude: 11.1113, longitude: 7.7227 },
  { label: "Kafanchan", state: "Kaduna", latitude: 9.5813, longitude: 8.2926 },
  { label: "Kachia", state: "Kaduna", latitude: 9.8767, longitude: 7.9546 },
  { label: "Kuje", state: "FCT Abuja", latitude: 8.8796, longitude: 7.2275 },
  { label: "Gwagwalada", state: "FCT Abuja", latitude: 8.9432, longitude: 7.084 },
  { label: "Kubwa", state: "FCT Abuja", latitude: 9.1681, longitude: 7.316 },
  { label: "Bwari", state: "FCT Abuja", latitude: 9.2793, longitude: 7.3811 },
  { label: "Ado-Ekiti", state: "Ekiti", latitude: 7.6231, longitude: 5.2209 },
  { label: "Ikere-Ekiti", state: "Ekiti", latitude: 7.4957, longitude: 5.2304 },
  { label: "Ise-Ekiti", state: "Ekiti", latitude: 7.4627, longitude: 5.4287 },
  { label: "Akure", state: "Ondo", latitude: 7.2526, longitude: 5.1931 },
  { label: "Owo", state: "Ondo", latitude: 7.1962, longitude: 5.5868 },
  { label: "Ondo", state: "Ondo", latitude: 7.0931, longitude: 4.8331 },
  { label: "Ifon", state: "Ondo", latitude: 6.9282, longitude: 5.1679 },
  { label: "Osogbo", state: "Osun", latitude: 7.7718, longitude: 4.5561 },
  { label: "Ikirun", state: "Osun", latitude: 7.913, longitude: 4.674 },
  { label: "Ilesa", state: "Osun", latitude: 7.621, longitude: 4.7418 },
  { label: "Ede", state: "Osun", latitude: 7.7375, longitude: 4.4431 },
  { label: "Wukari", state: "Taraba", latitude: 7.8735, longitude: 9.78 },
  { label: "Jalingo", state: "Taraba", latitude: 8.881, longitude: 11.3744 },
  { label: "Bali", state: "Taraba", latitude: 7.8523, longitude: 10.9718 },
  { label: "Makera", state: "Plateau", latitude: 9.8965, longitude: 8.8583 },
  { label: "Bukuru", state: "Plateau", latitude: 9.79, longitude: 8.863 },
];

function normalizeStateName(value: string) {
  const lower = value.trim().toLowerCase();
  if (!lower) return "Lagos";
  if (lower.includes("federal capital") || lower === "fct" || lower === "fct abuja" || lower.includes("abuja")) {
    return "FCT Abuja";
  }
  const matched = NIGERIA_STATE_NAMES.find((state) => lower.includes(state.toLowerCase()));
  return matched ?? "Lagos";
}

function coordinateLocationLabel(latitude: number, longitude: number) {
  return `Near ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export function searchStateSuggestions(query: string, limit = 5) {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return [];

  return NIGERIA_STATE_NAMES.filter((state) => state.toLowerCase().includes(normalized))
    .slice(0, limit)
    .map((state) => {
      const center = NIGERIA_STATE_CENTERS[state] ?? { latitude: 9.082, longitude: 8.6753 };
      return {
        id: `state-${state.toLowerCase().replace(/\s+/g, "-")}`,
        label: state,
        description: "State",
        latitude: center.latitude,
        longitude: center.longitude,
        state,
      };
    });
}

export function searchAreaHubs(query: string, limit = 10, options?: { state?: string }): AreaHub[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return [];

  const selectedState = options?.state?.trim().toLowerCase() ?? "";

  return AREA_HUBS.filter((hub) => {
    const label = hub.label.toLowerCase();
    const state = hub.state.toLowerCase();
    const stateMatches = !selectedState || state === selectedState || state.includes(selectedState) || selectedState.includes(state);
    return stateMatches && (label.includes(normalized) || state.includes(normalized));
  }).slice(0, limit);
}

export function searchTownHubs(query: string, limit = 10, options?: { state?: string }): AreaHub[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return [];

  return searchAreaHubs(query, limit * 2, options).filter((hub) => !MAJOR_CITY_NAMES.has(hub.label)).slice(0, limit);
}

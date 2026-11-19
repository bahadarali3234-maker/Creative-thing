export interface VerifiedIslamicQuotation {
  id: string;
  sourceType: 'quran' | 'hadith';
  reference: string;
  arabic?: string;
  translation: string;
  theme: string;
}

/**
 * Curated registry of verified, traceable Qur'an Ayat and authentic Hadith.
 * Every quotation is strictly sourced with exact Surah:Ayah or canonical Hadith collection reference.
 */
export const VERIFIED_ISLAMIC_QUOTATIONS: VerifiedIslamicQuotation[] = [
  {
    id: 'quran-94-5-6',
    sourceType: 'quran',
    reference: 'Qur’an — Surah Ash-Sharh (94:5–6)',
    arabic: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا',
    translation: 'For indeed, with hardship will be ease. Indeed, with hardship will be ease.',
    theme: 'Patience & Perseverance',
  },
  {
    id: 'quran-2-286',
    sourceType: 'quran',
    reference: 'Qur’an — Surah Al-Baqarah (2:286)',
    arabic: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا',
    translation: 'Allah does not burden a soul beyond that it can bear.',
    theme: 'Strength & Resilience',
  },
  {
    id: 'quran-13-11',
    sourceType: 'quran',
    reference: 'Qur’an — Surah Ar-Ra‘d (13:11)',
    arabic: 'إِنَّ اللَّهَ لَا يُغَيِّرُ مَا بِقَوْمٍ حَتَّىٰ يُغَيِّرُوا مَا بِأَنفُسِهِمْ',
    translation: 'Indeed, Allah will not change the condition of a people until they change what is in themselves.',
    theme: 'Personal Growth & Action',
  },
  {
    id: 'quran-3-159',
    sourceType: 'quran',
    reference: 'Qur’an — Surah Ali ‘Imran (3:159)',
    arabic: 'فَإِذَا عَزَمْتَ فَتَوَكَّلْ عَلَى اللَّهِ ۚ إِنَّ اللَّهَ يُحِبُّ الْمُتَوَكِّلِينَ',
    translation: 'And when you have decided, then rely upon Allah. Indeed, Allah loves those who rely upon Him.',
    theme: 'Decisiveness & Trust',
  },
  {
    id: 'quran-20-114',
    sourceType: 'quran',
    reference: 'Qur’an — Surah Taha (20:114)',
    arabic: 'وَقُل رَّبِّ زِدْنِي عِلْمًا',
    translation: 'And say, "My Lord, increase me in knowledge."',
    theme: 'Seeking Knowledge',
  },
  {
    id: 'quran-14-7',
    sourceType: 'quran',
    reference: 'Qur’an — Surah Ibrahim (14:7)',
    arabic: 'لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ',
    translation: 'If you are grateful, I will surely increase you in favor.',
    theme: 'Gratitude',
  },
  {
    id: 'quran-65-3',
    sourceType: 'quran',
    reference: 'Qur’an — Surah At-Talaq (65:3)',
    arabic: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ',
    translation: 'And whoever relies upon Allah — then He is sufficient for him.',
    theme: 'Reliance & Calm',
  },
  {
    id: 'quran-53-39',
    sourceType: 'quran',
    reference: 'Qur’an — Surah An-Najm (53:39)',
    arabic: 'وَأَن لَّيْسَ لِلْإِنسَانِ إِلَّا مَا سَعَىٰ',
    translation: 'And that there is not for man except that good for which he strives.',
    theme: 'Effort & Excellence',
  },
  {
    id: 'quran-16-90',
    sourceType: 'quran',
    reference: 'Qur’an — Surah An-Nahl (16:90)',
    arabic: 'إِنَّ اللَّهَ يَأْمُرُ بِالْعَدْلِ وَالْإِحْسَانِ',
    translation: 'Indeed, Allah orders justice and good conduct and giving to relatives.',
    theme: 'Integrity & Kindness',
  },
  {
    id: 'hadith-bukhari-1',
    sourceType: 'hadith',
    reference: 'Sahih al-Bukhari 1 (Narrated by ‘Umar ibn al-Khattab)',
    translation: 'The reward of deeds depends upon the intentions and every person will get the reward according to what he has intended.',
    theme: 'Sincere Intention',
  },
  {
    id: 'hadith-muslim-2699',
    sourceType: 'hadith',
    reference: 'Sahih Muslim 2699 (Narrated by Abu Hurairah)',
    translation: 'Whoever treads a path seeking knowledge, Allah will make easy for him the path to Paradise.',
    theme: 'Learning & Study',
  },
  {
    id: 'hadith-bukhari-6464',
    sourceType: 'hadith',
    reference: 'Sahih al-Bukhari 6464 (Narrated by ‘Aishah)',
    translation: 'The most beloved of deeds to Allah are those that are most consistent, even if they are small.',
    theme: 'Consistency & Routine',
  },
  {
    id: 'hadith-muslim-2564',
    sourceType: 'hadith',
    reference: 'Sahih Muslim 2564 (Narrated by Abu Hurairah)',
    translation: 'Indeed Allah does not look at your appearance or wealth, rather He looks at your hearts and actions.',
    theme: 'Character & Sincerity',
  },
  {
    id: 'hadith-bukhari-6018',
    sourceType: 'hadith',
    reference: 'Sahih al-Bukhari 6018 (Narrated by Abu Hurairah)',
    translation: 'Whoever believes in Allah and the Last Day should speak what is good or remain silent.',
    theme: 'Thoughtful Speech',
  },
  {
    id: 'hadith-muslim-17',
    sourceType: 'hadith',
    reference: 'Sahih Muslim 17 (Narrated by Shaddad ibn Aws)',
    translation: 'Indeed, Allah has prescribed excellence (Ihsan) in all things.',
    theme: 'Craft & Excellence',
  },
];

/**
 * Selects the next verified quotation not yet sent to the user.
 * When all verified entries have been seen, starts a fresh cycle cleanly.
 */
export function selectNextIslamicQuotation(sentIds: string[] = []): {
  quotation: VerifiedIslamicQuotation;
  nextSentIds: string[];
} {
  const seen = new Set(Array.isArray(sentIds) ? sentIds : []);
  let pool = VERIFIED_ISLAMIC_QUOTATIONS.filter((q) => !seen.has(q.id));
  let reset = false;
  if (pool.length === 0) {
    pool = VERIFIED_ISLAMIC_QUOTATIONS;
    reset = true;
  }
  const chosen = pool[0];
  const baseIds = reset ? [] : Array.from(seen);
  const nextSentIds = [...baseIds, chosen.id].slice(-VERIFIED_ISLAMIC_QUOTATIONS.length);
  return { quotation: chosen, nextSentIds };
}

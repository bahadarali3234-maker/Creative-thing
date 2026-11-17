import React from 'react';
import { Layers, Sparkles, ExternalLink, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface CreativeThinkLibraryCardProps {
  language?: 'ur' | 'roman-urdu' | 'en' | 'hi';
  onOpenLibrary?: () => void;
  onProceedAnyway?: () => void;
  disabled?: boolean;
}

export const CreativeThinkLibraryCard: React.FC<CreativeThinkLibraryCardProps> = ({
  language = 'en',
  onOpenLibrary,
  onProceedAnyway,
  disabled = false,
}) => {
  const handleOpen = () => {
    if (onOpenLibrary) {
      onOpenLibrary();
    } else {
      window.dispatchEvent(new CustomEvent('open-buildy-workspace'));
    }
  };

  // Translations matching user language
  const content = {
    en: {
      title: 'Create a Better Website with Creative Think Library',
      desc: 'Open the Creative Think Library and explore ready-made designs, color palettes, typography, animations, components and other creative resources. Select the elements you want, combine your favorites and export everything into one file. Attach that file here and tell me what website you want to build. I will analyze your selected resources and use them to create a complete website with HTML, CSS and JavaScript.',
      button: 'Open Creative Think Library',
      skipText: 'Continue building directly without library',
    },
    'roman-urdu': {
      title: 'Creative Think Library ke zariye behtareen website banayein',
      desc: 'Creative Think Library open karein aur tayyar designs, color palettes, typography, animations aur components explore karein. Apni pasandida cheezein select karein, unhein ek file mein export karein aur yahan attach karein. Main aapke muntakhib resources ko analyze karke mukammal HTML, CSS aur JavaScript website bana kar doonga.',
      button: 'Open Creative Think Library',
      skipText: 'Library ke baghair direct website banayein',
    },
    ur: {
      title: 'کریئیٹو تھنک لائبریری کے ذریعے بہترین ویب سائٹ بنائیں',
      desc: 'کریئیٹو تھنک لائبریری کھولیں اور تیار ڈیزائنز، کلر پیلیٹس، ٹائپوگرافی، اینیمیشنز اور جدید کمپونینٹس دیکھیں۔ اپنے پسندیدہ عناصر منتخب کریں، انہیں ایک فائل میں ایکسپورٹ کریں اور یہاں اٹیچ کریں۔ میں آپ کے منتخب وسائل کا مکمل تجزیہ کر کے ایچ ٹی ایم ایل، سی ایس ایس اور جاوا اسکرپٹ پر مبنی مکمل ویب سائٹ تیار کر دوں گا۔',
      button: 'کریئیٹو تھنک لائبریری کھولیں',
      skipText: 'لائبریری کے بغیر براہ راست بنائیں',
    },
    hi: {
      title: 'Creative Think Library के साथ एक बेहतर वेबसाइट बनाएं',
      desc: 'Creative Think Library खोलें और रेडी-मेड डिज़ाइन, रंग पट्टियाँ, टाइपोग्राफी और एनिमेशन देखें। अपने पसंदीदा घटकों का चयन करें, उन्हें एक फ़ाइल में निर्यात करें और यहाँ संलग्न करें। मैं आपकी चुनी हुई सामग्री का विश्लेषण कर के एक संपूर्ण वेबसाइट तैयार करूँगा।',
      button: 'Creative Think Library खोलें',
      skipText: 'लाइब्रेरी के बिना सीधे बनाएं',
    },
  }[language] || {
    title: 'Create a Better Website with Creative Think Library',
    desc: 'Open the Creative Think Library and explore ready-made designs, color palettes, typography, animations, components and other creative resources. Select the elements you want, combine your favorites and export everything into one file. Attach that file here and tell me what website you want to build. I will analyze your selected resources and use them to create a complete website with HTML, CSS and JavaScript.',
    button: 'Open Creative Think Library',
    skipText: 'Continue building directly without library',
  };

  return (
    <div
      className="my-3 rounded-2xl border border-[#00a6ff]/35 bg-gradient-to-br from-white via-blue-50/40 to-indigo-50/30 dark:from-[#0e1224] dark:via-[#090b14] dark:to-[#0f172a] p-5 sm:p-6 shadow-[0_12px_36px_rgba(0,166,255,0.08)] relative overflow-hidden"
      dir={language === 'ur' ? 'rtl' : 'ltr'}
    >
      {/* Header & Content */}

      <div className="relative z-10 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00a6ff] to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
            <Layers size={20} strokeWidth={2.4} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#00a6ff] px-2 py-0.5 rounded-full bg-[#00a6ff]/10 border border-[#00a6ff]/20">
                Recommended Architecture
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-50 leading-snug">
              {content.title}
            </h3>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
          {content.desc}
        </p>

        {/* Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            type="button"
            disabled={disabled}
            onClick={handleOpen}
            className="rounded-xl px-4 py-2.5 bg-gradient-to-r from-[#00a6ff] to-blue-600 hover:from-[#0092e0] hover:to-blue-700 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
          >
            <Sparkles size={16} />
            <span>{content.button}</span>
            <ExternalLink size={14} className="opacity-80" />
          </Button>

          {onProceedAnyway && (
            <button
              type="button"
              disabled={disabled}
              onClick={onProceedAnyway}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors px-2 py-1 underline underline-offset-4 cursor-pointer"
            >
              {content.skipText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

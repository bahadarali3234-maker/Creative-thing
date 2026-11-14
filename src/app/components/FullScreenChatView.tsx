// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  MessageSquare,
  LayoutGrid,
  Folder,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Star,
  Send,
  Mic,
  MicOff,
  User as UserIcon,
  ArrowLeft,
  Menu,
  X,
  Sparkles,
  Paperclip,
  CheckCircle2,
  Copy,
  RotateCcw,
  Pencil,
  Trash2,
  Undo2,
  FileDown,
  FileText,
  FileCode,
  FileCode2,
  Download,
  Eye,
  EyeOff,
  Code2,
  Terminal,
  Check,
  Loader2,
  Clock,
  Coins,
  Smartphone,
  Scan,
  Locate,
  ListTree,
  Image as ImageIcon,
  Maximize2,
  HelpCircle,
  FolderGit2,
  History,
  Layers,
  ArrowRight,
  Brain,
  Lock,
  LogOut,
  ArrowDown,
  ExternalLink,
  Sliders,
  Sun,
  Moon,
  PhoneCall,
  Volume2,
  VolumeX,
  Settings,
  Square,
  ArrowUp,
  Hammer,
  MoreVertical,
  Globe,
  Link2,
  AudioLines,
  Wand2,
  Pause,
  Play,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../context/ThemeContext';
import { AttachedFile, QuestionBlock, ProjectMemory } from '../types';
import { AttachmentGrid } from './AttachmentGrid';
import { detectAndExtractCode, sniffCodeLanguage } from '../utils/codeAttachment';
import { mergeChatThreads } from '../utils/chatThreads';
import { WebsitePreviewModal } from './WebsitePreviewModal';
import { FullScreenCodeEditorModal } from './FullScreenCodeEditorModal';
import { ProjectMemoryDrawer } from './ProjectMemoryDrawer';
import { TimetableImageCard, TimetableSlot } from './TimetableImageCard';
import { ThemeOptionsCard } from './ThemeOptionsCard';
import { BuildyExpandableCard, BUILDY_URL } from './BuildyExpandableCard';
import { isWebsiteOrAppUiBuildRequest } from '../utils/buildyIntent';
import { StudentLiveQuizCard } from './StudentLiveQuizCard';
import { parseStudentContent } from '../utils/studentQuizParser';
import { LiveVoiceCallModal } from './LiveVoiceCallModal';
import { ExploreGptsModal, AiSkillItem } from './ExploreGptsModal';
import { VoiceSettingsModal } from './VoiceSettingsModal';
import { CreativeStudioModal } from './CreativeStudioModal';
import { StudioImageCard, StudioVideoPlayerCard, StudioToolBadge } from './StudioRenderCards';
import { ImageCardBlock } from './ImageCardBlock';
import {
  StudioUploadEntry,
  allTemplates,
  catalogForPrompt,
  classifyStudioHtmlBlock,
  extractStudioToolCall,
  extractVideoPlan,
  getImageDimensions,
  initMythoriaWindowBridge,
  removeBackground,
  saveTemplate,
} from '../utils/mythoriaLib';
import {
  speakWithGeminiTts,
  pauseGeminiTts,
  stopGeminiTts,
  clearPausedSession,
  getStoredVoice,
  getAutoReadAloud,
  getActiveAssistantPersona,
} from '../utils/geminiTts';
import { isCreativeThinkLibraryDocument } from '../utils/creativeThinkLibrary';
import { parseThemeOptions } from '../utils/themeOptions';
import { LoginModal } from './LoginModal';
import { memoryManager } from '../utils/memoryManager';
import {
  subscribeToAuth,
  subscribeToUserChatThreads,
  syncChatThreadToFirestore,
  deleteChatThreadFromFirestore,
  getCurrentUser,
  logOut,
} from '../firebase';

/**
 * Strips raw HTML image tags and markdown image links from text
 */
export function sanitizeImageMarkupFromText(text: string): string {
  if (!text) return '';
  return text
    .replace(/!\[.*?\]\([^)]+\)/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<a[^>]*href=["'][^"']*\.(?:png|jpg|jpeg|webp|gif)[^"']*["'][^>]*>.*?<\/a>/gi, '')
    .replace(/\[(?:Image|Photo|Reference|Preview|Picture)\]\([^)]+\)/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function isSimpleMessage(text?: string): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase().replace(/[!.,?]/g, '');
  const simple = [
    'hi', 'hello', 'hey', 'hey there', 'hello there', 'hi there',
    'thanks', 'thank you', 'thx', 'ty', 'good morning', 'good afternoon',
    'good evening', 'bye', 'goodbye', 'see you', 'ok', 'okay', 'cool',
    'great', 'awesome', 'salam', 'assalam o alaikum'
  ];
  return simple.includes(clean);
}
export function extractTimetableData(text: string): { title: string; slots: TimetableSlot[] } | null {
  if (!text) return null;

  // Extract from bullet/numbered lines containing times like 05:00 AM, 6:30, 08:00 - 09:00, etc.
  const timeSlotRegex =
    /(?:^|\n)[-*•\d.]*\s*([01]?\d:[0-5]\d(?:\s*[ap]m)?(?:\s*[-–—to]\s*[01]?\d:[0-5]\d(?:\s*[ap]m)?)?)\s*[:–—|-]\s*([^\n]+)/gi;

  const matches: TimetableSlot[] = [];
  let match: RegExpExecArray | null;

  while ((match = timeSlotRegex.exec(text)) !== null) {
    const rawTime = match[1].trim();
    const rawContent = match[2].trim().replace(/^[*#_]+|[*#_]+$/g, '');

    if (!rawContent || rawContent.length < 3) continue;

    let category: TimetableSlot['category'] = 'General';
    const lower = (rawTime + ' ' + rawContent).toLowerCase();

    if (/wake|rise|morning|breakfast|hydrat/i.test(lower)) category = 'Morning';
    else if (/work|deep|code|study|focus|task|execut/i.test(lower)) category = 'Deep Work';
    else if (/gym|workout|exercise|training|run|fitness|walk/i.test(lower)) category = 'Fitness';
    else if (/lunch|dinner|meal|snack|nutrit|food/i.test(lower)) category = 'Nutrition';
    else if (/evening|family|relax|hobby|wind\s*down|read/i.test(lower)) category = 'Evening';
    else if (/sleep|bed|rest/i.test(lower)) category = 'Sleep';

    const parts = rawContent.split(/\s*[-–—(]\s*/);
    const activity = parts[0].replace(/[)]+$/, '').trim();
    const desc = parts.length > 1 ? parts.slice(1).join(' - ').replace(/[)]+$/, '').trim() : undefined;

    matches.push({
      time: rawTime,
      activity: activity || 'Scheduled Block',
      category,
      description: desc,
    });
  }

  if (matches.length >= 3) {
    let title = 'DAILY ROUTINE MASTER TIMETABLE';
    if (/study|exam/i.test(text)) title = 'STUDY & ACADEMIC TIMETABLE';
    else if (/workout|fitness|gym/i.test(text)) title = 'FITNESS & TRAINING SCHEDULE';
    else if (/weekend/i.test(text)) title = 'WEEKEND ROUTINE TIMETABLE';

    return {
      title,
      slots: matches,
    };
  }

  // Also parse markdown table if present
  const tableRows = text.split('\n').filter((l) => l.includes('|') && /\d{1,2}:\d{2}/.test(l));
  if (tableRows.length >= 3) {
    const tableSlots: TimetableSlot[] = [];
    for (const row of tableRows) {
      const cells = row.split('|').map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 2) {
        const timeCell = cells.find((c) => /\d{1,2}:\d{2}/.test(c)) || cells[0];
        const actCell = cells.find((c) => c !== timeCell && c.length > 2) || cells[1];
        if (timeCell && actCell) {
          tableSlots.push({
            time: timeCell,
            activity: actCell.replace(/^[*#_]+|[*#_]+$/g, ''),
            category: 'General',
          });
        }
      }
    }
    if (tableSlots.length >= 3) {
      return {
        title: 'DAILY ROUTINE MASTER TIMETABLE',
        slots: tableSlots,
      };
    }
  }

  // Also parse workflow steps / flowchart process if requested
  const stepRegex = /(?:^|\n)[-*•]?\s*(?:Step|Phase|Stage|Flow|Part)\s*(\d+)[:–—.]\s*([^\n]+)/gi;
  const flowSlots: TimetableSlot[] = [];
  let sMatch: RegExpExecArray | null;
  while ((sMatch = stepRegex.exec(text)) !== null) {
    const stepNum = sMatch[1];
    const stepContent = sMatch[2].trim().replace(/^[*#_]+|[*#_]+$/g, '');
    const parts = stepContent.split(/\s*[-–—(]\s*/);
    flowSlots.push({
      time: `Phase ${stepNum}`,
      activity: parts[0].replace(/[)]+$/, '').trim(),
      category: Number(stepNum) <= 2 ? 'Morning' : Number(stepNum) <= 4 ? 'Deep Work' : 'Evening',
      description: parts.length > 1 ? parts.slice(1).join(' - ').replace(/[)]+$/, '').trim() : undefined,
    });
  }
  if (flowSlots.length >= 3) {
    return {
      title: 'MASTER WORKFLOW ARCHITECTURE',
      slots: flowSlots,
    };
  }

  return null;
}

export interface SourceCitation {
  title: string;
  uri: string;
  domain: string;
}

export interface ThoughtSummaryMeta {
  detectedLanguage: string;
  scriptMode: string;
  skillName?: string;
  groundedUsed: boolean;
  sourcesCount: number;
  summary: string;
  steps: Array<{ title: string; desc: string }>;
}

export interface SectionItem {
  title: string;
  description?: string;
  bullets?: string[];
  codeSnippet?: string;
  codeLanguage?: string;
  promptSnippet?: string;
  chartSnippet?: string;
  imageCardSnippet?: string;
  isPrompt?: boolean;
  fileName?: string;
  question?: QuestionBlock;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  isStreaming?: boolean;
  thoughtDuration?: number;
  attachments?: AttachedFile[];
  previousVersions?: string[];
  futureVersions?: string[];
  provider?: 'gemini' | 'groq';
  showLibraryRecommendation?: boolean;
  libraryRecommendationLang?: 'ur' | 'roman-urdu' | 'en' | 'hi';
  sources?: SourceCitation[];
  thoughtSummary?: ThoughtSummaryMeta;
  structuredContent?: {
    mainTitle?: string | { white: string; red: string };
    intro?: string;
    sections?: SectionItem[];
    question?: QuestionBlock;
  };
  activeQuestion?: QuestionBlock;
}

export interface ChatThread {
  id: string;
  title: string;
  promptBanner: string;
  messages: ChatMessage[];
}

/**
 * Robust markdown to structured layout parser for Gemini outputs
 */
export function normalizeMarkdownFences(raw: string): string {
  if (!raw) return raw;
  return raw
    .replace(/```([a-zA-Z0-9_-]+)[ \t]*(?=[<{\[])/g, '```$1\n')
    .replace(/([^\n`])```(?=[ \t]*(?:\n|$|[A-Za-z0-9*#]))/g, '$1\n```\n');
}

export function parseAIText(raw: string): {
  mainTitle?: string;
  intro?: string;
  sections: SectionItem[];
} {
  // Strip out any ```question ... ``` blocks completely so questions NEVER render in chat
  // Strip out any raw HTML <img> tags, markdown image links, or leaked image markup so text is purely clean
  const cleanedRaw = normalizeMarkdownFences(raw)
    .replace(/```question[\s\S]*?```/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/gi, '')
    .trim();
  const lines = cleanedRaw.split('\n');
  let mainTitle: string | undefined;
  let intro = '';
  const sections: SectionItem[] = [];

  const finalizeCode = (code: string): string => {
    if (!code) return code;
    let s = code.trim();
    const isHtml =
      /<!DOCTYPE\s+html/i.test(s) ||
      /<html[\s>]/i.test(s) ||
      /<head[\s>]/i.test(s) ||
      /<body[\s>]/i.test(s) ||
      /<style[\s>]/i.test(s) ||
      /<div[\s>]/i.test(s);

    if (isHtml) {
      if (!/<!DOCTYPE\s+html/i.test(s)) {
        if (/<html[\s>]/i.test(s)) {
          s = '<!DOCTYPE html>\n' + s;
        } else {
          s = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Website</title>\n</head>\n<body>\n${s}\n</body>\n</html>`;
        }
      }
      if (!/<\/html>/i.test(s)) {
        if (!/<\/script>/i.test(s) && /<script[\s>]/i.test(s)) {
          s += '\n</script>';
        }
        if (!/<\/body>/i.test(s)) {
          s += '\n</body>';
        }
        s += '\n</html>';
      }
    }
    return s;
  };

  let currentSection: {
    title: string;
    descLines: string[];
    bullets: string[];
    codeLines: string[];
    inCodeBlock: boolean;
    codeLang: string;
    isPrompt: boolean;
    isChart?: boolean;
    isImageCard?: boolean;
    fileName?: string;
  } | null = null;

  let headerFound = false;
  let inIntro = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check code block markers
    if (trimmed.startsWith('```')) {
      if (currentSection && currentSection.inCodeBlock) {
        currentSection.inCodeBlock = false;
        continue;
      }

      const fenceRest = trimmed.slice(3).trim();
      let lang = fenceRest.toLowerCase();
      let customFile = '';
      const fileMatch = fenceRest.match(/filename=["']?([^"'\s]+)["']?/i) || fenceRest.match(/file=["']?([^"'\s]+)["']?/i);
      if (fileMatch) {
        customFile = fileMatch[1];
      }
      lang = lang.replace(/filename=["']?[^"'\s]+["']?/i, '').replace(/file=["']?[^"'\s]+["']?/i, '').trim();
      const primaryLang: string = lang.split(/[\s,]+/)[0] || '';
      const isChartBlock = primaryLang === 'chart' || primaryLang === 'json-chart';
      const isImageCardBlock = primaryLang === 'image-card';
      let isPromptBlock = false;
      if (!isChartBlock && !isImageCardBlock && (primaryLang.includes('prompt') || primaryLang.includes('llm'))) {
        isPromptBlock = true;
      } else if (!isChartBlock && !isImageCardBlock && currentSection && currentSection.title.toLowerCase().includes('prompt')) {
        isPromptBlock = true;
      }

      let defaultName = 'Component.tsx';
      if (customFile) {
        defaultName = customFile;
      } else if (primaryLang === 'html') {
        defaultName = 'index.html';
      } else if (primaryLang === 'css') {
        defaultName = 'styles.css';
      } else if (isPromptBlock) {
        defaultName = 'prompt.txt';
      }

      // If no current section or current section already contains content, start a dedicated section
      if (!currentSection || currentSection.bullets.length > 0 || currentSection.codeLines.length > 0) {
        if (currentSection) {
          const snippetText = currentSection.codeLines.join('\n').trim();
          const cleanCode = finalizeCode(snippetText);
          sections.push({
            title: currentSection.title,
            description: currentSection.descLines.join('\n').trim() || undefined,
            bullets: currentSection.bullets.length > 0 ? currentSection.bullets : undefined,
            codeSnippet: !currentSection.isPrompt && !currentSection.isChart && !currentSection.isImageCard && cleanCode ? cleanCode : undefined,
            codeLanguage: currentSection.codeLang || undefined,
            promptSnippet: currentSection.isPrompt && snippetText ? snippetText : undefined,
            chartSnippet: currentSection.isChart && snippetText ? snippetText : undefined,
            imageCardSnippet: currentSection.isImageCard && snippetText ? snippetText : undefined,
            isPrompt: currentSection.isPrompt,
            fileName: currentSection.fileName,
          });
        }
        currentSection = {
          title: isImageCardBlock
            ? 'Web Photographs'
            : isChartBlock
            ? 'Interactive Visual Chart'
            : isPromptBlock
            ? 'AI Concept Prompt'
            : `Source Code (${defaultName})`,
          descLines: [],
          bullets: [],
          codeLines: [],
          inCodeBlock: true,
          codeLang: primaryLang || (isPromptBlock ? 'prompt' : 'tsx'),
          isPrompt: isPromptBlock,
          isChart: isChartBlock,
          isImageCard: isImageCardBlock,
          fileName: defaultName,
        };
      } else {
        currentSection.inCodeBlock = true;
        currentSection.codeLang = primaryLang || (isPromptBlock ? 'prompt' : 'tsx');
        currentSection.isPrompt = isPromptBlock;
        currentSection.isChart = isChartBlock;
        currentSection.isImageCard = isImageCardBlock;
        currentSection.fileName = defaultName;
      }
      continue;
    }

    if (currentSection && currentSection.inCodeBlock) {
      currentSection.codeLines.push(line);
      continue;
    }

    // Check # Main Title
    if (trimmed.startsWith('# ') && !headerFound) {
      headerFound = true;
      mainTitle = trimmed.replace(/^#\s+/, '').trim();
      inIntro = true;
      continue;
    }

    // Check ## Section Title
    if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
      inIntro = false;
      if (currentSection) {
        const snippetText = currentSection.codeLines.join('\n').trim();
        const cleanCode = finalizeCode(snippetText);
        sections.push({
          title: currentSection.title,
          description: currentSection.descLines.join('\n').trim() || undefined,
          bullets: currentSection.bullets.length > 0 ? currentSection.bullets : undefined,
          codeSnippet: !currentSection.isPrompt && !currentSection.isChart && !currentSection.isImageCard && cleanCode ? cleanCode : undefined,
          codeLanguage: currentSection.codeLang || undefined,
          promptSnippet: currentSection.isPrompt && snippetText ? snippetText : undefined,
          chartSnippet: currentSection.isChart && snippetText ? snippetText : undefined,
          imageCardSnippet: currentSection.isImageCard && snippetText ? snippetText : undefined,
          isPrompt: currentSection.isPrompt,
          fileName: currentSection.fileName,
        });
      }
      const sTitle = trimmed.replace(/^#+\s+/, '').trim();
      currentSection = {
        title: sTitle,
        descLines: [],
        bullets: [],
        codeLines: [],
        inCodeBlock: false,
        codeLang: '',
        isPrompt: sTitle.toLowerCase().includes('prompt'),
        isChart: false,
        isImageCard: false,
      };
      continue;
    }

    // Bullet points
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      inIntro = false;
      const bulletText = trimmed.replace(/^[-*•]\s+/, '').trim();
      if (!currentSection) {
        currentSection = {
          title: 'Key Takeaways',
          descLines: [],
          bullets: [bulletText],
          codeLines: [],
          inCodeBlock: false,
          codeLang: '',
          isPrompt: false,
          isChart: false,
        };
      } else {
        currentSection.bullets.push(bulletText);
      }
      continue;
    }

    // Numbered list items
    if (/^\d+\.\s+/.test(trimmed)) {
      inIntro = false;
      const bulletText = trimmed.replace(/^\d+\.\s+/, '').trim();
      if (!currentSection) {
        currentSection = {
          title: 'Step-by-Step Breakdown',
          descLines: [],
          bullets: [bulletText],
          codeLines: [],
          inCodeBlock: false,
          codeLang: '',
          isPrompt: false,
          isChart: false,
        };
      } else {
        currentSection.bullets.push(bulletText);
      }
      continue;
    }

    // Content lines
    if (inIntro) {
      if (trimmed) {
        intro += (intro ? '\n' : '') + trimmed;
      }
    } else if (currentSection) {
      if (trimmed) {
        currentSection.descLines.push(trimmed);
      }
    } else if (trimmed) {
      intro += (intro ? '\n' : '') + trimmed;
    }
  }

  if (currentSection) {
    const snippetText = currentSection.codeLines.join('\n').trim();
    const cleanCode = finalizeCode(snippetText);
    sections.push({
      title: currentSection.title,
      description: currentSection.descLines.join('\n').trim() || undefined,
      bullets: currentSection.bullets.length > 0 ? currentSection.bullets : undefined,
      codeSnippet: !currentSection.isPrompt && !currentSection.isChart && !currentSection.isImageCard && cleanCode ? cleanCode : undefined,
      codeLanguage: currentSection.codeLang || undefined,
      promptSnippet: currentSection.isPrompt && snippetText ? snippetText : undefined,
      chartSnippet: currentSection.isChart && snippetText ? snippetText : undefined,
      imageCardSnippet: currentSection.isImageCard && snippetText ? snippetText : undefined,
      isPrompt: currentSection.isPrompt,
      fileName: currentSection.fileName,
    });
  }

  return {
    mainTitle,
    intro: intro.trim() || undefined,
    sections,
  };
}

/**
 * Detects and extracts interactive question blocks from model responses
 */
export function extractQuestionBlock(raw: string): QuestionBlock | null {
  if (!raw) return null;

  if (isCreativeThinkLibraryDocument(raw)) {
    return null;
  }

  const defaultStyles = ['Minimal Luxury', 'Glassmorphism & Neon', 'Editorial Modern', 'Cyber Minimal'];

  // 1. Check for ```question ... ``` or :::question ... :::
  const blockMatch = raw.match(/(?:```question|:::question)([\s\S]*?)(?:```|:::)/i);
  if (blockMatch) {
    const content = blockMatch[1].trim();
    const lines = content.split('\n');
    let title = '';
    let description = '';
    const options: string[] = [];

    for (const l of lines) {
      const t = l.trim();
      if (/^title[:\s]/i.test(t)) {
        title = t.replace(/^title[:\s]+/i, '').trim();
      } else if (/^(?:description|desc|explanation)[:\s]/i.test(t)) {
        description = t.replace(/^(?:description|desc|explanation)[:\s]+/i, '').trim();
      } else if (/^options[:\s]/i.test(t)) {
        // options header
      } else if (t.startsWith('- ') || t.startsWith('* ') || t.startsWith('• ') || /^\d+\.\s/.test(t)) {
        const optText = t.replace(/^[-*•\d.]+\s*/, '').trim();
        if (optText && !optText.toLowerCase().includes('custom') && optText.length > 1) {
          options.push(optText);
        }
      }
    }

    const cleanOptions = options.filter((o) => o && o.trim().length > 0);

    if (title || cleanOptions.length > 0) {
      return {
        id: `q-${Date.now()}`,
        title: title || 'What visual style should the website use?',
        description: description || undefined,
        options: cleanOptions.length > 0 ? cleanOptions : defaultStyles,
      };
    }
  }

  // 2. Natural question format check
  const naturalMatch = raw.match(/(?:\*\*Question:\*\*|Question:)\s*([^\n]+)([\s\S]*?)(?:(?=\n\n[#*A-Z])|$)/i);
  if (naturalMatch) {
    const qTitle = naturalMatch[1].replace(/[*_#]/g, '').trim();
    const rest = naturalMatch[2];
    const optMatches = rest.match(/^[•\-*]\s*([^\n]+)/gm) || rest.match(/^\d+\.\s*([^\n]+)/gm);
    if (optMatches && optMatches.length >= 2) {
      const parsedOpts = optMatches
        .map((o) => o.replace(/^[•\-*\d.]+\s*/, '').trim())
        .filter((o) => o && o.length > 1 && !o.toLowerCase().startsWith('custom'));
      return {
        id: `q-${Date.now()}`,
        title: qTitle,
        options: parsedOpts.length > 0 ? parsedOpts : defaultStyles,
      };
    }
  }

  return null;
}

/**
 * Universal browser file download helper for multi-format export
 */
function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface SpecialSnippetBoxProps {
  type: 'code' | 'prompt';
  badgeTitle?: string;
  content: string;
  language?: string;
  fileName?: string;
  isStreaming?: boolean;
  onUseInChat?: (text: string) => void;
  onOpenFullScreenPreview?: (html: string, fileName?: string) => void;
  onOpenFullScreenEditor?: (code: string, fileName?: string, language?: string) => void;
}

/**
 * Opens standalone HTML website directly in a browser tab / localhost
 * App me preview na chale per user request!
 */
export const openHtmlPreviewInBrowser = async (htmlContent: string, fileName = 'index.html') => {
  try {
    // 1. Try server preview endpoint first for a clean localhost/preview/:id URL
    const res = await fetch('/api/preview-store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: htmlContent }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.url) {
        const fullUrl = window.location.origin + data.url;
        const newWin = window.open(fullUrl, '_blank');
        if (newWin) return;
      }
    }
  } catch (err) {
    console.warn('Server preview endpoint notice:', err);
  }

  // 2. Direct Blob fallback in browser tab
  try {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank');
    if (!win) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.target = '_blank';
      a.rel = 'noopener,noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } catch (err) {
    console.error('Failed to open preview in browser:', err);
  }
};

// Download helper function for code files
export const downloadCodeFile = (filename: string, content: string) => {
  try {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Download error:', err);
  }
};

// Formatted text helper to render AI responses in bold high-contrast editorial typography
export const renderFormattedBoldText = (text: string) => {
  if (!text) return null;

  const calloutRegex = /^(IMPORTANT|NOTE|TIP|WARNING|SUCCESS|ERROR|KEY POINT|REMEMBER)[:\s]+([\s\S]+)$/i;
  const lines = text.split('\n');
  const renderedElements: React.ReactNode[] = [];

  for (let lIdx = 0; lIdx < lines.length; lIdx++) {
    const line = lines[lIdx];
    const calloutMatch = line.trim().match(calloutRegex);
    if (calloutMatch) {
      const type = calloutMatch[1].toUpperCase();
      const content = calloutMatch[2];
      const isWarn = type === 'WARNING' || type === 'ERROR';
      const isTip = type === 'TIP' || type === 'SUCCESS';
      renderedElements.push(
        <div
          key={`callout-${lIdx}`}
          className={`my-2.5 px-4 py-3 rounded-2xl border flex items-start gap-3 ${
            isWarn
              ? 'bg-rose-50 border-rose-300 text-rose-950'
              : isTip
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-sky-50/70 border-[#00a6ff]/35 text-foreground'
          }`}
        >
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-zinc-950 text-white shrink-0 mt-0.5">
            {type}
          </span>
          <span className="font-bold text-sm sm:text-base leading-relaxed">
            {content}
          </span>
        </div>
      );
      continue;
    }

    const parts = line.split(/(\*\*[^*]+\*\*|__[^_]+__|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<]+)/g);
    const lineElements = parts.map((part, index) => {
      if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
        const boldContent = part.slice(2, -2);
        return (
          <strong key={`bold-${lIdx}-${index}`} className="font-black text-foreground">
            {boldContent}
          </strong>
        );
      }

      const mdLinkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (mdLinkMatch) {
        const linkTitle = mdLinkMatch[1];
        const linkUrl = mdLinkMatch[2];
        let domain = 'link';
        try { domain = new URL(linkUrl).hostname.replace(/^www\./, ''); } catch {}
        return (
          <a
            key={`link-${lIdx}-${index}`}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 my-0.5 rounded-lg bg-[#00a6ff]/10 hover:bg-[#00a6ff]/20 text-[#0a2a66] border border-[#00a6ff]/30 transition-all text-xs sm:text-sm font-extrabold no-underline"
          >
            <span>{linkTitle}</span>
            <span className="text-[10px] opacity-70">({domain})</span>
            <ExternalLink size={11} className="shrink-0" />
          </a>
        );
      }

      if (/^https?:\/\/[^\s<]+$/.test(part)) {
        let domain = 'link';
        try { domain = new URL(part).hostname.replace(/^www\./, ''); } catch {}
        return (
          <a
            key={`rawlink-${lIdx}-${index}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 my-0.5 rounded-lg bg-[#00a6ff]/10 hover:bg-[#00a6ff]/20 text-[#0a2a66] border border-[#00a6ff]/30 transition-all text-xs sm:text-sm font-extrabold no-underline"
          >
            <span>{domain}</span>
            <ExternalLink size={11} className="shrink-0" />
          </a>
        );
      }

      return (
        <span key={`span-${lIdx}-${index}`} className="font-bold text-foreground">
          {part}
        </span>
      );
    });

    renderedElements.push(
      <React.Fragment key={`line-${lIdx}`}>
        {lineElements}
        {lIdx < lines.length - 1 && '\n'}
      </React.Fragment>
    );
  }

  return renderedElements;
};

const CHART_COLORS = ['#00a6ff', '#0a2a66', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

export const MarkdownTableBlock: React.FC<{ lines: string[] }> = ({ lines }) => {
  const cleanCells = (row: string) =>
    row
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());

  const headers = cleanCells(lines[0] || '');
  const bodyLines = lines.slice(1).filter((l) => !/^\|?[\s:-]+(\|[\s:-]+)*\|?$/.test(l.trim()));
  if (!headers.length) return null;

  return (
    <div className="my-3 w-full overflow-x-auto rounded-2xl border border-border bg-white shadow-sm">
      <table className="w-full text-left border-collapse text-xs sm:text-sm">
        <thead>
          <tr className="bg-zinc-950 text-white">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-2.5 font-extrabold tracking-wide whitespace-nowrap border-b border-zinc-800">
                {h.replace(/\*\*/g, '')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyLines.map((row, rIdx) => {
            const cells = cleanCells(row);
            return (
              <tr
                key={rIdx}
                className={rIdx % 2 === 0 ? 'bg-white' : 'bg-sky-50/35'}
              >
                {headers.map((_, cIdx) => (
                  <td
                    key={cIdx}
                    className="px-4 py-2.5 font-bold text-zinc-900 border-b border-zinc-100 align-top"
                  >
                    {renderFormattedBoldText(cells[cIdx] || '—')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export const InteractiveChartBlock: React.FC<{ rawSpec: string; isStreaming?: boolean }> = ({
  rawSpec,
  isStreaming = false,
}) => {
  let parsed: any = null;
  try {
    parsed = JSON.parse(rawSpec.trim());
  } catch {
    if (isStreaming) {
      return (
        <div className="my-3 p-4 rounded-2xl border border-border bg-white shadow-sm flex items-center gap-2 text-xs font-bold text-zinc-600">
          <Loader2 size={14} className="animate-spin text-[#00a6ff]" />
          <span>Rendering interactive chart...</span>
        </div>
      );
    }
    return null;
  }

  const data = Array.isArray(parsed?.data) ? parsed.data : [];
  if (!data.length) return null;

  const chartType = (parsed.type || 'bar').toLowerCase();
  const xKey = parsed.xKey || Object.keys(data[0]).find((k) => typeof data[0][k] === 'string') || 'label';
  const series = Array.isArray(parsed.series) && parsed.series.length > 0
    ? parsed.series
    : Object.keys(data[0])
        .filter((k) => k !== xKey && typeof data[0][k] === 'number')
        .map((k, idx) => ({ key: k, label: k, color: CHART_COLORS[idx % CHART_COLORS.length] }));

  return (
    <div className="my-4 p-4 sm:p-5 rounded-2xl border border-border bg-white shadow-sm space-y-3">
      {parsed.title && (
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm sm:text-base font-extrabold text-zinc-900">{parsed.title}</h4>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-sky-50 text-[#0a2a66] border border-[#00a6ff]/30">
            {chartType} chart
          </span>
        </div>
      )}
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'line' ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fontWeight: 700, fill: '#27272a' }} />
              <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: '#27272a' }} />
              <Tooltip />
              <Legend />
              {series.map((s: any, idx: number) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label || s.key}
                  stroke={s.color || CHART_COLORS[idx % CHART_COLORS.length]}
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
              ))}
            </LineChart>
          ) : chartType === 'area' ? (
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fontWeight: 700, fill: '#27272a' }} />
              <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: '#27272a' }} />
              <Tooltip />
              <Legend />
              {series.map((s: any, idx: number) => {
                const c = s.color || CHART_COLORS[idx % CHART_COLORS.length];
                return (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label || s.key}
                    stroke={c}
                    fill={c}
                    fillOpacity={0.2}
                    strokeWidth={2.5}
                  />
                );
              })}
            </AreaChart>
          ) : chartType === 'pie' ? (
            <PieChart>
              <Tooltip />
              <Legend />
              <Pie
                data={data}
                dataKey={series[0]?.key || 'value'}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                outerRadius={84}
                label
              >
                {data.map((_: any, idx: number) => (
                  <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fontWeight: 700, fill: '#27272a' }} />
              <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: '#27272a' }} />
              <Tooltip />
              <Legend />
              {series.map((s: any, idx: number) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label || s.key}
                  fill={s.color || CHART_COLORS[idx % CHART_COLORS.length]}
                  radius={[6, 6, 0, 0]}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const renderRichProseWithTables = (text: string) => {
  if (!text) return null;
  const lines = text.split('\n');
  const blocks: Array<{ kind: 'text' | 'table' | 'heading'; level?: number; lines: string[] }> = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    const nextLine = (lines[i + 1] || '').trim();
    const isTableStart =
      line.includes('|') &&
      (nextLine.includes('|') && /^\|?[\s:-]+(\|[\s:-]+)+\|?$/.test(nextLine));
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);

    if (isTableStart) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      blocks.push({ kind: 'table', lines: tableLines });
    } else if (headingMatch) {
      blocks.push({
        kind: 'heading',
        level: headingMatch[1].length,
        lines: [headingMatch[2].trim()],
      });
      i++;
    } else {
      const textLines: string[] = [];
      while (i < lines.length) {
        const cur = lines[i].trim();
        const nxt = (lines[i + 1] || '').trim();
        if (cur.includes('|') && nxt.includes('|') && /^\|?[\s:-]+(\|[\s:-]+)+\|?$/.test(nxt)) {
          break;
        }
        if (/^#{1,4}\s+/.test(cur)) {
          break;
        }
        textLines.push(lines[i]);
        i++;
      }
      const joined = textLines.join('\n');
      if (joined.trim()) {
        blocks.push({ kind: 'text', lines: [joined] });
      }
    }
  }

  return (
    <div className="space-y-3">
      {blocks.map((b, idx) => {
        if (b.kind === 'table') {
          return <MarkdownTableBlock key={`tbl-${idx}`} lines={b.lines} />;
        }
        if (b.kind === 'heading') {
          const title = b.lines[0].replace(/\*\*/g, '');
          const lvl = b.level || 2;
          if (lvl === 1) {
            return (
              <h2
                key={`hd-${idx}`}
                className="text-xl sm:text-2xl font-extrabold text-foreground tracking-[-0.015em] leading-[1.28] pt-1"
              >
                {title}
              </h2>
            );
          }
          if (lvl === 2) {
            return (
              <div key={`hd-${idx}`} className="flex items-center gap-2.5 pt-2">
                <span className="w-1.5 h-5 rounded-full bg-[var(--primary)] shrink-0" />
                <h3 className="text-lg sm:text-xl font-extrabold text-foreground tracking-[-0.015em] leading-[1.3]">
                  {title}
                </h3>
              </div>
            );
          }
          return (
            <h4
              key={`hd-${idx}`}
              className="text-base sm:text-lg font-extrabold text-foreground tracking-[-0.01em] leading-[1.32] pt-1"
            >
              {title}
            </h4>
          );
        }
        return (
          <div key={`txt-${idx}`} className="whitespace-pre-line font-bold text-foreground leading-relaxed">
            {renderFormattedBoldText(b.lines[0])}
          </div>
        );
      })}
    </div>
  );
};

// Helper to generate a live HTML sandbox document from raw HTML/code
const generateLiveSandboxHtml = (rawCode: string) => {
  // If the user's snippet is already a complete HTML document, render it faithfully
  if (/<!DOCTYPE\s+html/i.test(rawCode) || /<html[\s>]/i.test(rawCode)) {
    if (!rawCode.includes('cdn.tailwindcss.com')) {
      if (/<head[\s>]/i.test(rawCode)) {
        return rawCode.replace(/<head>/i, '<head><script src="https://cdn.tailwindcss.com"></script>');
      }
      return `<script src="https://cdn.tailwindcss.com"></script>\n${rawCode}`;
    }
    return rawCode;
  }

  // Extract clean markup if wrapped in JSX return
  let clean = rawCode;
  const returnMatch = clean.match(/return\s*\(\s*([\s\S]*?)\s*\);?\s*\}?\s*$/m);
  if (returnMatch && returnMatch[1]) {
    clean = returnMatch[1];
  } else {
    // Strip import statements
    clean = clean.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '');
    // Strip export statement wrappers
    clean = clean.replace(/export\s+(default\s+)?(function|const)\s+[\w\s=><()]+=>\s*\{?\s*(return\s*\(?)?/g, '');
    clean = clean.replace(/export\s+(default\s+)?function[\s\S]*?\{\s*(return\s*\(?)?/g, '');
    clean = clean.replace(/\}\s*;\s*$/, '').replace(/\}\s*$/, '');
  }

  // Convert JSX className to HTML class
  clean = clean.replace(/className=/g, 'class=');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
      font-family: 'Plus Jakarta Sans', sans-serif;
      background-color: #09090b;
      color: #ffffff;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body class="bg-[#09090b] text-foreground min-h-screen flex items-center justify-center p-6 antialiased">
  <div class="w-full flex justify-center items-center">
    ${clean}
  </div>
</body>
</html>`;
};

/**
 * Dedicated Special Layout Box for code snippets and prompts
 * Features:
 * - Compact box layout with scrollable detail code (max-h-80)
 * - White background option for crisp, readable code viewing
 * - Action controls: Fullscreen Wide, Copy, Live Preview (HTML), Download
 */
export const SpecialSnippetBox: React.FC<SpecialSnippetBoxProps> = ({
  type,
  badgeTitle,
  content,
  language,
  fileName,
  isStreaming = false,
  onUseInChat,
  onOpenFullScreenPreview,
  onOpenFullScreenEditor,
}) => {
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<'code' | 'preview'>('code');
  const codeContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll code container as code/prompt is typed in live
  useEffect(() => {
    if (isStreaming && codeContainerRef.current) {
      codeContainerRef.current.scrollTop = codeContainerRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  const isPrompt = type === 'prompt';

  // Preview is STRICTLY restricted to real HTML / markup code only
  const isHtmlCode =
    !isPrompt &&
    type === 'code' &&
    (
      Boolean(language && ['html', 'htm', 'xhtml'].includes(language.toLowerCase())) ||
      /<!DOCTYPE\s+html/i.test(content) ||
      /<html[\s>]/i.test(content) ||
      /<(div|section|header|footer|nav|main|aside|article|button|table|form|card|span|p|h[1-6]|svg)[\s>]/i.test(content)
    );

  // When NOT streaming, ensure HTML code strictly starts from <!DOCTYPE html> and ends with </html> for complete copy/export
  let completeContent = content;
  if (!isStreaming && isHtmlCode) {
    if (!/<!DOCTYPE\s+html/i.test(completeContent)) {
      if (/<html[\s>]/i.test(completeContent)) {
        completeContent = '<!DOCTYPE html>\n' + completeContent.trim();
      } else {
        completeContent = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Website</title>\n</head>\n<body>\n${completeContent}\n</body>\n</html>`;
      }
    }
    if (!/<\/html>/i.test(completeContent)) {
      if (!/<\/script>/i.test(completeContent) && /<script[\s>]/i.test(completeContent)) {
        completeContent += '\n</script>';
      }
      if (!/<\/body>/i.test(completeContent)) {
        completeContent += '\n</body>';
      }
      completeContent += '\n</html>';
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(completeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resolvedFileName =
    fileName ||
    (isPrompt
      ? 'prompt.txt'
      : isHtmlCode
      ? 'index.html'
      : language?.toLowerCase() === 'css'
      ? 'styles.css'
      : language?.toLowerCase() === 'json'
      ? 'data.json'
      : language?.toLowerCase() === 'py'
      ? 'main.py'
      : language?.toLowerCase() === 'js' || language?.toLowerCase() === 'javascript'
      ? 'script.js'
      : 'index.html');

  const handleDownload = () => {
    downloadCodeFile(resolvedFileName, completeContent);
  };

  const lineCount = (completeContent || '').split('\n').length;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`snippet-box mt-4 rounded-[24px] sm:rounded-[28px] bg-surface border border-border shadow-[var(--shadow-neumorphic-soft)] overflow-hidden transition-all text-foreground ${
        isStreaming ? 'ring-2 ring-[var(--primary)]/40 shadow-[var(--shadow-neumorphic-soft)]' : ''
      }`}
    >
      {/* Top Header Bar (Pure White Container matching Question card) */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-surface border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--primary)] shadow-[var(--shadow-neumorphic-soft)]" />
          <span className="font-mono text-xs sm:text-sm font-bold text-foreground tracking-wide truncate">
            {resolvedFileName}
          </span>
          {isStreaming ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/25 text-[var(--primary)] text-[11px] font-bold shrink-0 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-ping" />
              <span>
                {!completeContent.trim()
                  ? 'Generating code...'
                  : `Writing ${isPrompt ? 'Prompt' : language?.toUpperCase() || 'Code'}...`}
              </span>
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-foreground bg-surface border border-border px-2 py-0.5 rounded-full shrink-0">
              {lineCount} lines • Scrollable
            </span>
          )}
        </div>

        {/* Action Controls: 4 clean icon options (Wide Screen, Copy, Preview, Save) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* 1. Wide Screen / Expand Button -> Opens Fullscreen In-App Code Editor */}
          <button
            type="button"
            onClick={() => {
              if (onOpenFullScreenEditor) {
                onOpenFullScreenEditor(completeContent, resolvedFileName, language || (isPrompt ? 'text' : 'html'));
              } else if (onOpenFullScreenPreview) {
                onOpenFullScreenPreview(completeContent, resolvedFileName);
              }
            }}
            className="w-8 h-8 rounded-lg bg-surface hover:bg-surface hover:text-[var(--primary)] text-foreground flex items-center justify-center transition-all cursor-pointer select-none active:scale-90 border border-border shadow-sm"
            title="Expand Full Screen Code Editor"
            aria-label="Expand Full Screen Code Editor"
          >
            <Maximize2 size={15} />
          </button>

          {/* 2. Copy */}
          <button
            type="button"
            onClick={handleCopy}
            className="w-8 h-8 rounded-lg bg-surface hover:bg-surface text-foreground hover:text-black flex items-center justify-center transition-all cursor-pointer select-none active:scale-90 border border-border shadow-sm"
            title="Copy Code"
            aria-label="Copy Code"
          >
            {copied ? (
              <CheckCircle2 size={15} className="text-[var(--primary)]" />
            ) : (
              <Copy size={15} />
            )}
          </button>

          {/* 3. HTML Live Preview in App */}
          {isHtmlCode && (
            <button
              type="button"
              onClick={() => {
                if (onOpenFullScreenPreview) {
                  onOpenFullScreenPreview(completeContent, resolvedFileName);
                } else {
                  openHtmlPreviewInBrowser(completeContent, resolvedFileName);
                }
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer select-none active:scale-90 border shadow-sm bg-surface hover:bg-surface text-foreground hover:text-[var(--primary)] border-border"
              title="Open Live Preview in App"
              aria-label="Open Live Preview in App"
            >
              <Eye size={15} />
            </button>
          )}

          {/* 4. Save / Download */}
          <button
            type="button"
            onClick={handleDownload}
            className="w-8 h-8 rounded-lg bg-surface hover:bg-surface text-foreground hover:text-[var(--primary)] flex items-center justify-center transition-all cursor-pointer select-none active:scale-90 border border-border shadow-sm"
            title="Download Complete File"
            aria-label="Download Complete File"
          >
            <Download size={15} />
          </button>
        </div>
      </div>

      {/* Code / Preview tabs (live sandboxed preview inline, v2 spec) */}
      {isHtmlCode && !isStreaming && (
        <div className="flex items-center gap-1.5 px-3 sm:px-4 pt-2.5 bg-surface" role="tablist" aria-label="Code and preview tabs">
          {(['code', 'preview'] as const).map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              role="tab"
              aria-selected={view === tabKey}
              onClick={() => setView(tabKey)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wide border transition-all cursor-pointer ${
                view === tabKey
                  ? 'bg-[var(--primary)] text-foreground border-transparent shadow-[var(--shadow-neumorphic-soft)]'
                  : 'bg-surface text-foreground border-border hover:border-[var(--primary)]/60'
              }`}
            >
              {tabKey === 'code' ? 'Code' : 'Preview'}
            </button>
          ))}
        </div>
      )}

      {/* Special Layout Content: Pure White Compact Scrollable Box or Live Sandbox */}
      {view === 'preview' && isHtmlCode && !isStreaming ? (
        <div className="p-3 sm:p-4 bg-surface">
          <iframe
            srcDoc={completeContent}
            title="Live website preview"
            sandbox="allow-scripts allow-forms allow-modals"
            className="w-full rounded-xl border border-border bg-surface"
            style={{ height: 'min(70vh, 560px)' }}
          />
        </div>
      ) : (
      <div className="p-3 sm:p-4 bg-surface">
        {/* COMPACT SCROLLABLE CODE BOX: Pure White Background */}
        <div className="rounded-xl border border-border bg-surface text-foreground shadow-sm overflow-hidden">
          {/* Scrollable Code Area (compact height, complete detail inside with line numbers) */}
          <div
            ref={codeContainerRef}
            className="max-h-64 sm:max-h-72 overflow-y-auto overflow-x-auto p-3.5 select-text bg-surface scroll-smooth"
          >
            <div className="flex font-mono text-xs sm:text-[13px] leading-relaxed">
              {/* Line Numbers Column */}
              {!isPrompt && (
                <div
                  className="select-none pr-3 mr-3 text-right border-r border-border text-foreground font-mono font-medium bg-surface"
                  style={{ minWidth: '2.4rem' }}
                >
                  {(completeContent || ' ').split('\n').map((_, idx) => (
                    <div key={idx} className="leading-relaxed">
                      {idx + 1}
                    </div>
                  ))}
                </div>
              )}
              {/* Complete Code Content in Pure White Container */}
              <pre className="flex-1 font-mono text-xs sm:text-[13px] leading-relaxed whitespace-pre font-bold text-foreground bg-surface selection:bg-[var(--primary)]/20">
                {completeContent || (isStreaming ? ' ' : '')}
                {isStreaming && (
                  <span className="inline-block w-2 h-4 bg-[var(--primary)] align-middle ml-1 rounded-[1px] animate-pulse shadow-[var(--shadow-neumorphic-soft)]" />
                )}
              </pre>
            </div>
          </div>

          {isPrompt && onUseInChat && (
            <div className="flex justify-end p-2.5 border-t border-border bg-surface">
              <button
                type="button"
                onClick={() => onUseInChat(content)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-foreground text-xs font-semibold shadow-[var(--shadow-neumorphic-soft)] transition-all cursor-pointer"
              >
                <Send size={12} />
                <span>Run In Prompt Box</span>
              </button>
            </div>
          )}
          </div>
        </div>
      )}
    </motion.div>
  );
};

/**
 * Live Stream & Message Renderer with instant separation of conversational text vs code boxes
 * Satisfies User Directives:
 * 1. "First of all, you can write this answer with the animation. Not apply at last when you generate everything okay"
 * 2. "And on code don't show typing animation. It is in when it write code. Make it faster but have simulation animation"
 * 3. "it don't show complete code in chat. Just so a little box and have scrollable detail code... White background every kind of code"
 * 4. "always answer in bold. Make it more bold. It's not bold, okay?"
 */
export const LiveMessageStreamRenderer: React.FC<{
  rawText: string;
  isStreaming?: boolean;
  uploadsMap?: Record<string, string>;
  onOpenPreview?: (html: string, fileName?: string) => void;
  onOpenEditor?: (code: string, fileName?: string, language?: string) => void;
  onUseInChat?: (prompt: string) => void;
  onChooseTheme?: (choice: string) => void;
  onTimingDriftReport?: (reportJson: string) => void;
}> = ({ rawText: rawTextProp, isStreaming = false, uploadsMap = {}, onOpenPreview, onOpenEditor, onUseInChat, onChooseTheme, onTimingDriftReport }) => {
  if (!rawTextProp) return null;

  const normalizedRaw = React.useMemo(() => normalizeMarkdownFences(rawTextProp), [rawTextProp]);
  const videoPlan = React.useMemo(() => extractVideoPlan(normalizedRaw), [normalizedRaw]);
  const studioTool = React.useMemo(() => extractStudioToolCall(normalizedRaw), [normalizedRaw]);

  // v2 website designer: parse the **Option N - Name** theme blocks into an
  // interactive swatch card and hide the raw markdown from the message text.
  const themeParsed = parseThemeOptions(normalizedRaw);
  const rawText = themeParsed ? themeParsed.cleanedText : normalizedRaw;

  // Robust regex for code/chart/prompt fences: ```[lang] [attributes]\n[code...] (```|$ )
  const fenceRegex = /```([a-zA-Z0-9_.-]+)?([^\n]*)\n([\s\S]*?)(?:```|$)/g;
  const segments: { type: 'text' | 'code' | 'prompt' | 'chart' | 'image-card'; content: string; language?: string; fileName?: string }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(rawText)) !== null) {
    const textBefore = rawText.slice(lastIndex, match.index);
    if (textBefore.trim()) {
      segments.push({ type: 'text', content: textBefore });
    }
    const rawLang = (match[1] || '').toLowerCase();
    const restHeader = match[2] || '';
    const code = match[3] || '';

    let fileName = '';
    const fnMatch =
      restHeader.match(/(?:filename|file)=["']?([^"'\s]+)["']?/i) ||
      restHeader.match(/:([^\s\n]+)/);
    if (fnMatch) {
      fileName = fnMatch[1];
    }

    const isImageCard = rawLang === 'image-card';
    const isChart = !isImageCard && (rawLang === 'chart' || rawLang === 'json-chart');
    const isPrompt = !isImageCard && !isChart && Boolean(rawLang && (rawLang.includes('prompt') || rawLang === 'llm'));
    segments.push({
      type: isImageCard ? 'image-card' : isChart ? 'chart' : isPrompt ? 'prompt' : 'code',
      content: code,
      language: rawLang || (isPrompt ? 'prompt' : 'html'),
      fileName: fileName || (isPrompt ? 'prompt.txt' : 'Component.tsx'),
    });
    lastIndex = match.index + match[0].length;
  }

  const trailingText = rawText.slice(lastIndex);
  const pendingFenceMatch = trailingText.match(/```([a-zA-Z0-9_.-]+)?([^\n]*)$/);
  if (pendingFenceMatch) {
    const textBeforeFence = trailingText.slice(0, pendingFenceMatch.index);
    if (textBeforeFence.trim()) {
      segments.push({ type: 'text', content: textBeforeFence });
    }
    const rawLang = (pendingFenceMatch[1] || '').toLowerCase();
    const isImageCard = rawLang === 'image-card';
    const isChart = !isImageCard && (rawLang === 'chart' || rawLang === 'json-chart');
    const isPrompt = !isImageCard && !isChart && Boolean(rawLang && (rawLang.includes('prompt') || rawLang === 'llm'));
    segments.push({
      type: isImageCard ? 'image-card' : isChart ? 'chart' : isPrompt ? 'prompt' : 'code',
      content: '',
      language: rawLang || (isPrompt ? 'prompt' : 'html'),
      fileName: isPrompt ? 'prompt.txt' : 'Component.tsx',
    });
  } else if (trailingText.trim() || segments.length === 0) {
    segments.push({ type: 'text', content: trailingText || rawText });
  }

  const hasCodeOrPrompt = segments.some((s) => s.type === 'code' || s.type === 'prompt');

  return (
    <div className="space-y-4">
      {isStreaming && (
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface/90 border border-border/80 shadow-md text-xs text-foreground font-bold mb-1 select-none">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--primary)] opacity-80" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--primary)]" />
          </span>
          <span className="tracking-wide">
            {hasCodeOrPrompt ? 'Writing & structuring output' : 'Generating live response'}
          </span>
        </div>
      )}

      {segments.map((seg, idx) => {
        const isLastSegment = idx === segments.length - 1;
        if (seg.type === 'image-card') {
          return (
            <ImageCardBlock
              key={`seg-imgcard-${idx}`}
              rawSpec={seg.content}
              isStreaming={isStreaming && isLastSegment}
            />
          );
        }
        if (seg.type === 'chart') {
          return (
            <InteractiveChartBlock
              key={`seg-chart-${idx}`}
              rawSpec={seg.content}
              isStreaming={isStreaming && isLastSegment}
            />
          );
        }
        if (seg.type === 'code' || seg.type === 'prompt') {
          const isLastSegStreaming = isStreaming && isLastSegment;
          const langLower = (seg.language || '').toLowerCase();

          // Hide raw JSON blocks that belong to VideoPlan or MythoriaLib Tool Call
          if (langLower === 'json') {
            if (studioTool && seg.content.includes('"tool"')) {
              return (
                <StudioToolBadge
                  key={`seg-tool-${idx}`}
                  toolCall={studioTool}
                />
              );
            }
            if (videoPlan && seg.content.includes('"segments"') && seg.content.includes('"scenes"')) {
              return isLastSegStreaming ? (
                <div key={`seg-plan-${idx}`} className="px-3.5 py-2.5 rounded-xl bg-[#F4F8FC] border border-[#00A6FF]/35 text-xs font-bold text-[#0A2A66] flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-[#00A6FF]" />
                  <span>Preparing video storyboard &amp; narration cues...</span>
                </div>
              ) : null;
            }
          }

          if (seg.type === 'code' && (langLower === 'html' || /<div[^>]+id=["']canvas["']|window\.VIDEO/i.test(seg.content))) {
            const studioKind = classifyStudioHtmlBlock(seg.content);
            if (studioKind === 'video' && videoPlan) {
              return (
                <StudioVideoPlayerCard
                  key={`seg-studio-vid-${idx}`}
                  htmlCode={seg.content}
                  videoPlan={videoPlan}
                  uploadsMap={uploadsMap}
                  isStreaming={isLastSegStreaming}
                  onOpenFullScreenEditor={onOpenEditor}
                  onTimingDriftReport={onTimingDriftReport}
                />
              );
            }
            if (studioKind === 'image') {
              return (
                <StudioImageCard
                  key={`seg-studio-img-${idx}`}
                  htmlCode={seg.content}
                  uploadsMap={uploadsMap}
                  fileName={seg.fileName || 'studio-design.html'}
                  isStreaming={isLastSegStreaming}
                  onOpenFullScreenEditor={onOpenEditor}
                />
              );
            }
          }

          return (
            <div key={`seg-${seg.type}-${idx}`} className="space-y-1.5">
              <SpecialSnippetBox
                type={seg.type}
                content={seg.content}
                language={seg.language || (seg.type === 'prompt' ? 'prompt' : 'html')}
                fileName={seg.fileName}
                isStreaming={isLastSegStreaming}
                onOpenFullScreenPreview={onOpenPreview}
                onOpenFullScreenEditor={onOpenEditor}
                onUseInChat={onUseInChat}
              />
            </div>
          );
        }

        return (
          <div
            key={`seg-text-${idx}`}
            className="text-foreground text-base sm:text-lg md:text-[19px] leading-relaxed font-bold select-text"
          >
            {renderRichProseWithTables(seg.content)}
            {isStreaming && isLastSegment && (
              <span className="inline-flex items-center ml-1.5 align-middle select-none">
                <span className="inline-block w-2 h-5 bg-zinc-950 rounded-[2px] animate-pulse" />
              </span>
            )}
          </div>
        );
      })}

      {themeParsed && (
        <ThemeOptionsCard
          options={themeParsed.options}
          disabled={Boolean(isStreaming)}
          onChoose={onChooseTheme}
        />
      )}
    </div>
  );
};

/**
 * STT Sound Bar Component
 * Features:
 * - Live dynamic italic bold text typing in real-time as user speaks
 * - Capsule with X (cancel), center waveform, Square (stop & keep text in prompt box), and Black Arrow (send immediately)
 */
export interface SttSoundBarProps {
  isTranscribing: boolean;
  liveText?: string;
  onCancel: () => void;
  onStopKeepText?: () => void;
  onConfirm: () => void;
  onAttach?: () => void;
}

export const SttSoundBar: React.FC<SttSoundBarProps> = ({
  isTranscribing,
  liveText = '',
  onCancel,
  onStopKeepText,
  onConfirm,
}) => {
  const [waveSeed, setWaveSeed] = useState(0);

  useEffect(() => {
    if (isTranscribing) return;
    const interval = setInterval(() => {
      setWaveSeed((s) => s + 0.25);
    }, 40);
    return () => clearInterval(interval);
  }, [isTranscribing]);

  const barCount = 32;
  const bars = Array.from({ length: barCount }, (_, i) => {
    const distFromCenter = Math.abs(i - barCount / 2) / (barCount / 2);
    const bellCurve = Math.max(0.15, 1 - Math.pow(distFromCenter, 1.4));
    const sineFactor = 0.5 + 0.5 * Math.sin(waveSeed * 2.8 + i * 0.42);
    const heightPx = Math.max(5, Math.round(bellCurve * (14 + 18 * sineFactor)));
    return heightPx;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98 }}
      transition={{ duration: 0.22 }}
      className="w-full flex flex-col select-none"
    >
      {/* Live Transcribed Text Streaming as User Speaks */}
      <div className="px-2 sm:px-3 mb-3 min-h-[46px] flex items-center">
        <p className="font-extrabold italic text-zinc-900 dark:text-zinc-50 text-xl sm:text-2xl lg:text-[26px] tracking-tight leading-snug break-words">
          {isTranscribing ? (
            <span className="text-zinc-400 font-medium">Transcribing audio...</span>
          ) : liveText && liveText.trim() ? (
            <span>
              {liveText}
              <span className="inline-block w-2.5 h-5 bg-zinc-950 ml-1.5 animate-pulse rounded-sm align-middle" />
            </span>
          ) : (
            <span className="text-zinc-400 font-normal not-italic text-lg sm:text-xl">
              Listening... Speak now
            </span>
          )}
        </p>
      </div>

      {/* Capsule Sound Bar */}
      <div className="w-full bg-white rounded-full border border-zinc-200/90 shadow-[0_8px_30px_rgba(0,0,0,0.08)] px-3 py-2 sm:px-4 sm:py-2.5 flex items-center justify-between gap-3 sm:gap-4 transition-all">
        {/* Left: Cancel 'X' Circular Button */}
        <button
          type="button"
          onClick={onCancel}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-900 flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
          title="Cancel voice input"
          aria-label="Cancel voice input"
        >
          <X size={19} strokeWidth={2.4} />
        </button>

        {/* Center: Live Oscillating Waveform Sound Bars */}
        <div className="flex-1 max-w-[420px] h-9 sm:h-10 flex items-center justify-center gap-[3px] sm:gap-[3.5px] px-2 overflow-hidden select-none">
          {bars.map((height, idx) => (
            <span
              key={idx}
              style={{ height: `${height}px` }}
              className="w-[3px] sm:w-[3.5px] rounded-full bg-zinc-950 transition-all duration-75 block shrink-0"
            />
          ))}
        </div>

        {/* Right: Square Stop (keeps text in prompt box) + Black Arrow (send immediately) */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onStopKeepText || onCancel}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-950 flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
            title="Stop mic & keep text in prompt box"
            aria-label="Stop mic and keep text"
          >
            <Square size={13} className="fill-current text-zinc-950" />
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isTranscribing}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-zinc-950 hover:bg-black text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95 shrink-0 disabled:opacity-50"
            title="Send voice message now"
            aria-label="Send voice message"
          >
            {isTranscribing ? (
              <Loader2 size={18} className="animate-spin text-white" />
            ) : (
              <ArrowUp size={20} strokeWidth={2.6} className="text-white" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export interface CompactThinkingPanelProps {
  duration?: number;
  message?: ChatMessage | null;
  onClose: () => void;
}

export const CompactThinkingPanel: React.FC<CompactThinkingPanelProps> = ({
  duration = 3,
  message,
  onClose,
}) => {
  const meta = message?.thoughtSummary;
  const text = message?.text || '';
  const lower = text.toLowerCase();
  const hasChartOrTable = /```(chart|json-chart)/i.test(text) || /\|\s*---/.test(text);
  const hasCode = /```(python|ts|tsx|js|sql|cpp|java|go|bash)/i.test(text);
  const sourcesCount = meta?.sourcesCount ?? (message?.sources?.length || 0);

  const steps =
    meta?.steps && meta.steps.length > 0
      ? meta.steps
      : [
          {
            title: 'Language & Script Detection',
            desc: `Analyzed query language and selected ${meta?.scriptMode || 'Romanized default'} output.`,
          },
          {
            title: 'Structured Answer Planning',
            desc: `${hasChartOrTable ? 'Designed interactive table & Recharts visual data' : hasCode ? 'Prepared code implementation & architecture blocks' : 'Synthesized bold key points and examples'}${meta?.skillName ? ` using ${meta.skillName}` : ''}.`,
          },
          {
            title: sourcesCount > 0 ? `Verified ${sourcesCount} Sources` : 'Contextual Accuracy Verification',
            desc:
              sourcesCount > 0
                ? `Collected and linked ${sourcesCount} grounded reference source(s).`
                : 'Verified explanation clarity, factual alignment, and formatting.',
          },
        ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 15, scale: 0.98 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="w-full bg-surface text-foreground rounded-[28px] sm:rounded-[32px] px-5 sm:px-6 py-4 shadow-[var(--shadow-neumorphic-soft)] border border-border/90 max-h-64 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-border shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shrink-0">
            <Check size={12} strokeWidth={3} />
          </div>
          <span className="text-xs sm:text-sm font-extrabold text-foreground tracking-tight truncate">
            Thought for {duration}s
          </span>
          {meta && (
            <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-[#0a2a66] border border-[#00a6ff]/30 shrink-0">
              {meta.detectedLanguage} · {meta.scriptMode}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-6 h-6 rounded-full hover:bg-zinc-100 text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Close overview"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Dynamic Summary Banner */}
      {meta?.summary && (
        <div className="mt-2 px-3 py-2 rounded-xl bg-sky-50/60 border border-[#00a6ff]/20 text-[11px] font-bold text-[#0a2a66] shrink-0">
          {meta.summary}
        </div>
      )}

      {/* Query-Specific Steps */}
      <div className="flex-1 overflow-y-auto pr-1 pt-2.5 space-y-2.5 text-xs text-foreground font-sans">
        {steps.map((st, idx) => (
          <div key={idx} className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-900 flex items-center justify-center shrink-0 mt-0.5">
              <Check size={11} strokeWidth={2.5} />
            </div>
            <div>
              <span className="font-extrabold text-foreground block text-xs">{st.title}</span>
              <span className="text-zinc-600 text-[11px] leading-snug font-medium">{st.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export interface InteractiveQuestionCardProps {
  question: QuestionBlock;
  onAnswer: (answer: string) => void;
  disabled?: boolean;
  stepNumber?: number;
  totalSteps?: number;
}

export const InteractiveQuestionCard: React.FC<InteractiveQuestionCardProps> = ({
  question,
  onAnswer,
  disabled = false,
  stepNumber,
  totalSteps,
}) => {
  const [customInput, setCustomInput] = useState('');

  // Sanitize and guarantee 3 distinct, non-empty, rich options
  const defaultPresets = ['Cyber Lime Noir', 'Crimson Noir Luxury', 'Electric Blue Glass'];
  const rawOptions = (question.options || [])
    .map((o) => (typeof o === 'string' ? o.replace(/^[-*•\d.]+\s*/, '').trim() : ''))
    .filter((o) => o.length > 0 && !o.toLowerCase().startsWith('custom'));

  const top3: string[] = [];
  for (let i = 0; i < 3; i++) {
    top3.push(rawOptions[i] || defaultPresets[i]);
  }

  // Detect whether this is a style, theme, color, or visual design discovery question
  const isThemeOrStyleQuestion =
    /style|theme|color|palette|visual|design|look|concept|layout/i.test(question.title || '') ||
    top3.some((o) => /minimal|neon|dark|light|cyber|editorial|glass|crimson|luxury|palette/i.test(o));

  // Rich palette swatches mapped to styles to show real colors (User spec: "جب یہ تھیم سجسٹ کرے تو کلرز شو کروائے")
  const STYLE_PRESETS_SWATCHES: Record<string, { mood: string; colors: string[] }> = {
    'Cyber Lime Noir': {
      mood: 'Futuristic Dark',
      colors: ['#070B07', '#101710', '#A3E635', '#22D3EE', '#EAFFD0'],
    },
    'Crimson Noir Luxury': {
      mood: 'Executive Crimson',
      colors: ['#090A0F', '#171822', '#FF1828', '#FFFFFF', '#A1A1AA'],
    },
    'Electric Blue Glass': {
      mood: 'Neon Glassmorphism',
      colors: ['#060B14', '#0F172A', '#00A6FF', '#38BDF8', '#FFFFFF'],
    },
    'Modern Minimal Luxury': {
      mood: 'Minimalist Clean',
      colors: ['#0A0A0C', '#18181B', '#E4E4E7', '#38BDF8', '#71717A'],
    },
    'Glassmorphism & Neon': {
      mood: 'Vibrant Cyberpunk',
      colors: ['#080811', '#14142B', '#A3E635', '#00A6FF', '#F1F5F9'],
    },
    'Editorial Portfolio': {
      mood: 'Serif High-Fashion',
      colors: ['#0C0D14', '#1A1B26', '#FF1828', '#F8FAFC', '#94A3B8'],
    },
  };

  const getSwatchesForOption = (optName: string, idx: number) => {
    if (STYLE_PRESETS_SWATCHES[optName]) {
      return STYLE_PRESETS_SWATCHES[optName];
    }
    const fallbackList = [
      { mood: 'Futuristic Cyber', colors: ['#070B07', '#101710', '#A3E635', '#22D3EE', '#EAFFD0'] },
      { mood: 'Crimson Luxury', colors: ['#090A0F', '#171822', '#FF1828', '#FFFFFF', '#A1A1AA'] },
      { mood: 'Arctic Cobalt', colors: ['#060B14', '#0F172A', '#00A6FF', '#38BDF8', '#FFFFFF'] },
    ];
    return fallbackList[idx % fallbackList.length];
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 15, scale: 0.98 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="w-full bg-white text-zinc-900 rounded-[24px] sm:rounded-[28px] px-4 sm:px-6 py-4 sm:py-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-zinc-200/90 flex flex-col transition-all"
    >
      {/* Top Question Info */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#00a6ff] uppercase tracking-wider font-mono">
          <span className="w-2 h-2 rounded-full bg-[#00a6ff] shadow-[0_0_8px_#00a6ff] animate-pulse shrink-0" />
          <span>Requirement Discovery {totalSteps ? `• Step ${stepNumber || 1} of ${totalSteps}` : ''}</span>
        </div>
        {isThemeOrStyleQuestion && (
          <span className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
            Visual Color Palettes
          </span>
        )}
      </div>

      <h3 className="text-zinc-900 font-bold text-base sm:text-lg leading-snug">
        {question.title || 'What visual style should the website use?'}
      </h3>
      {question.description && (
        <p className="text-xs text-zinc-500 font-normal mt-0.5 leading-relaxed">
          {question.description}
        </p>
      )}

      {/* Options: If Theme/Style Question, Show Real Color Swatches with Hex Codes */}
      {isThemeOrStyleQuestion ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3">
          {top3.map((opt, idx) => {
            const palette = getSwatchesForOption(opt, idx);
            return (
              <button
                key={idx}
                type="button"
                disabled={disabled}
                onClick={() => onAnswer(opt)}
                className="p-3.5 rounded-2xl border border-zinc-200/90 bg-white hover:bg-blue-50/40 hover:border-[#00a6ff] text-zinc-900 transition-all text-left flex flex-col justify-between group active:scale-[0.98] cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed gap-2.5"
                title={`Choose ${opt}`}
              >
                <div className="flex items-start justify-between gap-2 w-full">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-zinc-100 group-hover:bg-[#00a6ff] text-zinc-700 group-hover:text-white text-[10px] font-bold flex items-center justify-center shrink-0 transition-colors">
                        {idx + 1}
                      </span>
                      <span className="font-extrabold text-xs sm:text-sm text-zinc-900 group-hover:text-[#00a6ff] transition-colors truncate">
                        {opt}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-medium mt-0.5 block">
                      {palette.mood}
                    </span>
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-zinc-400 group-hover:text-[#00a6ff] group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5"
                  />
                </div>

                {/* 5 Real Color Swatches with Borders and Inline Colors */}
                <div className="space-y-1 w-full pt-1">
                  <div className="flex items-center gap-1.5">
                    {palette.colors.map((hex, cIdx) => (
                      <span
                        key={cIdx}
                        className="w-5 h-5 rounded-full border border-black/20 shadow-sm shrink-0 inline-block transition-transform group-hover:scale-110"
                        style={{ backgroundColor: hex }}
                        title={hex}
                      />
                    ))}
                  </div>
                  <span className="font-mono text-[9px] text-zinc-500 block truncate">
                    {palette.colors.join(' ')}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        /* Standard Non-Theme Questions: High-contrast buttons with number badge */
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3">
          {top3.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              onClick={() => onAnswer(opt)}
              className="px-3.5 py-3 rounded-xl border border-zinc-200/90 bg-white hover:bg-blue-50/50 hover:border-[#00a6ff] text-zinc-900 transition-all text-left flex items-center justify-between group active:scale-[0.98] cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed gap-2"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="w-5 h-5 rounded-full bg-zinc-100 group-hover:bg-[#00a6ff] text-zinc-700 group-hover:text-white text-[11px] font-bold flex items-center justify-center shrink-0 transition-colors">
                  {idx + 1}
                </span>
                <span className="truncate font-semibold text-xs sm:text-sm text-zinc-900 group-hover:text-[#00a6ff] transition-colors">
                  {opt}
                </span>
              </div>
              <ChevronRight
                size={14}
                className="text-zinc-400 group-hover:text-[#00a6ff] group-hover:translate-x-0.5 transition-all shrink-0"
              />
            </button>
          ))}
        </div>
      )}

      {/* Custom Option input below */}
      <div className="pt-3 flex items-center gap-2">
        <input
          type="text"
          disabled={disabled}
          placeholder="Custom: Enter your own answer or colors..."
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && customInput.trim() && !disabled) {
              e.preventDefault();
              onAnswer(customInput.trim());
              setCustomInput('');
            }
          }}
          className="flex-1 bg-zinc-50 border border-zinc-200/90 focus:border-[#00a6ff] focus:bg-white rounded-xl px-3.5 py-2 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none transition-all disabled:opacity-50 font-medium"
        />
        <button
          type="button"
          disabled={!customInput.trim() || disabled}
          onClick={() => {
            if (customInput.trim() && !disabled) {
              onAnswer(customInput.trim());
              setCustomInput('');
            }
          }}
          className="px-4 py-2 rounded-xl bg-[#00a6ff] hover:bg-[#0094e6] text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,166,255,0.35)] cursor-pointer shrink-0 active:scale-95"
        >
          <span>Submit</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </motion.div>
  );
};

/**
 * Half-Screen Thinking Timeline & Image Analysis Drawer matching Screenshot 3
 * Features:
 * - Half-screen expansion (covers ~50-55% height)
 * - Header with Back < button, [ Timeline ] & [ Changes ] tabs
 * - Worked for 13m 42s and 6.80 credits used metrics
 * - Vertical connected timeline with nodes
 * - Read [m2.png] node with phone preview & optical/phoneme image analysis
 */
export interface ThinkingTimelineDrawerProps {
  message: ChatMessage | null;
  thinkingTimer: number;
  activeAttachments?: AttachedFile[];
  onClose: () => void;
  inputVal: string;
  setInputVal: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isAiTyping: boolean;
  onAttach: () => void;
}

export const ThinkingTimelineDrawer: React.FC<ThinkingTimelineDrawerProps> = ({
  message,
  thinkingTimer,
  activeAttachments,
  onClose,
  inputVal,
  setInputVal,
  onSubmit,
  isAiTyping,
  onAttach,
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'changes'>('timeline');
  const meta = message?.thoughtSummary;
  const attachedImage =
    activeAttachments?.find((a) => a.type.startsWith('image/')) ||
    message?.attachments?.find((a) => a.type.startsWith('image/'));

  const imageName = attachedImage?.name || 'Attachment';
  const imagePreview = attachedImage?.preview;
  const durationLabel = isAiTyping
    ? `${thinkingTimer || 1}s (Live)`
    : `${message?.thoughtDuration || thinkingTimer || 3}s`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full h-[52vh] sm:h-[56vh] max-h-[580px] bg-white border border-border rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden text-foreground"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-white/95 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-border hover:bg-zinc-100 flex items-center justify-center text-foreground transition-colors cursor-pointer active:scale-95"
            title="Minimize timeline"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="flex items-center bg-zinc-100 border border-border rounded-full p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'timeline'
                  ? 'bg-white text-foreground font-bold shadow-sm'
                  : 'text-zinc-600 hover:text-foreground'
              }`}
            >
              <ListTree size={13} />
              <span>Summary</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('changes')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'changes'
                  ? 'bg-white text-foreground font-bold shadow-sm'
                  : 'text-zinc-600 hover:text-foreground'
              }`}
            >
              <Globe size={13} />
              <span>Details</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-zinc-600 hover:text-foreground transition-colors px-2 py-1 rounded cursor-pointer"
        >
          Close
        </button>
      </div>

      {/* Real Query Telemetry Strip */}
      <div className="flex items-center justify-between px-5 sm:px-8 py-2 bg-sky-50/60 border-b border-border text-[11px] sm:text-xs font-bold text-[#0a2a66] shrink-0">
        <div className="flex items-center gap-1.5">
          <Clock size={13} />
          <span>Duration: {durationLabel}</span>
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <Globe size={13} />
          <span>{meta ? `${meta.detectedLanguage} · ${meta.scriptMode}` : 'Auto Language · Romanized'}</span>
        </div>
      </div>

      {/* Main Body Content Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 font-sans text-xs sm:text-sm">
        {activeTab === 'timeline' ? (
          <div className="relative pl-6 sm:pl-8 border-l border-border ml-3 sm:ml-4 space-y-5">
            {meta?.summary && (
              <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-[#00a6ff]/25 text-xs font-bold text-[#0a2a66]">
                {meta.summary}
              </div>
            )}

            {(meta?.steps && meta.steps.length > 0
              ? meta.steps
              : [
                  {
                    title: 'Language & Script Detection',
                    desc: 'Detected user language and formatted output in Roman script unless native script requested.',
                  },
                  {
                    title: 'Structured Answer Synthesis',
                    desc: 'Organized response with bold key points, structured tables/charts, and practical details.',
                  },
                  {
                    title: 'Accuracy & Sources Check',
                    desc: `${message?.sources?.length || 0} grounded external source(s) attached.`,
                  },
                ]
            ).map((step, sIdx) => (
              <div key={sIdx} className="relative">
                <div className="absolute -left-[33px] sm:-left-[41px] top-1 w-5 h-5 rounded-full bg-sky-50 border border-[#00a6ff]/40 flex items-center justify-center text-[#00a6ff]">
                  <Check size={11} strokeWidth={2.8} />
                </div>
                <div className="pl-1 space-y-1">
                  <div className="text-foreground font-extrabold text-xs sm:text-sm">{step.title}</div>
                  <div className="p-3 rounded-xl bg-zinc-50 border border-border text-xs font-medium text-zinc-700">
                    {step.desc}
                  </div>
                </div>
              </div>
            ))}

            {attachedImage && (
              <div className="relative">
                <div className="absolute -left-[33px] sm:-left-[41px] top-1 w-5 h-5 rounded-full bg-blue-50 border border-blue-300 flex items-center justify-center text-blue-600">
                  <Scan size={12} />
                </div>
                <div className="pl-1 space-y-1">
                  <div className="text-foreground font-bold text-xs sm:text-sm">Visual Context Verified</div>
                  <div className="mt-2 p-3 rounded-xl bg-zinc-50 border border-border flex items-center gap-3">
                    {imagePreview && (
                      <img
                        src={imagePreview}
                        alt={imageName}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 object-cover rounded-lg border border-border shadow-sm"
                      />
                    )}
                    <div>
                      <div className="font-mono text-xs text-foreground font-semibold">{imageName}</div>
                      <div className="text-[11px] text-zinc-600">Analyzed with multimodal vision context</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-zinc-50 border border-border flex items-center justify-between">
              <div>
                <div className="font-bold text-foreground text-xs sm:text-sm">Language & Script</div>
                <div className="text-[11px] text-zinc-600">
                  {meta ? `${meta.detectedLanguage} (${meta.scriptMode})` : 'Auto-detected'}
                </div>
              </div>
              <span className="text-xs font-bold text-[#0a2a66]">Verified</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-50 border border-border flex items-center justify-between">
              <div>
                <div className="font-bold text-foreground text-xs sm:text-sm">Research Sources</div>
                <div className="text-[11px] text-zinc-600">
                  {message?.sources?.length || meta?.sourcesCount || 0} grounded citation(s) collected
                </div>
              </div>
              <span className="text-xs font-bold text-[#0a2a66]">
                {meta?.groundedUsed ? 'Web Grounded' : 'Model Synthesis'}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-50 border border-border flex items-center justify-between">
              <div>
                <div className="font-bold text-foreground text-xs sm:text-sm">Active Creative Skill</div>
                <div className="text-[11px] text-zinc-600">
                  {meta?.skillName || 'General Intelligence Mode'}
                </div>
              </div>
              <span className="text-xs font-bold text-[#0a2a66]">
                {message?.text ? `${message.text.length} chars` : 'Streaming'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Compact Prompt Box inside Drawer */}
      <div className="p-3 sm:p-4 bg-[var(--surface)] border-t border-border/10 shrink-0">
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAttach}
            className="w-9 h-9 rounded-full bg-surface/10 hover:bg-surface/20 text-foreground flex items-center justify-center shrink-0 transition-colors"
            title="Attach file"
          >
            <Plus size={18} />
          </button>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Ask a follow-up or command..."
            className="flex-1 bg-surface/40 border border-border/15 rounded-full px-4 py-2 text-xs sm:text-sm text-foreground placeholder-zinc-500 focus:outline-none focus:border-[var(--primary)]"
          />
          <button
            type="submit"
            disabled={!inputVal.trim() || isAiTyping}
            className="w-9 h-9 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-40 text-foreground flex items-center justify-center shrink-0 transition-all cursor-pointer"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </motion.div>
  );
};

interface FullScreenChatViewProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
  onClearInitialPrompt?: () => void;
  initialAttachments?: AttachedFile[];
  selectedRecentTopic?: string;
  onSelectRecentTopic?: (topic: string) => void;
  onOpenLogin?: () => void;
  externalActiveSkill?: AiSkillItem | null;
  onExternalActiveSkillChange?: (skill: AiSkillItem | null) => void;
}

const GUEST_TOPIC = 'Guest Session';

export const FullScreenChatView: React.FC<FullScreenChatViewProps> = ({
  isOpen,
  onClose,
  initialPrompt = '',
  onClearInitialPrompt,
  initialAttachments,
  selectedRecentTopic = '',
  onSelectRecentTopic,
  onOpenLogin,
  externalActiveSkill,
  onExternalActiveSkillChange,
}) => {
  const [currentUser, setCurrentUser] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('think_creative_user');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {}
      }
    }
    return getCurrentUser();
  });

  const [chatThreads, setChatThreads] = useState<Record<string, ChatThread>>({});
  const [activeTopic, setActiveTopic] = useState<string>(() => {
    return selectedRecentTopic || GUEST_TOPIC;
  });

  const prevUidRef = useRef<string | undefined>(currentUser?.uid);

  // Track Firebase Auth state continuously and handle user transition
  useEffect(() => {
    const unsub = subscribeToAuth((user) => {
      // If user changed (login or logout), reset state completely
      if (user?.uid !== prevUidRef.current) {
        prevUidRef.current = user?.uid;
        setChatThreads({});
        if (user && !user.isAnonymous) {
          setActiveTopic('');
        } else {
          setActiveTopic(GUEST_TOPIC);
        }
      }
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  // Listen to Firestore real-time chats if user is logged in
  useEffect(() => {
    if (!currentUser || currentUser.isAnonymous || !currentUser.uid) {
      return;
    }

    const unsub = subscribeToUserChatThreads(currentUser.uid, (firestoreThreads) => {
      setChatThreads((prev) => mergeChatThreads(firestoreThreads, prev));

      setActiveTopic((curr) => {
        if (curr) return curr;
        const keys = Object.keys(firestoreThreads);
        return keys.length > 0 ? keys[0] : '';
      });
    });

    return () => unsub();
  }, [currentUser?.uid]);

  // Synchronize completed messages strictly to Firestore for authenticated user:
  useEffect(() => {
    if (!activeTopic || !chatThreads[activeTopic]) return;
    const currentThread = chatThreads[activeTopic];

    if (currentUser?.uid && !currentUser.isAnonymous) {
      if (!currentThread.messages || currentThread.messages.length === 0) return;
      if (currentThread.messages.some((m) => m.isStreaming)) return;
      const timer = setTimeout(() => {
        syncChatThreadToFirestore(currentThread, currentUser.uid).then((saved) => {
          if (!saved) showToast('Chat could not be saved. Please try again.');
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [chatThreads, activeTopic, currentUser?.uid]);

  const [inputVal, setInputVal] = useState<string>('');
  const [isAiTyping, setIsAiTyping] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('GPT-4o');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState<boolean>(false);
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isThinkingTimelineExpanded, setIsThinkingTimelineExpanded] = useState<boolean>(false);
  const [activeTimelineMessage, setActiveTimelineMessage] = useState<ChatMessage | null>(null);
  const [isMemoryDrawerOpen, setIsMemoryDrawerOpen] = useState<boolean>(false);
  const { theme, toggleTheme } = useTheme();
  const themeMode = theme;
  const toggleThemeMode = toggleTheme;
  const [isInternalLoginOpen, setIsInternalLoginOpen] = useState<boolean>(false);

  const handleOpenLogin = () => {
    setIsInternalLoginOpen(true);
    if (onOpenLogin) onOpenLogin();
  };

  // Proactive Question Queue in Prompt Box (Pure prompt box flow)
  const [promptQuestionQueue, setPromptQuestionQueue] = useState<QuestionBlock[]>([]);
  const [promptQuestionIdx, setPromptQuestionIdx] = useState<number>(0);
  const collectedAnswersRef = useRef<Record<string, string>>({});
  const pendingVaguePromptRef = useRef<string>('');
  const answeredQuestionsRef = useRef<Record<string, string>>({});

  // Slide-out modal & persona states for Daro & Zara, Explore Creative Skills, Creative Studio, and Voices
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState<boolean>(false);
  const [isExploreGptsOpen, setIsExploreGptsOpen] = useState<boolean>(false);
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState<boolean>(false);
  const [isCreativeStudioOpen, setIsCreativeStudioOpen] = useState<boolean>(false);
  const [activePersona, setActivePersona] = useState<'Zara' | 'Daro'>(() => getActiveAssistantPersona());
  const [currentlySpeakingMsgId, setCurrentlySpeakingMsgId] = useState<string | null>(null);
  const [synthesizingMsgId, setSynthesizingMsgId] = useState<string | null>(null);
  const [pausedSpeakingMsgId, setPausedSpeakingMsgId] = useState<string | null>(null);
  const [activeSkill, setActiveSkill] = useState<AiSkillItem | null>(externalActiveSkill ?? null);

  // Creative Studio (MythoriaLib) Upload Registry & Automated Tool Execution Loop
  const [studioUploads, setStudioUploads] = useState<StudioUploadEntry[]>([]);
  const studioUploadsRef = useRef<StudioUploadEntry[]>([]);
  const studioUploadCounterRef = useRef<number>(1);
  const studioToolDepthRef = useRef<number>(0);

  useEffect(() => {
    studioUploadsRef.current = studioUploads;
  }, [studioUploads]);

  useEffect(() => {
    initMythoriaWindowBridge();
  }, []);

  const studioUploadsMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const u of studioUploads) {
      m[u.id] = u.dataUrl;
    }
    return m;
  }, [studioUploads]);

  const registerStudioUpload = React.useCallback(async (dataUrl: string, name: string, mimeType = 'image/png', explicitId?: string) => {
    if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;
    const existing = studioUploadsRef.current.find((u) => u.dataUrl === dataUrl);
    if (existing) return existing;
    const dims = await getImageDimensions(dataUrl);
    const id = explicitId || `img_${studioUploadCounterRef.current++}`;
    const entry: StudioUploadEntry = {
      id,
      name,
      mimeType,
      dataUrl,
      width: dims.width,
      height: dims.height,
      has_transparency: mimeType.includes('png'),
    };
    const nextList = [...studioUploadsRef.current.filter((x) => x.id !== id), entry];
    studioUploadsRef.current = nextList;
    setStudioUploads(nextList);
    return entry;
  }, []);

  useEffect(() => {
    if (externalActiveSkill !== undefined) {
      setActiveSkill(externalActiveSkill);
    }
  }, [externalActiveSkill]);

  const updateSelectedSkill = (skill: AiSkillItem | null) => {
    setActiveSkill(skill);
    onExternalActiveSkillChange?.(skill);
  };

  const handleToggleSpeakMessage = (msgId: string, text: string) => {
    // Pause at exact second when currently playing (keeps cached chunks + exact playback offset)
    if (currentlySpeakingMsgId === msgId) {
      const paused = pauseGeminiTts();
      setCurrentlySpeakingMsgId(null);
      if (paused) {
        setPausedSpeakingMsgId(msgId);
      }
      return;
    }

    // Cancel pending synthesis if user taps while still loading
    if (synthesizingMsgId === msgId) {
      stopGeminiTts();
      setSynthesizingMsgId(null);
      return;
    }

    // Play or Continue from exact paused spot using cached server WAV audio
    setCurrentlySpeakingMsgId(null);
    if (pausedSpeakingMsgId !== msgId) {
      setSynthesizingMsgId(msgId);
    }

    speakWithGeminiTts({
      text,
      messageId: msgId,
      voice: getStoredVoice(),
      onLoadingStart: () => {
        setPausedSpeakingMsgId((curr) => (curr === msgId ? null : curr));
        setSynthesizingMsgId(msgId);
      },
      onStart: () => {
        setPausedSpeakingMsgId((curr) => (curr === msgId ? null : curr));
        setSynthesizingMsgId((curr) => (curr === msgId ? null : curr));
        setCurrentlySpeakingMsgId(msgId);
      },
      onPause: () => {
        setCurrentlySpeakingMsgId((curr) => (curr === msgId ? null : curr));
        setPausedSpeakingMsgId(msgId);
      },
      onEnd: () => {
        setSynthesizingMsgId((curr) => (curr === msgId ? null : curr));
        setCurrentlySpeakingMsgId((curr) => (curr === msgId ? null : curr));
        setPausedSpeakingMsgId((curr) => (curr === msgId ? null : curr));
      },
      onError: (err) => {
        console.warn('TTS playback notice:', err);
        setSynthesizingMsgId((curr) => (curr === msgId ? null : curr));
        setCurrentlySpeakingMsgId((curr) => (curr === msgId ? null : curr));
        setPausedSpeakingMsgId((curr) => (curr === msgId ? null : curr));
        showToast(typeof err === 'string' ? err : 'Studio voice playback unavailable');
      },
    });
  };

  // Background running chat summary & active code retention across turns
  const [runningChatSummary, setRunningChatSummary] = useState<string>('');
  const [latestActiveCode, setLatestActiveCode] = useState<string>('');

  // Message Send Lock, Buildy Upward Card & Process Overview Panel State
  const [isSendLocked, setIsSendLocked] = useState<boolean>(false);
  const [isThinkingPanelOpen, setIsThinkingPanelOpen] = useState<boolean>(false);
  const [activeThinkingMessage, setActiveThinkingMessage] = useState<ChatMessage | null>(null);
  const [buildyRedirectRequest, setBuildyRedirectRequest] = useState<string | null>(null);

  // Interactive Thinking State & Live Elapsed Timer
  const [thinkingTimer, setThinkingTimer] = useState<number>(0);
  const [activeThinkingMsgId, setActiveThinkingMsgId] = useState<string | null>(null);
  const thinkingTimerRef = useRef<number>(0);

  // Progressive Typing Animation & Tactile Sound/Vibration
  const [typingAnimationMsgId, setTypingAnimationMsgId] = useState<string | null>(null);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fullGeneratedTextMap = useRef<Record<string, string>>({});

  const playTypingClick = () => {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!(window as any).__chatAudioCtx) {
        (window as any).__chatAudioCtx = new AudioCtx();
      }
      const ctx = (window as any).__chatAudioCtx;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(460 + Math.random() * 90, ctx.currentTime);
      gain.gain.setValueAtTime(0.015, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.035);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.038);
    } catch {}
  };

  const triggerTypingVibration = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(8);
      } catch {}
    }
  };

  const persistArtifactIfPresent = (fullText: string, topicKey: string, userPrompt?: string) => {
    try {
      const htmlMatch = fullText.match(/```html(?::([\w.-]+))?\n([\s\S]*?)```/i);
      if (htmlMatch && htmlMatch[2]) {
        const filename = htmlMatch[1] || 'index.html';
        const code = htmlMatch[2].trim();
        const isBMW =
          topicKey.toLowerCase().includes('bmw') ||
          fullText.toLowerCase().includes('bmw') ||
          fullText.toLowerCase().includes('telemetry') ||
          (userPrompt && (userPrompt.toLowerCase().includes('bmw') || userPrompt.toLowerCase().includes('telemetry')));
        const targetProjId = isBMW ? 'proj-creativedrive-ai' : `proj-${Date.now().toString(36)}`;

        memoryManager.saveOrUpdateArtifact(
          targetProjId,
          {
            name: filename,
            title: isBMW ? 'BMW M-Power Telemetry Interface' : filename,
            type: 'html',
            content: code,
            description: `Generated or updated for "${topicKey}"`,
          },
          'Auto-saved to persistent memory vault'
        );
      }
    } catch (e) {
      console.warn('Memory persist error:', e);
    }
  };

  const handleSkipTyping = (msgId: string) => {
    if (typingAnimationMsgId === msgId) {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
      setTypingAnimationMsgId(null);
      setIsSendLocked(false);
      const fullText = fullGeneratedTextMap.current[msgId];
      if (fullText) {
        persistArtifactIfPresent(fullText, activeTopic, inputVal);
        const parsed = parseAIText(fullText);
        const extractedQuestion = extractQuestionBlock(fullText);
        if (extractedQuestion) {
          setPromptQuestionQueue([extractedQuestion]);
          setPromptQuestionIdx(0);
        }
        setChatThreads((prev) => {
          const thread = prev[activeTopic];
          if (!thread) return prev;
          return {
            ...prev,
            [activeTopic]: {
              ...thread,
              messages: thread.messages.map((m) =>
                m.id === msgId
                  ? {
                      ...m,
                      text: fullText,
                      structuredContent:
                        parsed.mainTitle || parsed.intro || parsed.sections.length > 0
                          ? parsed
                          : undefined,
                      activeQuestion: undefined,
                    }
                  : m
              ),
            },
          };
        });
      }
    }
  };

  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isAiTyping) {
      interval = setInterval(() => {
        setThinkingTimer((prev) => {
          thinkingTimerRef.current = prev + 1;
          return prev + 1;
        });
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAiTyping]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // File Attachments (Max 10)
  const [chatAttachments, setChatAttachments] = useState<AttachedFile[]>([]);
  const [fileLimitError, setFileLimitError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  // MediaRecorder Ref & Speech-to-Text via Groq Whisper + Web Speech live interim
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<any>(null);
  const micBaseInputRef = useRef<string>('');
  const isMicActiveRef = useRef<boolean>(false);
  const suppressSttFallbackRef = useRef<boolean>(false);

  // AI response vibration trigger state
  const [vibratingMsgId, setVibratingMsgId] = useState<string | null>(null);

  // Active streaming & clipboard states
  const activeStreamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // User Message Action States (strictly icon-only under user message)
  const [copiedUserMsgId, setCopiedUserMsgId] = useState<string | null>(null);
  const [editingUserMsgId, setEditingUserMsgId] = useState<string | null>(null);
  const [editingUserText, setEditingUserText] = useState<string>('');

  // AI Message Action States (three-dot menu, sources drawer, export)
  const [exportMenuMsgId, setExportMenuMsgId] = useState<string | null>(null);
  const [moreMenuMsgId, setMoreMenuMsgId] = useState<string | null>(null);
  const [activeSourcesMsg, setActiveSourcesMsg] = useState<ChatMessage | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [fullscreenWebsite, setFullscreenWebsite] = useState<{ html: string; fileName: string } | null>(null);
  const [fullscreenEditor, setFullscreenEditor] = useState<{
    code: string;
    fileName: string;
    language: string;
  } | null>(null);

  const handleOpenEditor = (code: string, fileName?: string, language?: string) => {
    setFullscreenEditor({
      code,
      fileName: fileName || 'index.html',
      language: language || 'html',
    });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const handleCopySnippet = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippet(code);
    setTimeout(() => setCopiedSnippet(null), 2500);
  };

  const handleCopyResponse = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(msgId);
    showToast('Copied response to clipboard');
    setTimeout(() => setCopiedMessageId(null), 2500);
  };

  // User message action handlers
  const handleCopyUserMessage = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUserMsgId(msgId);
    showToast('Copied message');
    setTimeout(() => setCopiedUserMsgId(null), 2000);
  };

  const handleStartEditUser = (msg: ChatMessage) => {
    setEditingUserMsgId(msg.id);
    setEditingUserText(msg.text);
  };

  const handleCancelEditUser = () => {
    setEditingUserMsgId(null);
    setEditingUserText('');
  };

  const handleSaveEditUser = (msgId: string) => {
    if (!editingUserText.trim()) return;
    const newText = editingUserText.trim();
    setEditingUserMsgId(null);

    const thread = chatThreads[activeTopic];
    if (!thread) return;

    const userMsgIndex = thread.messages.findIndex((m) => m.id === msgId);
    const nextMsg =
      userMsgIndex !== -1 && userMsgIndex + 1 < thread.messages.length
        ? thread.messages[userMsgIndex + 1]
        : null;

    let targetAiId = '';

    if (nextMsg && nextMsg.sender === 'ai') {
      targetAiId = nextMsg.id;
      setChatThreads((prev) => {
        const t = prev[activeTopic];
        if (!t) return prev;
        return {
          ...prev,
          [activeTopic]: {
            ...t,
            messages: t.messages.map((m, idx) => {
              if (idx === userMsgIndex) {
                return { ...m, text: newText };
              }
              if (idx === userMsgIndex + 1) {
                return {
                  ...m,
                  previousVersions: m.text ? [...(m.previousVersions || []), m.text] : m.previousVersions,
                  futureVersions: [],
                  text: '',
                  isStreaming: true,
                  structuredContent: undefined,
                };
              }
              return m;
            }),
          },
        };
      });
    } else {
      targetAiId = `msg-ai-${Date.now()}`;
      const aiPlaceholder: ChatMessage = {
        id: targetAiId,
        sender: 'ai',
        text: '',
        isStreaming: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatThreads((prev) => {
        const t = prev[activeTopic];
        if (!t) return prev;
        return {
          ...prev,
          [activeTopic]: {
            ...t,
            messages: t.messages
              .map((m) => (m.id === msgId ? { ...m, text: newText } : m))
              .concat(aiPlaceholder),
          },
        };
      });
    }

    startGeminiStream(activeTopic, targetAiId, newText);
    showToast('Regenerating response with updated query...');
  };

  const handleRetryUserMessage = (msg: ChatMessage) => {
    if (isSendLocked || isAiTyping) return;
    setIsSendLocked(true);
    const thread = chatThreads[activeTopic];
    if (!thread) return;

    const userMsgIndex = thread.messages.findIndex((m) => m.id === msg.id);
    const nextMsg =
      userMsgIndex !== -1 && userMsgIndex + 1 < thread.messages.length
        ? thread.messages[userMsgIndex + 1]
        : null;

    let targetAiId = '';

    if (nextMsg && nextMsg.sender === 'ai') {
      targetAiId = nextMsg.id;
      setChatThreads((prev) => {
        const t = prev[activeTopic];
        if (!t) return prev;
        return {
          ...prev,
          [activeTopic]: {
            ...t,
            messages: t.messages.map((m, idx) => {
              if (idx === userMsgIndex + 1) {
                return {
                  ...m,
                  previousVersions: m.text ? [...(m.previousVersions || []), m.text] : m.previousVersions,
                  futureVersions: [],
                  text: '',
                  isStreaming: true,
                  structuredContent: undefined,
                };
              }
              return m;
            }),
          },
        };
      });
    } else {
      targetAiId = `msg-ai-${Date.now()}`;
      const aiPlaceholder: ChatMessage = {
        id: targetAiId,
        sender: 'ai',
        text: '',
        isStreaming: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatThreads((prev) => {
        const t = prev[activeTopic];
        if (!t) return prev;
        return {
          ...prev,
          [activeTopic]: {
            ...t,
            messages: [...t.messages, aiPlaceholder],
          },
        };
      });
    }

    startGeminiStream(activeTopic, targetAiId, msg.text, msg.attachments || []);
    showToast('Regenerating response for prompt...');
  };

  // AI message action handlers (revert, retry, delete, export)
  const handleRevertAiMessage = (msgId: string) => {
    let reverted = false;

    setChatThreads((prev) => {
      const thread = prev[activeTopic];
      if (!thread) return prev;

      const msgIndex = thread.messages.findIndex((m) => m.id === msgId);
      if (msgIndex === -1) return prev;
      const targetMsg = thread.messages[msgIndex];

      // 1. If previousVersions exists on this message
      if (targetMsg.previousVersions && targetMsg.previousVersions.length > 0) {
        const prevText = targetMsg.previousVersions[targetMsg.previousVersions.length - 1];
        const remaining = targetMsg.previousVersions.slice(0, -1);
        const future = [targetMsg.text, ...(targetMsg.futureVersions || [])];
        const parsed = parseAIText(prevText);
        reverted = true;

        return {
          ...prev,
          [activeTopic]: {
            ...thread,
            messages: thread.messages.map((m, idx) =>
              idx === msgIndex
                ? {
                    ...m,
                    text: prevText,
                    previousVersions: remaining,
                    futureVersions: future,
                    structuredContent:
                      parsed.mainTitle || parsed.intro || parsed.sections.length > 0
                        ? parsed
                        : undefined,
                  }
                : m
            ),
          },
        };
      }

      // 2. If futureVersions exists, toggle to future version
      if (targetMsg.futureVersions && targetMsg.futureVersions.length > 0) {
        const nextText = targetMsg.futureVersions[0];
        const remainingFuture = targetMsg.futureVersions.slice(1);
        const prevList = [...(targetMsg.previousVersions || []), targetMsg.text];
        const parsed = parseAIText(nextText);
        reverted = true;

        return {
          ...prev,
          [activeTopic]: {
            ...thread,
            messages: thread.messages.map((m, idx) =>
              idx === msgIndex
                ? {
                    ...m,
                    text: nextText,
                    previousVersions: prevList,
                    futureVersions: remainingFuture,
                    structuredContent:
                      parsed.mainTitle || parsed.intro || parsed.sections.length > 0
                        ? parsed
                        : undefined,
                  }
                : m
            ),
          },
        };
      }

      // 3. If there is another AI message earlier in the thread history
      if (msgIndex > 1) {
        const priorAiMsg = [...thread.messages.slice(0, msgIndex)]
          .reverse()
          .find((m) => m.sender === 'ai' && m.text.trim());

        if (priorAiMsg) {
          const parsed = parseAIText(priorAiMsg.text);
          reverted = true;
          return {
            ...prev,
            [activeTopic]: {
              ...thread,
              messages: thread.messages.map((m, idx) =>
                idx === msgIndex
                  ? {
                      ...m,
                      text: priorAiMsg.text,
                      futureVersions: [m.text, ...(m.futureVersions || [])],
                      structuredContent:
                        parsed.mainTitle || parsed.intro || parsed.sections.length > 0
                          ? parsed
                          : undefined,
                    }
                  : m
              ),
            },
          };
        }
      }

      return prev;
    });

    if (reverted) {
      showToast('Reverted to previous version');
    } else {
      showToast('No previous version to revert');
    }
  };

  const handleRetryAiMessage = (aiMsg: ChatMessage) => {
    if (isSendLocked || isAiTyping) return;
    setIsSendLocked(true);
    const thread = chatThreads[activeTopic];
    if (!thread) return;
    const msgIndex = thread.messages.findIndex((m) => m.id === aiMsg.id);
    let promptToUse = '';
    let attachmentsToUse: AttachedFile[] = [];

    for (let i = msgIndex - 1; i >= 0; i--) {
      if (thread.messages[i].sender === 'user') {
        promptToUse = thread.messages[i].text;
        attachmentsToUse = thread.messages[i].attachments || [];
        break;
      }
    }

    if (!promptToUse) {
      promptToUse = thread.promptBanner || 'Regenerate response';
    }

    // Save current version into previousVersions for revert
    setChatThreads((prev) => {
      const t = prev[activeTopic];
      if (!t) return prev;
      return {
        ...prev,
        [activeTopic]: {
          ...t,
          messages: t.messages.map((m) =>
            m.id === aiMsg.id
              ? {
                  ...m,
                  previousVersions: m.text ? [...(m.previousVersions || []), m.text] : m.previousVersions,
                  futureVersions: [],
                  text: '',
                  isStreaming: true,
                  structuredContent: undefined,
                }
              : m
          ),
        },
      };
    });

    clearPausedSession(aiMsg.id);
    if (currentlySpeakingMsgId === aiMsg.id) {
      stopGeminiTts();
      setCurrentlySpeakingMsgId(null);
    }
    setPausedSpeakingMsgId((curr) => (curr === aiMsg.id ? null : curr));
    setSynthesizingMsgId((curr) => (curr === aiMsg.id ? null : curr));

    startGeminiStream(activeTopic, aiMsg.id, promptToUse, attachmentsToUse);
    showToast('Regenerating response...');
  };

  const handleDeleteAiMessage = (msgId: string) => {
    clearPausedSession(msgId);
    if (currentlySpeakingMsgId === msgId || synthesizingMsgId === msgId) {
      stopGeminiTts();
      setCurrentlySpeakingMsgId(null);
      setSynthesizingMsgId(null);
    }
    setPausedSpeakingMsgId((curr) => (curr === msgId ? null : curr));

    setChatThreads((prev) => {
      const thread = prev[activeTopic];
      if (!thread) return prev;
      return {
        ...prev,
        [activeTopic]: {
          ...thread,
          messages: thread.messages.filter((m) => m.id !== msgId),
        },
      };
    });
    setExportMenuMsgId(null);
    setMoreMenuMsgId(null);
    showToast('Message deleted');
  };

  const handleAnswerQuestionInChat = (msgId: string, answer: string) => {
    if (isAiTyping) return;

    // Collect user selection dynamically by question title/id
    const currentQ = promptQuestionQueue[promptQuestionIdx];
    const qKey = currentQ ? currentQ.title : `Question ${promptQuestionIdx + 1}`;
    collectedAnswersRef.current[qKey] = answer;
    answeredQuestionsRef.current[qKey] = answer;

    const userAnsMsg: ChatMessage = {
      id: `user-ans-${Date.now()}`,
      sender: 'user',
      text: answer,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextIdx = promptQuestionIdx + 1;
    if (nextIdx < promptQuestionQueue.length) {
      // Advance to next discovery question directly in chat
      setPromptQuestionIdx(nextIdx);
      const nextQ = promptQuestionQueue[nextIdx];
      const nextAiQMsg: ChatMessage = {
        id: `ai-q-${Date.now()}`,
        sender: 'ai',
        text: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        activeQuestion: nextQ,
      };

      setChatThreads((prev) => {
        const thread = prev[activeTopic];
        if (!thread) return prev;
        return {
          ...prev,
          [activeTopic]: {
            ...thread,
            messages: [
              ...thread.messages.map((m) =>
                m.id === msgId ? { ...m, activeQuestion: undefined, text: `Selected: **${answer}**` } : m
              ),
              userAnsMsg,
              nextAiQMsg,
            ],
          },
        };
      });

      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(25);
        } catch {}
      }
    } else {
      // All questions have been answered: stop asking and immediately start thinking and complete code
      setPromptQuestionQueue([]);
      setPromptQuestionIdx(0);

      const userPrompt = pendingVaguePromptRef.current || 'Create a complete high-performance solution';
      pendingVaguePromptRef.current = '';

      const isBuildyTask = isWebsiteOrAppUiBuildRequest(userPrompt);
      const isTimetable =
        /(\btimetable\b|\btime\s*table\b|\broutine\b|\bdaily\s*routine\b|\bschedule\b|\bday\s*plan\b|\bplanner\b|\bstudy\s*plan\b|\bworkout\s*routine\b|\bworkout\s*plan\b)/i.test(
          userPrompt
        );

      const answersList = Object.entries(collectedAnswersRef.current)
        .map(([q, a]) => `- ${q}: ${a}`)
        .join('\n');

      let fullExecutionPrompt = `${userPrompt}

USER SPECIFICATIONS & PREFERENCES:
${answersList}`;

      if (isBuildyTask) {
        fullExecutionPrompt += `\n\nIMPORTANT PRODUCT RULE:
This workspace does NOT build HTML/CSS/JS websites or App UIs.
1. Tell the user clearly: "Go to Buildy (https://fluorescent-code-vault-flow.base44.app) to create App or Web UI."
2. NEVER generate a complete <!DOCTYPE html>...</html> website.
3. Provide a detailed, copy-ready Buildy UI specification prompt inside a \`\`\`prompt code block tailored to their specifications above.`;
      } else if (isTimetable) {
        fullExecutionPrompt += `\n\nCRITICAL MANDATORY INSTRUCTIONS:
1. Provide a comprehensive, hourly timetable breakdown from wake-up to restorative sleep.
2. Include structured time blocks and practical productivity recommendations.`;
      }

      const aiMsgId = `ai-${Date.now()}`;
      const aiPlaceholder: ChatMessage = {
        id: aiMsgId,
        sender: 'ai',
        text: '',
        isStreaming: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatThreads((prev) => {
        const thread = prev[activeTopic];
        if (!thread) return prev;
        return {
          ...prev,
          [activeTopic]: {
            ...thread,
            messages: [
              ...thread.messages.map((m) =>
                m.id === msgId ? { ...m, activeQuestion: undefined, text: `Selected: **${answer}**` } : m
              ),
              userAnsMsg,
              aiPlaceholder,
            ],
          },
        };
      });

      startGeminiStream(activeTopic, aiMsgId, fullExecutionPrompt, pendingAttachmentsRef.current || []);
    }
  };

  const handleAnswerPromptQuestion = (answer: string) => {
    const thread = chatThreads[activeTopic];
    const lastQMsg = thread?.messages.slice().reverse().find((m) => Boolean(m.activeQuestion));
    if (lastQMsg) {
      handleAnswerQuestionInChat(lastQMsg.id, answer);
    }
  };

  const handleAnswerQuestion = (_messageId: string, _question: QuestionBlock, answer: string) => {
    handleAnswerPromptQuestion(answer);
  };

  const handleExport = (
    format: 'pdf' | 'doc' | 'md' | 'txt' | 'html',
    message: ChatMessage
  ) => {
    setExportMenuMsgId(null);
    const rawTitle = message.structuredContent?.mainTitle;
    const title = typeof rawTitle === 'string'
      ? rawTitle
      : rawTitle
      ? `${rawTitle.white} ${rawTitle.red}`
      : activeTopic;
    const filename = `${title.toLowerCase().replace(/[^a-z0-9]/gi, '_')}_gemini_ai`;

    // Extract formatted clean text from structuredContent or message.text
    let fullMarkdown = '';
    if (message.structuredContent) {
      if (message.structuredContent.mainTitle) {
        fullMarkdown += `# ${title}\n\n`;
      }
      if (message.structuredContent.intro) {
        fullMarkdown += `${message.structuredContent.intro}\n\n`;
      }
      message.structuredContent.sections?.forEach((s) => {
        fullMarkdown += `## ${s.title}\n\n`;
        if (s.description) fullMarkdown += `${s.description}\n\n`;
        if (s.bullets && s.bullets.length > 0) {
          s.bullets.forEach((b) => (fullMarkdown += `- ${b}\n`));
          fullMarkdown += '\n';
        }
        if (s.imageCardSnippet) {
          try {
            const ic = JSON.parse(s.imageCardSnippet);
            if (ic?.description) {
              fullMarkdown += `**${ic.title || ic.query}**: ${ic.description}\n\n`;
            }
          } catch {}
        }
        if (s.promptSnippet) {
          fullMarkdown += `\`\`\`prompt\n${s.promptSnippet}\n\`\`\`\n\n`;
        }
        if (s.codeSnippet) {
          fullMarkdown += `\`\`\`${s.codeLanguage || 'tsx'}\n${s.codeSnippet}\n\`\`\`\n\n`;
        }
      });
    } else {
      fullMarkdown = message.text;
    }

    if (format === 'md') {
      downloadBlob(fullMarkdown, `${filename}.md`, 'text/markdown;charset=utf-8;');
      showToast('Exported as Markdown (.md)');
    } else if (format === 'txt') {
      const plain = fullMarkdown.replace(/#+\s+/g, '').replace(/```[a-z]*\n?/g, '');
      downloadBlob(plain, `${filename}.txt`, 'text/plain;charset=utf-8;');
      showToast('Exported as Text (.txt)');
    } else if (format === 'doc') {
      const docHtml = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 11pt; color: #111; line-height: 1.6; padding: 24px; }
            h1 { font-size: 20pt; color: #cc0000; border-bottom: 2px solid #cc0000; padding-bottom: 6px; }
            h2 { font-size: 14pt; color: #222; margin-top: 18pt; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
            p { margin: 6pt 0; }
            ul { padding-left: 20px; }
            li { margin-bottom: 4pt; }
            pre { background: #f4f4f5; padding: 10pt; border-radius: 6px; font-family: Consolas, monospace; font-size: 9.5pt; overflow-x: auto; border: 1px solid #e4e4e7; }
            .badge { display: inline-block; background: #fee2e2; color: #991b1b; padding: 2pt 6pt; border-radius: 4pt; font-size: 9pt; font-weight: bold; }
          </style>
        </head>
        <body>
          <span class="badge">AI Studio Intelligence</span>
          <h1>${title}</h1>
          <p><em>Generated by AI Studio Intelligence Workspace • ${new Date().toLocaleDateString()}</em></p>
          <hr/>
          <div>${fullMarkdown.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>')}</div>
        </body>
        </html>
      `;
      downloadBlob(docHtml, `${filename}.doc`, 'application/msword');
      showToast('Exported as Word Document (.doc)');
    } else if (format === 'html') {
      const standaloneHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>${title} — AI Studio Intelligence</title>
          <style>
            body { background: #070709; color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 860px; margin: 40px auto; padding: 0 24px; line-height: 1.7; }
            h1 { font-size: 2.2rem; color: #fff; border-bottom: 3px solid #00a6ff; padding-bottom: 10px; }
            h2 { font-size: 1.4rem; color: #fff; margin-top: 2rem; border-left: 4px solid #00a6ff; padding-left: 10px; }
            pre { background: #0e0204; border: 1px solid rgba(0, 166, 255,0.3); padding: 16px; border-radius: 12px; font-family: monospace; color: #f4f4f5; overflow-x: auto; }
            ul { padding-left: 20px; }
            li { margin-bottom: 8px; color: #d4d4d8; }
            .header-tag { display: inline-block; padding: 4px 12px; background: #1a0306; border: 1px solid #00a6ff; color: #00a6ff; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 12px; }
          </style>
        </head>
        <body>
          <div class="header-tag">AI Studio Verified</div>
          <h1>${title}</h1>
          <div>${fullMarkdown.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>')}</div>
        </body>
        </html>
      `;
      downloadBlob(standaloneHtml, `${filename}.html`, 'text/html;charset=utf-8;');
      showToast('Exported as HTML (.html)');
    } else if (format === 'pdf') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${title} - PDF Export</title>
            <style>
              @media print {
                body { padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; line-height: 1.6; }
                h1 { color: #cc0000; border-bottom: 2px solid #cc0000; padding-bottom: 8px; font-size: 22pt; }
                h2 { color: #222; margin-top: 18pt; border-bottom: 1px solid #ccc; padding-bottom: 4px; font-size: 15pt; }
                pre { background: #f4f4f5; padding: 10pt; border-radius: 6pt; font-family: monospace; font-size: 9.5pt; white-space: pre-wrap; word-break: break-word; border: 1px solid #e4e4e7; }
                ul { padding-left: 20pt; }
                li { margin-bottom: 6pt; }
                .footer { font-size: 9pt; color: #666; margin-top: 24pt; border-top: 1px solid #eee; padding-top: 8pt; }
              }
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 30px; line-height: 1.6; color: #111; }
              h1 { color: #cc0000; border-bottom: 2px solid #cc0000; padding-bottom: 8px; }
              h2 { color: #222; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
              pre { background: #f4f4f5; padding: 14px; border-radius: 8px; font-family: monospace; border: 1px solid #ddd; }
              ul { padding-left: 24px; }
            </style>
          </head>
          <body>
            <p style="color:#cc0000; font-weight:bold; font-size:10pt; text-transform:uppercase; letter-spacing:1px;">AI Intelligence Document</p>
            <h1>${title}</h1>
            <div>${fullMarkdown.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>')}</div>
            <div class="footer">Generated by AI Studio Intelligence Workspace • ${new Date().toLocaleString()}</div>
            <script>
              window.onload = function() { window.print(); }
            </script>
          </body>
          </html>
        `);
        printWindow.document.close();
      }
      showToast('Opening PDF print preview...');
    }
  };

  // Clean up typewriter interval on unmount
  useEffect(() => {
    return () => {
      if (activeStreamIntervalRef.current) {
        clearInterval(activeStreamIntervalRef.current);
      }
    };
  }, []);

  /**
   * AI Streaming Engine: Groq Primary / Gemini Fallback
   * Captures SSE data.meta (sources, thoughtSummary, provider) cleanly alongside live streaming.
   */
  const startGeminiStream = (
    topicKey: string,
    aiMsgId: string,
    promptText: string,
    attachmentsToPass: AttachedFile[] = []
  ) => {
    const isSimple = isSimpleMessage(promptText);

    setIsAiTyping(true);
    if (!isSimple) {
      setThinkingTimer(0);
      thinkingTimerRef.current = 0;
      setActiveThinkingMsgId(aiMsgId);
    } else {
      setActiveThinkingMsgId(null);
    }

    // Trigger physical & haptic vibration when AI reply stream begins
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([60, 40, 60]);
      } catch {}
    }
    setVibratingMsgId(aiMsgId);
    setTimeout(() => setVibratingMsgId((curr) => (curr === aiMsgId ? null : curr)), 700);

    if (activeStreamIntervalRef.current) {
      clearInterval(activeStreamIntervalRef.current);
      activeStreamIntervalRef.current = null;
    }

    // Call server SSE /api/chat with full history
    (async () => {
      let accumulatedText = '';
      let streamSources: SourceCitation[] = [];
      let streamThoughtSummary: ThoughtSummaryMeta | undefined = undefined;
      let streamProvider: 'gemini' | 'groq' | undefined = undefined;

      try {
        const currentThread = chatThreads[topicKey];
        const historyPayload = (currentThread?.messages || [])
          .filter((m) => m.id !== aiMsgId)
          .map((m) => ({
            sender: m.sender,
            text: m.text,
          }));

        // Semantic memory retrieval across long-term project vault & past conversation context
        const contextPackage = isSimple
          ? null
          : memoryManager.buildContextPackage(promptText, topicKey, historyPayload);

        const isWebsite = /website|landing\s*page|web\s*app|single-file|html/i.test(promptText);
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: promptText,
            isSimple,
            isWebsite,
            history: isSimple ? [] : historyPayload.slice(-6),
            contextPackage,
            conversationSummary: runningChatSummary,
            activeCode: latestActiveCode,
            activeSkill: activeSkill
              ? {
                  id: activeSkill.id,
                  name: activeSkill.name,
                  instructions: activeSkill.systemInstructions,
                }
              : undefined,
            studioCatalog: catalogForPrompt(),
            studioUploads: studioUploadsRef.current.map((u) => ({
              id: u.id,
              name: u.name,
              width: u.width || 0,
              height: u.height || 0,
              has_transparency: Boolean(u.has_transparency),
            })),
            attachments: isSimple
              ? []
              : attachmentsToPass.map((a) => ({
                  name: a.name,
                  type: a.type,
                  preview: a.preview,
                  codeContent: a.codeContent,
                })),
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`Server returned status ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let hasTriggeredStartVibration = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let lastAudioTick = 0;
          let finalThoughtDuration: number | undefined = undefined;

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              try {
                const data = JSON.parse(trimmed.slice(6));
                if (data.meta) {
                  if (Array.isArray(data.meta.sources)) streamSources = data.meta.sources;
                  if (data.meta.thoughtSummary) streamThoughtSummary = data.meta.thoughtSummary;
                  if (data.meta.provider) streamProvider = data.meta.provider;
                  setChatThreads((prev) => {
                    const t = prev[topicKey];
                    if (!t) return prev;
                    return {
                      ...prev,
                      [topicKey]: {
                        ...t,
                        messages: t.messages.map((m) =>
                          m.id === aiMsgId
                            ? {
                                ...m,
                                sources: streamSources.length > 0 ? streamSources : m.sources,
                                thoughtSummary: streamThoughtSummary || m.thoughtSummary,
                                provider: streamProvider || m.provider,
                              }
                            : m
                        ),
                      },
                    };
                  });
                } else if (data.done) {
                  // Stream done
                } else if (data.error) {
                  accumulatedText = data.error;
                } else if (data.text) {
                  accumulatedText += data.text;
                  const currentCleanText = accumulatedText.replace(/```question[\s\S]*?```/gi, '');

                  if (!hasTriggeredStartVibration) {
                    hasTriggeredStartVibration = true;
                    finalThoughtDuration = isSimple ? undefined : Math.max(1, thinkingTimerRef.current || 1);
                    setIsAiTyping(false);
                    setActiveThinkingMsgId(null);
                    setTypingAnimationMsgId(aiMsgId);
                    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                      try {
                        navigator.vibrate(35);
                      } catch {}
                    }
                  }

                  // Update message in real time with incoming stream text!
                  setChatThreads((prev) => {
                    const thread = prev[topicKey] || {
                      id: `thread-${Date.now()}`,
                      title: topicKey,
                      promptBanner: promptText,
                      messages: [
                        {
                          id: `user-${Date.now()}`,
                          sender: 'user',
                          text: promptText,
                          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        },
                        {
                          id: aiMsgId,
                          sender: 'ai',
                          text: '',
                          isStreaming: true,
                          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        },
                      ],
                    };
                    const hasAiMsg = thread.messages.some((m) => m.id === aiMsgId);
                    const updatedMessages = hasAiMsg
                      ? thread.messages.map((m) =>
                          m.id === aiMsgId
                            ? {
                                ...m,
                                text: currentCleanText,
                                isStreaming: true,
                                thoughtDuration: finalThoughtDuration,
                                sources: streamSources.length > 0 ? streamSources : m.sources,
                                thoughtSummary: streamThoughtSummary || m.thoughtSummary,
                                provider: streamProvider || m.provider,
                              }
                            : m
                        )
                      : [
                          ...thread.messages,
                          {
                            id: aiMsgId,
                            sender: 'ai' as const,
                            text: currentCleanText,
                            isStreaming: true,
                            thoughtDuration: finalThoughtDuration,
                            sources: streamSources.length > 0 ? streamSources : undefined,
                            thoughtSummary: streamThoughtSummary,
                            provider: streamProvider,
                            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                          },
                        ];

                    return {
                      ...prev,
                      [topicKey]: {
                        ...thread,
                        messages: updatedMessages,
                      },
                    };
                  });

                  // Faster audio & haptic ticks in sync with live generation
                  const now = Date.now();
                  if (now - lastAudioTick >= 60) {
                    playTypingClick();
                    triggerTypingVibration();
                    lastAudioTick = now;
                  }
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      } catch (err) {
        console.warn('Live stream error:', err);
        if (!accumulatedText) {
          accumulatedText = 'The AI service is temporarily unavailable due to rate limits or connection errors. Please try again.';
        }
      } finally {
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }

        const finalThoughtDuration = isSimple ? undefined : Math.max(1, thinkingTimerRef.current || 1);
        setIsAiTyping(false);
        setActiveThinkingMsgId(null);
        setTypingAnimationMsgId(null);
        setIsSendLocked(false);

        // Haptic feedback & subtle vibration when reply completes
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate([40, 25, 40]);
          } catch {}
        }
        setVibratingMsgId(aiMsgId);
        setTimeout(() => setVibratingMsgId((curr) => (curr === aiMsgId ? null : curr)), 500);

        const fullAnswer = accumulatedText || 'Response ready.';
        const cleanFullAnswer = sanitizeImageMarkupFromText(fullAnswer.replace(/```question[\s\S]*?```/gi, '').trim());
        fullGeneratedTextMap.current[aiMsgId] = cleanFullAnswer;
        const parsed = parseAIText(cleanFullAnswer);

        // Proactive question mode when instructions are missing
        const extractedQuestion = isSimple ? null : extractQuestionBlock(fullAnswer);
        if (extractedQuestion) {
          setPromptQuestionQueue([extractedQuestion]);
          setPromptQuestionIdx(0);
        }

        // Persist code artifact and memory immediately
        persistArtifactIfPresent(cleanFullAnswer, topicKey, promptText);

        // Set final formatted structured content with instant code boxes
        setChatThreads((prev) => {
          const thread = prev[topicKey] || {
            id: `thread-${Date.now()}`,
            title: topicKey,
            promptBanner: promptText,
            messages: [
              {
                id: `user-${Date.now()}`,
                sender: 'user',
                text: promptText,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ],
          };
          const hasAiMsg = thread.messages.some((m) => m.id === aiMsgId);
          const finalMessages = hasAiMsg
            ? thread.messages.map((m) =>
                m.id === aiMsgId
                  ? {
                      ...m,
                      text: cleanFullAnswer,
                      isStreaming: false,
                      thoughtDuration: finalThoughtDuration,
                      sources: streamSources.length > 0 ? streamSources : m.sources,
                      thoughtSummary: streamThoughtSummary || m.thoughtSummary,
                      provider: streamProvider || m.provider,
                      structuredContent:
                        parsed.mainTitle || parsed.intro || parsed.sections.length > 0
                          ? parsed
                          : undefined,
                      activeQuestion: extractedQuestion || undefined,
                    }
                  : m
              )
            : [
                ...thread.messages,
                {
                  id: aiMsgId,
                  sender: 'ai' as const,
                  text: cleanFullAnswer,
                  isStreaming: false,
                  thoughtDuration: finalThoughtDuration,
                  sources: streamSources.length > 0 ? streamSources : undefined,
                  thoughtSummary: streamThoughtSummary,
                  provider: streamProvider,
                  structuredContent:
                    parsed.mainTitle || parsed.intro || parsed.sections.length > 0
                      ? parsed
                      : undefined,
                  activeQuestion: extractedQuestion || undefined,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ];

          const updatedThread = {
            ...thread,
            messages: finalMessages,
          };

          // Preserve any generated code in active state for subsequent turns (User spec)
          const codeMatch =
            cleanFullAnswer.match(/```(?:html|css|javascript|js|typescript|ts|tsx)?\s*([\s\S]*?)```/i) ||
            cleanFullAnswer.match(/(<!DOCTYPE html[\s\S]*?<\/html>)/i);
          if (codeMatch && codeMatch[1]) {
            setLatestActiveCode(codeMatch[1].trim());
          }

          // Maintain running background conversation summary (hidden from chat UI)
          setRunningChatSummary((prevSummary) => {
            const turnInfo = `User requested: "${promptText.slice(0, 100)}". AI provided response${codeMatch ? ' with updated source code' : ''}.`;
            return prevSummary ? `${prevSummary} | ${turnInfo}`.slice(-1500) : turnInfo;
          });

          return {
            ...prev,
            [topicKey]: updatedThread,
          };
        });

        // Automatically speak AI answer with Gemini TTS if enabled in settings
        if (getAutoReadAloud() && cleanFullAnswer) {
          handleToggleSpeakMessage(aiMsgId, cleanFullAnswer);
        }

        // Execute MythoriaLib Creative Studio tool call automatically if emitted (remove_background / save_template / list_templates)
        const studioToolCall = extractStudioToolCall(cleanFullAnswer);
        if (studioToolCall && studioToolDepthRef.current < 3) {
          studioToolDepthRef.current += 1;
          setTimeout(async () => {
            try {
              if (studioToolCall.tool === 'remove_background' && studioToolCall.upload_id) {
                const srcEntry = studioUploadsRef.current.find((u) => u.id === studioToolCall.upload_id) || studioUploadsRef.current[0];
                if (srcEntry) {
                  showToast('Removing subject background...');
                  const res = await removeBackground(srcEntry.dataUrl, {
                    edge_feather: studioToolCall.edge_feather,
                    tolerance: studioToolCall.tolerance,
                  });
                  const cutoutId = `${srcEntry.id}_cutout`;
                  await registerStudioUpload(res.dataURL, `${srcEntry.name}_cutout.png`, 'image/png', cutoutId);
                  sendProgrammaticMessage(
                    JSON.stringify({
                      tool: 'remove_background',
                      status: 'done',
                      upload_id: cutoutId,
                      method: res.method,
                    })
                  );
                } else {
                  sendProgrammaticMessage(
                    JSON.stringify({ tool: 'remove_background', status: 'error', error: 'No uploaded image available' })
                  );
                }
              } else if (studioToolCall.tool === 'save_template' && studioToolCall.template) {
                const saved = saveTemplate(studioToolCall.template);
                showToast(`Saved template "${saved.name}"`);
                sendProgrammaticMessage(
                  JSON.stringify({ tool: 'save_template', status: 'saved', id: saved.id, name: saved.name })
                );
              } else if (studioToolCall.tool === 'list_templates') {
                const list = studioToolCall.kind
                  ? allTemplates(studioToolCall.kind)
                  : [...allTemplates('thumbnail'), ...allTemplates('image'), ...allTemplates('video')];
                sendProgrammaticMessage(
                  JSON.stringify({
                    tool: 'list_templates',
                    templates: list.map((t: any) => ({ id: t.id, name: t.name, kind: t.kind })),
                  })
                );
              }
            } catch (toolErr) {
              console.warn('Studio tool execution warning:', toolErr);
            }
          }, 150);
        } else {
          studioToolDepthRef.current = 0;
        }
      }
    })();
  };

  const processChatFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (!fileArray.length) return;

    if (chatAttachments.length >= 10) {
      setFileLimitError('Max 10 files can be attached.');
      setTimeout(() => setFileLimitError(null), 3500);
      return;
    }

    const availableSlots = 10 - chatAttachments.length;
    const filesToAttach = fileArray.slice(0, availableSlots);

    if (fileArray.length > availableSlots) {
      setFileLimitError(`Max 10 files limit reached. Added ${availableSlots} file(s).`);
      setTimeout(() => setFileLimitError(null), 3500);
    }

    filesToAttach.forEach((file) => {
      const isImg = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|ogg)$/i.test(file.name);
      const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name);
      const isCodeOrText =
        file.type.includes('text') ||
        /\.(txt|md|json|js|jsx|ts|tsx|html|css|py|csv|xml|sql|yaml|yml)$/i.test(file.name);
      const reader = new FileReader();
      const attachmentId = `chat-file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      if (isImg || isVideo || isAudio) {
        reader.onload = (ev) => {
          const base64Data = ev.target?.result as string;
          if (isImg && base64Data) {
            registerStudioUpload(base64Data, file.name, file.type || 'image/png');
          }
          const newAttachment: AttachedFile = {
            id: attachmentId,
            name: file.name,
            size: file.size,
            type: file.type,
            isImage: isImg,
            preview: base64Data,
          };
          setChatAttachments((prev) => [...prev, newAttachment]);
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = (ev) => {
          const content = (ev.target?.result as string) || '';
          const langInfo = sniffCodeLanguage(content, file.name);
          const newAttachment: AttachedFile = {
            id: attachmentId,
            name: file.name,
            size: file.size,
            type: file.type || 'text/plain',
            isImage: false,
            preview: content,
            codeContent: content,
            language: langInfo.lang,
          };
          setChatAttachments((prev) => [...prev, newAttachment]);
        };
        if (isCodeOrText) {
          reader.readAsText(file);
        } else {
          reader.readAsDataURL(file);
        }
      }
    });
  };

  const removeChatAttachment = (id: string) => {
    setChatAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const pendingAttachmentsRef = useRef<AttachedFile[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const prevSelectedTopicRef = useRef<string>(selectedRecentTopic);
  // Sync activeTopic when prop changes (only if user explicitly selected a different recent topic and no incoming initialPrompt)
  useEffect(() => {
    if (selectedRecentTopic && selectedRecentTopic !== prevSelectedTopicRef.current && !initialPrompt) {
      prevSelectedTopicRef.current = selectedRecentTopic;
      setActiveTopic(selectedRecentTopic);
    }
  }, [selectedRecentTopic, initialPrompt]);

  const consumedInitialPromptRef = useRef<string | null>(null);
  // Handle each incoming welcome prompt once, including development effect replay.
  useEffect(() => {
    if (!initialPrompt) { consumedInitialPromptRef.current = null; return; }
    if (initialPrompt.trim() && consumedInitialPromptRef.current !== initialPrompt) {
      consumedInitialPromptRef.current = initialPrompt;
      setIsSendLocked(true);
      const trimmed = initialPrompt.trim();
      const isAuth = Boolean(currentUser && !currentUser.isAnonymous);
      const targetTopic = isAuth
        ? (trimmed.length > 25 ? `${trimmed.slice(0, 25)}...` : trimmed)
        : GUEST_TOPIC;

      const userMsgId = `msg-user-${Date.now()}`;
      const aiMsgId = `msg-ai-${Date.now()}`;

      const userMessage: ChatMessage = {
        id: userMsgId,
        sender: 'user',
        text: trimmed,
        attachments: initialAttachments && initialAttachments.length > 0 ? [...initialAttachments] : undefined,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const aiPlaceholder: ChatMessage = {
        id: aiMsgId,
        sender: 'ai',
        text: '',
        isStreaming: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatThreads((prev) => {
        const existing = prev[targetTopic] || {
          id: `thread-${Date.now()}`,
          title: targetTopic,
          promptBanner: trimmed,
          messages: [],
        };
        return {
          ...prev,
          [targetTopic]: {
            ...existing,
            messages: [...existing.messages, userMessage, aiPlaceholder],
          },
        };
      });

      setActiveTopic(targetTopic);
      if (onSelectRecentTopic && isAuth) {
        onSelectRecentTopic(targetTopic);
      }

      onClearInitialPrompt?.();

      // Register any initial image attachments into MythoriaLib upload registry, then stream
      (async () => {
        if (initialAttachments && initialAttachments.length > 0) {
          for (const att of initialAttachments) {
            if (att.isImage && att.preview) {
              await registerStudioUpload(att.preview, att.name, att.type || 'image/png');
            }
          }
        }
        startGeminiStream(targetTopic, aiMsgId, trimmed, initialAttachments || []);
      })();
    }
  }, [initialPrompt]);

  // Smart user-aware auto-scroll: strictly prevents viewport snapping down when user scrolls up
  const userScrolledUpRef = useRef<boolean>(false);
  const isAutoScrollingRef = useRef<boolean>(false);
  const lastScrollTopRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState<boolean>(false);

  const handleChatScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    if (isAutoScrollingRef.current) return;

    const currentScrollTop = el.scrollTop;
    const distanceFromBottom = el.scrollHeight - currentScrollTop - el.clientHeight;

    // Detect user actively scrolling up or already scrolled up away from bottom
    if (currentScrollTop < lastScrollTopRef.current && distanceFromBottom > 15) {
      userScrolledUpRef.current = true;
      setShowScrollBottomBtn(true);
    } else if (distanceFromBottom > 20) {
      userScrolledUpRef.current = true;
      setShowScrollBottomBtn(true);
    } else if (distanceFromBottom <= 8) {
      // User has returned all the way to the bottom
      userScrolledUpRef.current = false;
      setShowScrollBottomBtn(false);
    }

    lastScrollTopRef.current = currentScrollTop;
  };

  const scrollToBottom = (smooth = true) => {
    const el = chatContainerRef.current;
    if (!el) return;
    isAutoScrollingRef.current = true;
    userScrolledUpRef.current = false;
    setShowScrollBottomBtn(false);

    if (smooth) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: 'smooth',
      });
    } else {
      el.scrollTop = el.scrollHeight;
    }

    setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, 350);
  };

  // Only auto-scroll when switching topic
  useEffect(() => {
    userScrolledUpRef.current = false;
    scrollToBottom(false);
  }, [activeTopic]);

  // When new messages or streaming chunks arrive: NEVER scroll down if user has scrolled up!
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el || userScrolledUpRef.current) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // Only keep sticky bottom if user was already at the absolute bottom
    if (distanceFromBottom <= 15) {
      el.scrollTop = el.scrollHeight;
    }
  }, [chatThreads, isAiTyping]);

  const isAuthUser = Boolean(currentUser && !currentUser.isAnonymous);
  const currentThread =
    chatThreads[activeTopic] ||
    Object.values(chatThreads).find((t) => t.id === activeTopic || t.title === activeTopic) ||
    chatThreads[selectedRecentTopic] ||
    (!activeTopic && isAuthUser ? Object.values(chatThreads)[0] : !isAuthUser ? chatThreads[GUEST_TOPIC] : undefined);

  // Sends a programmatic message (e.g. "I choose Option 2" from a swatch card)
  const programmaticSendRef = useRef<string | null>(null);
  const sendProgrammaticMessage = (text: string) => {
    programmaticSendRef.current = text;
    handleSendMessage();
  };

  // Auto-extract pasted code into attached file chips in chat
  const handleChatPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    const { hasCode, cleanedText, codeFiles } = detectAndExtractCode(text);
    if (hasCode && codeFiles.length > 0) {
      e.preventDefault();
      const updated = [...chatAttachments];
      for (const cf of codeFiles) {
        if (updated.length < 10) updated.push(cf);
      }
      setChatAttachments(updated);
      if (cleanedText) {
        setInputVal((prev) => (prev ? `${prev} ${cleanedText}`.trim() : cleanedText));
      }
    }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSendLocked || isAiTyping) return;
    const programmaticQuery = programmaticSendRef.current;
    programmaticSendRef.current = null;
    let query = (programmaticQuery ?? inputVal).trim();
    let currentAtts = [...chatAttachments];

    // Detect and extract code from query if user entered code directly
    const { hasCode, cleanedText, codeFiles } = detectAndExtractCode(query);
    if (hasCode && codeFiles.length > 0) {
      for (const cf of codeFiles) {
        if (currentAtts.length < 10) currentAtts.push(cf);
      }
      query = cleanedText;
    }

    if (!query && currentAtts.length === 0) return;

    const messageText = query || (currentAtts[0] ? `Attached code/file: ${currentAtts[0].name}` : 'Code analysis request');
    const userMsgId = `user-${Date.now()}`;

    const userMessage: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: messageText,
      attachments: currentAtts.length > 0 ? currentAtts : undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    if (programmaticQuery === null) setInputVal('');
    setChatAttachments([]);
    pendingAttachmentsRef.current = currentAtts;
    userScrolledUpRef.current = false;
    setShowScrollBottomBtn(false);
    scrollToBottom(true);

    const isAuth = Boolean(currentUser && !currentUser.isAnonymous);
    const targetTopic = isAuth
      ? (activeTopic || `Chat ${Object.keys(chatThreads).length + 1}`)
      : GUEST_TOPIC;

    if (activeTopic !== targetTopic) {
      setActiveTopic(targetTopic);
      if (onSelectRecentTopic && isAuth) onSelectRecentTopic(targetTopic);
    }

    // Check if user is asking to create/build a Website or App UI (handled exclusively by Buildy)
    const isBuildyUiRequest = isWebsiteOrAppUiBuildRequest(messageText, currentAtts);

    // Website / App UI creation request -> Expand Prompt Box Upward with Buildy Card (NO HTML/CSS/JS building in-app)
    if (isBuildyUiRequest) {
      setIsSendLocked(false);
      setIsThinkingPanelOpen(false);
      setBuildyRedirectRequest(messageText);

      const aiBuildyMsg: ChatMessage = {
        id: `ai-buildy-${Date.now()}`,
        sender: 'ai',
        text: `### Go to Buildy to create App or Web UI\n\nThis workspace does not build HTML/CSS/JS websites or App UIs directly. Open **[Buildy](${BUILDY_URL})** to generate and customize your website or app interface.\n\nIf you want a detailed **Buildy UI prompt**, architecture plan, or coding help in **Python, TypeScript, C++, Java, or SQL**, click **Write Detailed Buildy Prompt** below or ask right here.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatThreads((prev) => {
        const existing = prev[targetTopic] || {
          id: `thread-${Date.now()}`,
          title: targetTopic,
          promptBanner: messageText,
          messages: [],
        };
        return {
          ...prev,
          [targetTopic]: {
            ...existing,
            messages: [...existing.messages, userMessage, aiBuildyMsg],
          },
        };
      });
      return;
    }

    // Immediate maximum-quality execution (Clarification Gate removed per user preference)
    setIsSendLocked(true);
    const aiMsgId = `ai-${Date.now()}`;
    const aiPlaceholder: ChatMessage = {
      id: aiMsgId,
      sender: 'ai',
      text: '',
      isStreaming: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatThreads((prev) => {
      const existing = prev[targetTopic] || {
        id: `thread-${Date.now()}`,
        title: targetTopic,
        promptBanner: messageText,
        messages: [],
      };
      return {
        ...prev,
        [targetTopic]: {
          ...existing,
          messages: [...existing.messages, userMessage, aiPlaceholder],
        },
      };
    });

    startGeminiStream(targetTopic, aiMsgId, messageText, currentAtts);
  };

  const handleSelectRecentChat = (topic: string) => {
    if (!currentUser || currentUser.isAnonymous) {
      onOpenLogin?.();
      return;
    }
    setActiveTopic(topic);
    if (onSelectRecentTopic) onSelectRecentTopic(topic);
    setIsMobileSidebarOpen(false);
  };

  const handleNewChat = () => {
    if (!currentUser || currentUser.isAnonymous) {
      onOpenLogin?.();
      return;
    }
    const newId = `Chat ${Object.keys(chatThreads).length + 1}`;
    const newThread: ChatThread = {
      id: `thread-${Date.now()}`,
      title: newId,
      promptBanner: 'Start a new conversation or ask anything...',
      messages: [],
    };

    setChatThreads((prev) => ({
      [newId]: newThread,
      ...prev,
    }));
    setActiveTopic(newId);
    if (onSelectRecentTopic) onSelectRecentTopic(newId);
    setIsMobileSidebarOpen(false);
  };

  const toggleMic = async () => {
    if (isMicActive) {
      isMicActiveRef.current = false;
      setIsMicActive(false);
      showToast('Microphone stopped');
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
        speechRecognitionRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      return;
    }

    suppressSttFallbackRef.current = false;
    isMicActiveRef.current = true;
    setIsMicActive(true);
    // Save existing text before voice input starts
    micBaseInputRef.current = inputVal;
    showToast('Listening... Speak now (Live transcription active)');

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    let startedSpeechRecognition = false;

    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.lang = navigator.language || 'en-US';

        recognition.onresult = (event: any) => {
          let interim = '';
          let finalChunk = '';
          for (let i = 0; i < event.results.length; ++i) {
            const res = event.results[i];
            if (res.isFinal) {
              finalChunk += (finalChunk ? ' ' : '') + res[0].transcript.trim();
            } else {
              interim += (interim ? ' ' : '') + res[0].transcript.trim();
            }
          }
          const base = micBaseInputRef.current;
          const liveCombined = [base, finalChunk, interim].filter(Boolean).join(' ');
          setInputVal(liveCombined);
        };

        recognition.onerror = (err: any) => {
          console.warn('SpeechRecognition error:', err?.error);
          if (err?.error === 'not-allowed') {
            isMicActiveRef.current = false;
            setIsMicActive(false);
            showToast('Microphone access denied');
          }
        };

        recognition.onend = () => {
          // Re-arm recognition if user is still actively recording
          if (isMicActiveRef.current) {
            try {
              recognition.start();
            } catch {}
          }
        };

        recognition.start();
        speechRecognitionRef.current = recognition;
        startedSpeechRecognition = true;
      } catch (recErr) {
        console.warn('SpeechRecognition failed, falling back to MediaRecorder:', recErr);
      }
    }

    // Audio stream & MediaRecorder for Whisper backend fallback
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          if (suppressSttFallbackRef.current) return;
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

          if (audioBlob.size < 50) return;

          // If speech recognition didn't yield text, fallback to /api/stt
          if (!startedSpeechRecognition || inputVal === micBaseInputRef.current) {
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
              const base64Audio = reader.result as string;
              try {
                showToast('Transcribing audio input...');
                const sttRes = await fetch('/api/stt', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ audio: base64Audio, mimeType: 'audio/webm' }),
                });
                const sttData = await sttRes.json();
                if (sttData.text && sttData.text.trim()) {
                  setInputVal((prev) => (prev ? `${prev} ${sttData.text.trim()}` : sttData.text.trim()));
                  showToast('Transcribed audio');
                }
              } catch (sttErr) {
                console.warn('Groq STT transcription error:', sttErr);
                showToast('Transcription service unavailable');
              }
            };
          }
        };

        mediaRecorder.start(250);
        mediaRecorderRef.current = mediaRecorder;
      }
    } catch (micErr) {
      if (!startedSpeechRecognition) {
        console.warn('Microphone permission error:', micErr);
        isMicActiveRef.current = false;
        setIsMicActive(false);
        showToast('Microphone access denied or unavailable');
      }
    }
  };

  const handleCancelMic = () => {
    suppressSttFallbackRef.current = true;
    isMicActiveRef.current = false;
    setIsMicActive(false);
    setIsTranscribing(false);
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    setInputVal(micBaseInputRef.current);
    showToast('Voice recording cancelled');
  };

  const handleStopMicKeepText = () => {
    suppressSttFallbackRef.current = false;
    isMicActiveRef.current = false;
    setIsMicActive(false);
    setIsTranscribing(false);
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    showToast('Stopped listening — text kept in prompt box');
  };

  const handleConfirmMic = () => {
    suppressSttFallbackRef.current = true;
    isMicActiveRef.current = false;
    setIsMicActive(false);
    setIsTranscribing(false);
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    const latestText = inputVal.trim();
    if (latestText) {
      setInputVal('');
      sendProgrammaticMessage(latestText);
    } else {
      showToast('No speech detected to send');
    }
  };

  if (!isOpen) return null;

  const isLight = themeMode === 'light';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed inset-0 z-[10000] flex overflow-hidden font-sans select-none transition-colors duration-300 ${
          isLight ? 'chat-workspace bg-background text-foreground' : 'chat-workspace bg-background text-foreground'
        }`}
      >
        {/* ------------------------------------------------------------- */}
        {/* LEFT CURVED-BOX MENU: Exact Welcome Screen Curved Menu Parity */}
        {/* ------------------------------------------------------------- */}
        {(() => {
          const renderCurvedMenuCard = (isMobileOverlay: boolean) => (
            <div
              onClick={(e) => e.stopPropagation()}
              className={`relative w-full ${
                isMobileOverlay ? 'max-w-[345px] sm:max-w-[365px] h-[92vh] max-h-[820px]' : 'w-[325px] lg:w-[348px] h-full'
              } rounded-[38px] border-2 p-6 flex flex-col justify-between overflow-hidden select-none transition-colors duration-300`}
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--primary)',
                boxShadow: '0 10px 40px rgba(71, 105, 135, 0.16)',
                color: 'var(--text)',
              }}
            >
              {/* Atmospheric subtle nebula corner accents matching Welcome menu */}
              <div
                className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-20"
                style={{ backgroundColor: 'var(--primary)' }}
              />
              <div
                className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-20"
                style={{ backgroundColor: 'var(--primary)' }}
              />

              {/* TOP FIXED SECTION: BMW ///M Crest + Mobile Close */}
              <div className="shrink-0 relative z-10">
                <div className="flex items-center justify-between pt-1 pb-1">
                  <div className="flex items-center gap-2 select-none">
                    <div className="flex items-center gap-1.5 -skew-x-[18deg]">
                      <span className="w-2.5 h-7 sm:w-3 sm:h-8 bg-[#0082CA] rounded-[1px] shadow-[0_0_12px_rgba(0,130,202,0.7)]" />
                      <span className="w-2.5 h-7 sm:w-3 sm:h-8 bg-[#17205a] rounded-[1px]" />
                      <span className="w-2.5 h-7 sm:w-3 sm:h-8 bg-[#E21B23] rounded-[1px] shadow-[0_0_16px_rgba(226,27,35,0.9)]" />
                    </div>
                    <span className="text-3xl sm:text-4xl font-black italic tracking-tighter ml-1 text-foreground">
                      M
                    </span>
                  </div>

                  {isMobileOverlay && (
                    <button
                      type="button"
                      onClick={() => setIsMobileSidebarOpen(false)}
                      className="p-2 rounded-full hover:bg-black/5 text-zinc-700 cursor-pointer"
                      aria-label="Close menu"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>
              </div>

              {/* GUEST MODE OR AUTHENTICATED CONTENT */}
              {!currentUser || currentUser.isAnonymous ? (
                <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-4 text-center my-auto relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-[#00a6ff]/40 flex items-center justify-center text-[#00a6ff] shadow-[0_0_20px_rgba(0,166,255,0.2)] mb-3">
                    <Lock size={24} />
                  </div>
                  <h3 className="text-foreground text-base font-extrabold tracking-tight mb-1.5">
                    Sign in required
                  </h3>
                  <p className="text-xs text-zinc-600 leading-relaxed max-w-[210px] mb-5">
                    Sign in to access your chats, projects and memory.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileSidebarOpen(false);
                      handleOpenLogin();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#00a6ff] hover:bg-[#0094e6] text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(0,166,255,0.45)] cursor-pointer active:scale-95"
                  >
                    Sign In
                  </button>
                </div>
              ) : (
                <>
                  {/* Authenticated Mode: New Chat + Navigation */}
                  <div className="shrink-0 space-y-4 pt-3 relative z-10">
                    {/* + New Chat Pill Button */}
                    <button
                      type="button"
                      onClick={handleNewChat}
                      className="w-full py-3 px-4 rounded-[20px] bg-[#0c0204] border-[1.5px] border-[#00a6ff] text-white font-medium text-[15px] flex items-center justify-between shadow-[0_0_18px_rgba(0,166,255,0.35)] hover:shadow-[0_0_24px_rgba(0,166,255,0.55)] transition-all cursor-pointer active:scale-98 group"
                    >
                      <div className="flex items-center gap-3">
                        <Plus size={19} className="text-white group-hover:rotate-90 transition-transform" />
                        <span className="text-white tracking-wide">New Chat</span>
                      </div>
                      <ChevronRight size={18} className="text-[#00a6ff] font-bold group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    {/* Navigation Items: Daro & Zara, Explore Creative Skills, Buildy */}
                    <div className="space-y-1.5 pt-0.5 text-[15px] font-medium text-foreground">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMobileSidebarOpen(false);
                          setIsVoiceCallOpen(true);
                        }}
                        className="w-full px-3 py-2 rounded-xl hover:bg-sky-50 text-left flex items-center justify-between text-foreground transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-3.5">
                          <AudioLines size={19} strokeWidth={1.9} className="text-[#00a6ff]" />
                          <span className="tracking-wide font-semibold">Daro &amp; Zara</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00a6ff]/15 text-[#0a2a66] font-bold uppercase tracking-wider">
                          {activePersona}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsMobileSidebarOpen(false);
                          setIsExploreGptsOpen(true);
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-all cursor-pointer ${
                          activeSkill
                            ? 'bg-[#00a6ff]/12 text-[#0a2a66] font-semibold'
                            : 'hover:bg-sky-50 text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <Wand2 size={19} strokeWidth={1.8} className={activeSkill ? 'text-[#00a6ff]' : 'text-zinc-600'} />
                          <span className="tracking-wide">Explore Creative Skills</span>
                        </div>
                        {activeSkill && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00a6ff] text-white font-bold">
                            Active
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsMobileSidebarOpen(false);
                          setIsCreativeStudioOpen(true);
                        }}
                        className="w-full px-3 py-2 rounded-xl hover:bg-sky-50 text-left flex items-center justify-between text-foreground transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3.5">
                          <Sparkles size={19} strokeWidth={1.8} className="text-[#00a6ff]" />
                          <span className="tracking-wide font-semibold">Creative Studio</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsMobileSidebarOpen(false);
                          window.open(BUILDY_URL, '_blank', 'noopener,noreferrer');
                        }}
                        className="w-full px-3 py-2 rounded-xl hover:bg-sky-50 text-left flex items-center gap-3.5 text-foreground transition-all cursor-pointer"
                      >
                        <Hammer size={19} strokeWidth={1.8} className="text-zinc-600" />
                        <span className="tracking-wide">Buildy</span>
                      </button>
                    </div>
                  </div>

                  {/* ONLY RECENT SECTION SCROLLABLE */}
                  <div className="flex-1 min-h-0 flex flex-col pt-3 relative z-10">
                    <span className="text-[13px] font-semibold text-zinc-500 px-3 tracking-wide mb-2 shrink-0">
                      Recent
                    </span>

                    <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 no-scrollbar">
                      {Object.keys(chatThreads).length === 0 ? (
                        <div className="px-3 py-6 text-center text-xs text-zinc-500">
                          No saved chats yet. Start a new conversation!
                        </div>
                      ) : (
                        Object.values(chatThreads).map((thread) => {
                          const topic = thread.title || thread.id;
                          return (
                            <div
                              key={thread.id || topic}
                              className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between transition-all cursor-pointer border group ${
                                topic === activeTopic
                                  ? 'bg-sky-50 text-[#0a2a66] border-[#00a6ff]/35 font-semibold'
                                  : 'hover:bg-sky-50/60 text-foreground border-transparent'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleSelectRecentChat(topic)}
                                className="flex items-center gap-3 truncate text-left flex-1 min-w-0 cursor-pointer"
                              >
                                <MessageSquare
                                  size={17}
                                  strokeWidth={1.8}
                                  className={topic === activeTopic ? 'text-[#00a6ff] shrink-0' : 'text-zinc-500 shrink-0'}
                                />
                                <span className="truncate text-[14px]">
                                  {topic}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (currentUser?.uid && thread.id) {
                                    await deleteChatThreadFromFirestore(thread.id, currentUser.uid);
                                    setChatThreads((prev) => {
                                      const next = { ...prev };
                                      delete next[topic];
                                      return next;
                                    });
                                    if (activeTopic === topic) {
                                      const remaining = Object.keys(chatThreads).filter((k) => k !== topic);
                                      setActiveTopic(remaining[0] || '');
                                    }
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-400 hover:text-red-500 transition-opacity ml-1 shrink-0 cursor-pointer"
                                title="Delete chat"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* BOTTOM ACTIONS: ← Welcome + Voices + Account Row */}
              <div className="shrink-0 space-y-2.5 pt-3 relative z-10 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileSidebarOpen(false);
                    onClose();
                  }}
                  className="w-full py-2.5 px-4 rounded-[18px] text-white font-semibold text-[14px] flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-98 theme-button-primary"
                >
                  <ArrowLeft size={17} className="text-white" />
                  <span>Welcome</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsVoiceSettingsOpen(true);
                    setIsMobileSidebarOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-sky-50/70 hover:bg-sky-50 text-foreground border border-border transition-all text-xs font-medium cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#00a6ff]/15 text-[#00a6ff] flex items-center justify-center">
                      <Volume2 size={15} />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="font-bold text-foreground">Voices</span>
                      <span className="text-[10px] text-zinc-500">{activePersona} • 14 Studio Voices • Auto-Read</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-zinc-400" />
                </button>

                {currentUser && !currentUser.isAnonymous ? (
                  <div className="flex items-center justify-between px-2.5 py-2 select-none rounded-xl bg-sky-50/50 border border-border">
                    <div className="flex items-center gap-2.5 min-w-0 truncate">
                      <div className="w-9 h-9 rounded-full bg-white border-[1.5px] border-[#00a6ff] flex items-center justify-center text-[#00a6ff] shadow-sm shrink-0 overflow-hidden">
                        {currentUser?.photoURL ? (
                          <img src={currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <UserIcon size={17} className="fill-[#00a6ff] text-[#00a6ff]" />
                        )}
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="text-[13px] font-bold text-foreground leading-tight truncate">
                          {currentUser.displayName || currentUser.email?.split('@')[0]}
                        </span>
                        <span className="text-[11px] text-zinc-500 truncate">
                          {currentUser.email || 'Cloud Account'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await logOut();
                        showToast('Signed out successfully');
                      }}
                      className="ml-2 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                      title="Sign Out"
                    >
                      <LogOut size={13} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={handleOpenLogin}
                    className="flex items-center justify-between px-3 py-2 select-none cursor-pointer hover:bg-sky-50/60 bg-sky-50/40 border border-border rounded-xl transition-colors"
                    title="Click to sign in"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-9 h-9 rounded-full bg-white border-[1.5px] border-zinc-300 flex items-center justify-center text-zinc-600 shrink-0">
                        <UserIcon size={16} />
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="text-[13px] font-bold text-foreground leading-tight truncate">
                          Guest User
                        </span>
                        <span className="text-[11px] text-zinc-500 truncate">
                          Session Active
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenLogin();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#00a6ff] hover:bg-[#0094e6] text-white text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
                    >
                      Sign In
                    </button>
                  </div>
                )}
              </div>
            </div>
          );

          return (
            <>
              {/* Desktop Floating Curved-Box Sidebar */}
              <div className="hidden md:flex md:p-4 md:pr-2 h-full shrink-0 z-20">
                {renderCurvedMenuCard(false)}
              </div>

              {/* Mobile Floating Curved-Box Modal Overlay (Identical to Welcome Screen) */}
              <AnimatePresence>
                {isMobileSidebarOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsMobileSidebarOpen(false)}
                    className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-start p-2 sm:p-6 md:hidden"
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, x: -40 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95, x: -40 }}
                      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                      className="w-full flex justify-start"
                    >
                      {renderCurvedMenuCard(true)}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          );
        })()}

        {/* ------------------------------------------------------------- */}
        {/* RIGHT MAIN CHAT AREA */}
        {/* ------------------------------------------------------------- */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          {/* Top Header Row for Desktop & Mobile */}
          <div className={`flex items-center justify-between px-4 sm:px-8 py-3 border-b z-30 transition-colors ${
            isLight
              ? 'bg-[var(--surface)]/90 border-border/80 backdrop-blur-md text-foreground shadow-[var(--shadow-neumorphic-soft)]'
              : 'bg-surface/60 border-border/10 backdrop-blur-md text-foreground'
          }`}>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className={`md:hidden p-2 rounded-xl flex items-center gap-2 text-sm ${
                  isLight
                    ? 'bg-surface text-foreground border border-border shadow-sm'
                    : 'bg-surface text-foreground'
                }`}
              >
                <Menu size={18} />
                <span>Menu</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {activeSkill && (
                <button
                  type="button"
                  onClick={() => setIsExploreGptsOpen(true)}
                  className="px-2.5 py-1 rounded-full bg-[#00a6ff]/10 border border-[#00a6ff]/30 text-[11px] font-bold text-[#0a2a66] flex items-center gap-1.5 cursor-pointer"
                >
                  <Wand2 size={12} className="text-[#00a6ff]" />
                  <span>{activeSkill.name}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsVoiceCallOpen(true)}
                className="px-3 py-1.5 rounded-full bg-zinc-950 hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                title={`Open ${activePersona} Voice & Camera Assistant`}
              >
                <AudioLines size={13} className="text-[#38bdf8]" />
                <span>{activePersona}</span>
              </button>
            </div>
          </div>

          {/* Chat Scrollable Content Area */}
          <div
            ref={chatContainerRef}
            onScroll={handleChatScroll}
            onTouchStart={(e) => {
              touchStartYRef.current = e.touches[0].clientY;
            }}
            onTouchMove={(e) => {
              const currentY = e.touches[0].clientY;
              if (currentY > touchStartYRef.current + 8) {
                // User pulled down to scroll up into previous messages
                userScrolledUpRef.current = true;
                setShowScrollBottomBtn(true);
              }
            }}
            onWheel={(e) => {
              if (e.deltaY < 0) {
                userScrolledUpRef.current = true;
                setShowScrollBottomBtn(true);
              }
            }}
            className="flex-1 overflow-y-auto px-4 sm:px-8 md:px-12 lg:px-16 pt-6 pb-40 space-y-8"
          >
            {/* Conversation Messages or Welcome State */}
            {(!currentThread || !currentThread.messages || currentThread.messages.length === 0) ? (
              <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center px-4 max-w-xl mx-auto select-none">
                <div className="w-16 h-16 rounded-3xl bg-[var(--surface)] border-[1.5px] border-[var(--primary)]/60 flex items-center justify-center text-[var(--primary)] shadow-[var(--shadow-neumorphic-soft)] mb-4">
                  <Sparkles size={28} className="animate-pulse" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-[-0.015em] leading-[1.28] mb-2">
                  Think Creative AI
                </h2>
                <p className="text-xs sm:text-sm text-foreground max-w-md leading-relaxed mb-4">
                  {currentUser
                    ? `Welcome back, ${currentUser.displayName || currentUser.email?.split('@')[0]}! Your real-time chats and visual references are automatically saved.`
                    : 'Ask anything, explore high-performance design, or generate blueprints.'}
                </p>
              </div>
            ) : (
              currentThread.messages.map((message) => {
              if (message.sender === 'user') {
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-end"
                  >
                    <div className="max-w-2xl px-2 py-1 text-foreground text-sm sm:text-base font-normal leading-relaxed">
                      {/* Render attached files if present (only image shown for images, no name pill) */}
                      {message.attachments && message.attachments.length > 0 && (
                        <AttachmentGrid files={message.attachments} />
                      )}

                      {/* Content or Inline Editor */}
                      {editingUserMsgId === message.id ? (
                        <div className="space-y-2 min-w-[280px]">
                          <textarea
                            value={editingUserText}
                            onChange={(e) => setEditingUserText(e.target.value)}
                            className="w-full bg-surface/70 border border-[var(--primary)]/60 rounded-xl p-3 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
                            rows={3}
                            autoFocus
                          />
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleCancelEditUser}
                              className="px-3 py-1 rounded-lg text-xs bg-surface/10 hover:bg-surface/20 text-foreground transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditUser(message.id)}
                              className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-foreground font-medium shadow-[var(--shadow-neumorphic-soft)] transition-colors cursor-pointer"
                            >
                              <Check size={12} />
                              <span>Save</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {(() => {
                            const raw = message.text || '';
                            if (raw.startsWith('{"tool":') || raw.startsWith('{"timing_report":')) {
                              const label = raw.startsWith('{"timing_report":')
                                ? 'Studio: Re-syncing video scenes to voice timings...'
                                : raw.includes('remove_background')
                                ? 'Studio: Applied background cutout'
                                : raw.includes('save_template')
                                ? 'Studio: Template saved to library'
                                : 'Studio: Synced library catalog';
                              return (
                                <p className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-50 border border-[#00a6ff]/30 text-xs font-bold text-[#0a2a66]">
                                  <Sparkles size={12} className="text-[#00a6ff]" />
                                  <span>{label}</span>
                                </p>
                              );
                            }
                            return <p className="leading-relaxed">{message.text}</p>;
                          })()}
                          <span className="block text-[11px] text-foreground text-right mt-1">
                            {message.timestamp}
                          </span>
                        </>
                      )}
                    </div>

                    {/* User Message Action Toolbar: ONLY ICONS, NO LABELS/NAMES (Copy, Retry, Edit) */}
                    {editingUserMsgId !== message.id && (
                      <div className="flex items-center justify-end gap-1.5 mt-1.5 px-1 select-none">
                        {/* Copy Icon Only */}
                        <button
                          type="button"
                          onClick={() => handleCopyUserMessage(message.id, message.text)}
                          className="w-7 h-7 rounded-lg bg-surface/5 hover:bg-surface/15 border border-border/10 hover:border-border/20 text-foreground hover:text-foreground flex items-center justify-center transition-all cursor-pointer active:scale-90"
                          title="Copy"
                          aria-label="Copy"
                        >
                          {copiedUserMsgId === message.id ? (
                            <CheckCircle2 size={13} className="text-emerald-400" />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>

                        {/* Retry Icon Only */}
                        <button
                          type="button"
                          onClick={() => handleRetryUserMessage(message)}
                          className="w-7 h-7 rounded-lg bg-surface/5 hover:bg-surface/15 border border-border/10 hover:border-border/20 text-foreground hover:text-foreground flex items-center justify-center transition-all cursor-pointer active:scale-90"
                          title="Retry"
                          aria-label="Retry"
                        >
                          <RotateCcw size={13} />
                        </button>

                        {/* Edit Icon Only */}
                        <button
                          type="button"
                          onClick={() => handleStartEditUser(message)}
                          className="w-7 h-7 rounded-lg bg-surface/5 hover:bg-surface/15 border border-border/10 hover:border-border/20 text-foreground hover:text-foreground flex items-center justify-center transition-all cursor-pointer active:scale-90"
                          title="Edit"
                          aria-label="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              }

              // AI Message formatted with attractive headings, crimson accents, and typing animation
              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-6 pt-2"
                >
                  {/* Compact Thinking / Process Section: only for non-simple messages */}
                  {!isSimpleMessage(message.text) && (message.isStreaming || message.thoughtDuration !== undefined || activeThinkingMsgId === message.id) && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveThinkingMessage(message);
                        setIsThinkingPanelOpen((prev) => (activeThinkingMessage?.id === message.id ? !prev : true));
                      }}
                      className="text-xs text-foreground hover:text-foreground font-normal select-none py-1 flex items-center gap-1.5 transition-colors cursor-pointer group text-left"
                      title="Tap to inspect thinking breakdown & process"
                    >
                      {message.isStreaming && (
                        <span className="w-1.5 h-1.5 rounded-full bg-surface animate-pulse" />
                      )}
                      <span>
                        {message.isStreaming
                          ? `Thinking... ${formatTimer(thinkingTimer)}`
                          : `Thought for ${message.thoughtDuration || 3}s`}
                      </span>
                      <ChevronRight size={13} className="text-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                    </button>
                  )}

                  {/* Question Mode Card IN CHAT (User: "gasa question Wala ma question ataha na wasa ka lankin wo prompt box ma ni chat ma show ho") */}
                  {message.activeQuestion && (
                    <div className="pt-1 pb-2">
                      <InteractiveQuestionCard
                        question={message.activeQuestion}
                        disabled={isSendLocked || isAiTyping}
                        onAnswer={(answer) => handleAnswerQuestionInChat(message.id, answer)}
                      />
                    </div>
                  )}



                  {/* Buildy Redirect Card (For any legacy thread entries) */}
                  {message.showLibraryRecommendation && (
                    <div className="pt-1 pb-2">
                      <BuildyExpandableCard
                        onClose={() => {
                          setChatThreads((prev) => {
                            const t = prev[activeTopic];
                            if (!t) return prev;
                            return {
                              ...prev,
                              [activeTopic]: {
                                ...t,
                                messages: t.messages.map((m) =>
                                  m.id === message.id ? { ...m, showLibraryRecommendation: false } : m
                                ),
                              },
                            };
                          });
                        }}
                      />
                    </div>
                  )}

                  {/* Loaded Answer Content with typing animation and tactile vibration */}
                  {message.text && (
                    <motion.div
                      key={message.id + (message.structuredContent && typingAnimationMsgId !== message.id ? '-struct' : '-plain')}
                      initial={{ opacity: 0, y: 12 }}
                      animate={
                        vibratingMsgId === message.id
                          ? { opacity: 1, y: 0, x: [0, -2, 2, -1, 1, 0] }
                          : { opacity: 1, y: 0 }
                      }
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      className="space-y-6"
                      onClick={() => handleSkipTyping(message.id)}
                    >
                      {/* While typing or streaming, display progressively with animated blinking cursor & immediate scrollable code box */}
                      {(message.isStreaming || typingAnimationMsgId === message.id) ? (
                        <LiveMessageStreamRenderer
                          rawText={message.text}
                          isStreaming={true}
                          uploadsMap={studioUploadsMap}
                          onOpenPreview={(html, fn) => setFullscreenWebsite({ html, fileName: fn || 'website.html' })}
                          onOpenEditor={handleOpenEditor}
                          onChooseTheme={sendProgrammaticMessage}
                          onTimingDriftReport={(reportJson) => sendProgrammaticMessage(reportJson)}
                          onUseInChat={(p) => {
                            setInputVal(p);
                            showToast('Loaded prompt into input box');
                          }}
                        />
                      ) : (
                        <>
                          {/* Student Learning Suite: Interactive MCQs, Live Solver, and PDF Download */}
                          {(() => {
                            const parsedStudent = parseStudentContent(message.text);
                            if (parsedStudent && (parsedStudent.mcqs.length > 0 || parsedStudent.quizzes.length > 0)) {
                              return (
                                <div className="pt-2 pb-3">
                                  <StudentLiveQuizCard
                                    studyPackage={parsedStudent}
                                    title={parsedStudent.title || 'Interactive Practice Sheet & MCQs'}
                                  />
                                </div>
                              );
                            }
                            return null;
                          })()}

                          {/* Clean Main Title */}
                          {message.structuredContent?.mainTitle && (
                            <div className="pt-1">
                              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.015em] text-foreground leading-[1.28]">
                                {typeof message.structuredContent.mainTitle === 'string'
                                  ? message.structuredContent.mainTitle
                                  : `${(message.structuredContent.mainTitle as any).white || ''} ${(message.structuredContent.mainTitle as any).red || ''}`.trim()}
                              </h2>
                            </div>
                          )}

                          {/* Plain text fallback when no structured headers yet */}
                          {!message.structuredContent && message.text.replace(/```question[\s\S]*?```/gi, '').trim() && (
                            <LiveMessageStreamRenderer
                              rawText={message.text.replace(/```question[\s\S]*?```/gi, '').trim()}
                              isStreaming={false}
                              uploadsMap={studioUploadsMap}
                              onOpenPreview={(html, fn) => setFullscreenWebsite({ html, fileName: fn || 'website.html' })}
                              onOpenEditor={handleOpenEditor}
                              onChooseTheme={sendProgrammaticMessage}
                              onTimingDriftReport={(reportJson) => sendProgrammaticMessage(reportJson)}
                              onUseInChat={(p) => {
                                setInputVal(p);
                                showToast('Loaded prompt into input box');
                              }}
                            />
                          )}

                  {/* Intro Text (Bold, clean tables supported) */}
                  {message.structuredContent?.intro && (
                    <div className="text-foreground text-base sm:text-lg leading-relaxed max-w-4xl font-bold">
                      {renderRichProseWithTables(message.structuredContent.intro)}
                    </div>
                  )}

                  {/* Sections with high-contrast bold prose, interactive tables, Recharts, and Creative Studio Image/Video Cards */}
                  {(() => {
                    const msgVideoPlan = extractVideoPlan(message.text);
                    const msgStudioTool = extractStudioToolCall(message.text);
                    return message.structuredContent?.sections?.map((section, sIdx) => (
                      <div key={sIdx} className="space-y-3.5 pt-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-1.5 h-5 bg-[var(--primary)] rounded-full shrink-0" />
                          <h3 className="text-lg sm:text-2xl font-extrabold text-foreground tracking-[-0.015em] leading-[1.3]">
                            {section.title}
                          </h3>
                        </div>

                        {section.description && (
                          <div className="text-foreground text-sm sm:text-base md:text-[17px] leading-relaxed font-bold">
                            {renderRichProseWithTables(section.description)}
                          </div>
                        )}

                        {section.bullets && (
                          <ul className="space-y-2.5 pt-1">
                            {section.bullets.map((bullet, bIdx) => (
                              <li
                                key={bIdx}
                                className="flex items-start gap-3 text-sm sm:text-base text-foreground font-bold group"
                              >
                                <span className="w-2 h-2 rounded-full bg-[var(--primary)] mt-2 shrink-0 group-hover:scale-125 transition-transform" />
                                <span className="leading-relaxed text-foreground font-bold">{renderFormattedBoldText(bullet)}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        {section.imageCardSnippet && (
                          <ImageCardBlock rawSpec={section.imageCardSnippet} />
                        )}

                        {section.chartSnippet && (
                          <InteractiveChartBlock rawSpec={section.chartSnippet} />
                        )}

                        {section.promptSnippet && (
                          <SpecialSnippetBox
                            type="prompt"
                            content={section.promptSnippet}
                            onUseInChat={(p) => {
                              setInputVal(p);
                              showToast('Loaded prompt into input box');
                            }}
                          />
                        )}

                        {section.codeSnippet && (() => {
                          const codeLang = (section.codeLanguage || '').toLowerCase();
                          if (codeLang === 'json') {
                            if (msgStudioTool && section.codeSnippet.includes('"tool"')) {
                              return <StudioToolBadge toolCall={msgStudioTool} />;
                            }
                            if (msgVideoPlan && section.codeSnippet.includes('"segments"') && section.codeSnippet.includes('"scenes"')) {
                              return null;
                            }
                          }
                          if (codeLang === 'html' || /<div[^>]+id=["']canvas["']|window\.VIDEO/i.test(section.codeSnippet)) {
                            const studioKind = classifyStudioHtmlBlock(section.codeSnippet);
                            if (studioKind === 'video' && msgVideoPlan) {
                              return (
                                <StudioVideoPlayerCard
                                  htmlCode={section.codeSnippet}
                                  videoPlan={msgVideoPlan}
                                  uploadsMap={studioUploadsMap}
                                  onOpenFullScreenEditor={(code, fn, lg) => handleOpenEditor(code, fn, lg)}
                                  onTimingDriftReport={(reportJson) => sendProgrammaticMessage(reportJson)}
                                />
                              );
                            }
                            if (studioKind === 'image') {
                              return (
                                <StudioImageCard
                                  htmlCode={section.codeSnippet}
                                  uploadsMap={studioUploadsMap}
                                  fileName={section.fileName || 'studio-design.html'}
                                  onOpenFullScreenEditor={(code, fn, lg) => handleOpenEditor(code, fn, lg)}
                                />
                              );
                            }
                          }

                          return (
                            <SpecialSnippetBox
                              type="code"
                              content={section.codeSnippet}
                              language={section.codeLanguage || 'tsx'}
                              fileName={section.fileName}
                              onOpenFullScreenPreview={(html, fileName) =>
                                setFullscreenWebsite({ html, fileName: fileName || 'website.html' })
                              }
                              onOpenFullScreenEditor={(code, fileName, language) =>
                                handleOpenEditor(code, fileName, language)
                              }
                            />
                          );
                        })()}
                      </div>
                    ));
                  })()}

                  {/* Visual Timetable Card with 1-Click PNG Download */}
                  {(() => {
                    const tbData = extractTimetableData(message.text);
                    if (tbData && tbData.slots.length >= 3) {
                      const htmlSection = message.structuredContent?.sections?.find(
                        (s) => s.codeSnippet && (s.fileName?.includes('timetable') || s.codeSnippet.includes('<!DOCTYPE html>'))
                      );
                      const htmlContent = htmlSection?.codeSnippet || '';

                      return (
                        <TimetableImageCard
                          title={tbData.title}
                          slots={tbData.slots}
                          wakeTime={collectedAnswersRef.current['time']}
                          focus={collectedAnswersRef.current['focus']}
                          onOpenFullScreen={
                            htmlContent
                              ? () => setFullscreenWebsite({ html: htmlContent, fileName: 'timetable.html' })
                              : undefined
                          }
                        />
                      );
                    }
                    return null;
                  })()}

                  {/* Bottom Action Bar: Revert, Copy, Read Aloud (with Loading), Sources Pill, Three-Dot Menu (Summarize, Export PDF, Retry, Delete, Sources) */}
                  {!message.isStreaming && typingAnimationMsgId !== message.id && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/15 select-none">
                      <div className="flex items-center gap-1.5">
                        {/* Revert */}
                        <button
                          type="button"
                          onClick={() => handleRevertAiMessage(message.id)}
                          className="w-8 h-8 rounded-lg bg-surface/5 hover:bg-surface/15 border border-border/20 text-foreground flex items-center justify-center transition-all cursor-pointer active:scale-90"
                          title="Revert response"
                          aria-label="Revert"
                        >
                          <Undo2 size={13} />
                        </button>

                        {/* Copy */}
                        <button
                          type="button"
                          onClick={() => handleCopyResponse(message.id, message.text)}
                          className="w-8 h-8 rounded-lg bg-surface/5 hover:bg-surface/15 border border-border/20 text-foreground flex items-center justify-center transition-all cursor-pointer active:scale-90"
                          title="Copy response"
                          aria-label="Copy"
                        >
                          {copiedMessageId === message.id ? (
                            <CheckCircle2 size={13} className="text-emerald-500" />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>

                        {/* Read Aloud with Gemini TTS + Loading / Pause / Exact-Spot Continue */}
                        <button
                          type="button"
                          onClick={() => handleToggleSpeakMessage(message.id, message.text)}
                          className={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 text-[11px] font-bold transition-all cursor-pointer active:scale-95 ${
                            currentlySpeakingMsgId === message.id
                              ? 'bg-zinc-950 text-white border-zinc-950'
                              : pausedSpeakingMsgId === message.id
                              ? 'bg-sky-50 text-[#0a2a66] border-[#00a6ff]/50'
                              : synthesizingMsgId === message.id
                              ? 'bg-sky-50 text-[#0a2a66] border-[#00a6ff]/40'
                              : 'bg-surface/5 hover:bg-surface/15 border-border/20 text-foreground'
                          }`}
                          title={
                            synthesizingMsgId === message.id
                              ? 'Preparing Studio voice...'
                              : currentlySpeakingMsgId === message.id
                              ? 'Pause at current spot'
                              : pausedSpeakingMsgId === message.id
                              ? 'Continue from exact paused spot'
                              : 'Read aloud'
                          }
                          aria-label="Read aloud"
                        >
                          {synthesizingMsgId === message.id ? (
                            <>
                              <Loader2 size={13} className="animate-spin text-[#00a6ff]" />
                              <span>Loading voice...</span>
                            </>
                          ) : currentlySpeakingMsgId === message.id ? (
                            <>
                              <Pause size={13} className="text-white" />
                              <span>Pause</span>
                            </>
                          ) : pausedSpeakingMsgId === message.id ? (
                            <>
                              <Play size={13} className="text-[#00a6ff] fill-[#00a6ff]" />
                              <span>Continue</span>
                            </>
                          ) : (
                            <Volume2 size={13} />
                          )}
                        </button>

                        {/* Three-Dot Overflow Menu: Summarize, Export to PDF, Retry, Delete, Sources */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setMoreMenuMsgId((prev) => (prev === message.id ? null : message.id))
                            }
                            className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                              moreMenuMsgId === message.id
                                ? 'bg-zinc-950 text-white border-zinc-950'
                                : 'bg-surface/5 hover:bg-surface/15 border-border/20 text-foreground'
                            }`}
                            title="More actions"
                            aria-label="More actions"
                          >
                            <MoreVertical size={14} />
                          </button>

                          <AnimatePresence>
                            {moreMenuMsgId === message.id && (
                              <motion.div
                                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                                className="absolute left-0 bottom-full mb-2 w-52 rounded-2xl bg-white border border-border shadow-2xl p-1.5 z-50 text-xs"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMoreMenuMsgId(null);
                                    sendProgrammaticMessage(
                                      `Summarize the previous answer concisely using bold key bullet points (Roman script if non-English):\n\n${message.text.slice(0, 1800)}`
                                    );
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-zinc-100 text-zinc-900 font-bold text-left cursor-pointer"
                                >
                                  <Sparkles size={14} className="text-[#00a6ff]" />
                                  <span>Summarize</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setMoreMenuMsgId(null);
                                    handleExport('pdf', message);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-zinc-100 text-zinc-900 font-bold text-left cursor-pointer"
                                >
                                  <FileText size={14} className="text-red-500" />
                                  <span>Export to PDF</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setMoreMenuMsgId(null);
                                    handleRetryAiMessage(message);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-zinc-100 text-zinc-900 font-bold text-left cursor-pointer"
                                >
                                  <RotateCcw size={14} className="text-zinc-700" />
                                  <span>Retry</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteAiMessage(message.id)}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-red-50 text-red-600 font-bold text-left cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                  <span>Delete</span>
                                </button>

                                <div className="my-1 border-t border-zinc-100" />

                                <button
                                  type="button"
                                  onClick={() => {
                                    setMoreMenuMsgId(null);
                                    setActiveSourcesMsg(message);
                                  }}
                                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-sky-50 text-[#0a2a66] font-extrabold text-left cursor-pointer"
                                >
                                  <span className="flex items-center gap-2.5">
                                    <Globe size={14} className="text-[#00a6ff]" />
                                    <span>Sources</span>
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-[#0a2a66]">
                                    {message.sources?.length || 0}
                                  </span>
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  )}
                        </>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              );
            })
          )}
          </div>

          {/* Scroll to bottom button when user scrolled up */}
          <AnimatePresence>
            {showScrollBottomBtn && (
              <motion.button
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                type="button"
                onClick={() => scrollToBottom(true)}
                className="absolute bottom-28 sm:bottom-28 right-6 sm:right-12 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-surface/95 hover:bg-surface text-foreground border border-border/80 hover:border-border shadow-[var(--shadow-neumorphic-soft)] text-xs font-bold tracking-wide backdrop-blur-xl transition-all cursor-pointer pointer-events-auto group active:scale-95"
              >
                <div className="w-5 h-5 rounded-full bg-surface border border-border flex items-center justify-center text-foreground shrink-0 group-hover:bg-surface transition-colors">
                  <ArrowDown size={13} className="text-foreground group-hover:translate-y-0.5 transition-transform" />
                </div>
                <span className="text-foreground font-bold tracking-wide">Jump to Recent</span>
              </motion.button>
            )}
          </AnimatePresence>

          {/* ------------------------------------------------------------- */}
          {/* BOTTOM FLOATING PROMPT BOX & INTERACTIVE EXPANDABLE MODULES */}
          {/* ------------------------------------------------------------- */}
          <div className="absolute bottom-2 sm:bottom-5 left-0 right-0 px-2 sm:px-8 md:px-12 lg:px-16 flex flex-col items-center pointer-events-none z-40 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
            {/* Hidden File Input for Prompt Box & Modules */}
            <input
              ref={chatFileInputRef}
              type="file"
              multiple
              accept="*/*"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  processChatFiles(e.target.files);
                  e.target.value = '';
                }
              }}
              className="hidden"
            />

            {/* Dynamic width container: expands seamlessly when Thinking or Buildy card is active */}
            {(() => {
              const hasActiveQuestionInChat = currentThread?.messages?.some((m) => Boolean(m.activeQuestion));
              const isBuildyCardOpen = buildyRedirectRequest !== null;
              const hideInputControls = isThinkingPanelOpen || hasActiveQuestionInChat;

              return (
                <div
                  className={`w-full transition-all duration-300 pointer-events-auto relative max-w-[96vw] sm:max-w-3xl ${
                    isThinkingPanelOpen || isBuildyCardOpen ? 'sm:max-w-4xl' : ''
                  }`}
                >
                  <AnimatePresence mode="wait">
                    {isThinkingPanelOpen && activeThinkingMessage ? (
                      /* COMPACT PROCESS OVERVIEW PANEL (Thought for Xs, high-level steps, max 2x prompt box) */
                      <CompactThinkingPanel
                        key="compact-thinking-panel"
                        duration={activeThinkingMessage.thoughtDuration || 3}
                        message={activeThinkingMessage}
                        onClose={() => setIsThinkingPanelOpen(false)}
                      />
                    ) : isBuildyCardOpen ? (
                      /* UPWARD-EXPANDING BUILDY CARD (Mirrors CompactThinkingPanel upward dock expansion) */
                      <BuildyExpandableCard
                        key="chat-buildy-expand-card"
                        variant="chat"
                        requestText={buildyRedirectRequest!}
                        onClose={() => setBuildyRedirectRequest(null)}
                        onDraftPrompt={(reqText) => {
                          setBuildyRedirectRequest(null);
                          sendProgrammaticMessage(
                            `Write a detailed Buildy UI & architecture specification prompt (sections, color palette, typography, and interactive controls) for: ${reqText}`
                          );
                        }}
                      />
                    ) : isMicActive || isTranscribing ? (
                      /* LIVE STT SOUND BAR matching black arrow & stop-to-keep-text UX */
                      <SttSoundBar
                        key="stt-sound-bar"
                        isTranscribing={isTranscribing}
                        liveText={inputVal}
                        onCancel={handleCancelMic}
                        onStopKeepText={handleStopMicKeepText}
                        onConfirm={handleConfirmMic}
                        onAttach={() => chatFileInputRef.current?.click()}
                      />
                    ) : (
                      /* STANDARD WHITE PROMPT BOX */
                      <form
                        key="standard-white-prompt-box"
                        onSubmit={handleSendMessage}
                        className="w-full relative"
                      >
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDraggingOver(true);
                          }}
                          onDragLeave={() => setIsDraggingOver(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsDraggingOver(false);
                            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                              processChatFiles(e.dataTransfer.files);
                            }
                          }}
                          className={`fixed-prompt-box relative rounded-[28px] sm:rounded-[32px] bg-surface text-foreground px-5 pt-4 pb-3 shadow-[var(--shadow-neumorphic-soft)] border transition-all ${
                            isDraggingOver
                              ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/30'
                              : activeSkill
                              ? 'border-[#00a6ff] ring-2 ring-[#00a6ff]/20'
                              : 'border-border/90'
                          }`}
                        >
                          {/* Active AI Skill Chip */}
                          {activeSkill && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 mb-2 rounded-full bg-[#00a6ff]/12 border border-[#00a6ff]/35 text-xs w-max select-none">
                              <Wand2 size={12} className="text-[#00a6ff] shrink-0" />
                              <span className="font-bold text-[#0a2a66] text-[11px] truncate max-w-[220px]">
                                Skill: {activeSkill.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateSelectedSkill(null)}
                                className="p-0.5 rounded-full hover:bg-black/10 text-zinc-500 hover:text-zinc-900 cursor-pointer"
                                title="Clear active skill"
                                aria-label="Clear active skill"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          )}

                          {/* Input Field */}
                          <input
                            type="text"
                            disabled={isSendLocked || isAiTyping}
                            placeholder={
                              isSendLocked || isAiTyping ? 'Synthesizing response...' : 'Ask anything...'
                            }
                            value={inputVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              const { hasCode, cleanedText, codeFiles } = detectAndExtractCode(val);
                              if (hasCode && codeFiles.length > 0) {
                                setChatAttachments((prev) => {
                                  const updated = [...prev];
                                  for (const cf of codeFiles) {
                                    if (updated.length < 10) updated.push(cf);
                                  }
                                  return updated;
                                });
                                setInputVal(cleanedText);
                              } else {
                                setInputVal(val);
                              }
                            }}
                            onPaste={handleChatPaste}
                            className="w-full bg-transparent text-foreground text-sm sm:text-base font-normal placeholder:text-foreground focus:outline-none pb-2.5 tracking-wide disabled:opacity-60"
                          />

                          {/* Attached Files Strip (Only image shown for images, no name pill) */}
                          {chatAttachments.length > 0 && (
                            <AttachmentGrid files={chatAttachments} onRemove={removeChatAttachment} disabled={isSendLocked || isAiTyping} />
                          )}

                          {/* File Limit Warning Notification */}
                          <AnimatePresence>
                            {fileLimitError && (
                              <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                className="text-xs text-[var(--primary)] font-medium px-1 py-1"
                              >
                                {fileLimitError}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Bottom Row Controls: Rule 11 - hide when Question Mode or Thinking Mode is active */}
                          {!hideInputControls ? (
                            <div className="flex items-center justify-between pt-1">
                              {/* Left: Plus (+) and Microphone */}
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={isSendLocked || isAiTyping}
                                  onClick={() => chatFileInputRef.current?.click()}
                                  className="w-8 h-8 rounded-full hover:bg-surface text-foreground flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                  title="Attach files (Max 10)"
                                  aria-label="Attach files (Max 10)"
                                >
                                  <Plus size={20} strokeWidth={2} />
                                </button>

                                <button
                                  type="button"
                                  disabled={isSendLocked || isAiTyping}
                                  onClick={toggleMic}
                                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 hover:bg-surface text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                                  title="Voice Input (STT with Live Animation)"
                                >
                                  <Mic size={19} />
                                </button>
                              </div>

                              {/* Right: Model Selector + Send Button */}
                              <div className="flex items-center gap-2">
                                {/* Model Dropdown - Pure White Style */}
                                <div className="relative">
                                  <button
                                    type="button"
                                    disabled={isSendLocked || isAiTyping}
                                    onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface hover:bg-surface text-foreground border border-border/90 text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    <span>{selectedModel === 'Gemini 2.5' ? 'AI Studio 2.5' : selectedModel}</span>
                                    <ChevronDown size={14} className="text-foreground" />
                                  </button>

                                  {isModelDropdownOpen && !isSendLocked && !isAiTyping && (
                                    <div className="absolute bottom-11 right-0 w-38 bg-surface text-foreground rounded-2xl shadow-2xl border border-border/90 p-1.5 z-50 text-xs space-y-0.5">
                                      {['GPT-4o', 'GPT-4o mini', 'AI Studio 2.5', 'Claude 3.7'].map((model) => (
                                        <button
                                          key={model}
                                          type="button"
                                          onClick={() => {
                                            setSelectedModel(model);
                                            setIsModelDropdownOpen(false);
                                          }}
                                          className={`w-full text-left px-3 py-2 rounded-xl transition-all font-medium ${
                                            selectedModel === model
                                              ? 'bg-[var(--primary)] text-foreground shadow-md font-semibold'
                                              : 'hover:bg-surface text-foreground'
                                          }`}
                                        >
                                          {model}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Empty Prompt -> Black AI Voice Assistant Button | Text -> Black Up-Arrow Button matching STT */}
                                {!isSendLocked && !isAiTyping && !inputVal.trim() && chatAttachments.length === 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => setIsVoiceCallOpen(true)}
                                    className="w-9 h-9 rounded-full bg-zinc-950 hover:bg-black text-white flex items-center justify-center shadow-md hover:scale-105 cursor-pointer active:scale-95 transition-all"
                                    title={`Open ${activePersona} Voice & Camera Assistant`}
                                    aria-label="Open Voice Assistant"
                                  >
                                    <AudioLines size={17} />
                                  </button>
                                ) : (
                                  <button
                                    type="submit"
                                    disabled={isSendLocked || isAiTyping}
                                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                                      !isSendLocked && !isAiTyping
                                        ? 'bg-zinc-950 hover:bg-black text-white shadow-md hover:scale-105 cursor-pointer active:scale-95'
                                        : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                                    }`}
                                    title={isSendLocked || isAiTyping ? 'Generating response...' : 'Send prompt'}
                                    aria-label="Send prompt"
                                  >
                                    {isSendLocked || isAiTyping ? (
                                      <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                      <ArrowUp size={18} strokeWidth={2.6} />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between pt-1 px-1 text-[11px] text-foreground font-medium">
                              <span>Discovery question active above</span>
                              <span className="text-foreground">Select an option to proceed</span>
                            </div>
                          )}
                        </div>
                      </form>
                    )}
                  </AnimatePresence>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Floating Feedback Toast */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="fixed bottom-24 right-6 z-[10001] px-4 py-2.5 rounded-xl bg-[var(--surface)]/95 border border-[var(--primary)]/60 shadow-[var(--shadow-neumorphic-soft)] text-foreground text-xs flex items-center gap-2.5 backdrop-blur-md pointer-events-none"
            >
              <CheckCircle2 size={15} className="text-[var(--primary)]" />
              <span className="font-medium tracking-wide">{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fullscreen Single-File Website Sandbox Modal */}
        {fullscreenWebsite && (
          <WebsitePreviewModal
            isOpen={Boolean(fullscreenWebsite)}
            onClose={() => setFullscreenWebsite(null)}
            htmlContent={fullscreenWebsite.html}
            fileName={fullscreenWebsite.fileName}
          />
        )}

        {/* Fullscreen In-App Code Editor with Live Editing per user request */}
        {fullscreenEditor && (
          <FullScreenCodeEditorModal
            isOpen={Boolean(fullscreenEditor)}
            onClose={() => setFullscreenEditor(null)}
            initialCode={fullscreenEditor.code}
            fileName={fullscreenEditor.fileName}
            language={fullscreenEditor.language}
            onSave={(updatedCode) => {
              setFullscreenEditor((prev) => prev ? { ...prev, code: updatedCode } : null);
              showToast('Code saved successfully');
            }}
            onOpenInBrowser={(code) => {
              setFullscreenWebsite({ html: code, fileName: fullscreenEditor.fileName || 'index.html' });
            }}
          />
        )}

        {/* Persistent Project & Artifact Recovery Vault Drawer */}
        <ProjectMemoryDrawer
          isOpen={isMemoryDrawerOpen}
          onClose={() => setIsMemoryDrawerOpen(false)}
          onSelectArtifactForPreview={(htmlContent: string, title: string) => {
            setIsMemoryDrawerOpen(false);
            setFullscreenWebsite({
              html: htmlContent,
              fileName: title || 'index.html',
            });
            showToast(`Loaded preview for ${title}`);
          }}
          onSelectProjectForChat={(project: ProjectMemory, promptSnippet?: string) => {
            setIsMemoryDrawerOpen(false);
            if (promptSnippet) {
              setInputVal(promptSnippet);
            }
            showToast(`Active project: ${project.name}`);
          }}
          showToast={showToast}
        />

        {/* Firebase Authentication Modal */}
        <LoginModal
          isOpen={isInternalLoginOpen}
          onClose={() => setIsInternalLoginOpen(false)}
        />

        {/* Slide-Up Bottom Sources Drawer */}
        <AnimatePresence>
          {activeSourcesMsg && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[10002] bg-black/35 backdrop-blur-xs flex items-end justify-center p-0 sm:p-4"
              onClick={() => setActiveSourcesMsg(null)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl border border-zinc-200 shadow-2xl overflow-hidden max-h-[75vh] flex flex-col"
              >
                <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-sky-50 border border-[#00a6ff]/30 text-[#00a6ff] flex items-center justify-center">
                      <Globe size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-zinc-900">Sources &amp; Data Origins</h3>
                      <p className="text-[11px] text-zinc-500">
                        {activeSourcesMsg.sources && activeSourcesMsg.sources.length > 0
                          ? `${activeSourcesMsg.sources.length} verified citation(s) retrieved for this answer`
                          : 'Context & synthesis provenance'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSourcesMsg(null)}
                    className="w-8 h-8 rounded-full hover:bg-zinc-100 text-zinc-600 flex items-center justify-center cursor-pointer"
                    aria-label="Close sources"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="p-5 overflow-y-auto space-y-3">
                  {activeSourcesMsg.thoughtSummary && (
                    <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-[#00a6ff]/25 text-xs text-[#0a2a66] space-y-1">
                      <div className="font-extrabold">
                        Language: {activeSourcesMsg.thoughtSummary.detectedLanguage} ({activeSourcesMsg.thoughtSummary.scriptMode})
                      </div>
                      <div className="font-medium">{activeSourcesMsg.thoughtSummary.summary}</div>
                    </div>
                  )}

                  {activeSourcesMsg.sources && activeSourcesMsg.sources.length > 0 ? (
                    <div className="space-y-2">
                      {activeSourcesMsg.sources.map((src, idx) => (
                        <a
                          key={idx}
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-zinc-200 hover:border-[#00a6ff] hover:bg-sky-50/40 transition-all group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-700 flex items-center justify-center shrink-0">
                              <Link2 size={14} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-extrabold text-zinc-900 truncate group-hover:text-[#0a2a66]">
                                {src.title}
                              </div>
                              <div className="text-[11px] font-medium text-zinc-500 truncate">
                                {src.domain}
                              </div>
                            </div>
                          </div>
                          <ExternalLink size={14} className="text-zinc-400 group-hover:text-[#00a6ff] shrink-0" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-700 leading-relaxed">
                      Synthesized from built-in domain knowledge and reasoning without external web URLs.
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Daro & Zara Live Voice + Camera Vision Modal */}
        <LiveVoiceCallModal
          isOpen={isVoiceCallOpen}
          onClose={() => setIsVoiceCallOpen(false)}
          activeModelName="Gemini 3.8 Flash"
          onVoiceChanged={() => setActivePersona(getActiveAssistantPersona())}
          onSendUserPrompt={(voicePrompt) => {
            sendProgrammaticMessage(voicePrompt);
          }}
          onGoToChat={(topicPrompt) => {
            setIsVoiceCallOpen(false);
            sendProgrammaticMessage(topicPrompt);
          }}
        />

        {/* Creative Studio (Thumbnails, Images, Video Templates, Voices, Cutouts) */}
        <CreativeStudioModal
          isOpen={isCreativeStudioOpen}
          onClose={() => setIsCreativeStudioOpen(false)}
          onLaunchPromptInChat={async (prompt, attachedFile) => {
            setIsCreativeStudioOpen(false);
            if (attachedFile?.preview && attachedFile.isImage) {
              await registerStudioUpload(attachedFile.preview, attachedFile.name, attachedFile.type || 'image/png');
            }
            sendProgrammaticMessage(prompt);
          }}
        />

        {/* Explore Creative Skills Modal (Built-In Skills Only) */}
        <ExploreGptsModal
          isOpen={isExploreGptsOpen}
          onClose={() => setIsExploreGptsOpen(false)}
          activeSkillId={activeSkill?.id}
          onSelectSkill={(skill) => {
            updateSelectedSkill(skill);
            showToast(skill ? `Skill enabled: ${skill.name}` : 'Skill cleared');
          }}
        />

        {/* Minimal Voices Modal */}
        <VoiceSettingsModal
          isOpen={isVoiceSettingsOpen}
          onClose={() => setIsVoiceSettingsOpen(false)}
          onVoiceChanged={() => setActivePersona(getActiveAssistantPersona())}
        />
      </motion.div>
    </AnimatePresence>
  );
};

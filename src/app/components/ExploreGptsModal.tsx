import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Sparkles,
  Code2,
  BookOpen,
  Search,
  Wand2,
  PenTool,
  Globe,
  BarChart3,
  Languages,
  Check,
} from 'lucide-react';

export interface AiSkillItem {
  id: string;
  name: string;
  category: 'Website & UI' | 'Education' | 'Coding' | 'Writing' | 'Data';
  description: string;
  iconName: 'Globe' | 'BookOpen' | 'Code2' | 'Languages' | 'BarChart3' | 'Sparkles' | 'PenTool';
  systemInstructions: string;
  starterPrompt: string;
}

export interface ExploreGptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeModel?: string;
  activeSkillId?: string;
  onSelectSkill?: (skill: AiSkillItem | null) => void;
}

export const BUILT_IN_CREATIVE_SKILLS: AiSkillItem[] = [
  {
    id: 'skill-web-architect',
    name: 'Buildy Prompt & UI Architect',
    category: 'Website & UI',
    description: 'Crafts detailed Buildy UI prompts, section blueprints, and design systems ready to paste into Buildy.',
    iconName: 'Globe',
    systemInstructions:
      'You are a Buildy specification and UI architecture specialist. Remember: this workspace does NOT build HTML/CSS/JS websites directly in chat — always remind the user to open the built-in Buildy workspace (via the Buildy button or sidebar menu) to build any App or Web UI, and provide a comprehensive Buildy prompt plus architecture specs.',
    starterPrompt: 'Write a detailed Buildy prompt for a luxury dark-mode portfolio website.',
  },
  {
    id: 'skill-student-mcqs',
    name: 'Student Exam & MCQ Master',
    category: 'Education',
    description: 'Transforms study notes and chapters into structured MCQs, solved quizzes, tables, and revision sheets.',
    iconName: 'BookOpen',
    systemInstructions:
      'You are a master academic exam planner. Generate high-yield MCQs with 4 distinct options (A, B, C, D), indicate the correct index, provide clear explanations, and organize key formulas cleanly.',
    starterPrompt: 'Create 10 board exam MCQs with explanations for Physics Chapter 1 Electrostatics.',
  },
  {
    id: 'skill-code-auditor',
    name: 'Code Auditor & Multi-Lang Engineer',
    category: 'Coding',
    description: 'Writes, refactors, and audits Python, TypeScript, C++, Java, SQL, and backend architectures.',
    iconName: 'Code2',
    systemInstructions:
      'You are a senior security researcher and principal polyglot engineer. Write clean production code across Python, TypeScript, JavaScript, C++, Java, Go, and SQL, and audit code thoroughly.',
    starterPrompt: 'Write a clean Python & SQL backend service implementation for user analytics.',
  },
  {
    id: 'skill-urdu-polyglot',
    name: 'Roman Urdu & Polyglot Writer',
    category: 'Writing',
    description: 'Naturally writes letters, speeches, poetry, and translations in Roman Urdu and multilingual Roman scripts.',
    iconName: 'Languages',
    systemInstructions:
      'You are an articulate multilingual writer. Reply in Roman Urdu or the Romanized version of the user detected language by default unless native script is specifically asked.',
    starterPrompt: 'Mujhe aik professional job application letter likh kar do Roman Urdu mein.',
  },
  {
    id: 'skill-data-analyst',
    name: 'Data Analyst & Visual Insights',
    category: 'Data',
    description: 'Turns metrics and comparisons into structured Markdown tables and interactive Recharts visualizations.',
    iconName: 'BarChart3',
    systemInstructions:
      'You are a principal data scientist. Compute key aggregations, spot trends, and include both crisp Markdown comparison tables and valid ```chart JSON specifications for Recharts visual charts.',
    starterPrompt: 'Analyze quarterly growth metrics with an interactive chart and executive comparison table.',
  },
  {
    id: 'skill-creative-think',
    name: 'Buildy Workflow & Prompt Planner',
    category: 'Website & UI',
    description: 'Designs complete color roles, typography pairings, and component prompts tailored for Buildy.',
    iconName: 'Sparkles',
    systemInstructions:
      'You are a Buildy workflow strategist. Guide users to open the built-in Buildy workspace from the sidebar menu to construct their Web or App UI while crafting detailed color palette, typography, and component prompts.',
    starterPrompt: 'Write a Buildy UI prompt with palette, typography, and component hierarchy.',
  },
];

export const ExploreGptsModal: React.FC<ExploreGptsModalProps> = ({
  isOpen,
  onClose,
  activeSkillId,
  onSelectSkill,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredSkills = BUILT_IN_CREATIVE_SKILLS.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderSkillIcon = (iconName: string) => {
    switch (iconName) {
      case 'Globe':
        return <Globe size={17} />;
      case 'BookOpen':
        return <BookOpen size={17} />;
      case 'Code2':
        return <Code2 size={17} />;
      case 'Languages':
        return <Languages size={17} />;
      case 'BarChart3':
        return <BarChart3 size={17} />;
      case 'PenTool':
        return <PenTool size={17} />;
      default:
        return <Sparkles size={17} />;
    }
  };

  return (
    <AnimatePresence>
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl max-h-[86vh] rounded-[28px] neu-glass text-foreground border border-border shadow-[var(--shadow-neumorphic)] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3 border-b border-border/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[var(--primary)]/15 text-[var(--primary)] flex items-center justify-center">
                <Wand2 size={18} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-foreground leading-tight">
                  Explore Creative Skills
                </h3>
                <p className="text-xs text-muted-foreground">
                  Enable a built-in skill to highlight and activate it inside your prompt box
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full neu-raise text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
              title="Close modal"
              aria-label="Close modal"
            >
              <X size={16} />
            </button>
          </div>

          {/* Search Box */}
          <div className="px-5 sm:px-6 py-2.5 bg-surface/60 border-b border-border/70 flex items-center gap-2">
            <Search size={15} className="text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search built-in creative skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs text-foreground placeholder:text-muted-foreground bg-transparent focus:outline-none"
            />
          </div>

          {/* Built-in Skills List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5 no-scrollbar">
            {filteredSkills.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">
                No matching built-in skills found.
              </div>
            ) : (
              filteredSkills.map((skill) => {
                const isActive = activeSkillId === skill.id;

                return (
                  <div
                    key={skill.id}
                    onClick={() => {
                      onSelectSkill?.(isActive ? null : skill);
                      onClose();
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-[var(--primary)]/10 border-[var(--primary)] ring-1 ring-[var(--primary)] shadow-sm'
                        : 'neu-raise border-border/80 hover:border-[var(--primary)]/45'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isActive
                            ? 'bg-[var(--primary)] text-white'
                            : 'bg-[var(--primary)]/12 text-[var(--primary)]'
                        }`}
                      >
                        {renderSkillIcon(skill.iconName)}
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground">{skill.name}</span>
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            {skill.category}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
                          {skill.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSkill?.(isActive ? null : skill);
                          onClose();
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[var(--primary)] text-white shadow-sm'
                            : 'neu-raise text-foreground hover:bg-[var(--primary)] hover:text-white'
                        }`}
                      >
                        {isActive ? <Check size={12} strokeWidth={2.5} /> : <Wand2 size={12} />}
                        <span>{isActive ? 'Enabled' : 'Enable Skill'}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-5 sm:px-6 py-3 bg-surface/50 border-t border-border/80 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {activeSkillId
                ? '1 creative skill active in your prompt box'
                : 'Built-in creative skills ready for instant activation'}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl neu-raise text-foreground font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

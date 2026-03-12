// src/pages/Utilities.tsx
// Shell page for utility tools. Add new tools as tabs here.

import { useState } from 'react';
import { Wrench, Link2, Terminal, Bug, ChevronRight } from 'lucide-react';
import { useAppSelector } from '../store/hooks';
import ItemMapping from './utilities/ItemMapping';
import KdsDebugPanel from './utilities/KdsDebugPanel';
import TMBillDebugPanel from '../features/tmbill/components/TmbillDebugPanel';

type Tab = 'item-mapping' | 'kds-debug' | 'tmbill-debug';

interface TabDef {
  id: Tab;
  label: string;
  description: string;
  icon: React.ElementType;
  /** If provided, tab only shows when this returns true */
  visible?: () => boolean;
}

const ALL_TABS: TabDef[] = [
  {
    id: 'item-mapping',
    label: 'Item Mapping',
    description: 'Unify menu items from CocoEats and TMBILL under a single canonical name',
    icon: Link2,
  },
  {
    id: 'kds-debug',
    label: 'KDS Debug',
    description: 'Live log terminal for the multi-screen KDS system — connection status and event log',
    icon: Terminal,
  },
  {
    id: 'tmbill-debug',
    label: 'TMBILL Debug',
    description: 'TMBILL POS integration debug panel — connection, authentication, and event log',
    icon: Bug,
    visible: () => !!window.tmbill,
  },
];

export default function Utilities() {
  const debugMode = useAppSelector((s) => s.ui.settings.debugMode ?? false);
  const [activeTab, setActiveTab] = useState<Tab>('item-mapping');

  // Tabs visible in current mode
  const tabs = ALL_TABS.filter(t => {
    if (t.id === 'item-mapping') return true;
    if (!debugMode) return false;
    return t.visible ? t.visible() : true;
  });

  // If active tab is no longer visible (e.g. debug mode turned off), fall back
  const resolvedTab = tabs.find(t => t.id === activeTab) ? activeTab : 'item-mapping';

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-kds-bg-primary overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-kds-bg-secondary border-b border-slate-200 dark:border-kds-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Wrench className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-800 dark:text-kds-text-primary">Utilities</h1>
            <p className="text-sm text-slate-500 dark:text-kds-text-muted">Configuration tools and data management</p>
          </div>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 mt-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                resolvedTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-kds-text-muted hover:bg-slate-100 dark:hover:bg-kds-surface'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab description banner */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/30 px-6 py-2 flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
        <ChevronRight className="w-4 h-4 shrink-0" />
        {tabs.find(t => t.id === resolvedTab)?.description}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {resolvedTab === 'item-mapping' && <ItemMapping />}
        {resolvedTab === 'kds-debug'    && <KdsDebugPanel />}
        {resolvedTab === 'tmbill-debug' && <TMBillDebugPanel />}
      </div>
    </div>
  );
}

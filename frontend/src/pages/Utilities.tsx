// src/pages/Utilities.tsx
// Shell page for utility tools. Add new tools as tabs here.

import { useState } from 'react';
import { Wrench, Link2, ChevronRight } from 'lucide-react';
import ItemMapping from './utilities/ItemMapping';

type Tab = 'item-mapping';

const TABS: { id: Tab; label: string; description: string }[] = [
  {
    id: 'item-mapping',
    label: 'Item Mapping',
    description: 'Unify menu items from CocoEats and TMBILL under a single canonical name',
  },
];

export default function Utilities() {
  const [activeTab, setActiveTab] = useState<Tab>('item-mapping');

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
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-kds-text-muted hover:bg-slate-100 dark:hover:bg-kds-surface'
              }`}
            >
              <Link2 className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab description banner */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/30 px-6 py-2 flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
        <ChevronRight className="w-4 h-4 shrink-0" />
        {TABS.find(t => t.id === activeTab)?.description}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'item-mapping' && <ItemMapping />}
      </div>
    </div>
  );
}

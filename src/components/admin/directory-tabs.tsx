import { Link } from '@tanstack/react-router';
import { User, Shield, Truck } from 'lucide-react';

interface DirectoryTabsProps {
  activeTab: 'users' | 'staff' | 'riders';
  counts?: {
    users?: number;
    staff?: number;
    riders?: number;
  };
}

export function DirectoryTabs({ activeTab, counts }: DirectoryTabsProps) {
  const tabs = [
    {
      id: 'users',
      label: 'All Users',
      sublabel: 'Customers only',
      to: '/admin/users',
      icon: User,
      activeColor: 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 border-blue-500',
      badgeActive: 'bg-white/20 text-white',
      badgeInactive: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
      count: counts?.users,
    },
    {
      id: 'staff',
      label: 'All Staff',
      sublabel: 'Staff & Admin',
      to: '/admin/staff',
      icon: Shield,
      activeColor: 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 border-emerald-500',
      badgeActive: 'bg-white/20 text-white',
      badgeInactive: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      count: counts?.staff,
    },
    {
      id: 'riders',
      label: 'All Riders',
      sublabel: 'Riders & Drivers',
      to: '/admin/riders',
      icon: Truck,
      activeColor: 'bg-orange-600 text-white shadow-lg shadow-orange-600/20 border-orange-500',
      badgeActive: 'bg-white/20 text-white',
      badgeInactive: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
      count: counts?.riders,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[#0a0f1c] border border-slate-800 rounded-2xl w-full sm:w-fit">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            to={tab.to as any}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
              isActive
                ? tab.activeColor
                : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <div className="flex flex-col text-left">
              <span className="leading-none">{tab.label}</span>
              <span className={`text-[10px] font-normal mt-0.5 leading-none ${isActive ? 'text-white/80' : 'text-slate-500'}`}>
                {tab.sublabel}
              </span>
            </div>
            {typeof tab.count === 'number' && (
              <span
                className={`ml-1 px-2 py-0.5 text-xs font-bold rounded-full ${
                  isActive ? tab.badgeActive : tab.badgeInactive
                }`}
              >
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

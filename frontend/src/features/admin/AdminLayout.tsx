import { NavLink, Outlet } from 'react-router-dom';
import { countOpenReports } from '../../api/reports.api';
import { useApiResource } from '../../hooks/useApiResource';
import { cn } from '../../utils/cn';

export interface AdminOutletContext {
  refreshReportCount: () => void;
}

const SECTIONS = [
  { to: '/admin/groups', label: 'Groups' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/mentor-requests', label: 'Mentor requests' },
  { to: '/admin/reports', label: 'Reports' },
];

export function AdminLayout() {
  const { state, reload } = useApiResource(countOpenReports);
  const openReports = state.phase === 'ready' ? state.data : 0;
  const context: AdminOutletContext = { refreshReportCount: reload };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <nav
        aria-label="Admin sections"
        className="-mx-4 flex overflow-x-auto border-b border-line px-4 pt-4 sm:mx-0 sm:gap-1 sm:px-0"
      >
        {SECTIONS.map((section) => (
          <NavLink
            key={section.to}
            to={section.to}
            className={({ isActive }) =>
              cn(
                '-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-2 pb-3 pt-1 text-sm font-semibold transition-colors sm:px-3',
                isActive
                  ? 'border-pine-600 text-pine-700'
                  : 'border-transparent text-ink-muted hover:text-ink',
              )
            }
          >
            {section.label}
            {section.to === '/admin/reports' && openReports > 0 && (
              <span className="rounded-full bg-clay-500 px-1.5 py-0.5 text-[11px] leading-none text-white">
                {openReports}
                <span className="sr-only"> open</span>
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <Outlet context={context} />
    </div>
  );
}

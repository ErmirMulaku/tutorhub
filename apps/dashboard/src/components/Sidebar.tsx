import type { JSX } from 'react';
import { NavLink } from 'react-router-dom';
import { Avatar } from '@ermulaku/ui';
import { useGetDashboardSummaryQuery, useGetMeTutorQuery } from '../store/api';
import { type NavItem, NAV_GROUPS } from '../app/nav';

export function Sidebar(): JSX.Element {
  const { data: me } = useGetMeTutorQuery();
  const { data: summary } = useGetDashboardSummaryQuery();

  /** Live badge counts that aren't part of the static nav model. */
  const badgeFor = (item: NavItem): { count: number; tone: 'primary' | 'danger' } | undefined => {
    if (item.to === '/lessons' && summary && summary.pendingCount > 0)
      return { count: summary.pendingCount, tone: 'primary' };
    if (item.to === '/messages' && summary && summary.unreadMessages > 0)
      return { count: summary.unreadMessages, tone: 'danger' };
    return item.badge;
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__logo" aria-hidden>
          ◎
        </span>
        <div>
          <div className="sidebar__wordmark">
            Tutor<strong>Hub</strong>
          </div>
          <div className="sidebar__eyebrow">FOR TUTORS</div>
        </div>
      </div>

      <nav className="sidebar__nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="sidebar__group">
            <div className="sidebar__group-label">{group.label}</div>
            {group.items.map((item) => {
              const badge = badgeFor(item);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
                  }
                >
                  <span>{item.label}</span>
                  {badge && (
                    <span className={`sidebar__badge sidebar__badge--${badge.tone}`}>
                      {badge.count}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar__footer">
        <NavLink
          to="/settings"
          className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
        >
          Settings
        </NavLink>
        <NavLink to="/onboarding" className="sidebar__profile">
          <Avatar name={me?.name ?? 'Tutor'} size="sm" />
          <div className="sidebar__profile-text">
            <div className="sidebar__profile-name">{me?.name ?? 'Loading…'}</div>
            <div className="sidebar__profile-meta">Profile 80% complete</div>
          </div>
        </NavLink>
      </div>
    </aside>
  );
}

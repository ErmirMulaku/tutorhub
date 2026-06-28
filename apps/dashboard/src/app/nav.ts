/** Sidebar navigation model. `nav` maps to a route; groups match the design. */
export interface NavItem {
  to: string;
  label: string;
  /** Optional badge: a count + tone (the design shows pending/unread badges). */
  badge?: { count: number; tone: 'primary' | 'danger' };
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/calendar', label: 'Calendar' },
      { to: '/lessons', label: 'Lessons' },
      { to: '/messages', label: 'Messages' },
    ],
  },
  {
    label: 'Business',
    items: [
      { to: '/catalog', label: 'Catalog' },
      { to: '/availability', label: 'Availability' },
      { to: '/earnings', label: 'Earnings' },
      { to: '/marketing', label: 'Marketing' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/reviews', label: 'Reviews' },
      { to: '/analytics', label: 'Analytics' },
    ],
  },
];

/** Page title + subtitle shown in the topbar, keyed by the route path. */
export const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Your practice at a glance' },
  '/calendar': { title: 'Calendar', subtitle: 'Your week of lessons' },
  '/lessons': { title: 'Lessons', subtitle: 'Upcoming, pending and past' },
  '/messages': { title: 'Messages', subtitle: 'Chat with your students' },
  '/catalog': { title: 'Catalog', subtitle: 'Your subjects and packages' },
  '/availability': { title: 'Availability', subtitle: 'When students can book you' },
  '/earnings': { title: 'Earnings', subtitle: 'Balance, payouts and history' },
  '/marketing': { title: 'Marketing', subtitle: 'Promotions and referrals' },
  '/reviews': { title: 'Reviews', subtitle: 'What your students say' },
  '/analytics': { title: 'Analytics', subtitle: 'Trends across your practice' },
  '/settings': { title: 'Settings', subtitle: 'Profile, payout and notifications' },
};

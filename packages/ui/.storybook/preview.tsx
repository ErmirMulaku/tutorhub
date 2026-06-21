import type { Decorator, Preview } from '@storybook/react-vite';
import '../src/styles.css';

/**
 * A global toolbar lets every story flip between LTR/RTL and light/dark, so the
 * RTL mirroring and theming guarantees are visible at a glance.
 */
const withDirAndTheme: Decorator = (Story, context) => {
  const dir = context.globals['direction'] === 'rtl' ? 'rtl' : 'ltr';
  const theme = context.globals['theme'] === 'dark' ? 'dark' : 'light';
  return (
    <div
      dir={dir}
      data-theme={theme}
      style={{
        background: 'var(--th-bg)',
        color: 'var(--th-text)',
        padding: '2rem',
        minHeight: '100vh',
        fontFamily: 'var(--th-font)',
      }}
    >
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [withDirAndTheme],
  globalTypes: {
    direction: {
      description: 'Text direction',
      defaultValue: 'ltr',
      toolbar: {
        title: 'Direction',
        icon: 'transfer',
        items: [
          { value: 'ltr', title: 'LTR' },
          { value: 'rtl', title: 'RTL' },
        ],
        dynamicTitle: true,
      },
    },
    theme: {
      description: 'Color theme',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
};

export default preview;

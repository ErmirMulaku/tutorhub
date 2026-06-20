// SVGs are imported as React components via @svgr/webpack.
declare module '*.svg' {
  import type { FC, SVGProps } from 'react';
  const ReactComponent: FC<SVGProps<SVGSVGElement>>;
  export default ReactComponent;
}

// CSS is handled by css-loader / MiniCssExtractPlugin; imported for side effects.
declare module '*.css';

// Injected at build time by Webpack's DefinePlugin.
declare const process: { env: Record<string, string | undefined> };

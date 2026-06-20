import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import webpack from 'webpack';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';

const root = dirname(fileURLToPath(import.meta.url));

// Hand-written Webpack 5 config (SPEC §10): TS/JSX via Babel, CSS, SVGR,
// code-splitting, env injection (DefinePlugin), and an opt-in bundle analyzer.
export default (_env, argv) => {
  const isProd = argv.mode === 'production';
  const analyze = process.env.ANALYZE === 'true';

  return {
    entry: resolve(root, 'src/main.tsx'),
    output: {
      path: resolve(root, 'dist'),
      filename: isProd ? '[name].[contenthash].js' : '[name].js',
      publicPath: '/',
      clean: true,
    },
    resolve: { extensions: ['.tsx', '.ts', '.jsx', '.js'] },
    devtool: isProd ? 'source-map' : 'eval-source-map',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'ts-loader',
            // Type-checking is a separate `tsc --noEmit` target; transpile fast here.
            options: { transpileOnly: true, compilerOptions: { noEmit: false } },
          },
        },
        {
          test: /\.css$/,
          use: [isProd ? MiniCssExtractPlugin.loader : 'style-loader', 'css-loader'],
        },
        { test: /\.svg$/, use: ['@svgr/webpack'] },
      ],
    },
    optimization: {
      splitChunks: { chunks: 'all' },
      runtimeChunk: 'single',
    },
    // Vendor (react-dom) exceeds the default budget; size is tracked via the analyzer.
    performance: { hints: false },
    plugins: [
      new HtmlWebpackPlugin({ template: resolve(root, 'src/index.html') }),
      new webpack.DefinePlugin({
        'process.env.API_URL': JSON.stringify(process.env.API_URL ?? 'http://localhost:4000'),
      }),
      ...(isProd ? [new MiniCssExtractPlugin({ filename: '[name].[contenthash].css' })] : []),
      ...(analyze
        ? [new BundleAnalyzerPlugin({ analyzerMode: 'static', openAnalyzer: false })]
        : []),
    ],
    devServer: {
      port: 3100,
      historyApiFallback: true,
      hot: true,
    },
  };
};

---
sidebarDepth: 0
---

# Overview

::: warning
このドキュメントは `@vue/cli` のものです。古い `vue-cli` については、 [こちら](https://github.com/vuejs/vue-cli/tree/v2#vue-cli--) をご覧ください。
:::

Vue CLI は、迅速な Vue.js 開発のためのフルシステムであり、以下を提供します。

- `@vue/cli` からインタラクティブなプロジェクト生成を行います。
- `@vue/cli` + `@vue/cli-service-global` からゼロコンフィグでラピッドプロトタイピングを実行します。
- ランタイム( `@vue/cli-service` ) の依存関係
  - アップグレード可能です。
  - 実用的なデフォルト設定を備えた webpack の上に構築されます。
  - プロジェクト内の設定ファイルで設定します。
  - プラグイン経由で拡張可能です。
- フロントエンドエコシステムで最高のツールを統合する公式プラグインが豊富に集約されています。
- Vue.js プロジェクトを作成および管理するための完全なグラフィカルユーザーインターフェイスがあります。

Vue CLI は、Vue エコシステムの標準的なベースラインツールを目指しています。 これにより、さまざまなビルドツールが適切なデフォルトとスムーズに連携して動作するようになり、構成に悩むことなく、アプリの開発に集中できます。 同時に、イジェクトする必要なしに各ツールの構成を変更できる柔軟性を提供します。

## システム構成

Vue CLI にはいくつかの未確定要素があります。[ソースコード](https://github.com/vuejs/vue-cli/tree/dev/packages/%40vue)を見ると、個別に公開された多数のパッケージを含むモノレポであることが分かります。

### CLI

CLI (`@vue/cli`) はグローバルにインストールされた npm パッケージであり、ターミナルで `vue` コマンドを提供します。`vue create` は新しいプロジェクトを迅速に構築する機能、また `vue serve` は即座に新しいアイデアをプロトタイプ化する機能を提供します。`vue ui` はグラフィカルユーザーインターフェイスを使用してプロジェクトを管理することもできます。このガイドのいくつかのセクションで出来ることを説明します。

### CLI サービス

CLI サービス (`@vue/cli-service`) は開発に依存するパッケージです。これは、`@vue/cli` によって作成された全てのプロジェクトにローカルインストールされる npm パッケージです。

The CLI Service is built on top of [webpack](http://webpack.js.org/) and [webpack-dev-server](https://github.com/webpack/webpack-dev-server). It contains:

- The core service that loads other CLI Plugins;
- An internal webpack config that is optimized for most apps;
- The `vue-cli-service` binary inside the project, which comes with the basic `serve`, `build` and `inspect` commands.

If you are familiar with [create-react-app](https://github.com/facebookincubator/create-react-app), `@vue/cli-service` is roughly the equivalent of `react-scripts`, although the feature set is different.

The section on [CLI Service](./cli-service.md) covers its detailed usage.

### CLI Plugins

CLI Plugins are npm packages that provide optional features to your Vue CLI projects, such as Babel/TypeScript transpilation, ESLint integration, unit testing, and end-to-end testing. It's easy to spot a Vue CLI plugin as their names start with either `@vue/cli-plugin-` (for built-in plugins) or `vue-cli-plugin-` (for community plugins).

When you run the `vue-cli-service` binary inside your project, it automatically resolves and loads all CLI Plugins listed in your project's `package.json`.

Plugins can be included as part of your project creation process or added into the project later. They can also be grouped into reusable presets. We will discuss these in more depth in the [Plugins and Presets](./plugins-and-presets.md) section.

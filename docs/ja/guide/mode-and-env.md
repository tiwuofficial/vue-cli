# モードと環境変数

## モード

**モード** は Vue CLI プロジェクトで重要な概念です。デフォルトでは3つのモードがあります:

- `development` は `vue-cli-service serve` によって使用されます
- `test` は `vue-cli-service test:unit` によって使用されます
- `production` は `vue-cli-service build` と `vue-cli-service test:e2e` によって使用されます

`--mode` オプションフラグを渡すことで、コマンドで使用されるデフォルトのモードを上書きできます。例えば、 ビルドコマンドで development モードを利用したい場合:

```
vue-cli-service build --mode development
```

`vue-cli-service` を実行すると、環境変数は全ての [モードに対応するファイル](#environment-variables) から環境変数が読み込まれます。それらに `NODE_ENV` 変数が含まれていない場合、モードに応じて設定されます。例えば、 production モードでは `"production"` に設定され、 test モードでは `"test"` に設定され、それ以外の場合はデフォルトで `"development"` に設定されます。

次に、 `NODE_ENV` は実行されているアプリのモード（ development , production もしくは test ）を決定し、その結果、どの種類の webpack 設定が作成されるかを決定します。

例えば、 `NODE_ENV` が「 test 」に設定されている場合、  Vue CLI は、単体テスト用に使用および最適化することを目的とした webpack 設定を作成します。

同様に、 `NODE_ENV=development` は、HMR を有効にした webpack 設定を作成し、開発サーバーの実行時に高速に再ビルドを可能にするために、アセットのハッシュ化や vendor のバンドルを作成したりしません。

`vue-cli-service build` を実行しているとき、デプロイ先の環境にかかわらず、デプロイ可能なアプリを取得するために、 `NODE_ENV` を常に「 production 」に設定すべきです。

::: warning NODE_ENV
実行環境にデフォルトの `NODE_ENV` がある場合は、それを削除するか、 `vue-cli-service` コマンドの実行時に `NODE_ENV` を明示的に設定する必要があります。
:::

## 環境変数

プロジェクトルートに以下のファイルを配置することで、環境変数を指定できます。:

``` bash
.env                # 全ての場合に読み込まれます
.env.local          # 全ての場合に読み込まれ、 git に無視されます
.env.[mode]         # 指定されたモードの場合のみ読み込まれます
.env.[mode].local   # 指定されたモードの場合のみ読み込まれ、 git に無視されます
```

env ファイルには、環境変数の単なる key=value ペアが含まれています。:

```
FOO=bar
VUE_APP_SECRET=secret
```

`VUE_APP_` で始まる変数のみが `webpack.DefinePlugin` でクライアントのバンドルに静的に埋め込まれることに注意してください。

より詳細な env 解析ルールについては、 [ `dotenv` のドキュメント](https://github.com/motdotla/dotenv#rules) を参照してください。また、変数展開に [dotenv-expand](https://github.com/motdotla/dotenv-expand) を使用します。（ Vue CLI 3.5 以降で使用可能）

読み込まれた変数は、全ての `vue-cli-service` コマンド、プラグイン、依存関係で利用可能になります。

::: tip 環境読み込みの優先順位

特定のモード（例: `.env.production` ）の env ファイルは、一般的なモード（例: ` .env` ）よりも高い優先度を持ちます。

さらに、Vue CLI の実行時に既に存在する環境変数は最も高い優先度を持ち、 `.env` ファイルによって上書きされません。

`.env` ファイルは `vue-cli-service` の開始時にロードされます。 変更後、サービスを再起動します。
:::

### 例: staging モード

以下のような `.env` ファイルを持つアプリがあると仮定します。:

```
VUE_APP_TITLE=My App
```

さらに、以下のような `.env.staging` も持ちます。:

```
NODE_ENV=production
VUE_APP_TITLE=My App (staging)
```

- `vue-cli-service build` は、 本番用のアプリをビルドし、 `.env` 、 `.env.production` 、 `.env.production.local` が存在する場合にこれらを読み込みます。

- `vue-cli-service build --mode staging` は、staging モードで本番アプリをビルドし、`.env` 、 `.env.staging` 、 `.env.staging.local` が存在する場合にこれらを読み込みます。

どちらの場合にも、 `NODE_ENV` の設定により、本番用のアプリとしてビルドされますが、 staging モードでは、 `process.env.VUE_APP_TITLE` が別の値で上書きされます。

### クライアントサイドコードでの環境変数の利用

アプリケーションコードでは、 env 変数にアクセスできます。:

``` js
console.log(process.env.VUE_APP_SECRET)
```

ビルド中、 `process.env.VUE_APP_SECRET` は、対応する値に置き換えられます。 `VUE_APP_SECRET=secret` の場合、これは `"secret"` に置き換えられます。

`VUE_APP_*` 変数に加えて、アプリケーションコードで利用できる2つの特別な変数も存在します。:

- `NODE_ENV` - アプリが実行されている [モード](#modes) に応じて、 `"development"` 、 `"production"` 、 `"test"` のいずれかになります。
- `BASE_URL` - `vue.config.js` の `publicPath` オプションに対応し、アプリがデプロイされる場所のベースパスです。

All resolved env variables will be available inside `public/index.html` as discussed in [HTML - 補間](./html-and-static-assets.md#interpolation).

[HTML - 補間](./html-and-static-assets.md#interpolation) で説明されているように、全ての解決された環境変数は、 `public/index.html` 内で利用可能になります。

::: tip
`vue.config.js` ファイルで環境変数の演算ができます。それには、 `VUE_APP_` のプレフィックスをつける必要があります。これは、バージョン情報の設定に役立ちます。:

```js
process.env.VUE_APP_VERSION = require('./package.json').version

module.exports = {
  // config
}
```
:::

### Local Only Variables

Sometimes you might have env variables that should not be committed into the codebase, especially if your project is hosted in a public repository. In that case you should use an `.env.local` file instead. Local env files are ignored in `.gitignore` by default.

`.local` can also be appended to mode-specific env files, for example `.env.development.local` will be loaded during development, and is ignored by git.

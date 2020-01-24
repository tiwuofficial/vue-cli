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

Then `NODE_ENV` will determine the primary mode your app is running in - development, production or test - and consequently, what kind of webpack config will be created.

With `NODE_ENV` set to "test" for example, Vue CLI creates a webpack config that is intended to be used and optimized for unit tests. It doesn't process images and other assets that are unnecessary for unit tests.

Similarly, `NODE_ENV=development` creates a webpack configuration which enables HMR, doesn't hash assets or create vendor bundles in order to allow for fast re-builds when running a dev server.

When you are running `vue-cli-service build`, your `NODE_ENV` should always be set to "production" to obtain an app ready for deployment, regardless of the environment you're deploying to.

::: warning NODE_ENV
あなたの実行環境にデフォルトの `NODE_ENV` がある場合は、それを削除するか、` vue-cli-service` コマンドの実行時に `NODE_ENV` を明示的に設定する必要があります。
:::

## Environment Variables

You can specify env variables by placing the following files in your project root:

``` bash
.env                # loaded in all cases
.env.local          # loaded in all cases, ignored by git
.env.[mode]         # only loaded in specified mode
.env.[mode].local   # only loaded in specified mode, ignored by git
```

An env file simply contains key=value pairs of environment variables:

```
FOO=bar
VUE_APP_SECRET=secret
```

Note that only variables that start with `VUE_APP_` will be statically embedded into the client bundle with `webpack.DefinePlugin`.

For more detailed env parsing rules, please refer to [the documentation of `dotenv`](https://github.com/motdotla/dotenv#rules). We also use [dotenv-expand](https://github.com/motdotla/dotenv-expand) for variable expansion (available in Vue CLI 3.5+).

Loaded variables will become available to all `vue-cli-service` commands, plugins and dependencies.

::: tip Env Loading Priorities

An env file for a specific mode (e.g. `.env.production`) will take higher priority than a generic one (e.g. `.env`).

In addition, environment variables that already exist when Vue CLI is executed have the highest priority and will not be overwritten by `.env` files.

`.env` files are loaded at the start of `vue-cli-service`. Restart the service after making changes.
:::

### Example: Staging Mode

Assuming we have an app with the following `.env` file:

```
VUE_APP_TITLE=My App
```

And the following `.env.staging` file:

```
NODE_ENV=production
VUE_APP_TITLE=My App (staging)
```

- `vue-cli-service build` builds a production app, loading `.env`, `.env.production` and `.env.production.local` if they are present;

- `vue-cli-service build --mode staging` builds a production app in staging mode, using `.env`, `.env.staging` and `.env.staging.local` if they are present.

In both cases, the app is built as a production app because of the `NODE_ENV`, but in the staging version, `process.env.VUE_APP_TITLE` is overwritten with a different value.

### Using Env Variables in Client-side Code

You can access env variables in your application code:

``` js
console.log(process.env.VUE_APP_SECRET)
```

During build, `process.env.VUE_APP_SECRET` will be replaced by the corresponding value. In the case of `VUE_APP_SECRET=secret`, it will be replaced by `"secret"`.

In addition to `VUE_APP_*` variables, there are also two special variables that will always be available in your app code:

- `NODE_ENV` - this will be one of `"development"`, `"production"` or `"test"` depending on the [mode](#modes) the app is running in.
- `BASE_URL` - this corresponds to the `publicPath` option in `vue.config.js` and is the base path your app is deployed at.

All resolved env variables will be available inside `public/index.html` as discussed in [HTML - Interpolation](./html-and-static-assets.md#interpolation).

::: tip
You can have computed env vars in your `vue.config.js` file. They still need to be prefixed with `VUE_APP_`. This is useful for version info

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

const fs = require('fs')
const ejs = require('ejs')
const path = require('path')
const merge = require('deepmerge')
const resolve = require('resolve')
const { isBinaryFileSync } = require('isbinaryfile')
const semver = require('semver')
const mergeDeps = require('./util/mergeDeps')
const runCodemod = require('./util/runCodemod')
const stringifyJS = require('./util/stringifyJS')
const ConfigTransform = require('./ConfigTransform')
const { getPluginLink, toShortPluginId, loadModule } = require('@vue/cli-shared-utils')

const isString = val => typeof val === 'string'
const isFunction = val => typeof val === 'function'
const isObject = val => val && typeof val === 'object'
const mergeArrayWithDedupe = (a, b) => Array.from(new Set([...a, ...b]))

class GeneratorAPI {
  /**
   * @param {string} id - Id of the owner plugin
   * @param {Generator} generator - The invoking Generator instance
   * @param {object} options - generator options passed to this plugin
   * @param {object} rootOptions - root options (the entire preset)
   */
  constructor (id, generator, options, rootOptions) {
    this.id = id
    this.generator = generator
    this.options = options
    this.rootOptions = rootOptions

    this.pluginsData = generator.plugins
      .filter(({ id }) => id !== `@vue/cli-service`)
      .map(({ id }) => ({
        name: toShortPluginId(id),
        link: getPluginLink(id)
      }))

    this._entryFile = undefined
  }

  /**
   * Resolves the data when rendering templates.
   *
   * @private
   */
  _resolveData (additionalData) {
    return Object.assign({
      options: this.options,
      rootOptions: this.rootOptions,
      plugins: this.pluginsData
    }, additionalData)
  }

  /**
   * Inject a file processing middleware.
   *
   * @private
   * @param {FileMiddleware} middleware - A middleware function that receives the
   *   virtual files tree object, and an ejs render function. Can be async.
   */
  _injectFileMiddleware (middleware) {
    this.generator.fileMiddlewares.push(middleware)
  }

  /**
   * Resolve path for a project.
   *
   * @param {string} _path - Relative path from project root
   * @return {string} The resolved absolute path.
   */
  resolve (_path) {
    return path.resolve(this.generator.context, _path)
  }

  get cliVersion () {
    return require('../package.json').version
  }

  assertCliVersion (range) {
    if (typeof range === 'number') {
      if (!Number.isInteger(range)) {
        throw new Error('Expected string or integer value.')
      }
      range = `^${range}.0.0-0`
    }
    if (typeof range !== 'string') {
      throw new Error('Expected string or integer value.')
    }

    if (semver.satisfies(this.cliVersion, range)) return

    throw new Error(
      `Require global @vue/cli "${range}", but was invoked by "${this.cliVersion}".`
    )
  }

  get cliServiceVersion () {
    const servicePkg = loadModule(
      '@vue/cli-service/package.json',
      this.generator.context
    )

    return servicePkg.version
  }

  assertCliServiceVersion (range) {
    if (typeof range === 'number') {
      if (!Number.isInteger(range)) {
        throw new Error('Expected string or integer value.')
      }
      range = `^${range}.0.0-0`
    }
    if (typeof range !== 'string') {
      throw new Error('Expected string or integer value.')
    }

    if (semver.satisfies(this.cliServiceVersion, range)) return

    throw new Error(
      `Require @vue/cli-service "${range}", but was loaded with "${this.cliServiceVersion}".`
    )
  }

  /**
   * Check if the project has a given plugin.
   *
   * @param {string} id - Plugin id, can omit the (@vue/|vue-|@scope/vue)-cli-plugin- prefix
   * @return {boolean}
   */
  hasPlugin (id) {
    return this.generator.hasPlugin(id)
  }

  /**
   * Configure how config files are extracted.
   *
   * @param {string} key - Config key in package.json
   * @param {object} options - Options
   * @param {object} options.file - File descriptor
   * Used to search for existing file.
   * Each key is a file type (possible values: ['js', 'json', 'yaml', 'lines']).
   * The value is a list of filenames.
   * Example:
   * {
   *   js: ['.eslintrc.js'],
   *   json: ['.eslintrc.json', '.eslintrc']
   * }
   * By default, the first filename will be used to create the config file.
   */
  addConfigTransform (key, options) {
    const hasReserved = Object.keys(this.generator.reservedConfigTransforms).includes(key)
    if (
      hasReserved ||
      !options ||
      !options.file
    ) {
      if (hasReserved) {
        const { warn } = require('@vue/cli-shared-utils')
        warn(`Reserved config transform '${key}'`)
      }
      return
    }

    this.generator.configTransforms[key] = new ConfigTransform(options)
  }

  /**
   * Extend the package.json of the project.
   * Nested fields are deep-merged unless `{ merge: false }` is passed.
   * Also resolves dependency conflicts between plugins.
   * Tool configuration fields may be extracted into standalone files before
   * files are written to disk.
   *
   * @param {object | () => object} fields - Fields to merge.
   * @param {boolean} forceNewVersion - Ignore version conflicts when updating dependency version
   */
  extendPackage (fields, forceNewVersion) {
    const pkg = this.generator.pkg
    const toMerge = isFunction(fields) ? fields(pkg) : fields
    for (const key in toMerge) {
      const value = toMerge[key]
      const existing = pkg[key]
      if (isObject(value) && (key === 'dependencies' || key === 'devDependencies')) {
        // use special version resolution merge
        pkg[key] = mergeDeps(
          this.id,
          existing || {},
          value,
          this.generator.depSources,
          forceNewVersion
        )
      } else if (!(key in pkg)) {
        pkg[key] = value
      } else if (Array.isArray(value) && Array.isArray(existing)) {
        pkg[key] = mergeArrayWithDedupe(existing, value)
      } else if (isObject(value) && isObject(existing)) {
        pkg[key] = merge(existing, value, { arrayMerge: mergeArrayWithDedupe })
      } else {
        pkg[key] = value
      }
    }
  }

  /**
   * Render template files into the virtual files tree object.
   *
   * @param {string | object | FileMiddleware} source -
   *   Can be one of:
   *   - relative path to a directory;
   *   - Object hash of { sourceTemplate: targetFile } mappings;
   *   - a custom file middleware function.
   * @param {object} [additionalData] - additional data available to templates.
   * @param {object} [ejsOptions] - options for ejs.
   */
  render (source, additionalData = {}, ejsOptions = {}) {
    const baseDir = extractCallDir()
    if (isString(source)) {
      source = path.resolve(baseDir, source)
      this._injectFileMiddleware(async (files) => {
        const data = this._resolveData(additionalData)
        const globby = require('globby')
        const _files = await globby(['**/*'], { cwd: source })
        for (const rawPath of _files) {
          const targetPath = rawPath.split('/').map(filename => {
            // dotfiles are ignored when published to npm, therefore in templates
            // we need to use underscore instead (e.g. "_gitignore")
            if (filename.charAt(0) === '_' && filename.charAt(1) !== '_') {
              return `.${filename.slice(1)}`
            }
            if (filename.charAt(0) === '_' && filename.charAt(1) === '_') {
              return `${filename.slice(1)}`
            }
            return filename
          }).join('/')
          const sourcePath = path.resolve(source, rawPath)
          const content = renderFile(sourcePath, data, ejsOptions)
          // only set file if it's not all whitespace, or is a Buffer (binary files)
          if (Buffer.isBuffer(content) || /[^\s]/.test(content)) {
            files[targetPath] = content
          }
        }
      })
    } else if (isObject(source)) {
      this._injectFileMiddleware(files => {
        const data = this._resolveData(additionalData)
        for (const targetPath in source) {
          const sourcePath = path.resolve(baseDir, source[targetPath])
          const content = renderFile(sourcePath, data, ejsOptions)
          if (Buffer.isBuffer(content) || content.trim()) {
            files[targetPath] = content
          }
        }
      })
    } else if (isFunction(source)) {
      this._injectFileMiddleware(source)
    }
  }

  /**
   * Push a file middleware that will be applied after all normal file
   * middelwares have been applied.
   *
   * @param {FileMiddleware} cb
   */
  postProcessFiles (cb) {
    this.generator.postProcessFilesCbs.push(cb)
  }

  /**
   * Push a callback to be called when the files have been written to disk.
   *
   * @param {function} cb
   */
  onCreateComplete (cb) {
    this.generator.completeCbs.push(cb)
  }

  /**
   * Add a message to be printed when the generator exits (after any other standard messages).
   *
   * @param {} msg String or value to print after the generation is completed
   * @param {('log'|'info'|'done'|'warn'|'error')} [type='log'] Type of message
   */
  exitLog (msg, type = 'log') {
    this.generator.exitLogs.push({ id: this.id, msg, type })
  }

  /**
   * convenience method for generating a js config file from json
   */
  genJSConfig (value) {
    return `module.exports = ${stringifyJS(value, null, 2)}`
  }

  /**
   * Turns a string expression into executable JS for JS configs.
   * @param {*} str JS expression as a string
   */
  makeJSOnlyValue (str) {
    const fn = () => {}
    fn.__expression = str
    return fn
  }

  /**
   * Run codemod on a script file or the script part of a .vue file
   * @param {string} file the path to the file to transform
   * @param {Codemod} codemod the codemod module to run
   * @param {object} options additional options for the codemod
   */
  transformScript (file, codemod, options) {
    this._injectFileMiddleware(files => {
      files[file] = runCodemod(
        codemod,
        { path: this.resolve(file), source: files[file] },
        options
      )
    })
  }

  /**
   * Add import statements to a file.
   */
  injectImports (file, imports) {
    const _imports = (
      this.generator.imports[file] ||
      (this.generator.imports[file] = new Set())
    )
    ;(Array.isArray(imports) ? imports : [imports]).forEach(imp => {
      _imports.add(imp)
    })
  }

  /**
   * Add options to the root Vue instance (detected by `new Vue`).
   */
  injectRootOptions (file, options) {
    const _options = (
      this.generator.rootOptions[file] ||
      (this.generator.rootOptions[file] = new Set())
    )
    ;(Array.isArray(options) ? options : [options]).forEach(opt => {
      _options.add(opt)
    })
  }

  /**
   * Get the entry file taking into account typescript.
   *
   * @readonly
   */
  get entryFile () {
    if (this._entryFile) return this._entryFile
    return (this._entryFile = fs.existsSync(this.resolve('src/main.ts')) ? 'src/main.ts' : 'src/main.js')
  }

  /**
   * Is the plugin being invoked?
   *
   * @readonly
   */
  get invoking () {
    return this.generator.invoking
  }
}

function extractCallDir () {
  // extract api.render() callsite file location using error stack
  const obj = {}
  Error.captureStackTrace(obj)
  const callSite = obj.stack.split('\n')[3]
  const fileName = callSite.match(/\s\((.*):\d+:\d+\)$/)[1]
  return path.dirname(fileName)
}

const replaceBlockRE = /<%# REPLACE %>([^]*?)<%# END_REPLACE %>/g

function renderFile (name, data, ejsOptions) {
  if (isBinaryFileSync(name)) {
    return fs.readFileSync(name) // return buffer
  }
  const template = fs.readFileSync(name, 'utf-8')

  // custom template inheritance via yaml front matter.
  // ---
  // extend: 'source-file'
  // replace: !!js/regexp /some-regex/
  // OR
  // replace:
  //   - !!js/regexp /foo/
  //   - !!js/regexp /bar/
  // ---
  const yaml = require('yaml-front-matter')
  const parsed = yaml.loadFront(template)
  const content = parsed.__content
  let finalTemplate = content.trim() + `\n`
  if (parsed.extend) {
    const extendPath = path.isAbsolute(parsed.extend)
      ? parsed.extend
      : resolve.sync(parsed.extend, { basedir: path.dirname(name) })
    finalTemplate = fs.readFileSync(extendPath, 'utf-8')
    if (parsed.replace) {
      if (Array.isArray(parsed.replace)) {
        const replaceMatch = content.match(replaceBlockRE)
        if (replaceMatch) {
          const replaces = replaceMatch.map(m => {
            return m.replace(replaceBlockRE, '$1').trim()
          })
          parsed.replace.forEach((r, i) => {
            finalTemplate = finalTemplate.replace(r, replaces[i])
          })
        }
      } else {
        finalTemplate = finalTemplate.replace(parsed.replace, content.trim())
      }
    }
    if (parsed.when) {
      finalTemplate = (
        `<%_ if (${parsed.when}) { _%>` +
          finalTemplate +
        `<%_ } _%>`
      )
    }
  }

  return ejs.render(finalTemplate, data, ejsOptions)
}

module.exports = GeneratorAPI

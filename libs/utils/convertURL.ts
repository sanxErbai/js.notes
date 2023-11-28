import { match, pathToRegexp, compile } from 'path-to-regexp'
import type { Key, RegexpToFunctionOptions, TokensToFunctionOptions } from 'path-to-regexp'

export type ConvertURL = URL | string

export const genURL = (url?: ConvertURL) => {
  if (typeof url === 'string') {
    const { origin, protocol } = window.location

    let resolvedUrl = url

    if (/^\/(?!\/).*$/.test(url)) {
      resolvedUrl = `${origin}${url}`
    } else if (/^\/\/.*$/.test(url)) {
      resolvedUrl = `${protocol}${url}`
    }

    try {
      return new URL(resolvedUrl)
    } catch (error) {
      return null
    }
  }

  return url || null
}

export interface ConvertOptions extends Pick<RegexpToFunctionOptions & TokensToFunctionOptions, 'encode' | 'decode'> {
  modifier?: RegExp
}

export interface ConvertConfigOptions extends ConvertOptions {
  url?: ConvertURL
}

const extractURLVariables = (config: URL, base: URL, options: ConvertOptions) => {
  const pathMatched = match(config.pathname, { decode: options.decode })(base.pathname)

  if (pathMatched) {
    const variables = pathMatched.params as Record<string, string | string[]> || {}

    config.searchParams.forEach((value, key) => {
      if (!variables[key] && options.modifier!.test(value)) {
        const searchValues = base.searchParams.getAll(key)

        if (searchValues.length) {
          variables[value.replace(options.modifier!, '')] = searchValues
        }
      }
    })

    return variables
  }

  return null
}

const resolveConfigURL = (config: URL, variables: Record<string, string | string[]>, options: ConvertOptions) => {
  const pathKeys: Key[] = []

  pathToRegexp(config.pathname, pathKeys)

  // 如果有链接上定义的通配字段值为空，则判定为匹配失败
  if (pathKeys.some(key => !variables[key.name])) {
    return null
  }

  const { searchParams } = config

  config.pathname = compile(config.pathname, { encode: options.encode })(variables)

  searchParams.forEach((value, key) => {
    if (options.modifier!.test(value)) {
      const variable = variables[value.replace(options.modifier!, '')]

      searchParams.delete(key)

      if (variable) {
        const variableArr = Array.isArray(variable) ? variable : [variable]

        variableArr.forEach(item => {
          searchParams.append(key, item)
        })
      }
    }
  })

  return config
}

export const CONVERT_DEFAULT_MODIFIER = /^:(?=.+$)/

export const fillConfigURL = (config: ConvertURL, variables: Record<string, string | string[]> = {}, options: ConvertOptions = {}) => {
  const {
    modifier = CONVERT_DEFAULT_MODIFIER,
    encode = encodeURIComponent,
  } = options

  const configURL = genURL(config)

  if (configURL) {
    return resolveConfigURL(configURL, variables, {
      modifier,
      encode,
    })
  }

  return null
}

const convertURL = (base: ConvertURL, from: ConvertURL, to: ConvertURL, options: ConvertOptions = {}) => {
  const {
    modifier = CONVERT_DEFAULT_MODIFIER,
    encode = encodeURIComponent,
    decode = decodeURIComponent,
  } = options

  const baseURL = genURL(base)
  const fromURL = genURL(from)
  const toURL = genURL(to)
  if (baseURL && fromURL && toURL) {
    const fromVariables = extractURLVariables(fromURL, baseURL, {
      modifier,
      decode,
    })

    if (fromVariables) {
      const resolvedToURL = resolveConfigURL(toURL, fromVariables, {
        modifier,
        encode,
      })

      return resolvedToURL
    }
  }

  return null
}

function convertConfigURL<T, P>(config: T[], handle: (item: T, convert: (from: ConvertURL, to: ConvertURL) => URL | null) => P, options?: ConvertConfigOptions): NonNullable<P> | false
function convertConfigURL<T, P>(config: Promise<T[]>, handle: (item: T, convert: (from: ConvertURL, to: ConvertURL) => URL | null) => P, options?: ConvertConfigOptions): Promise<NonNullable<P> | false>
function convertConfigURL<T, P>(config: T[] | Promise<T[]>, handle: (item: T, convert: (from: ConvertURL, to: ConvertURL) => URL | null) => P, options: ConvertConfigOptions = {}) {
  if (Array.isArray(config)) {
    const {
      url = window.location.href,
      ...others
    } = options
    const baseURL = genURL(url)

    if (baseURL) {
      const convert = (from: ConvertURL, to: ConvertURL) => convertURL(baseURL, from, to, others)

      let index = 0
      while (index < config.length) {
        const result = handle(config[index], convert)

        if (result) {
          return result
        }

        index += 1
      }
    }

    return false
  }

  return Promise.resolve(config).then(res => convertConfigURL(res, handle, options))
}

export { convertConfigURL }

export default convertURL

// export const convertURLExample = () => {
//   const mocks = [
//     {
//       pc: '/outer/induction/collection',
//       mobile: '/m/outer/induction/collection',
//     },
//     {
//       pc: '/outer/induction/collection?token=:token',
//       mobile: '/m/outer/induction/collection?token=:token',
//     },
//     {
//       pc: '/applicant-view/:talentId/:interviewId/resume',
//       mobile: '/m/recruit/view/:interviewId?talentId=:talentId',
//     },
//     {
//       pc: '/appraisal/task/probation/:userTaskId/relative?surroundIds=:surroundIds&from=pc&name=:title',
//       mobile: '/performance/positive/:userTaskId/probation?surroundIds=:surroundIds&from=mobile&title=:title',
//     },
//   ]

//   convertConfigURL(
//     mocks,
//     (item, convert) => {
//       const result = convert(item.pc, item.mobile)

//       if (result) {
//         console.log('========debug========:', result)
//       }

//       return result
//     },
//     { url: '/appraisal/task/probation/2123245/relative/ddddd?surroundIds=1111&surroundIds=2222&surroundIds=3333&name=我的转正' },
//   )
// }

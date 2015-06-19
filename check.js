var go = require('go-async')

exports.ok = function(obj, check) {
  var errors = []
  var log = new Log(errors); log.throwImmediately = true

  return go(function*() {
    try {
      return yield check(obj, log)
    } catch(e) {
      if (e !== stopValidationException)
        throw e
      return mix(new Error, errors[0])
    }
  })
}

function mix(t, s) {
  for(var key in s) {
    t[key] = s[key]
  }
  return t
}

exports.all = function(obj, check) {
  var errors = []
  var log = new Log(errors)

  return go(function*() {
    obj = yield check(obj, log)
    if (errors.length == 0) return obj
    var err = new Error('Validation errors')
    err.errors = errors
    return err
  })
}

exports.compile = compile

function compile(spec, validators) {
  validators = validators || exports.validators
  var checks = {}
  var nullable = spec.nullable
  var def = spec.def

  for(var key in spec) {
    if (key == 'nullable' || key == 'def') continue
    if (!validators[key]) throw new Error('Unknown validator ' + key)
    checks[key] = validators[key](spec[key], validators)
  }

  return function(obj, log) {
    if (obj == null) {
      if (nullable) return obj
      if (def != null) return def
      log.error("Can't be null")
      return
    }
    return go(function*() {
      try {
        for(var key in checks) {
          obj = yield checks[key](obj, log)
          if (log.seenErrors) return obj
        }
      } finally {
        log.seenErrors = false
      }
      return obj
    })
  }
}

var stopValidationException = exports.stopValidationException = new Error('Validation error')

function Log(parent, path) {
  this.parent = parent
  this.path = path || ''
  this.throwImmediately = false
  this.seenErrors = false
}

Log.prototype.error = function(msg, data) {
  data = data || {}
  data.message = msg
  data.path = data.path || ''
  this.push(data)
  if (this.throwImmediately) throw stopValidationException
}

Log.prototype.push = function(error) {
  error.path = this.path + error.path
  this.seenErrors = true
  this.parent.push(error)
}

Log.prototype.at = function(path) {
  return new Log(this, path)
}

var types = exports.types = {}

types.string = function(obj, log) {
  if (typeof obj == 'string') return obj
  return String(obj)
}

types.number = function(obj, log) {
  var n = Number(obj)
  if (Number.isNaN(n) || !Number.isFinite(n))
    return log.error('Not a number')
  return n
}

types.date = function(obj, log) {
  if (obj instanceof Date) return obj
  switch(typeof obj) {
    case 'number': return new Date(obj)
    case 'string':
      var date = Date.parse(obj)
      if (!Number.isNaN(date)) return date
    default:
      log.error('Not a date')
  }
}

types.object = function(obj, log) {
  if (typeof obj == 'object' && !Array.isArray(obj)) return obj
  log.error('Not a object')
}

types.array = function(obj, log) {
  if (Array.isArray(obj)) return obj
  log.error('Not an array')
}

var validators = exports.validators = {}

validators.type = function(name) {
  var check = types[name]
  if (!check) throw new Error('Unknown type ' + name)
  return check
}

validators.schema = function(schema, validators) {
  var required = {}
  var defaults = {}
  var optional = {}

  for(var key in schema) {
    var check = compile(schema[key], validators)
    if (schema[key].required) {
      required[key] = check
    } else if (schema[key].def != null) {
      defaults[key] = schema[key].def
    } else {
      optional[key] = check
    }
  }

  return function(obj, log) {
    var ret = {}
    return go(function*() {
      var key

      for(key in required) {
        if (obj[key] == null) {
          log.error('required, but not given', {path: '.'+key})
        } else {
          ret[key] = yield required[key](obj[key], log.at('.'+key))
        }
      }

      for(key in defaults) {
        if (obj[key] == null) ret[key] = defaults[key]
      }

      for(key in obj) {
        if (required[key]) continue
        if (defaults[key]) continue
        ret[key] = yield optional[key](obj[key], log.at('.'+key))
      }

      return ret
    })
  }
}

validators.required = function() {
  return function(obj) { return obj }
}
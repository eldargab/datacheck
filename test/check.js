var should = require('should')
var check = require('../check')

describe('datacheck', function() {
  var schema = {
    type: 'object',
    schema: {
      string: {type: 'string'},
      number: {type: 'number'}
    }
  }

  var validator = check.validator(schema)

  it('Should pass correct data', function(done) {
    var data = {string: 'foo', number: 1}
    check.ok(data, validator).next(function(err, ret) {
      if (err) return done(err)
      ret.should.eql(data)
      done()
    })
  })
})
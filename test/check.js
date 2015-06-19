var should = require('should')
var check = require('../check')

describe('datacheck', function() {
  describe('validator()', function() {
    it('Should run validators in turn', function() {
      var validator = check.compile({
        a: 'foo',
        b: 'bar',
        c: 'baz'
      }, {
        a: function(arg) {
          arg.should.equal('foo')
          return function(obj, log) {
            obj.should.equal(0)
            return obj + 1
          }
        },
        b: function(arg) {
          arg.should.equal('bar')
          return function(obj, log) {
            obj.should.equal(1)
            return obj + 1
          }
        },
       c: function(arg) {
          arg.should.equal('baz')
          return function(obj, log) {
            obj.should.equal(2)
            return obj + 1
          }
        }
      })
      check.ok(0, validator).value.should.equal(3)
    })

    it('Should stop validation on first error', function() {
      var future = check.all(10, check.compile({
        a: true,
        c: true }, {
          a: function() {
            return function(obj, log) {
              log.error('a')
              log.error('b')
            }
          },
          c: function() {
            return function() {
              should.fail()
            }
          }
        })
      )
      future.value.should.be.an.Error
      future.value.errors.should.eql([{message: 'a', path: ''}, {message: 'b', path: ''}])
    })

    it('Should support async validations', function() {
      return check.ok(10, check.compile({
        a: true
      }, {
        a: function() {
          return function(obj) {
            return Promise.resolve(obj + 1)
          }
        }
      })).then(function(obj) {
        obj.should.equal(11)
      })
    })

    it('Should handle nulls', function() {
      (check.ok(null, check.compile({type: 'number', nullable: true})).value === null).should.be.true
      check.ok(null, check.compile({type: 'number'})).value.should.be.an.Error
    })

    it('Should handle defaults', function() {
      check.ok(null, check.compile({type: 'number', def: 3})).value.should.equal(3)
    })
  })

  describe('Built in validators', function() {
    describe('schema', function() {
      var schema = check.compile({
        schema: {
          id: { type: 'number', required: true },
          string: { type: 'string' },
          number: { type: 'number' },
          nested: {
            type: 'object',
            schema: {
              a: { type: 'number',  required: true},
              b: { type: 'number', def: 10 }
            }
          }
        }
      })

      it('Fields are optional by default', function() {
        var obj = {id: 10}
        check.ok(obj, schema).value.should.eql(obj)
      })

      it('Should pass and sanitize correct values', function() {
        check.ok({id: 10, string: 20}, schema).value.should.eql({id: 10, string: '20'})
      })

      it('Should catch erros', function() {
        var ret = check.all({id: 1, number: 'foo', nested: {a: 'a'}}, schema).value
        ret.should.be.an.Error
        ret.errors[0].path.should.equal('.number')
        ret.errors[1].path.should.equal('.nested.a')
      })

      it('Should check for required fields', function() {
        var ret = check.ok({string: 'a', number: 10}, schema).value
        ret.should.be.an.Error
        ret.path.should.equal('.id')
        ret.message.should.match(/required, but not given/)
      })

      it('Should set defaults', function() {
        check.ok({id: 1, nested: {a: 1}}, schema).value.should.eql({id: 1, nested: {a: 1, b: 10}})
      })
    })
  })
})
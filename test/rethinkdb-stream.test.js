var beforeEach = global.beforeEach
var afterEach = global.afterEach
var describe = global.describe
var it = global.it

var expect = require('chai').expect
var ignore = require('ignore-errors')
var r = require('rethinkdb')
var shimmer = require('shimmer')
var sinon = require('sinon')
require('sinon-as-promised')

var createCursor = require('../index.js')

var table = 'rethinkdb_stream'

describe('rethinkdb-stream', function () {
  beforeEach(function () {
    // create table
    var self = this
    var opts = {
      host: 'localhost',
      port: 28015
    }
    this.rows = [
      { id: 100 },
      { id: 200 },
      { id: 300 }
    ]
    return r.connect(opts).then(function (conn) {
      self.conn = conn
      return r.tableCreate(table).run(conn)
        .catch(ignore(/exist/))
    })
  })
  afterEach(function () {
    // drop table
    return r.tableDrop(table).run(this.conn)
      .catch(ignore(/exist/))
  })

  describe('changes cursor', function () {
    beforeEach(function () {
      // create cursor
      var self = this
      return r.table(table).changes().run(this.conn).then(function (cursor) {
        self.cursor = cursor
      })
    })
    afterEach(function () {
      this.cursor.close()
    })

    it('should make cursor a stream', function (done) {
      var cursor = this.cursor
      var conn = this.conn
      var rows = this.rows

      var stream = createCursor(cursor)
      var handleData = sinon.stub()
      stream.on('data', handleData)
      stream.on('error', done)
      stream.on('end', function () {
        // assertions
        sinon.assert.calledThrice(handleData)
        rows.forEach(function (row) {
          sinon.assert.calledWith(handleData, {
            new_val: row,
            old_val: null
          })
        })
        done()
      })
      r.table(table).insert(rows[0]).run(conn)
        .then(function () {
          return r.table(table).insert(rows[1]).run(conn)
        })
        .then(function () {
          return r.table(table).insert(rows[2]).run(conn)
        })
        .then(function () {
          return cursor.close()
        })
        .catch(function (err) {
          stream.removeAllListeners('end')
          done(err)
        })
    })

    describe('errors', function () {
      describe('close error', function () {
        beforeEach(function () {
          this.err = new Error('boom')
          // original unwrapped close
          this.cursor.close = sinon.stub().rejects(this.err)
        })

        it('should emit error', function (done) {
          var self = this
          var stream = createCursor(this.cursor)
          var handleData = sinon.stub()
          stream.on('data', handleData)
          stream.on('error', function (err) {
            expect(err === self.err).to.equal(true)
            done()
          })
          stream.close()
        })
      })

      describe('next error', function () {
        beforeEach(function () {
          this.err = new Error('boom')
          // original unwrapped close
          this.cursor.next = sinon.stub().yieldsAsync(this.err)
        })

        it('should emit error', function (done) {
          var self = this
          var stream = createCursor(this.cursor)
          var handleData = sinon.stub()
          stream.on('data', handleData)
          stream.on('error', function (err) {
            expect(err === self.err).to.equal(true)
            done()
          })
        })
      })
    })
  })

  describe('rows cursor', function () {
    beforeEach(function () {
      // create cursor
      var self = this
      var conn = this.conn
      return r.table(table).insert(this.rows).run(conn)
        .then(function (results) {
          return r.table(table).run(conn)
        })
        .then(function (cursor) {
          self.cursor = cursor
        })
    })

    it('should make cursor a stream', function (done) {
      var cursor = this.cursor
      var rows = this.rows

      var stream = createCursor(cursor)
      var handleData = sinon.stub()
      stream.on('data', handleData)
      stream.on('end', function () {
        sinon.assert.calledThrice(handleData)
        rows.forEach(function (row) {
          sinon.assert.calledWith(handleData, row)
        })
        done()
      })
    })

    describe('close mid-read', function () {
      it('should not send any data', function (done) {
        var cursor = this.cursor
        var stream = createCursor(cursor)
        var handleData = sinon.stub()
        shimmer.wrap(cursor, 'next', function (next) {
          return function (cb) {
            next.call(cursor, function (err, data) {
              stream.close()
              cb(err, data)
            })
          }
        })
        stream.on('data', handleData)
        stream.on('end', function () {
          process.nextTick(function () {
            sinon.assert.notCalled(handleData)
            done()
          })
        })
      })
    })
    describe('read mid-read', function () {
      it('should not send any data', function (done) {
        var cursor = this.cursor
        var stream = createCursor(cursor)
        var handleData = sinon.stub()
        shimmer.wrap(cursor, 'next', function (next) {
          return function (cb) {
            next.call(cursor, function (err, data) {
              var ret = stream._read()
              expect(ret).to.equal(false)
              cb(err, data)
            })
          }
        })
        stream.on('data', handleData)
        stream.on('end', done)
      })
    })
  })
})

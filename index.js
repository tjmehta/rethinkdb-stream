'use strict'

var Readable = require('stream').Readable
var util = require('util')

var maybe = require('call-me-maybe')
var shimmer = require('shimmer')
var debug = require('debug')('rethinkdb-stream')

function isNoMoreRowsErr (err) {
  return (err.name === 'ReqlDriverError') && (err.message === 'No more rows in the cursor.')
}

module.exports = CursorStream

function CursorStream (cursor, opts) {
  if (!(this instanceof CursorStream)) {
    return new CursorStream(cursor)
  }
  // defaults
  opts = opts || {}
  opts.highWaterMark = opts.highWaterMark || 1000
  // force object mode
  opts.objectMode = true
  // super
  Readable.call(this, opts)
  // extended
  var self = this
  this._reading = false
  this._closing = false
  this._cursor = cursor
  // emit close on end
  this.once('end', function () {
    process.nextTick(function () {
      self.emit('close')
    })
  })
  // end stream when cursor is closed
  shimmer.wrap(cursor, 'close', function (close) {
    return function closeProxy (cb) {
      debug('close')
      self._closing = true
      shimmer.unwrap(cursor, 'close')
      // end
      var promise = close.call(this).then(function () {
        // end stream
        debug('close success')
        self.push(null)
      }).catch(function (err) {
        // emit error
        debug('close err', err)
        self.emit('error', err)
      })
      return maybe(cb, promise)
    }
  })
}

util.inherits(CursorStream, Readable)

/* Readable stream functionality */

/**
 * read data from stream
 */
CursorStream.prototype._read = function () {
  if (this._reading || this._closing) return false
  var self = this
  this._reading = true
  debug('_read')
  this._cursor.next(function (err, row) {
    self._reading = false
    debug('next')
    if (self._closing) { return }
    if (err) {
      debug('next err', err)
      if (isNoMoreRowsErr(err)) {
        debug('no more rows')
        // end stream
        self.push(null)
        return
      }
      self.emit('error', err)
      return
    }
    debug('next row', row)
    self.push(row)
  })
}

/* Extended functionality */

/**
 * End stream, by closing the underlying rethinkdb cursor
 * @return {Promise<,Error>}
 */
CursorStream.prototype.close = function () {
  return this._cursor.close()
}

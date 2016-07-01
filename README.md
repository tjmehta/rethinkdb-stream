# rethinkdb-stream  [![Build Status](https://travis-ci.org/tjmehta/rethinkdb-stream.svg?branch=master)](https://travis-ci.org/tjmehta/rethinkdb-stream) [![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](http://standardjs.com/)
Convert a rethinkdb cursor into a readable stream (object mode stream)

# Installation
```bash
npm i --save rethinkdb-stream
```

# Usage
### Changes Cursor Example:
```js
var r = require('rethinkdb')
var conn = r.connect({/* opts */})
var rethinkdbStream = require('rethinkdb-stream')

r.table('foo').changes().run(conn)
  .then(function (cursor) {
    var stream = rethinkdbStream(cursor)
    stream.on('error', /* handle error */)
    stream.pipe(/* other stream */)
    /*
      // data events:
      { new_val: { id: 1 }, old_val: null }
      { new_val: { id: 2 }, old_val: null }
      { new_val: { id: 3 }, old_val: null }
    */
  })
  .then(function () {
    // insert document 1
    return r.table('foo').insert({ id: 1 }).run(conn)
  })
  .then(function () {
    // insert document 2
    return r.table('foo').insert({ id: 2 }).run(conn)
  })
  .then(function () {
    // insert document 3
    return r.table('foo').insert({ id: 3 }).run(conn)
  })
```

### Query Cursor Example:
```js
var r = require('rethinkdb')
var conn = r.connect({/* opts */})
var rethinkdbStream = require('rethinkdb-stream')

var rows = [
  { id: 1 },
  { id: 2 },
  { id: 3 }
]
r.table('foo').insert(rows).run(conn).then(function () {
  return r.table('foo').run(conn).then(function (cursor) {
    var stream = rethinkdbStream(cursor)
    stream.on('error', /* handle error */)
    stream.pipe(/* other stream */)
    /*
      // data events:
      { id: 1 }
      { id: 2 }
      { id: 3 }
    */
  })
})
```

### Close Example:
rethinkdb streams have a `close` method which calls `cursor.close()`
```js
var r = require('rethinkdb')
var conn = r.connect({/* opts */})
var rethinkdbStream = require('rethinkdb-stream')

r.table('foo').changes().run(conn)
  .then(function (cursor) {
    var stream = rethinkdbStream(cursor)
    stream.on('error', /* handle error */)
    stream.pipe(/* other stream */)
    return stream.close() // returns a promise, immediately closes the underlying cursor
    /*
      // data events:
      (none)
    */
  })
  .then(function () {
    // insert document 1
    return r.table('foo').insert({ id: 1 }).run(conn)
  })
  .then(function () {
    // insert document 2
    return r.table('foo').insert({ id: 2 }).run(conn)
  })
  .then(function () {
    // insert document 3
    return r.table('foo').insert({ id: 3 }).run(conn)
  })
```

# License
MIT
const Handler = require('struts').Handler;
const MongoClient = require('mongodb').MongoClient;
const MongoOplog = require('mongo-oplog');

//
// Class manages a mongodb connection and emits events on connect and when
// a watched namespace is changed.
//
// ## Options
// The options object has the following fields with their defaults:
//
// '''js
// {
//   dbhost: "127.0.0.1", // mongod address
//   dbname: "test",      // mongo database name to open
//   dbopts: {},          // options object passed to driver on connect
//   root: "mongodb"      // root for emitted events (e.g. 'mongodb.connected')
// }
// '''
//
// ## Events
// 
// 'mongodb.connected', db
// 'mongodb.insert', { ns: <namespace>, _id: <_id>, o: <obj> }
// 'mongodb.update', { ns: <namespace>, _id: <_id>, o: <obj> }
// 'mongodb.delete', { ns: <namespace>, _id: <_id>, o: <obj> }
//
class MongoHandler extends Handler {
  //
  // Struts init expects a reference to an EventEmitter.
  //
  init() {
    // set defaults
    this.options.dbhost = this.options.dbhost || "127.0.0.1";
    this.options.dbname = this.options.dbname || "test";
    this.options.dbopts = this.options.dbopts || {};
    
    // the reference to the driver db object
    this.db = null;
    // watched namespaces
    this.watched = [];
  }
  
  //
  // Initiate a connection to mongodb using the native driver
  //
  start() {
    this.log(`Connecting to mongodb at ${this.options.dbhost}`);
    
    var fullhost = this.options.dbhost;
    
    // add full mongodb:// schema if not provided
    if (!fullhost.match(/^mongodb:\/\/.*/)) {
      fullhost = `mongodb://${this.options.dbhost}/${this.options.dbname}`;
    }
    
    // initiate connect
    MongoClient.connect(fullhost, this.options.dbopt)
    .then(db => this.connected(db)).catch(err => this.error(err));
  }
  
  //
  // watch the specified namespace for changes
  //
  watch(collection) {
    if (this.watched.indexOf(collection) === -1) {
      this.debug(`watching the ${collection} collection`);
      this.watched.push(collection);
    }
  }

  //
  // Bound class method which receives the freshly connected db object from
  // the mongodb native driver
  //
  connected(db) {
    this.log(`Connected to MongoDb at ${this.options.dbhost}`);

    // save to instance variable
    this.db = db;
    
    this.emitter.emit('mongodb.connected', this.db);
    if (this.watched.length > 0) {
      this.tailOplog();
    }
    
    // error on connection close
    this.db.on('close', () => {
      this.error("Lost connection to mongodb");
    });
    
  }

  //
  // Start tailing the mongodb oplog
  //
  tailOplog() {
    this.debug("initializing oplog connection");
    
    this.oplog = MongoOplog(`mongodb://${this.options.dbhost}/local`, {
      ns: `${this.db.s.databaseName}.(${this.watched.join('|')})`,
      coll: "oplog.$main"
    });
    
    this.oplog.on('insert', (doc) => {
      this.emitter.emit(`mongodb.insert`, {
        ns: doc.ns,
        _id: doc.o._id,
        o: doc.o
      });
    });
     
    this.oplog.on('update', (doc) => {
      this.emitter.emit(`mongodb.update`, {
        ns: doc.ns,
        _id: doc.o2._id,
        o: doc.o
      });
    });
     
    this.oplog.on('delete', (doc) => {
      this.emitter.emit(`mongodb.delete`, {
        ns: doc.ns,
        _id: doc.o._id,
        o: doc.o
      });
    });
     
    this.oplog.on('error', (err) => {
      this.error(err);
    });
    
    // start the oplog tailing
    this.oplog.tail()
    .then(() => {
      this.debug('oplog tailing started');
    })
    .catch((err) => this.error(err));
  }

}

//
// exports
//
module.exports = MongoHandler;
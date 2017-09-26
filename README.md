# struts-mongo

struts handler for mongodb

Provides simple connection using the native mongodb node.js driver, as well as
oplog monitoring for specified collections. All events follow the struts hub/spoke
model and are emitted on the hub emitter.

## Usage

```js

const options = {
  dbhost: "127.0.0.1",
  dbname: "test"
}

class Hub extends EventEmitter {
  constructor() {
    this.db = new MongoHandler(this, options);
    this.db.watch("some-collection");
    this.db.start();
    
    // handle events here or in other struts handlers
    this.on("mongodb.connected", (db) => {
      // directly use db object
    });
    
    this.on("mongodb.insert", (data) => {
      // data.ns provides namespace of insert
      // data._id provides _id of new insertion
    });
    
    this.on("mongodb.update", (data) => {
      // data.ns provides namespace of insert
      // data._id provides _id of new insertion
    });
    
    this.on("mongodb.delete", (data) => {
      // data.ns provides namespace of insert
      // data._id provides _id of new insertion
    });
    
  }
}
```
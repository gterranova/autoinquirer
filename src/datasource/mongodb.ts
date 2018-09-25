// tslint:disable:no-any
// tslint:disable:no-console

import fs from "fs";
import { MongoClient, ObjectID } from 'mongodb';
import objectPath from 'object-path';
import { loadJSON } from '../utils';
import { MemoryDataSource } from './memory';

const dbName = 'my-transmission';

function getType(value: any) {
    // tslint:disable-next-line:no-reserved-keywords
    const type = typeof value;
    if (type === 'object') {
        return value ? Object.prototype.toString.call(value).slice(8, -1) : 'null';
    }

    return type;
}

function findEntryPoints(p: string, schema: any) {
    let paths = {};
    if (schema.type=== 'object') {
        Object.keys(schema.properties).map((key: string) => {
            paths = {...paths, ...findEntryPoints(key, schema.properties[key])};
        });
    } else if (schema.type === 'array') {
        if (schema.$collection) {
            return {[p]: schema.$collection};
        }
        paths = findEntryPoints('(\\d+|[a-f0-9-]{24})', schema.items)
    } 

    return Object.keys(paths).reduce( (acc: any, key: string) => {
        acc[`${p}${p?'\\/':'^'}${key}`] = paths[key];
        
        return acc; 
    }, {});
}

export class MongoDataSource extends MemoryDataSource {
    private dataFile: string;
    private connectionUrl: string;
    private entryPoints: any = {};
    private client: MongoClient;
    private db: any;

    constructor(schemaFile: string, dataFile: string, connectionUrl: string) {
        super(schemaFile);
        this.dataFile = dataFile;
        this.connectionUrl = connectionUrl;
    }

    public async setup() {
        const schema = this.getDefinition('');
        const defaultValue = this.coerce(schema);
        this.jsonDocument = loadJSON(this.dataFile);
        if (!this.jsonDocument || getType(this.jsonDocument) !== getType(defaultValue)) {
            this.jsonDocument = defaultValue;
        }
        this.entryPoints = findEntryPoints('', this.schemaDocument);
        await new Promise((resolve: any, reject: any) => {
            MongoClient.connect(this.connectionUrl, { useNewUrlParser: true }, (err: any, client: any) => {
                if (err) { reject(err); }
                this.client = client;
                this.db = client.db(dbName);
                resolve();
            });  
        });
    }

    public async close() {
        this.client.close();
    }

    public async save() {
        fs.writeFileSync(this.dataFile, JSON.stringify(this.jsonDocument, null, 2));
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async get(itemPath?: string) {
        if (!itemPath) { return this.jsonDocument; }

        const collectionRefs = this.getCollectionsForPath(itemPath);
        if (collectionRefs.length) {
            const lastCollection = collectionRefs.pop();

            return this.getCollection(lastCollection);
        };
        const schemaPath = this.convertObjIDToIndex(itemPath);

        return objectPath.get(this.jsonDocument, schemaPath.split('/'));
    }

    public async push(itemPath: string, value: any) {
        const schemaPath = this.convertObjIDToIndex(itemPath);
        const schema = this.getDefinition(schemaPath);
    
        //console.log('addItemByPath', schemaPath.split('/'), schema.type, value);
        if (schema.type === 'array') {
            const arrayItemSchema: any = schema.items;

            // tslint:disable-next-line:no-parameter-reassignment
            value = this.coerce(arrayItemSchema, value);    

            const collectionRefs = this.getCollectionsForPath(itemPath);
            if (collectionRefs.length) {
                const lastCollection = collectionRefs.pop();
    
                return this.pushCollection(lastCollection, value);
            };

            if (getType(value) === getType({})) {
                value._id = new ObjectID().toHexString();
            }
    
            if (!schemaPath) { 
                this.jsonDocument.push(value); 
            } else {
                objectPath.push(this.jsonDocument, schemaPath.split('/'), value);
            }
        } else {
            throw new Error('not implemented')
        }
        this.save();    
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async set(itemPath: string, value: any) {
        if (value !== undefined) {
            const schemaPath = this.convertObjIDToIndex(itemPath);
            const schema = this.getDefinition(schemaPath);
            const prepValue = this.coerce(schema, value);
            if (!this.validate(schema, prepValue)) {
                throw new Error(JSON.stringify(this.validator.errors));
            }
            const collectionRefs = this.getCollectionsForPath(itemPath);
            if (collectionRefs.length) {
                const lastCollection = collectionRefs.pop();
    
                return this.setCollection(lastCollection, prepValue);
            };
            objectPath.set(this.jsonDocument, schemaPath.split('/'), prepValue);
            this.save();                
        }
    }

    public async del(itemPath: string) {
        const schemaPath = this.convertObjIDToIndex(itemPath);

        const collectionRefs = this.getCollectionsForPath(itemPath);
        if (collectionRefs.length) {
            const lastCollection = collectionRefs.pop();

            return this.delCollection(lastCollection);
        };
        this.getCollectionsWithinPath(itemPath).map( (name: string) => {
            const collection = this.db.collection(name);
            console.log("Must delete from", name, "with collectionPath starting with", RegExp(`^${itemPath}`));

            return collection.deleteMany({ collectionPath: RegExp(`^${itemPath}`) });
        });
        objectPath.del(this.jsonDocument, schemaPath.split('/'));
        this.save();
    }

    private async getCollection(data: { name: string; collectionPath: string; objPath: string }) {
        const { name, collectionPath, objPath} = data;
        const collection = this.db.collection(name);

        if (!objPath) {
            // tslint:disable-next-line:no-unnecessary-local-variable
            const index = await collection.find({ collectionPath }).toArray();

            return index; 
        }

        const parts = objPath.split('/');
        const collectionId = parts.shift();
        const item = await collection.findOne({ _id: new ObjectID(collectionId) /* collectionPath */});    

        if (item && parts.length) {
            return objectPath.get(item, parts);
        }
        
        return item;

    }

    private async pushCollection(data: { name: string; collectionPath: string; objPath: string }, value: any) {
        const { name, collectionPath, objPath} = data;
        const collection = this.db.collection(name);

        const parts = objPath.split('/');
        if (!objPath) {
            const r = await collection.insertOne({...value, collectionPath });
            
            return { _id: r.insertedId }; 
        } else if (parts.length < 2) { 
            throw new Error("Cannot push a collection item!");
        }
        
        const collectionId = new ObjectID(parts.shift());
        const item = await collection.findOne({ _id: collectionId, collectionPath });    
        objectPath.push(item, parts, value);

        await collection.updateOne({ _id: collectionId /* collectionPath */}, 
            { $set: {...item, _id: collectionId } });    
        
        return item;

    }

    private async setCollection(data: { name: string; collectionPath: string; objPath: string }, value: any) {
        const { name, collectionPath, objPath} = data;
        const collection = this.db.collection(name);

        if (!objPath) {
            throw new Error("Cannot set a collection!");
        }

        const parts = objPath.split('/');
        const collectionId = new ObjectID(parts.shift());
        let item;
        if (parts.length) {
            item = await collection.findOne({ _id: collectionId, collectionPath });    
            objectPath.set(item, parts, value);
        } else {
            item = value;
        }
        await collection.updateOne({ _id: collectionId }, { $set: {...item, _id: collectionId } });    
        
        return item;

    }

    private async delCollection(data: { name: string; collectionPath: string; objPath: string }) {
        const { name, collectionPath, objPath} = data;
        const collection = this.db.collection(name);

        const parts = objPath.split('/');
        if (!objPath) {
            await collection.deleteMany({ collectionPath });

            return; 
        }
        
        const collectionId = new ObjectID(parts.shift());
        if (!parts.length) {
            await collection.deleteOne({ _id: collectionId, collectionPath });
            
            return; 
        }
        const item = await collection.findOne({ _id: collectionId, collectionPath });    
        objectPath.del(item, parts);

        await collection.updateOne({ _id: collectionId }, 
            { $set: {...item, _id: collectionId } });    
        
        return item;

    }

    private getCollectionsForPath(schemaPath: string) {
        return Object.keys(this.entryPoints).filter( (k: string) => {
            return RegExp(k).test(schemaPath);
        }).map( (foundKey: string) => {
            const objPath = schemaPath.replace(RegExp(foundKey), ''); 
            const collectionPath = schemaPath.slice(0, schemaPath.length-objPath.length);
            
            return { name: this.entryPoints[foundKey], collectionPath, objPath: objPath.replace(/^\//, '')};
        });        
    }

    private getCollectionsWithinPath(schemaPath: string) {
        // tslint:disable-next-line:prefer-template
        const comparisonPath = '^'+schemaPath.replace(/(\d+|[a-f0-9-]{24})\//g, '(\\d+|[a-f0-9-]{24})/')
            .replace(/(\d+|[a-f0-9-]{24})$/g, '(\\d+|[a-f0-9-]{24})').replace('/', '\\/')
        
        return Object.keys(this.entryPoints).filter( (k: string) => {
            console.log(k, comparisonPath, k.indexOf(comparisonPath) !== -1);

            return k.indexOf(comparisonPath) !== -1;
        }).map( (foundKey: string) => {
            return this.entryPoints[foundKey];
        });        
    }

    private convertObjIDToIndex(path: string) {
        const parts = path.split('/');
        const converted = [];
        for (const key of parts) {
            if (/^[a-f0-9-]{24}$/.test(key)) {
                const tempObj = objectPath.get(this.jsonDocument, converted);
                if (tempObj && Array.isArray(tempObj)) {
                    const item = tempObj.find( (itemObj: any) => {
                        return typeof itemObj === 'object' && itemObj && itemObj._id === key; 
                    });
                    if (item) {
                        converted.push(tempObj.indexOf(item));
                        continue;
                    }
                }
                
                return [...converted, ...parts.slice(converted.length)].join('/');
            }
            converted.push(key);
        }
        
        return converted.join('/');
    }
    
};

// tslint:disable:no-any
// tslint:disable:no-console

import { Db, MongoClient, MongoError, ObjectID } from 'mongodb';
import objectPath from 'object-path';
import { IProperty } from '../interfaces';
import { getType } from '../utils';
import { DataSource } from './index';

export interface IMongoConfig {
    uri?: string;
    databaseName?: string;
    collectionName?: string;
}

export class MongoDataSource extends DataSource {
    private config: IMongoConfig;
    private client: MongoClient;
    private db: Db;
    private isConnected: boolean;

    constructor(config: IMongoConfig = {}) {
        super();
        this.config = config;
    }

    public async connect() {
        if (this.isConnected) { return };

        await new Promise((resolve: any, reject: any) => {
            const { uri, databaseName } = this.config;
            MongoClient.connect(uri, { useNewUrlParser: true }, (err: MongoError, client: MongoClient) => {
                if (err) { 
                    return reject(err); 
                }
                this.client = client;
                if (!databaseName) {
                    throw new Error("MongoDataSource: a databaseName must be passed");
                }
                this.db = client.db(databaseName);
                this.isConnected = true;
                resolve();
            });  
        });
        //console.log("Mongodb: initialized");
    }

    public async close() {
        if (!this.isConnected) { return };
        await this.client.close();
        this.isConnected = false;
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async get(objPath?: string, schema?: IProperty, _?: any, parentPath?: string, params?: IMongoConfig) {
        const collection = this.getCollection(params);
        //console.log("GET", objPath);

        if (!objPath) {
            // tslint:disable-next-line:no-unnecessary-local-variable
            const index = await collection.find({ parentPath: parentPath || '' }).toArray();

            return index; 
        }

        const parts = objPath.split('/');
        const collectionId = parts.shift();
        const item = await collection.findOne({ _id: new ObjectID(collectionId) /* parentPath */});    

        if (item && parts.length) {
            const schemaPath = await this.convertObjIDToIndex(parts, collectionId, item, schema, parentPath, params);
            //console.log("---> ", parts.join('.'), schemaPath.replace(/\//g,'.'));

            return objectPath.get(item, schemaPath.split('/'));
        }
        
        return item;

    }

    public async push(objPath?: string, schema?: IProperty, value?: any, parentPath?: string, params?: IMongoConfig): Promise<any> {
        const collection = this.getCollection(params);

        const parts = objPath.split('/');
        if (!objPath) {
            const r = await collection.insertOne({...value, parentPath: [parentPath] });
            
            return { _id: r.insertedId }; 
        } else if (parts.length < 2) { 
            throw new Error("Cannot push a collection item!");
        }
        
        const collectionId = new ObjectID(parts.shift());
        const schemaPath = await this.convertObjIDToIndex(parts, collectionId.toHexString(), null, schema, parentPath, params);
        //console.log("PUSH", parts.join('.'), schemaPath.replace(/\//g,'.'));
        if (getType(value) === 'Object') {
            value._id = new ObjectID().toHexString();
        }

        // tslint:disable-next-line:no-unnecessary-local-variable
        const item = await collection.updateOne({ _id: collectionId, parentPath },
            { $push: { [schemaPath.replace(/\//g,'.')]: value } });    
        
        return item;

    }

    // tslint:disable-next-line:no-reserved-keywords
    public async set(objPath?: string, schema?: IProperty, value?: any, parentPath?: string, params?: IMongoConfig) {
        const collection = this.getCollection(params);

        if (!objPath) {
            throw new Error("Cannot set a collection!");
        }

        const parts = objPath.split('/');
        const collectionId = new ObjectID(parts.shift());
        let item;
        if (parts.length) {
            const schemaPath = await this.convertObjIDToIndex(parts, collectionId.toHexString(), null, schema, parentPath, params);
            //("SET", parts.join('.'), schemaPath.replace(/\//g,'.'));
            item = await collection.updateOne({ _id: collectionId, parentPath },
                { $set: { [schemaPath.replace(/\//g,'.')]: value }});    
        } else {
            item = await collection.updateOne({ _id: collectionId, parentPath },
                { $set: value });    
        }
        
        return item;

    }

    public async del(objPath?: string, schema?: IProperty, _?: any, parentPath?: string, params?: IMongoConfig) {
        const collection = this.getCollection(params);

        const parts = objPath.split('/');
        if (!objPath) {
            await collection.deleteMany({ parentPath: parentPath || '' });

            return; 
        }
        
        const collectionId = new ObjectID(parts.shift());
        if (!parts.length) {
            await collection.deleteOne({ _id: collectionId, parentPath });
            
            return; 
        }

        // Have not found a way to do it in a single op (cannot $pull by index position)
        const item = await collection.findOne({ _id: collectionId, parentPath });
        const schemaPath = await this.convertObjIDToIndex(parts, collectionId.toHexString(), item, schema, parentPath, params);
        //console.log("DEL", parts.join('.'), schemaPath.replace(/\//g,'.'));
        
        objectPath.del(item, schemaPath.split('/'));

        await collection.updateOne({ _id: collectionId }, 
            { $set: {...item, _id: collectionId } });    
        
        return item;

    }

    public async delCascade(parentPath?: string, params?: IMongoConfig) {
        const collection = this.getCollection(params);
        //console.log("collection", params.collectionName, { 'parentPath.$': RegExp(`^${parentPath}`) })
        await collection.deleteMany({ 'parentPath': RegExp(`^${parentPath}`) })
    }

    public async dispatch(methodName: string, itemPath?: string, schema?: IProperty, value?: any, parentPath?: string, params?: any) {
        if (!this[methodName]) {
            throw new Error(`Method ${methodName} not implemented`);
        }

        // tslint:disable-next-line:no-return-await
        return await this[methodName].call(this, itemPath, schema, value, parentPath, params);
    }

    private getCollection(params: IMongoConfig = {}) {
        const { collectionName } = { ...this.config, ...params };
           
        return this.db.collection(collectionName);
    }
};

// tslint:disable:no-any
// tslint:disable:no-console

import fs from "fs";
import objectPath from 'object-path';
import path from "path";
import url from 'url';
import { Collection } from './collection';
import { actualPath } from './utils';

const refCache = {};
const schemaCache = {};

export class DataSource {
    // tslint:disable-next-line:variable-name
    public schemaDefinitions: Collection;
    private dataFile: string;
    private schemaInfo: any;

    constructor(dataFile: string) {
        this.dataFile = dataFile;

        const schema: any = [{ uri: 'schema.json' }];
        let data: any = { schema };

        if (fs.existsSync(dataFile)) {
            const buffer: Buffer = fs.readFileSync(dataFile);
            data = JSON.parse(buffer.toString());
            this.schemaInfo = data.schema = data.schema || schema;
        } 
        this.setupDefinitions(data);
        this.setupCollections(data);
        this.save();    
    }

    public getCollections() {
        return this.schemaDefinitions.filter({ type: 'array' });
        //return this.schemaDefinitions.filter( { type: 'Collection' });
    }

    public save() {
        const data: any = { schema: this.schemaInfo };
        this.schemaDefinitions.all().map( (c: any) => data[c.name] = this[c.name].value());
        fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
        //this.setupCollections();
    }

    public parseRef(schema: any, count: number = 0) {
        if (!schema) { return }
        let refSchema = schema;
        if (schema.type && this[schema.type]) {
            if (refCache[`#/definitions/${schema.type}`]) { 
                refSchema = refCache[`#/definitions/${schema.type}`]; 
            } else {
                refSchema = this.parseRef({ $ref: `#/definitions/${schema.type}`}, count+1);
                if (refSchema.items) {
                    refSchema.items = this.parseRef(refSchema.items, count+1);
                }
                refCache[`#/definitions/${schema.type}`] = refSchema;
            }

            return refCache[`#/definitions/${schema.type}`] = {...refSchema, ...schema, type: refSchema.type };
        } 
        if (refSchema.items) {
            refSchema.items = this.parseRef(refSchema.items, count+1);
        }

        if (!refSchema.$ref) { return refSchema; }

        const uri = url.parse(refSchema.$ref);
        if (refCache[refSchema.$ref]) { return {...refCache[refSchema.$ref], ...refSchema}; }

        if (uri.protocol === 'file:') {
            const refFile = path.join(process.cwd(), uri.path);
            const refDataSource = new DataSource(refFile);
            
            return refCache[refSchema.$ref] = refDataSource.parseRef({ $ref: uri.hash});
            //console.log("LOADED:", refSchema.$ref, refSchema, refSchema);
        } 
        const refPath = uri.hash.replace(/^#\//, '').split('/');

        if (refPath.length && count < 5) {
            if (refPath[0]==='definitions') {
                refCache[refSchema.$ref] = this.getSchemaByPath(refPath.slice(1));
                //if (refCache[refSchema.$ref].items) {
                //    refCache[refSchema.$ref].items = this.parseRef(refCache[refSchema.$ref].items, count+1);
                //}
                
                return {...refCache[refSchema.$ref], ...refSchema};
                //console.log("FOUND:", uri.hash, refSchema);
            } else {
                refSchema = this.getItemByPath(refPath);
                refSchema = refSchema.data || refSchema;
            }
        }    
        
        return refSchema;
    }

    public getSchemaByPath(schemaPath: string | string[] = []) {
        if (schemaCache[schemaPath.toString()]) { return schemaCache[schemaPath.toString()]; }
        
        const schemaParts = actualPath(schemaPath);

        if (!schemaPath.length) { 
            return { definitions: this.schemaDefinitions };
        }
        const collectionName = schemaParts.shift();
        
        const schemaCollection: any = this.parseRef(this.schemaDefinitions.find({name: collectionName}));
        if (!schemaParts.length) { return schemaCollection; }
        
        const parts: any[] = schemaParts;
        // tslint:disable-next-line:one-variable-per-declaration
        
        let properties: any;
        if (schemaCollection.type === 'object') {
            properties = schemaCollection.properties;
        } else if (schemaCollection.type === 'array') {
            properties = schemaCollection.items.properties;
        }
        
        let currSchema: any = schemaCollection;
        //parts.splice(1,1);
        //console.log(parts);
        let count = 0;

        do {
            const key = parts.shift(); 
            if (!key) { break; } 
            if (/^[a-f0-9-]{36}$/.test(key) || /^\d+$/.test(key) || /^#$/.test(key)) { 
                currSchema = currSchema.items;
                properties = currSchema.properties;
            } else if (properties && properties[key]) {
                currSchema = this.parseRef({...properties[key], name: key }, count);
                properties = currSchema.properties;
            } else if (properties && Array.isArray(properties)){
                currSchema = this.parseRef(properties.find((x: any) => x && x.name === key), count);
                properties = currSchema.properties;
            }
            count += 1;
            //console.log("---", key, currSchema);        
        } while (currSchema);
        currSchema = currSchema || {};
        schemaCache[schemaPath.toString()] = currSchema;

        //console.log("schemaLookup", schemaPath, currSchema);
        return currSchema;
    };

    public getItemByPath(itemPath: string | string[] = []) {
        const itemParts = actualPath(itemPath);
        if (!itemPath.length) { return this.schemaDefinitions.all().map( (c: any) => { return {name: c.name}; }) }
        const collection = this[itemParts.shift()];
        if (!itemParts.length) { return collection; }
        const item = collection.get(itemParts.shift());
        if (!itemParts.length) { return item; }
                
        return objectPath(item).get(itemParts);
    };

    public addItemByPath(itemPath: string | string[], value: any) {
        const itemParts = actualPath(itemPath);
        if (!itemPath.length) { return; }
        const collection = this[itemParts.shift()];
        if (!itemParts.length) { 
            collection.create(value); 
            this.save(); 
            
            return; 
        }
        const item = objectPath(collection.get(itemParts.shift()));
        const propertySchema = this.getSchemaByPath(itemPath);

        if (propertySchema.type === 'array') {
            item.push(itemParts, value);
        } else {
            item.set(itemParts, value);
        }
        this.save();
    };

    public updateItemByPath(itemPath: string | string[], value?: any) {
        const itemParts = actualPath(itemPath);
        if (!itemParts.length) { return; } 
        const collection = this[itemParts.shift()];
        if (!itemParts.length) { value !== undefined? collection.update(null, value) : collection.remove(); this.save();
        
            return;
        } // collection;
        const collectionId = itemParts.shift();
        if (!itemParts.length && !value) {
            // if the item is a reference, remove the reference
            const segments = Array.isArray(itemPath) ? [itemPath] : itemPath.split('§');
            if (segments.length>1) {
                return this.updateItemByPath(segments[segments.length-2], value);            
            }
            collection.remove(collectionId);
            
            return this.save();
        }
        const item = collection.get(collectionId);
        if (!item && value) {
            collection.data.splice(collectionId, 1);
            collection.create(value)
        } else {
            if (value !== undefined) {
                //console.log("update set", itemParts, value);
                objectPath.set(item, itemParts, value);
            } else if (item) {
                objectPath.del(item, itemParts);
            }    
        }
        this.save();
    };

    public removeItemByPath(itemPath: string) {
        this.updateItemByPath(itemPath);
    };

    private setupDefinitions(data: any) {
        this.schemaInfo = data.schema = data.schema || [{ uri: 'schema.json' }];

        const numberOfSchemas = this.schemaInfo.length; 
        const definitions = data.schema.reduce( (acc: any[], curr: any, idx: number) => {
            if (curr.uri && fs.existsSync(curr.uri)) {
                const currSchema: any = JSON.parse(fs.readFileSync(curr.uri).toString());
                for (const def of currSchema.definitions) {
                    def.enabled = idx === numberOfSchemas-1;
                    acc[def.name] = acc[def.name] ? { ...acc[def.name], ...def } : def;
                }
            }   

            return acc;
        },{});
        
        const schemaData = Object.keys(definitions).map( (key: string ) => definitions[key] );
        this.schemaDefinitions = new Collection('definitions', schemaData);
    }

    private setupCollections(data: any) {
        for (const schema of this.schemaDefinitions.all()) {
            this[schema.name] = new Collection(schema.name, data[schema.name]);
        }
    }
};

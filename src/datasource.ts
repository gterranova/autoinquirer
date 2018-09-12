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
        return this.schemaDefinitions.filter( { $ref: '#/definitions/Collection', enabled: true });

        //return this.schemaDefinitions.filter( { type: 'Collection' });
    }

    public save() {
        const data: any = { schema: this.schemaInfo };
        this.getCollections().map( (c: any) => data[c.name] = this[c.name].value());
        fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
        //this.setupCollections();
    }

    public parseRef(schema: any, count: number = 0) {
        let refSchema;
        if (schema && schema.type && this[schema.type]) {
            if (refCache[`#/definitions/${schema.type}`]) { 
                refSchema = refCache[`#/definitions/${schema.type}`]; 
            } else {
                refSchema = this.parseRef({ $ref: `#/definitions/${schema.type}`}, count+1);
            }

            return {...refSchema, ...schema, type: refSchema.type };
        }
        if (!schema || !schema.$ref) { return schema; }
        const uri = url.parse(schema.$ref);
        if (refCache[schema.$ref]) { refSchema = refCache[schema.$ref]; }
        else {
            if (uri.protocol === 'file:') {
                const refFile = path.join(process.cwd(), uri.path);
                const refDataSource = new DataSource(refFile);
                refSchema = refCache[schema.$ref] = refDataSource.parseRef({ $ref: uri.hash});
                //console.log("LOADED:", schema.$ref, schema, refSchema);
            } else {
                const refPath = uri.hash.replace(/^#\//, '').split('/');
                //console.log(refSchema);
                if (refPath.length>1 && count < 5) {
                    const collectionName = refPath.shift();
                    if (collectionName==='definitions') {
                        refSchema = this.getSchemaByPath(refPath);
                        //console.log("FOUND:", uri.hash, refSchema);
                    } else if (this[collectionName]) {
                        refSchema = this[collectionName].get(refPath.shift());
                        if (refPath.length) {
                            refSchema = objectPath.get(refSchema, refPath);
                        }
                    }
                }    
            }
        }
        if (refSchema) {
            return {...refSchema, ...schema }; 
        }
        
        return schema;
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
        
        const parts: any[] = schemaParts.filter( (p: string) => !/^[a-f0-9-]{36}$/.test(p) && !/^\d+$/.test(p) && !/^#$/.test(p) );
        // tslint:disable-next-line:one-variable-per-declaration
        
        let properties: any = schemaCollection.properties;
        
        let currSchema: any = schemaCollection;
        //parts.splice(1,1);
        //console.log(parts);
        let count = 0;
        do {
            const key = parts.shift(); 
            if (!key) { break; } 
            
            currSchema = properties ? this.parseRef(properties.find((x: any) => x && x.name === key), count): {};
            properties = currSchema && currSchema.properties;
            count += 1;
            //console.log("---", key, currSchema);        
        } while (currSchema);
        schemaCache[schemaPath.toString()] = currSchema || {};

        //console.log("schemaLookup", schemaPath, currSchema);
        return currSchema || {};
    };

    public getItemByPath(itemPath: string | string[] = []) {
        const itemParts = actualPath(itemPath);
        if (!itemPath.length) { return this.getCollections().map( (c: any) => { return {name: c.name}; }) }
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
        if (propertySchema.is_array) {
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
            collection.remove(collectionId);
            
            return this.save();
        }
        const item = objectPath(collection.get(collectionId));
        const idx = itemParts[itemParts.length-1];
        if (value !== undefined) {
            item.set(itemParts, value[idx]);
        } else {
            item.del(itemParts);
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
        for (const schema of this.getCollections()) {
            this[schema.name] = new Collection(schema.name, data[schema.name]);
            //this.addCollection(schema.name, data[schema.name] || []);
            
            //const properties = schema.properties;
            //for (let property of properties) {
            //    if (property.reference) {
            //        let collection = this.addCollection(property.reference, this.config[property.reference] || []);
            //        this[schema.name].addRelated(property.name, collection, property.is_array);
            //    }
            //}
            
        }
    }
};

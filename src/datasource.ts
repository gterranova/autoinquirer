// tslint:disable:no-any
// tslint:disable:no-console

import fs from "fs";
import objectPath from 'object-path';
import path from "path";
import url from 'url';
import { Collection, Definition } from './collection';
import { IDocument, IProperties, IProperty, ISchema } from './interfaces';
import { actualPath, ifArrayToObject, ifObjectToArray } from './utils';

const refCache = {};
const schemaCache = {};

export class DataSource {
    public schemaDefinitions: Definition;
    private dataFile: string;
    private schemaInfo: ISchema[];

    constructor(dataFile: string) {
        this.dataFile = dataFile;
        this.load();
        this.save();    
    }

    public getCollections() {
        return Object.keys(this.schemaDefinitions.value()).map( (c: string) => this[c] );
        //return this.schemaDefinitions.filter( { type: 'Collection' });
    }

    public load() {
        const schema: ISchema[] = [{ uri: 'schema.json' }];
        let data: IDocument = { schema, definitions: {} };

        if (fs.existsSync(this.dataFile)) {
            const buffer: Buffer = fs.readFileSync(this.dataFile);
            data = JSON.parse(buffer.toString());
            this.schemaInfo = data.schema = data.schema || schema;
        } 
        this.setupDefinitions(data);
    }

    public save() {
        const data: IDocument = { schema: this.schemaInfo, definitions: {} };
        this.getCollections().map( (c: Definition | Collection) => data[c.$name] = this[c.$name].value());
        data.definitions = ifArrayToObject(data.definitions);
        fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
        this.load();
    }

    public parseRef(propertySchema: IProperty, count: number = 0) {
        if (!propertySchema) { return }
        let refSchema = propertySchema;
        if (propertySchema.type && this[propertySchema.type]) {
            if (refCache[`#/definitions/${propertySchema.type}`]) { 
                refSchema = refCache[`#/definitions/${propertySchema.type}`]; 
            } else {
                refSchema = this.parseRef({ $ref: `#/definitions/${propertySchema.type}`}, count+1);
                if (refSchema.items) {
                    refSchema.items = this.parseRef(refSchema.items, count+1);
                }
                refCache[`#/definitions/${propertySchema.type}`] = refSchema;
            }

            return {...refSchema, ...propertySchema, type: refSchema.type };
        } 
        if (refSchema.items) {
            refSchema.items = this.parseRef(refSchema.items, count+1);
        }
        // tslint:disable-next-line:no-suspicious-comment
        // TODO: check if line below is needed
        if (!refSchema.$ref || typeof refSchema.$ref !== 'string') { return refSchema; }

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
                // tslint:disable-next-line:no-suspicious-comment
                // TODO: check if line below is needed
                // refSchema = refSchema.value? refSchema.value() : refSchema;
            }
        }    
        
        return refSchema;
    }

    public getSchemaByPath(schemaPath: string | string[] = []): IDocument | IProperty {
        if (schemaCache[schemaPath.toString()]) { return schemaCache[schemaPath.toString()]; }
        
        const schemaParts = actualPath(schemaPath);

        if (!schemaPath.length) { 
            return { schema: [], definitions: this.schemaDefinitions.value() };
        }
        const collectionName = schemaParts.shift();
        
        const schemaCollection: IProperty = this.parseRef(this.schemaDefinitions.get(collectionName));
        if (!schemaParts.length) { return schemaCollection; }
        
        const parts: string[] = schemaParts;
        // tslint:disable-next-line:one-variable-per-declaration
        
        let properties: IProperties;
        if (schemaCollection.type === 'object') {
            properties = schemaCollection.properties;
        } else if (schemaCollection.type === 'array') {
            properties = schemaCollection.items.properties;
        }
        properties = ifArrayToObject(properties);

        let currSchema: IProperty = schemaCollection;
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
                currSchema = this.parseRef(properties[key], count);
                properties = currSchema.properties;
            }
            properties = ifArrayToObject(properties);
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
        if (!itemPath.length) { return this.getCollections().map( (c: Definition | Collection) => { return {name: c.$name}; }) }
        const collectionName = itemParts.shift();
        let collection;
        collection = this[collectionName];
                
        return collection.get(itemParts);
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
                //console.log('updateItemByPath', item, collectionId, itemParts, value);
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

    private setupDefinitions(data: IDocument) {
        this.schemaInfo = data.schema = data.schema || [{ uri: 'schema.json' }];

        const definitions: IProperties = data.schema.reduce( (acc: IDocument, curr: ISchema) => {
            if (curr.uri && fs.existsSync(curr.uri)) {
                const currSchema: IDocument = JSON.parse(fs.readFileSync(curr.uri).toString());
                for (const def of ifObjectToArray(currSchema.definitions)) {
                    acc[def.$name] = acc[def.$name] ? { ...acc[def.$name], ...def } : def;
                }
            }   

            return acc;
        },{});
        
        definitions.definitions.type = 'array';
        definitions.definitions.items = { type: 'property'};
        definitions.property.properties.properties.type = 'array';
        definitions.property.properties.properties.items = { type: 'property'};
        
        this.schemaDefinitions = new Definition('definitions', '#/definitions', ifArrayToObject(definitions));
        for (const schemaName of Object.keys(this.schemaDefinitions.value())) {
            this[schemaName] = this.schemaDefinitions.fromData(schemaName, data[schemaName]);
        }
    }

};

// tslint:disable:no-any
// tslint:disable:no-console

//import fs from "fs";
import objectPath from 'object-path';
import { BlockType, IEntity } from './interfaces';
import { Document } from './types';
import { actualPath } from './utils';

//const refCache = {};
//const schemaCache = {};

export class DataSource {
    private rootDocument: Document;
    private dataFile: string;

    constructor(dataFile: string) {
        this.dataFile = dataFile;
        this.rootDocument = Document.load(this.dataFile);
        this.save();    
    }

    public save() {
        //const data: IDocument = { schema: this.schemaInfo, definitions: {} };
        //this.getCollections().map( (c: Definition | Collection) => data[c.$name] = this[c.$name].value());
        //data.definitions = ifArrayToObject(data.definitions);
        //fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
        //this.rootDocument = Document.load(this.dataFile);
    }

    public getValue(schemaPath: string | string[] = []): any {
        const schemaParts = actualPath(schemaPath).join('/');

        return this.rootDocument.getValue(schemaParts);
    }

    public getDefinition(schemaPath: string | string[] = []): IEntity {
        const schemaParts = actualPath(schemaPath).join('/');
        const tests: string[] = [
            schemaParts, 
            `property/properties/${schemaParts.slice(schemaParts.lastIndexOf('/')+1)}`, 
            'property'
        ];
        let result;
        do {
            result = this.rootDocument.getDefinition(tests.shift());
        } while (!result && tests.length);
        
        return result;
    }

    public addItemByPath(itemPath: string, value: any) {
        const schemaPath = actualPath(itemPath);
        const schema = this.getDefinition(schemaPath.join('/'));

        switch (schema.$discriminator) {
            case BlockType.DEFINITIONS:
            case BlockType.PROPERTIES:
                // New object? input.value is the key
                if (Object(schema).type === 'object') {
                    objectPath.set(this.rootDocument, [...schemaPath, value], {});
                } else {
                    throw new Error('not implemented')
                }
                break;
            case BlockType.PROPERTY:
                //console.log('addItemByPath', itemPath, schema.type, value);
                if (schema.type === 'object') {
                    objectPath.set(this.rootDocument, schemaPath, value);
                } else if (schema.type === 'array') {
                    objectPath.push(this.rootDocument, schemaPath, value);
                } else {
                    throw new Error('not implemented')
                }
                break;
            default:
                throw new Error('not implemented')
        }
    }

    public updateItemByPath(itemPath: string, value?: any) {
        const schemaPath = actualPath(itemPath);
        const schema = this.getDefinition(schemaPath.join('/'));

        switch (schema.$discriminator) {
            case BlockType.DEFINITIONS:
            case BlockType.PROPERTIES:
                //console.log('updateItemByPath', itemPath, schema.$discriminator, value);
                if (value) {
                    objectPath.set(this.rootDocument, schemaPath, value);
                } else {
                    objectPath.del(this.rootDocument, schemaPath);
                }
                break;

            case BlockType.PROPERTY:
                //console.log('updateItemByPath2', itemPath, schema.type, value);
                if (schema.type === 'object') {
                    if (value !== undefined) {
                        objectPath.set(this.rootDocument, schemaPath, value);
                    } else {
                        objectPath.del(this.rootDocument, schemaPath);
                    }    
                } else {
                    throw new Error('not implemented')
                }
                break;
            default:
                throw new Error('not implemented')
        }
    }
    public removeItemByPath(itemPath: string) {
        this.updateItemByPath(itemPath);
    }
};

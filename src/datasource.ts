// tslint:disable:no-any
// tslint:disable:no-console

import fs from "fs";
import objectPath from 'object-path';
import { IProperty } from './interfaces';
import { Document } from './types';
import { actualPath, loadJSON } from './utils';

const defaultTypeValue = {
    'object': Object,
    'array': Array,
    'string': String,
    'number': Number,
    'boolean': Boolean
};

export abstract class BaseDataSource {
    private schemaFile: string;
    private schemaDocument: Document;

    constructor(schemaFile: string) {
        this.schemaFile = schemaFile;
    }

    public async initialize() {
        this.schemaDocument = await Document.load(this.schemaFile);
    } 

    public getDefinition(schemaPath: string): IProperty {
        const schemaParts = actualPath(schemaPath);

        return this.schemaDocument.getDefinition(schemaParts);
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async abstract get(itemPath?: string);
    // tslint:disable-next-line:no-reserved-keywords
    public async abstract set(itemPath: string, value: any)
    public async abstract push(itemPath: string, value: any);
    public async abstract del(itemPath: string);
    public async abstract save();
}

export class FileSystemDataSource extends BaseDataSource {
    private dataFile: string;
    private jsonDocument: any;

    constructor(schemaFile: string, dataFile: string) {
        super(schemaFile);
        this.dataFile = dataFile;
        this.jsonDocument = loadJSON(this.dataFile) || {};
    }

    public async save() {
        fs.writeFileSync(this.dataFile, JSON.stringify(this.jsonDocument, null, 2));
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async get(itemPath?: string) {
        if (!itemPath) { return this.jsonDocument; }

        const schemaParts = actualPath(itemPath);

        return objectPath.get(this.jsonDocument, schemaParts.split('/'));
    }

    public async push(itemPath: string, value: any) {
        const schemaPath = actualPath(itemPath);
        const schema = this.getDefinition(schemaPath);
    
        //console.log('addItemByPath', schemaPath.split('/'), schema.type, value);
        if (schema.type === 'array') {
            const arrayItemSchema: any = schema.items;
            const arrayItemType = arrayItemSchema && arrayItemSchema.type;
    
            if (value === undefined) {
                // tslint:disable-next-line:no-parameter-reassignment
                value = typeof defaultTypeValue[arrayItemType] === 'function' ? defaultTypeValue[arrayItemType]() : defaultTypeValue[arrayItemType];
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
        const schemaPath = actualPath(itemPath);
        objectPath.set(this.jsonDocument, schemaPath.split('/'), value);
        this.save();
    }

    public async del(itemPath: string) {
        const schemaPath = actualPath(itemPath);
        objectPath.del(this.jsonDocument, schemaPath.split('/'));
        this.save();
    }
};

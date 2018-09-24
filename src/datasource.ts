// tslint:disable:no-any
// tslint:disable:no-console

import ajv from 'ajv';
import fs from "fs";
import objectPath from 'object-path';
import { IProperty } from './interfaces';
import { Document } from './types';
import { actualPath, loadJSON } from './utils';

const defaultTypeValue = {
    'object': (value?: any) => value? { ...value }: {},
    'array': (value?: any) => value? [ ...value ]: [],
    'string': (value?: any)=> `${value||''}`,
    'number': (value?: any)=> parseFloat(value) || 0,
    'integer': (value?: any)=> parseFloat(value) || 0,
    'boolean': (value?: any) => (value === true || value === 'true' || value === 1 || value === '1' || value === 'yes')
};

function getType(value: any) {
    // tslint:disable-next-line:no-reserved-keywords
    const type = typeof value;
    if (type === 'object') {
        return value ? Object.prototype.toString.call(value).slice(8, -1) : 'null';
    }

    return type;
}

export abstract class BaseDataSource {
    public schemaDocument: Document;
    public validator: any;
    private schemaFile: string;

    constructor(schemaFile: string) {
        this.schemaFile = schemaFile;
        this.validator = new ajv({ coerceTypes: true });
    }

    public async initialize() {
        this.schemaDocument = await Document.load(this.schemaFile);
        await this.setup();
    } 

    public getDefinition(schemaPath: string): IProperty {
        const schemaParts = actualPath(schemaPath);

        return this.schemaDocument.getDefinition(schemaParts);
    }

    public abstract setup(); 
    // tslint:disable-next-line:no-reserved-keywords
    public async abstract get(itemPath?: string);
    // tslint:disable-next-line:no-reserved-keywords
    public async abstract set(itemPath: string, value: any)
    public async abstract push(itemPath: string, value: any);
    public async abstract del(itemPath: string);
    public async abstract save();

    protected coerce(schema: IProperty, value?: any) {
        if (schema.type && !Array.isArray(schema.type) && typeof defaultTypeValue[schema.type] === 'function') {
            // tslint:disable-next-line:no-parameter-reassignment
            if (!value || ((schema.type !== 'number' && schema.type !== 'integer') || 
                /^(\d+|\d*(\.\d+)?)$/.test(value))) {
                return defaultTypeValue[schema.type](value || schema.default);                
            }
        }

        return value;
    }

    protected validate(schema: any, data: any) {
        return this.validator.validate(schema, data);
    }
}

export class MemoryDataSource extends BaseDataSource {
    protected jsonDocument: any;

    constructor(schemaFile: string) {
        super(schemaFile);
    }

    public async setup() {
        const schema = this.getDefinition('');
        this.jsonDocument = this.coerce(schema);
    }

    // tslint:disable-next-line:no-empty
    public async save() {}

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

            // tslint:disable-next-line:no-parameter-reassignment
            value = this.coerce(arrayItemSchema, value);    

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
            const schemaPath = actualPath(itemPath);
            const schema = this.getDefinition(schemaPath);
            const prepValue = this.coerce(schema, value);
            if (!this.validate(schema, prepValue)) {
                throw new Error(JSON.stringify(this.validator.errors));
            }
            objectPath.set(this.jsonDocument, schemaPath.split('/'), prepValue);
            this.save();                
        }
    }

    public async del(itemPath: string) {
        const schemaPath = actualPath(itemPath);
        objectPath.del(this.jsonDocument, schemaPath.split('/'));
        this.save();
    }
};

export class FileSystemDataSource extends MemoryDataSource {
    private dataFile: string;

    constructor(schemaFile: string, dataFile: string) {
        super(schemaFile);
        this.dataFile = dataFile;
    }

    public async setup() {
        const schema = this.getDefinition('');
        const defaultValue = this.coerce(schema);
        this.jsonDocument = loadJSON(this.dataFile);
        if (!this.jsonDocument || getType(this.jsonDocument) !== getType(defaultValue)) {
            this.jsonDocument = defaultValue;
        }
    }

    public async save() {
        fs.writeFileSync(this.dataFile, JSON.stringify(this.jsonDocument, null, 2));
    }

};

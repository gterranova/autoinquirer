// tslint:disable:no-any
// tslint:disable:no-console

import ajv from 'ajv';
import { IProperty } from '../interfaces';
import { Document } from '../types';
import { actualPath } from '../utils';

const defaultTypeValue = {
    'object': (value?: any) => value? { ...value }: {},
    'array': (value?: any) => value? [ ...value ]: [],
    'string': (value?: any)=> value ||'',
    'number': (value?: any)=> parseFloat(value) || 0,
    'integer': (value?: any)=> parseFloat(value) || 0,
    'boolean': (value?: any) => (value === true || value === 'true' || value === 1 || value === '1' || value === 'yes')
};

export abstract class DataSource {
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

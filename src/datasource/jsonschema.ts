// tslint:disable:no-any
// tslint:disable-next-line:import-name
import $RefParser from 'json-schema-ref-parser';

import ajv from 'ajv';
import { IProperty } from '../interfaces';
import { loadJSON } from '../utils';
import { DataSource } from './index';

const defaultTypeValue = {
    'object': (value?: any) => value? { ...value }: {},
    'array': (value?: any) => value? [ ...value ]: [],
    'string': (value?: any)=> value ||'',
    'number': (value?: any)=> parseFloat(value) || 0,
    'integer': (value?: any)=> parseFloat(value) || 0,
    'boolean': (value?: any) => (value === true || value === 'true' || value === 1 || value === '1' || value === 'yes')
};

export class JsonSchema extends DataSource {
    private validator: any;
    private schemaData: IProperty;

    constructor(data: IProperty | string) {
        super();
        this.validator = new ajv({ coerceTypes: true });
        this.schemaData = (typeof data === 'string') ? loadJSON(data) : data;
    }

    public async connect() {
        const parser = new $RefParser();
        this.schemaData = await parser.dereference(this.schemaData);
    } 

    public async close() {
        // pass
    } 
    
    // tslint:disable-next-line:no-reserved-keywords
    public async get(itemPath?: string) {
        let definition = this.schemaData;
        if (!itemPath || !itemPath.length) { 
            return definition;
        }
        const parts = itemPath.split('/');

        while (definition && parts.length) {
            const key = parts.shift();

            if (definition.type === 'array' && key==='items' || (/^[a-f0-9-]{24}$/.test(key) || /^\d+$/.test(key) || /^#$/.test(key))) {
                definition = definition.items;
            } else if (definition.type === 'object' && definition.properties && definition.properties[key]) {
                definition = definition.properties[key];
            } else if (definition.type === 'object' && key==='properties') {
                definition = definition.properties;
            } else {
                definition = definition[key];
            }
        }

        return definition;
    }
    
    // tslint:disable-next-line:no-reserved-keywords
    public set() {
        throw new Error("Method not implemented.");
    }
    
    public push() {
        throw new Error("Method not implemented.");
    }
    
    public del() {
        throw new Error("Method not implemented.");
    }
    
    public delCascade() {
        throw new Error("Method not implemented.");
    }
    
    public coerce(schema: IProperty, value?: any) {
        if (schema.type && !Array.isArray(schema.type) && typeof defaultTypeValue[schema.type] === 'function') {
            // tslint:disable-next-line:no-parameter-reassignment
            if (!value || ((schema.type !== 'number' && schema.type !== 'integer') || 
                /^(\d+|\d*(\.\d+)?)$/.test(value))) {
                return defaultTypeValue[schema.type](value || schema.default);                
            }
        }

        return value;
    }

    public validate(schema: IProperty, data: any) {
        const value = this.coerce(schema, data);
        if (!this.validator.validate(schema, value)) {
            throw new Error(this.validator.errors.map( (err: any) => err.message ).join('\n'));
        };
        
        return value;
    }

}

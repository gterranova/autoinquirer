// tslint:disable:no-any
// tslint:disable-next-line:import-name
import $RefParser from 'json-schema-ref-parser';

import ajv from 'ajv';
import path from 'path';
import { IProperty } from '../interfaces';
import { findUp, getType, loadJSON } from '../utils';
import { DataSource } from './index';

const defaultTypeValue = {
    'object': (value?: any) => getType(value) === 'Object' ? value: {},
    'array': (value?: any[]) => Array.isArray(value)? value: [],
    'string': (value?: any)=> value !== undefined? value.toString(): value,
    'number': (value?: string)=> parseFloat(value) || 0,
    'integer': (value?: string)=> parseFloat(value) || 0,
    'boolean': (value?: boolean | string | number) => (value === true || value === 'true' || value === 1 || value === '1' || value === 'yes')
};

export class JsonSchema extends DataSource {
    private validator: any;
    private schemaData: IProperty;
    private basePath: string;

    constructor(data: IProperty | string) {
        super();
        this.validator = new ajv({ coerceTypes: true });
        this.schemaData = (typeof data === 'string') ? loadJSON(data) : data;
        this.basePath = (typeof data === 'string') ? path.resolve(path.dirname(data)) : path.resolve(path.dirname(findUp('package.json', process.cwd())));
    }

    public async connect() {
        const parser = new $RefParser();
        const currentPath = process.cwd();
        process.chdir(this.basePath);
        this.schemaData = await parser.dereference(this.schemaData);
        process.chdir(currentPath);
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
            } else if (definition.type === 'object' && definition.patternProperties) {
                const patternFound = Object.keys(definition.patternProperties).find( (pattern: string) => RegExp(pattern).test(key));
                if (patternFound) {
                    definition = definition.patternProperties[patternFound];
                } else {
                    definition = undefined;
                }
            } else {
                definition = definition[key];
            }
        }

        return definition;
    }
        
    public coerce(schema: IProperty, value?: any) {
        if (schema.type && !Array.isArray(schema.type) && typeof defaultTypeValue[schema.type] === 'function') {
            // tslint:disable-next-line:no-parameter-reassignment
            if (value !== undefined || ((schema.type !== 'number' && schema.type !== 'integer') || 
                /^(\d+|\d*(\.\d+)?)$/.test(value))) {
                return defaultTypeValue[schema.type](value !== undefined? value: schema.default);                
            }
        }

        return value;
    }

    public validate(schema?: IProperty, data?: any) {
        if (schema === undefined) { return; }
        // avoid ajv RangeError: Maximum call stack size exceeded
        // tslint:disable-next-line:no-parameter-reassignment
        schema = {...schema, $ref: undefined};
        const value = this.coerce(schema, data !== undefined? data: schema.default);
        // tslint:disable-next-line:triple-equals
        if (value !== schema.default && value !== undefined && (data !== undefined || schema.default  !== undefined) && value.toString() !== (data !== undefined? data: schema.default).toString()) {
            // tslint:disable-next-line:no-console
            //console.log(schema, value, data);
            throw new Error(`Error: expecting an ${schema.type}`); 
        }
        if (!this.validator.validate(schema, value)) {
            throw new Error(this.validator.errors.map( (err: any) => err.message ).join('\n'));
        };
        
        return value;
    }

    public async dispatch(methodName: string, itemPath?: string, schema?: IProperty, value?: any, parentPath?: string, params?: any) {
        if (!this[methodName]) {
            throw new Error(`Method ${methodName} not implemented`);
        }

        // tslint:disable-next-line:no-return-await
        return await this[methodName].call(this, itemPath, schema, value, parentPath, params);
    }
}

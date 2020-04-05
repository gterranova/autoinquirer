// tslint:disable:no-any
// tslint:disable-next-line:import-name
import $RefParser from "@apidevtools/json-schema-ref-parser";

import ajv from 'ajv';
import path from 'path';
import * as _ from 'lodash';

import { IProperty, IDispatchOptions } from './interfaces';
import { findUp, loadJSON } from './utils';
import { AbstractDataSource } from './datasource';

const defaultTypeValue = {
    'object': (value?: any) => _.isObject(value) ? value : {},
    'array': (value?: any[]) => _.isArray(value) ? value : [],
    'string': (value?: any) => _.toString(value),
    'number': (value?: string) => parseFloat(value) || 0,
    'integer': (value?: string) => parseFloat(value) || 0,
    'boolean': (value?: boolean | string | number) => (value === true || value === 'true' || value === 1 || value === '1' || value === 'yes')
};

export class JsonSchema extends AbstractDataSource {
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

    // tslint:disable-next-line:no-reserved-keywords cyclomatic-complexity
    public async get(options?: IDispatchOptions) {
        let definition = this.schemaData;
        if (!options?.itemPath?.length) {
            return definition;
        }
        const parts = options.itemPath.split('/');

        while (definition && parts.length) {
            const key = parts.shift();

            if (definition.type === 'array' && key === 'items' ||
                (/^[a-f0-9-]{24}$/.test(key) || /^\d+$/.test(key) || /^#$/.test(key)) ||
                (definition.items?.properties?.slug)) {
                definition = definition.items;
            } else if (definition.type === 'object' && definition.properties?.[key]) {
                definition = definition.properties[key];
            } else if (definition.type === 'object' && key === 'properties') {
                definition = definition.properties;
            } else if (definition.type === 'object' && definition.patternProperties) {
                const patternFound = Object.keys(definition.patternProperties).find((pattern: string) => RegExp(pattern).test(key));
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
                return defaultTypeValue[schema.type](value !== undefined ? value : schema.default);
            }
        }

        return value;
    }

    public validate(schema?: IProperty, data?: any) {
        if (schema === undefined) { return; }
        // avoid ajv RangeError: Maximum call stack size exceeded
        // tslint:disable-next-line:no-parameter-reassignment
        schema = { ...schema, $ref: undefined };
        const value = this.coerce(schema, data !== undefined ? data : schema.default);
        // tslint:disable-next-line:triple-equals
        if (value !== schema.default && value !== undefined && (data !== undefined || schema.default !== undefined) && value.toString() !== (data !== undefined ? data : schema.default).toString()) {
            // tslint:disable-next-line:no-console
            //console.log(schema, value, data);
            throw new Error(`Error: expecting an ${schema.type}`);
        }
        try {
            if (!this.validator.validate(schema, value)) {
                throw new Error(JSON.stringify(this.validator.errors, null, 2));
            };
        } catch (error) {
            // Recursion maybe
            if (!~error.message.indexOf("Converting circular structure to JSON")) {
                throw error;
            };
        }
        return value;
    }

    public async dispatch(methodName: string, options?: IDispatchOptions) {
        if (!this[methodName]) {
            throw new Error(`Method ${methodName} not implemented`);
        }

        // tslint:disable-next-line:no-return-await
        return await this[methodName].call(this, options);
    }
}

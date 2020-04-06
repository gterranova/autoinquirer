// tslint:disable:no-any
// tslint:disable:no-console
import fs from "fs";
import * as _ from 'lodash';
import objectPath from 'object-path';
import { IProperty, IDispatchOptions } from './interfaces';
import { loadJSON, objectId } from './utils';
import { AbstractDispatcher } from './datasource';
import { JsonSchema } from './jsonschema';

export class JsonDataSource extends AbstractDispatcher {
    private jsonDocument: any;
    private dataFile: string;

    constructor(data: any) {
        super();
        this.dataFile = (typeof data === 'string') ? data : undefined;
        this.jsonDocument = this.dataFile !== undefined ? loadJSON(this.dataFile) : data;
    }

    public async connect() {
        // Nothing to do
    }

    public async close() {
        return this.save();
    }

    public async save() {
        if (this.dataFile) { fs.writeFileSync(this.dataFile, JSON.stringify(this.jsonDocument, null, 2)); }
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async getSchema(options?: IDispatchOptions, schemaSource?: JsonSchema): Promise<IProperty> {
        const { parentPath, itemPath} = options;
        //throw new Error("Method not implemented.");
        // Do not raise an error 
        const newPath = [parentPath, itemPath].filter( p => p?.length).join('/');
        return await schemaSource.get({ itemPath: newPath });
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async get(options?: IDispatchOptions) {
        if (!options?.itemPath) {
            //console.log(itemPath, schema?.type, getType(this.jsonDocument), Array.isArray(this.jsonDocument))
            if (options?.schema?.type === 'array' && !Array.isArray(this.jsonDocument)) {
                //console.log(itemPath, schema.type, typeof this.jsonDocument)
                return this.jsonDocument? [this.jsonDocument]: [];
            } 
            return this.jsonDocument; 
        }
        if (options.itemPath.indexOf('#') != -1) {
            const base = options.itemPath.split('#', 1)[0];
            const remaining = options.itemPath.slice(base.length+1);
            const baseItems = objectPath.get(this.jsonDocument, (await this.convertObjIDToIndex(base)).split('/').filter( p => p != '')) || [];
            const result = await Promise.all(baseItems.map( async baseItem => {
                let _fullPath = [base, remaining].join(baseItem._id);
                if (remaining.indexOf('#') == -1) {
                    if (options.schema?.$data?.remoteField) {
                        _fullPath = [_fullPath, options.schema.$data.remoteField].join('/');
                    }
                    return { _fullPath, ...await this.get({ itemPath: _fullPath, schema: options.schema }) };
                }
                return await this.get({ itemPath: [base, remaining].join(baseItem._id), schema: options.schema});
            } ));
            //console.log(result);
            return _.flatten(result);
        }
        const schemaPath = await this.convertObjIDToIndex(options.itemPath);
        return objectPath.get(this.jsonDocument, schemaPath.split('/'));
    }

    public async push({ itemPath, value }) {
        if (value !== undefined) {
            if (_.isObject(value)) {
                value._id = objectId();
            }

            if (!itemPath) {
                this.jsonDocument.push(value);
            } else {
                const schemaPath = await this.convertObjIDToIndex(itemPath);
                objectPath.push(this.jsonDocument, schemaPath.split('/'), value);
            }
            this.save();

            return value;
        }
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async set({ itemPath, value }) {
        if (value !== undefined) {
            if (!itemPath) {
                this.jsonDocument = value;
            } else {
                const schemaPath = await this.convertObjIDToIndex(itemPath);
                objectPath.set(this.jsonDocument, schemaPath.split('/'), value);
            }
            this.save();
        }
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async update(options?: IDispatchOptions) {
        const { itemPath, value } = options;
        let newValue;
        if (value !== undefined) {
            if (!itemPath) {
                newValue = this.jsonDocument = { ...this.jsonDocument, ...value };
            } else {
                const schemaPath = await this.convertObjIDToIndex(itemPath);
                // tslint:disable-next-line:no-parameter-reassignment
                newValue = { ...objectPath.get(this.jsonDocument, schemaPath.split('/')), ...value };
                objectPath.set(this.jsonDocument, schemaPath.split('/'), newValue);
            }
            this.save();
            return newValue;
        }
    }

    public async del({ itemPath }) {
        if (!itemPath) {
            this.jsonDocument = undefined;
            this.save();

            return;
        }
        const schemaPath = await this.convertObjIDToIndex(itemPath);
        objectPath.del(this.jsonDocument, schemaPath.split('/'));
        this.save();
    }

    public async delCascade({ itemPath }) {
        // Nothing to do
        itemPath;
    }

    public async dispatch(methodName: string, options?: IDispatchOptions) {
        if (!this[methodName]) {
            throw new Error(`Method ${methodName} not implemented`);
        }

        // tslint:disable-next-line:no-return-await
        return await this[methodName].call(this, options);
    }

}

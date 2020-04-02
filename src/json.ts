// tslint:disable:no-any
// tslint:disable:no-console
import fs from "fs";
import * as _ from 'lodash';
import objectPath from 'object-path';
import { IProperty } from './interfaces';
import { getType, loadJSON, objectId } from './utils';
import { DataSource } from './datasource';
import { JsonSchema } from './jsonschema';

export class JsonDataSource extends DataSource {
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
    public getSchema(itemPath?: string, schemaSource?: JsonSchema, _parentPath?: string, _params?: any): Promise<IProperty> {
        //throw new Error("Method not implemented.");
        // Do not raise an error 
        return schemaSource.get(itemPath);
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async get(itemPath?: string, schema?: IProperty) {
        if (!itemPath) {
            //console.log(itemPath, schema?.type, getType(this.jsonDocument), Array.isArray(this.jsonDocument))
            if (schema && schema.type === 'array' && !Array.isArray(this.jsonDocument)) {
                //console.log(itemPath, schema.type, typeof this.jsonDocument)
                return this.jsonDocument? [this.jsonDocument]: [];
            } 
            return this.jsonDocument; 
        }
        if (itemPath.indexOf('#') != -1) {
            const base = itemPath.split('#', 1)[0];
            const remaining = itemPath.slice(base.length+1);
            const baseItems = objectPath.get(this.jsonDocument, (await this.convertObjIDToIndex(base)).split('/').filter( p => p != '')) || [];
            const result = await Promise.all(baseItems.map( async baseItem => {
                let _fullPath = [base, remaining].join(baseItem._id);
                if (remaining.indexOf('#') == -1) {
                    if (schema.$data?.remoteField) {
                        _fullPath = [_fullPath, schema.$data.remoteField].join('/');
                    }
                    return { _fullPath, ...await this.get(_fullPath, schema) };
                }
                return await this.get([base, remaining].join(baseItem._id), schema);
            } ));
            //console.log(result);
            return _.flatten(result);
        }
        const schemaPath = await this.convertObjIDToIndex(itemPath);
        return objectPath.get(this.jsonDocument, schemaPath.split('/'));
    }

    public async push(itemPath: string, _?: IProperty, value?: any) {
        if (value !== undefined) {
            if (getType(value) === 'Object') {
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
    public async set(itemPath: string, _: IProperty, value: any) {
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
    public async update(itemPath: string, _: IProperty, value: any) {
        if (value !== undefined) {
            if (!itemPath) {
                this.jsonDocument = { ...this.jsonDocument, ...value };
            } else {
                const schemaPath = await this.convertObjIDToIndex(itemPath);
                // tslint:disable-next-line:no-parameter-reassignment
                value = { ...objectPath.get(this.jsonDocument, schemaPath.split('/')), ...value };
                objectPath.set(this.jsonDocument, schemaPath.split('/'), value);
            }
            this.save();

            return value;
        }
    }

    public async del(itemPath?: string) {
        if (!itemPath) {
            this.jsonDocument = undefined;
            this.save();

            return;
        }
        const schemaPath = await this.convertObjIDToIndex(itemPath);
        objectPath.del(this.jsonDocument, schemaPath.split('/'));
        this.save();
    }

    public async delCascade(itemPath?: string) {
        // Nothing to do
        itemPath;
    }

    public async dispatch(methodName: string, itemPath?: string, schema?: IProperty, value?: any, parentPath?: string, params?: any) {
        if (!this[methodName]) {
            throw new Error(`Method ${methodName} not implemented`);
        }

        // tslint:disable-next-line:no-return-await
        return await this[methodName].call(this, itemPath, schema, value, parentPath, params);
    }

}

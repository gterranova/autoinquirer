// tslint:disable:no-any
// tslint:disable:no-console
import fs from "fs";
import { basename, resolve } from 'path';
import * as _ from 'lodash';
import objectPath from 'object-path';
import { IProperty, IDispatchOptions, Action } from './interfaces';
import { loadJSON, objectId } from './utils';
import { AbstractDispatcher, AbstractDataSource } from './datasource';

export class JsonDataSource extends AbstractDispatcher {
    private jsonDocument: any;
    private dataFile: string;

    constructor(data: any) {
        super();
        this.dataFile = (typeof data === 'string') ? resolve(process.cwd(), data) : undefined;
        this.jsonDocument = this.dataFile !== undefined ? loadJSON(this.dataFile) : data;
    }

    public async connect(parentDispatcher: AbstractDispatcher) {
        this.setParent(parentDispatcher);
    }

    public async close() {
        return this.save();
    }

    public async save() {
        if (this.dataFile) { fs.writeFileSync(this.dataFile, JSON.stringify(this.jsonDocument, null, 2)); }
    }

    public getSchemaDataSource(): AbstractDataSource {
        if (!this.parentDispatcher) {
            //throw new Error("JsonDataSource requires a parent dispatcher");
            return {...this, get: (o) => this.getSchema(o) };
        }
        return this.parentDispatcher.getSchemaDataSource();
    }

    public getDataSource(): AbstractDataSource {
        return this;
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async getSchema(options?: IDispatchOptions): Promise<IProperty> {
        if (!this.parentDispatcher) {
            return {};
        }

        const { parentPath, itemPath} = options;
        //throw new Error("Method not implemented.");
        // Do not raise an error 
        const newPath = [parentPath, itemPath].filter( p => p?.length).join('/');
        return await this.parentDispatcher.getSchemaDataSource().get({ itemPath: newPath });
    }

    public async isMethodAllowed(_methodName: string, _options?: IDispatchOptions) {
        return true;     
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async get(options?: IDispatchOptions) {
        if (!options?.itemPath) {
            if (options?.schema?.type === 'array' && !Array.isArray(this.jsonDocument)) {
                //console.log(itemPath, schema.type, typeof this.jsonDocument)
                return this.jsonDocument? [this.jsonDocument]: [];
            } 
            return this.jsonDocument; 
        }
        const { jsonObjectID: schemaPath} = await this.convertObjIDToIndex(options);
        let schema = await this.getSchemaDataSource().get({ itemPath: options.itemPath });
        let $order = [];
        if (schema?.type === 'array') {
            $order = schema.$orderBy || [];
            //schema = schema.items;
        } else if (schema?.type === 'object') {
            schema = schema?.properties?.[basename(options.itemPath)];
            $order = schema?.$orderBy || [];
        }
        let value = objectPath.get(this.jsonDocument, schemaPath.split('/'));
        if ($order.length) {
            const order = _.zip(...$order.map( o => /^!/.test(o)? [o.slice(1), 'desc'] : [o, 'asc']));
            value = _.orderBy(value, ...order);                    
            //console.log({itemPath: options.itemPath, schemaPath, type: schema.type, order});
        } 
        return value;
    }

    public async push(options: IDispatchOptions) {
        const { itemPath, value } = options;
        if (value !== undefined) {
            if (_.isObject(value)) {
                (<any>value)._id = objectId();
            }

            if (!itemPath) {
                this.jsonDocument.push(value);
            } else {
                const { jsonObjectID: schemaPath} = await this.convertObjIDToIndex(options);
                objectPath.push(this.jsonDocument, schemaPath.split('/'), value);
            }
            this.save();

            return value;
        }
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async set(options: IDispatchOptions) {
        const { itemPath, value } = options;
        if (value !== undefined) {
            if (!itemPath) {
                this.jsonDocument = value;
            } else {
                const { jsonObjectID: schemaPath} = await this.convertObjIDToIndex(options);
                objectPath.set(this.jsonDocument, schemaPath.split('/'), value);
            }
            this.save();
        }
        return value;
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async update(options?: IDispatchOptions) {
        const { itemPath, value } = options;
        let newValue;
        if (value !== undefined) {
            if (!itemPath) {
                newValue = _.merge(this.jsonDocument, value);
            } else {
                const { jsonObjectID: schemaPath} = await this.convertObjIDToIndex(options);
                // tslint:disable-next-line:no-parameter-reassignment
                newValue = _.merge(objectPath.get(this.jsonDocument, schemaPath.split('/')), value);
                objectPath.set(this.jsonDocument, schemaPath.split('/'), newValue);
            }
            this.save();
        }
        return newValue;
    }

    public async delete(options: IDispatchOptions) {
        const { itemPath } = options;
        if (!itemPath) {
            this.jsonDocument = undefined;
            this.save();

            return;
        }
        const { jsonObjectID: schemaPath} = await this.convertObjIDToIndex(options);
        objectPath.del(this.jsonDocument, schemaPath.split('/'));
        this.save();
    }

    public async delCascade({ itemPath }) {
        // Nothing to do
        itemPath;
    }

    public async dispatch(methodName: Action, options?: IDispatchOptions) {
        if (!this[methodName]) {
            throw new Error(`Method ${methodName} not implemented`);
        }

        if (this.requestHasWildcards(options)) {
            return await this.processWildcards(methodName, options);
        }
        
        // tslint:disable-next-line:no-return-await
        return await this[methodName].call(this, options);
    }

}

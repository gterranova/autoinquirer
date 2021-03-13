// tslint:disable:no-any
// tslint:disable:no-console
import fs from "fs";
import { basename, resolve } from 'path';
import * as _ from 'lodash';
import objectPath from 'object-path';
import { IProperty, IDispatchOptions, Action } from './interfaces';
import { loadJSON, objectId } from './utils';
import { AbstractDispatcher, AbstractDataSource } from './datasource';

function mergeDeep(...objects) {
    const isObject = obj => obj && typeof obj === 'object';
    
    return objects.reduce((prev, obj) => {
      Object.keys(obj).forEach(key => {
        const pVal = prev[key];
        const oVal = obj[key];
        
        if (Array.isArray(pVal) && Array.isArray(oVal)) {
            _.each(oVal, v => {
                const pArrayItem = _.find(pVal, { _id: v._id });
                if (pArrayItem){
                    const pIdx = pVal.indexOf(pArrayItem);
                    //console.log("Found", key, v);
                    prev[key][pIdx] = mergeDeep(pArrayItem, v);
                } else {
                    //console.log("NOT Found", key, v);
                    if (!pVal.includes(v))
                        prev[key].push(v);
                }
            });
        }
        else if (isObject(pVal) && isObject(oVal)) {
          prev[key] = mergeDeep(pVal, oVal);
        }
        else {
          prev[key] = oVal;
        }
      });
      
      return prev;
    }, {});
}

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
        //if (!this.parentDispatcher) {
            //throw new Error("JsonDataSource requires a parent dispatcher");
            return {...this, get: (o) => this.getSchema(o) };
        //}
        //return this.parentDispatcher.getSchemaDataSource();
    }

    public getDataSource(): AbstractDataSource {
        return this;
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async getSchema(options?: IDispatchOptions): Promise<IProperty> {
        options = _.defaults(options, { itemPath: '', params: {} });
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
        const { archived } = (options?.params || {});
        const jsonDocument = archived? loadJSON(this.dataFile.replace('.json', '.archive.json')): this.jsonDocument;
        if (!options?.itemPath) {
            if (options?.schema?.type === 'array' && !Array.isArray(jsonDocument)) {
                //console.log(itemPath, schema.type, typeof jsonDocument)
                return jsonDocument? [jsonDocument]: [];
            } 
            return jsonDocument; 
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
        let value = objectPath.get(jsonDocument, schemaPath.split('/'));
        if ($order.length) {
            const order = _.zip(...$order.map( o => /^!/.test(o)? [o.slice(1), 'desc'] : [o, 'asc']));
            value = _.orderBy(value, ...order);                    
            //console.log({itemPath: options.itemPath, schemaPath, type: schema.type, order});
        } 
        return value;
    }

    public async push(options: IDispatchOptions) {
        const { itemPath, schema } = options;
        let value = options.value;
        if (value !== undefined) {
            if (schema?.type === 'array' && schema?.items?.type === 'object' && value?._id) {
                /* copy&paste op? */
                value = this.prepareValue({...options, schema: schema.items}, { [value._id]: objectId() }, true);
            } else if (schema?.type === 'object' && value?._id) {
                throw new Error("Pushing to an object");
            } else if (_.isObject(value)) {
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

    private prepareValue(options, idsMap = {}, firstCall = false) {
        const { schema } = options;
        let value = options.value;
        //console.log('prepareValue', schema)
        if (schema.type === 'object') {
            /* copy&paste op? */
            if (value?._id) {
                value._id = idsMap[value._id] = idsMap[value._id]? idsMap[value._id]: objectId();
                if (firstCall && value.slug) value.slug = value._id;
                _.keys(schema.properties).map( prop => {
                    if (prop == 'slug' && value.slug) {
                        value.slug = value._id;
                    } else if (~['object', 'array'].indexOf(schema.properties[prop].type)) {
                        value[prop] = this.prepareValue({...options, schema: schema.properties[prop], value: value[prop]}, idsMap);
                    } 
                });
            }
        } else if (schema.type === 'array' && _.isArray(value)) {
            //console.log("prepareArray", schema.items, value)
            value = value.map( item => this.prepareValue({...options, schema: schema.items, value: item}, idsMap))
        }
        if (firstCall) {
            value = value && JSON.parse(_.reduce(_.keys(idsMap), (acc, oldId) => {
                //console.log("REPLACE", oldId, "with", idsMap[oldId]);
                return acc.replace(RegExp(oldId, 'g'), idsMap[oldId]);
            }, JSON.stringify(value)));    
        }
        return value;
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async set(options: IDispatchOptions) {
        const { itemPath, schema } = options;
        let value = options.value;
        if (value !== undefined) {
            if (!itemPath) {
                this.jsonDocument = value;
            } else {
                if (schema?.type === 'object' && value?._id) {
                    /* copy&paste op? */
                    const oldValue = <any>(await this.dispatch(Action.GET, options));
                    value = this.prepareValue(options, { [value._id]: oldValue._id }, true);
                }        
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

    private async prepareArchiveValue(schemaPathArray: string[], value?: any) {
        const currentValue = schemaPathArray.length? objectPath.get(this.jsonDocument, schemaPathArray): this.jsonDocument;
        if (!value) {
            value = currentValue;
        }
        if (!schemaPathArray.length) {
            return value;
        }
        const schema = await this.getSchema({ itemPath: schemaPathArray.join('/')});
        const prop = schemaPathArray.pop();
        if (schema.type === 'array') {
            //console.log("array", _.isArray(value)? value : [value] );
            return this.prepareArchiveValue(schemaPathArray, { [prop]: _.isArray(value)? value : [value] });
        } else if (schema.type === 'object') {
            if (/^[0-9]+$/.test(prop)) {
                return this.prepareArchiveValue(schemaPathArray, [{...value, _id: value._id || currentValue._id}] );
            }
            return this.prepareArchiveValue(schemaPathArray, { [prop]: {...value, _id: value._id || currentValue._id} } );
            
        }
        return value;
    }

    public async archive(options: IDispatchOptions) {
        if (!this.dataFile) return {};
        const archiveFile = this.dataFile.replace('.json', '.archive.json');
        let archive = loadJSON(archiveFile);
        const { jsonObjectID: schemaPath} = await this.convertObjIDToIndex(options);
        const value = await this.prepareArchiveValue(schemaPath.length? schemaPath.split('/'): []);
        //console.log("Archive", value, "in", schemaPath.split('/'))
        fs.writeFileSync(archiveFile, JSON.stringify(mergeDeep(archive, value), null, 2));
        return { message: "ok", value };
    }

    public async delCascade({ itemPath }) {
        // Nothing to do
        itemPath;
    }

    public async dispatch(methodName: Action, options?: IDispatchOptions) {
        options = _.defaults(options, { itemPath: '', params: {} });
        if (/^archived\/?/.test(options.itemPath)) {
            options.itemPath = options.itemPath.replace(/^archived\/?/, '');
            options.params = {...options.params, archived: true };
        }
        if (options.params?.archived && methodName !== Action.GET) 
            throw new Error(`Method ${methodName} not implemented for archived items`);

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

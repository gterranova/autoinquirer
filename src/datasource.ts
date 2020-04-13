import * as _ from 'lodash';

import { IProperty, IDispatchOptions } from './interfaces';
import { isObject } from 'lodash';

// tslint:disable:no-console

// tslint:disable-next-line:no-any
export declare type Item = any;
// tslint:disable-next-line:no-any
export declare type Param = any;

export abstract class AbstractDataSource {
    public async abstract connect(): Promise<void>;
    public async abstract close(): Promise<void>;

    public async abstract get(options?: IDispatchOptions): Promise<Item>;
    public async abstract dispatch(methodName: string, options?: IDispatchOptions);

    public async convertObjIDToIndex(path: string | string[], basePath: string = '', obj?: Item, ...others: Param[]): Promise<string> {
        if (!path) { return ''; }
        const parts = typeof path === 'string' ? path.split('/') : path;
        const converted = [];
        let currentObj = obj || await this.dispatch.call(this, 'get', basePath, ...others);

        for (const key of parts) {
            if (Array.isArray(currentObj)) {
                let idx = key;
                if (/^[a-f0-9-]{24}$/.test(key)) {
                    const item = currentObj.find((itemObj: Item) => {
                        return itemObj && itemObj._id === key;
                    });
                    if (!item) {
                        return [...converted, ...parts.slice(converted.length)].join('/');
                    }
                    idx = currentObj.indexOf(item).toString();
                } else {
                    const item = currentObj.find((itemObj: Item) => {
                        return itemObj && itemObj.slug === key;
                    });
                    if (item) {
                        idx = currentObj.indexOf(item).toString();
                    }
                }
                converted.push(idx);
                currentObj = currentObj[idx];
                continue;

            } else if (isObject(currentObj) && currentObj[key]) {
                converted.push(key);
                currentObj = currentObj[key];
                continue;
            }

            return [...converted, ...parts.slice(converted.length)].join('/');
        }

        return converted.join('/');
    }

}

export abstract class AbstractDispatcher extends AbstractDataSource {
    // tslint:disable-next-line:no-reserved-keywords
    public async abstract getSchema(options?: IDispatchOptions, schemaSource?: AbstractDispatcher): Promise<IProperty>;
    public abstract getDataSource(parentDataSource?: AbstractDataSource): AbstractDataSource;
    public abstract getSchemaDataSource(parentDataSource?: AbstractDataSource): AbstractDataSource;

    public async convertPathToUri(path: string) {
        //console.log("Fixing", path);
        const pathParts = path.split('/');
        let nextIsArrayItem = false;
        const result = []; let idx = 0;
        for (let key of pathParts) {
            const itemPath = pathParts.slice(0, ++idx).join('/');
            //console.log("--", key, nextIsArrayItem);
            if (nextIsArrayItem && key != '#' && !/^[a-f0-9-]{24}$/.test(key)) {
                const model = await this.getDataSource(this).dispatch('get', { itemPath });
                if (!model) {
                    //console.log("Interrupted", result.concat(pathParts.slice(idx-1)).join('/'))
                    return result.concat(pathParts.slice(idx-1)).join('/')
                }
                nextIsArrayItem = false;
                key = model._id;
            }             
            const schema = await this.getSchema({ itemPath });
            nextIsArrayItem = (schema?.type === 'array' && schema?.items?.type === 'object');
            result.push(key);
        }
        //console.log("converted", path, "into", result.filter(p => p).join('/'));
        return result.filter(p => p).join('/');
    }

    protected isMethodAllowed(methodName: string, schema: IProperty) {
        // tslint:disable-next-line:no-bitwise
        if (schema === undefined || (schema.readOnly === true && (~['set', 'push', 'del'].indexOf(methodName)))) {
            return false;
        } else if (schema.writeOnly === true && methodName === 'get') {
            return false;
        }
        return true;     
    }

    public requestHasWildcards(options?: IDispatchOptions, wildcard = '#') : boolean {
        return (options?.itemPath && options.itemPath.indexOf(wildcard) != -1);
    }

    public async processWildcards(methodName: string, options: IDispatchOptions, wildcard = '#'): Promise<any> {
        //console.log("path with wildcards", options);
        const base = options.itemPath.split(wildcard, 1)[0];
        const remaining = options.itemPath.slice(base.length+1);
        const baseItems = (await this.dispatch('get', { ...options, itemPath: base.replace( /\/$/, '') })) || [];
        const result = await Promise.all(baseItems.map( async (baseItem, idx) => {
            let _fullPath = [base, remaining].join(baseItem._id || `${idx}`);
            if (remaining.indexOf(wildcard) == -1) {
                if (options?.schema?.$data?.remoteField) {
                    _fullPath = [_fullPath, options.schema.$data.remoteField].join('/');
                }
                const item = await this.dispatch(methodName, { ...options, itemPath: _fullPath });
                //console.log("BULK", `${methodName} on ${_fullPath} (value: ${options.value})`)
                if ((options?.schema?.items || options.schema).type === 'object') {
                    return { _fullPath, ...item };
                }
                return item;
            }
            return await this.dispatch(methodName, { ...options, itemPath: [base, remaining].join(baseItem._id || `${idx}`)});
        } ));
        //console.log(result);
        return _.flatten(result);
    }
}

export interface IDataRenderer {
    render: (methodName: string, options?: IDispatchOptions) => any;
}


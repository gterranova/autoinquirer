import * as _ from 'lodash';

import { IProperty, IDispatchOptions, ICursorObject } from './interfaces';
import { isObject } from 'lodash';

// tslint:disable:no-console

// tslint:disable-next-line:no-any
export declare type Item = any;
// tslint:disable-next-line:no-any
export declare type Param = any;

export abstract class AbstractDataSource {
    public abstract connect(): Promise<void>;
    public abstract close(): Promise<void>;

    public abstract get(options?: IDispatchOptions): Promise<Item>;
    public abstract dispatch(methodName: string, options?: IDispatchOptions);

    public abstract isMethodAllowed(methodName: string, options?: IDispatchOptions): Promise<Boolean>;

    // tslint:disable-next-line:no-reserved-keywords
    public abstract getSchema(options?: IDispatchOptions, schemaSource?: AbstractDataSource): Promise<IProperty>;
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

    public async convertObjIDToIndex(path: string | string[], basePath: string = '', obj?: Item, ...others: Param[]): Promise<ICursorObject> {
        if (!path) { return { jsonObjectID: '' }; }
        const parts = typeof path === 'string' ? path.split('/') : path;
        const converted = [];
        let currentObj = obj || await this.dispatch.call(this, 'get', { itemPath: basePath, ...others });
        const cursorData: Partial<ICursorObject> = {};

        const objResolver = (obj, idx) => obj[idx] && (`${basePath?basePath+'/':''}${[...parts.slice(0, converted.length-1), obj[idx].slug || obj[idx]._id || idx].join('/')}`);

        for (const key of parts) {
            cursorData.index = undefined;
            if (Array.isArray(currentObj)) {
                if (/^[a-f0-9-]{24}$/.test(key)) {
                    const item = currentObj.find((itemObj: Item) => {
                        return itemObj && (itemObj._id === key);
                    });
                    if (!item) {
                        break;
                    }
                    cursorData.index = currentObj.indexOf(item);
                } else {
                    const item = currentObj.find((itemObj: Item) => {
                        return itemObj && itemObj.slug === key;
                    });
                    if (item) {
                        cursorData.index = currentObj.indexOf(item);
                    }
                }
                converted.push(cursorData.index?.toString() || key);
                if (converted.length==parts.length) {
                    Object.assign(cursorData, {
                        index: cursorData.index+1,
                        total: currentObj.length,
                        self: objResolver(currentObj, cursorData.index),
                        first: (cursorData.index > 0 && objResolver(currentObj, 0)) || undefined,
                        prev: (cursorData.index > 0 && objResolver(currentObj, cursorData.index-1)) || undefined,
                        next: (cursorData.index < currentObj.length-1 && objResolver(currentObj, cursorData.index+1)) || undefined,
                        last: (cursorData.index < currentObj.length-1 && objResolver(currentObj, currentObj.length-1)) || undefined,
                    });
                    currentObj = currentObj[cursorData.index-1];
                } else {
                    currentObj = currentObj[cursorData.index];
                }
                continue;
            } else if (isObject(currentObj) && currentObj[key]) {
                converted.push(key);
                currentObj = currentObj[key];
                continue;
            } 
            break;
        }
        return { 
            ...cursorData,
            jsonObjectID: `${basePath?basePath+'/':''}${[...converted, ...parts.slice(converted.length)].join('/')}`,
        };
}

}

export abstract class AbstractDispatcher extends AbstractDataSource {
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


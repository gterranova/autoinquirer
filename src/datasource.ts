import * as _ from 'lodash';

import { IProperty, IDispatchOptions, ICursorObject, Action, AutoinquirerGet } from './interfaces';
import { isObject } from 'lodash';

// tslint:disable:no-console

// tslint:disable-next-line:no-any
export declare type Item = any;
// tslint:disable-next-line:no-any
export declare type Param = any;

export abstract class AbstractDataSource implements AutoinquirerGet {
    public abstract connect(): Promise<void>;
    public abstract close(): Promise<void>;

    public abstract get(options?: IDispatchOptions): Promise<Item>;
    public abstract dispatch(methodName: Action, options?: IDispatchOptions);

    public abstract isMethodAllowed(methodName: Action, options?: IDispatchOptions): Promise<Boolean>;

    // tslint:disable-next-line:no-reserved-keywords
    public abstract getSchema(options?: IDispatchOptions, schemaSource?: AbstractDataSource): Promise<IProperty>;
    public abstract getDataSource(parentDataSource?: AbstractDataSource): AbstractDataSource;
    public abstract getSchemaDataSource(parentDataSource?: AbstractDataSource): AbstractDataSource;

    public async convertPathToUri(path: string) {
        const pathParts = path.split('/');
        let nextIsArrayItem = false;
        const result = []; let idx = 0;
        for (let key of pathParts) {
            const itemPath = pathParts.slice(0, ++idx).join('/').replace(/\/$/, '');
            //console.log("--", key, nextIsArrayItem);
            if (nextIsArrayItem && key != '#' && !/^[a-f0-9-]{24}$/.test(key)) {
                const model = await this.getDataSource(this).dispatch(Action.GET, { itemPath });
                if (!model) {
                    //console.log("Interrupted", result.concat(pathParts.slice(idx-1)).join('/'))
                    return result.concat(pathParts.slice(idx-1)).join('/')
                }
                nextIsArrayItem = false;
                key = model._id || model.slug; // slug to be tested
            }             
            const schema = await this.getSchema({ itemPath });
            nextIsArrayItem = (schema?.type === 'array' && schema?.items?.type === 'object');
            result.push(key);
        }
        //console.log("converted", path, "into", result.filter(p => p).join('/'));
        return result.filter(p => p).join('/');
    }

    public async convertObjIDToIndex(path: string | string[], basePath: string = '', obj?: Item, options?: IDispatchOptions): Promise<ICursorObject> {
        if (!path) { return { jsonObjectID: '' }; }
        const parts = typeof path === 'string' ? path.split('/') : path;
        const converted = [];
        let currentObj = obj || await this.dispatch.call(this, Action.GET, { ...options, itemPath: basePath });
        const cursorData: Partial<ICursorObject> = {};

        const objResolver = (obj, idx) => obj[idx] && (`${basePath || ''}${[...parts.slice(0, converted.length-1), obj[idx].slug || obj[idx]._id || idx].join('/')}`);

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
            jsonObjectID: `${basePath || ''}${[...converted, ...parts.slice(converted.length)].join('/')}`,
        };
}

}

export abstract class AbstractDispatcher extends AbstractDataSource {
    public requestHasWildcards(options?: IDispatchOptions, wildcard = '#') : boolean {
        return (options?.itemPath && options.itemPath.indexOf(wildcard) != -1);
    }

    public async processWildcards(methodName: Action, options: IDispatchOptions, wildcard = '#'): Promise<any> {
        //console.log("processWildcards", { methodName, options});
        const parts = options.itemPath.split(wildcard);
        const [base, remaining] = [parts[0], parts.slice(1).join(wildcard)];
        const baseOptions = { ...options, schema: { type: 'array', items: options.schema }};
        let baseItems = (await this.dispatch(Action.GET, { ...baseOptions, itemPath: base.replace( /\/$/, '') })) || [];
        //if (typeof baseItems === 'object') baseItems = [baseItems];
        const result = await Promise.all(baseItems.map( async (baseItem, idx) => {
            let _fullPath = [base, remaining].join(baseItem._id || baseItem.slug || `${idx}`);
            if (remaining.indexOf(wildcard) == -1) {
                if (options?.schema?.$data?.remoteField) {
                    _fullPath = [_fullPath, options.schema.$data.remoteField].join('/');
                }
                const item = await this.dispatch(methodName, { /* ...options, */ itemPath: _fullPath });
                //console.log("processWildcards item", item);
                //console.log("BULK", `${methodName} on ${_fullPath} (value: ${options.value})`)
                if ((options?.schema?.items || options.schema)?.type === 'object') {
                    return { _fullPath, ...item };
                }
                return item;
            }
            return await this.dispatch(methodName, { /* ...options, */ itemPath: [base, remaining].join(baseItem._id || baseItem.slug || `${idx}`)});
        } ));
        //console.log(result);
        return _.flatten(result);
    }
}

export interface IDataRenderer {
    render: (methodName: Action, options?: IDispatchOptions) => any;
}


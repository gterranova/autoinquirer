import * as _ from 'lodash';

import { IProperty, IDispatchOptions, ICursorObject, IDataSourceInfo, Action, AutoinquirerGet } from './interfaces';
import { isObject } from 'lodash';

// tslint:disable:no-console

// tslint:disable-next-line:no-any
export declare type Item = any;
// tslint:disable-next-line:no-any
export declare type Param = any;

export abstract class AbstractDataSource implements AutoinquirerGet {
    protected parentDispatcher: AbstractDispatcher;

    public abstract connect(parentDispatcher: AbstractDispatcher): Promise<void>;
    public abstract close(): Promise<void>;

    public abstract get(options?: IDispatchOptions): Promise<Item>;
    public abstract dispatch(methodName: Action, options?: IDispatchOptions);

    public abstract isMethodAllowed(methodName: Action, options?: IDispatchOptions): Promise<Boolean>;

    // tslint:disable-next-line:no-reserved-keywords
    public abstract getSchema(options?: IDispatchOptions, schemaSource?: AbstractDataSource): Promise<IProperty>;
    public abstract getDataSource(): AbstractDataSource;
    public abstract getSchemaDataSource(): AbstractDataSource;

    public setParent(parentDispatcher: AbstractDispatcher) {
        this.parentDispatcher = parentDispatcher;
    }

    public async convertPathToUri(path: string) {
        const pathParts = path.split('/');
        let nextIsArrayItem = false;
        const result = []; let idx = 0;
        for (let key of pathParts) {
            const itemPath = pathParts.slice(0, ++idx).join('/').replace(/\/$/, '');
            //console.log("--", key, nextIsArrayItem);
            if (nextIsArrayItem && key != '#' && !/^[a-f0-9-]{24}$/.test(key)) {
                const model = await this.getDataSource().dispatch(Action.GET, { itemPath });
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

    public async convertObjIDToIndex(options?: IDispatchOptions, basePath: string = ''): Promise<ICursorObject> {
        if (!options?.itemPath) { return { jsonObjectID: '' }; }
        const { itemPath: path } = options;
        const parts = path.split('/');
        const converted = [];
        let currentObj = await this.getDataSource().dispatch(Action.GET, { itemPath: basePath });
        const cursorData: Partial<ICursorObject> = {};

        const objResolver = (obj, idx) => obj[idx] && (`${basePath || ''}${[...parts.slice(0, converted.length-1), obj[idx].slug || obj[idx]._id || idx].join('/')}`);

        for (const key of parts) {
            cursorData.index = undefined;
            if (Array.isArray(currentObj)) {
                if (/^[a-f0-9-]{24}$/.test(key)) {
                    const item = currentObj.find((itemObj: Item) => {
                        return itemObj?._id === key;
                    });
                    if (!item) {
                        break;
                    }
                    cursorData.index = currentObj.indexOf(item);
                } else if (/^\d+$/.test(key)) {
                    cursorData.index = parseInt(key);
                } else {
                    const item = currentObj.find((itemObj: Item) => {
                        return itemObj?.slug === key;
                    });
                    if (item) {
                        cursorData.index = currentObj.indexOf(item);
                    }
                }
                converted.push(cursorData.index?.toString() || key);
                if (converted.length==parts.length) {
                    const schema = await this.getSchemaDataSource().get({ itemPath: parts.slice(0, parts.length-1).join('/') });
                    const $order = schema.$orderBy || [];
                    let orderedMap = (new Array(currentObj.length)).map( (_o, idx) => idx);
                    if ($order.length) {
                        const order = _.zip(...$order.map( o => /^!/.test(o)? [o.slice(1), 'desc'] : [o, 'asc']));
                        const orderedValues = _.orderBy(currentObj, ...order);    
                        orderedMap = _.map(orderedValues, i => _.indexOf(_.map(currentObj, o => o._id), i._id));
                        //if (currentObj[0].name) {
                        //    console.log(_.map(orderedMap, (o, idx) => `${idx} = ${o} ${currentObj[o].name} ${cursorData.index==o? 'CURRENT': ''}`).join('\n')+'\n');
                        //    console.log(`PREV ${orderedMap[orderedMap.indexOf(cursorData.index)-1]} CURR ${orderedMap[cursorData.index]} NEXT ${orderedMap[cursorData.index+1]}`);    
                        //}
                    } 
                    Object.assign(cursorData, {
                        index: cursorData.index+1,
                        total: currentObj.length,
                        self: objResolver(currentObj, cursorData.index),
                        first: (orderedMap.indexOf(cursorData.index) > 0 && objResolver(currentObj, orderedMap[0])) || undefined,
                        prev: (orderedMap[cursorData.index] > 0 && objResolver(currentObj, orderedMap[orderedMap.indexOf(cursorData.index)-1])) || undefined,
                        next: (orderedMap[cursorData.index] < currentObj.length-1 && objResolver(currentObj, orderedMap[orderedMap.indexOf(cursorData.index)+1])) || undefined,
                        last: (orderedMap.indexOf(cursorData.index) < currentObj.length-1 && objResolver(currentObj, orderedMap[currentObj.length-1])) || undefined,
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

    public async getDataSourceInfo(options?: IDispatchOptions): Promise<IDataSourceInfo<AbstractDataSource>> {
        return { dataSource: <AbstractDataSource>this, entryPointOptions: options }
    };

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
                const item = await this.dispatch(methodName, { itemPath: _fullPath, value: options.value });
                //console.log("processWildcards item", item);
                //console.log("BULK", `${methodName} on ${_fullPath} (value: ${JSON.stringify(options.value)})`)
                if ((options?.schema?.items || options.schema)?.type === 'object') {
                    return { _fullPath, ...item };
                }
                return item;
            }
            return await this.dispatch(methodName, { value: options.value, itemPath: [base, remaining].join(baseItem._id || baseItem.slug || `${idx}`)});
        } ));
        //console.log(result);
        return _.flatten(result);
    }
}

export interface IDataRenderer {
    render: (methodName: Action, options?: IDispatchOptions) => any;
}


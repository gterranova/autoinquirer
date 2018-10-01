import { IProperty } from '../interfaces';
import { getType } from '../utils';

// tslint:disable:no-console

// tslint:disable-next-line:no-any
export declare type Item = any;
// tslint:disable-next-line:no-any
export declare type Param = any;

export abstract class DataSource {
    public async abstract connect(): Promise<void>; 
    public async abstract close(): Promise<void>; 

    // tslint:disable-next-line:no-reserved-keywords
    public async abstract get(itemPath?: string, schema?: IProperty, value?: Item, parentPath?: string, params?: Param): Promise<Item>;
    public async abstract dispatch(methodName: string, itemPath?: string, schema?: IProperty, value?: Item, parentPath?: string, params?: Param);

    public async convertObjIDToIndex(path: string | string[], basePath: string='', obj?: Item, ...others: Param[]): Promise<string> {
        if (!path) { return ''; }
        const parts = typeof path === 'string' ? path.split('/') : path;
        const converted = [];
        let currentObj = obj || await this.dispatch.call(this, 'get', basePath, ...others);

        for (const key of parts) {
            if (Array.isArray(currentObj)) {
                let idx = key;
                if (/^[a-f0-9-]{24}$/.test(key)) {
                    const item = currentObj.find( (itemObj: Item) => {
                        return itemObj && itemObj._id === key; 
                    });
                    if (!item) {
                        return [...converted, ...parts.slice(converted.length)].join('/');
                    }    
                    idx = currentObj.indexOf(item).toString();
                }
                converted.push(idx);
                currentObj = currentObj[idx];
                continue;

            } else if (getType(currentObj) === 'Object' && currentObj[key]) {
                converted.push(key);
                currentObj = currentObj[key];
                continue;
            }
            
            return [...converted, ...parts.slice(converted.length)].join('/');
        }
        
        return converted.join('/');
    }

}

export { Dispatcher } from './dispatcher';
export { JsonSchema } from './jsonschema';
export { MemoryDataSource } from './memory';
export { MongoDataSource } from './mongodb';
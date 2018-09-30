import { IProperty } from '../interfaces';
import { getType } from '../utils';

// tslint:disable:no-any
// tslint:disable:no-console

export abstract class DataSource {
    public async abstract connect(); 
    public async abstract close(); 

    // tslint:disable-next-line:no-reserved-keywords
    public async abstract get(itemPath?: string, schema?: IProperty, parentPath?: string, params?: any);
    // tslint:disable-next-line:no-reserved-keywords
    public async abstract set(itemPath?: string, value?: any, schema?: IProperty, parentPath?: string, params?: any);
    public async abstract push(itemPath?: string, value?: any, schema?: IProperty, parentPath?: string, params?: any);
    public async abstract del(itemPath?: string, schema?: IProperty, parentPath?: string, params?: any);
    public async abstract delCascade(parentPath?: string, params?: any);

    public async convertObjIDToIndex(path: string | string[], basePath: string='', obj?: any, ...others: any[]) {
        if (!path) { return obj; }
        const parts = typeof path === 'string' ? path.split('/') : path;
        const converted = [];
        let currentObj = obj || await this.get.call(this, basePath, ...others);

        for (const key of parts) {
            if (Array.isArray(currentObj)) {
                let idx = key;
                if (/^[a-f0-9-]{24}$/.test(key)) {
                    const item = currentObj.find( (itemObj: any) => {
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

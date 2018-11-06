import { IProperty } from '../interfaces';
export declare type Item = any;
export declare type Param = any;
export declare abstract class DataRenderer {
    abstract render(methodName: string, itemPath?: string, schema?: IProperty, value?: Item): Promise<Item>;
}
export declare abstract class DataSource {
    abstract connect(): Promise<void>;
    abstract close(): Promise<void>;
    abstract get(itemPath?: string, schema?: IProperty, value?: Item, parentPath?: string, params?: Param): Promise<Item>;
    abstract dispatch(methodName: string, itemPath?: string, schema?: IProperty, value?: Item, parentPath?: string, params?: Param): any;
    convertObjIDToIndex(path: string | string[], basePath?: string, obj?: Item, ...others: Param[]): Promise<string>;
}

import { IProperty } from '../interfaces';
import { JsonSchema } from './jsonschema';
export declare type Item = any;
export declare type Param = any;
export declare abstract class DataRenderer {
    abstract render(methodName: string, itemPath?: string, schema?: IProperty, value?: Item, datasource?: DataSource): Promise<Item>;
}
export declare abstract class DataSource {
    protected renderer: DataRenderer;
    abstract connect(): Promise<void>;
    abstract close(): Promise<void>;
    abstract getSchema(itemPath?: string, schemaSource?: JsonSchema, parentPath?: string, params?: Param): Promise<IProperty>;
    abstract get(itemPath?: string, schema?: IProperty, value?: Item, parentPath?: string, params?: Param): Promise<Item>;
    abstract dispatch(methodName: string, itemPath?: string, schema?: IProperty, value?: Item, parentPath?: string, params?: Param): any;
    setRenderer(renderer: DataRenderer): void;
    convertObjIDToIndex(path: string | string[], basePath?: string, obj?: Item, ...others: Param[]): Promise<string>;
}

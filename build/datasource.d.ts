import { IProperty, IDispatchOptions } from './interfaces';
export declare type Item = any;
export declare type Param = any;
export declare abstract class AbstractDataSource {
    abstract connect(): Promise<void>;
    abstract close(): Promise<void>;
    abstract get(options?: IDispatchOptions): Promise<Item>;
    abstract dispatch(methodName: string, options?: IDispatchOptions): any;
    convertObjIDToIndex(path: string | string[], basePath?: string, obj?: Item, ...others: Param[]): Promise<string>;
}
export declare abstract class AbstractDispatcher extends AbstractDataSource {
    abstract getSchema(options?: IDispatchOptions, schemaSource?: AbstractDispatcher): Promise<IProperty>;
    abstract getDataSource(parentDataSource?: AbstractDataSource): AbstractDataSource;
    abstract getSchemaDataSource(parentDataSource?: AbstractDataSource): AbstractDataSource;
    convertPathToUri(path: string): Promise<string>;
    protected isMethodAllowed(methodName: string, schema: IProperty): boolean;
    requestHasWildcards(options?: IDispatchOptions, wildcard?: string): boolean;
    processWildcards(methodName: string, options: IDispatchOptions, wildcard?: string): Promise<any>;
}
export interface IDataRenderer {
    render: (methodName: string, options?: IDispatchOptions) => any;
}
//# sourceMappingURL=datasource.d.ts.map
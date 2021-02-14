import { IProperty, IDispatchOptions, ICursorObject, IDataSourceInfo, Action, AutoinquirerGet } from './interfaces';
export declare type Item = any;
export declare type Param = any;
export declare abstract class AbstractDataSource implements AutoinquirerGet {
    protected parentDispatcher: AbstractDispatcher;
    abstract connect(parentDispatcher: AbstractDispatcher): Promise<void>;
    abstract close(): Promise<void>;
    abstract get(options?: IDispatchOptions): Promise<Item>;
    abstract dispatch(methodName: Action, options?: IDispatchOptions): any;
    abstract isMethodAllowed(methodName: Action, options?: IDispatchOptions): Promise<Boolean>;
    abstract getSchema(options?: IDispatchOptions, schemaSource?: AbstractDataSource): Promise<IProperty>;
    abstract getDataSource(): AbstractDataSource;
    abstract getSchemaDataSource(): AbstractDataSource;
    setParent(parentDispatcher: AbstractDispatcher): void;
    convertPathToUri(path: string): Promise<string>;
    convertObjIDToIndex(path: string | string[], basePath?: string, obj?: Item, options?: IDispatchOptions): Promise<ICursorObject>;
}
export declare abstract class AbstractDispatcher extends AbstractDataSource {
    getDataSourceInfo(options?: IDispatchOptions): Promise<IDataSourceInfo<AbstractDataSource>>;
    requestHasWildcards(options?: IDispatchOptions, wildcard?: string): boolean;
    processWildcards(methodName: Action, options: IDispatchOptions, wildcard?: string): Promise<any>;
}
export interface IDataRenderer {
    render: (methodName: Action, options?: IDispatchOptions) => any;
}
//# sourceMappingURL=datasource.d.ts.map
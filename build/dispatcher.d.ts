import { IProperty, IProxyInfo, IDispatchOptions, Action } from './interfaces';
import { AutoinquirerPush, AutoinquirerUpdate, AutoinquirerSet, AutoinquirerDelete } from './interfaces';
import { AbstractDispatcher, AbstractDataSource } from './datasource';
import { JsonSchema } from './jsonschema';
export interface IEntryPointInfo {
    proxyInfo: IProxyInfo;
    parentPath: string;
    itemPath: string;
    parent: AbstractDataSource;
    params: any;
}
export declare type Newable<T> = {
    new (...args: any[]): T;
};
interface IProxy {
    name: string;
    classRef?: Newable<AbstractDataSource>;
    dataSource?: AbstractDataSource;
}
export declare type IDataSourceInfo<T extends AbstractDataSource> = {
    dataSource: T;
    entryPointInfo?: IEntryPointInfo;
};
declare type renderFunction = (_methodName: string, options?: IDispatchOptions) => Promise<any>;
declare interface renderOptions {
    name: string;
    fn: renderFunction;
}
export declare class Dispatcher extends AbstractDispatcher implements AutoinquirerPush, AutoinquirerUpdate, AutoinquirerSet, AutoinquirerDelete {
    private entryPoints;
    private proxies;
    private schemaSource;
    private dataSource;
    private transformers;
    constructor(schema: string | JsonSchema, data: string | AbstractDispatcher);
    connect(): Promise<void>;
    close(): Promise<void>;
    getSchemaDataSource(parentDispatcher?: AbstractDispatcher): AbstractDataSource;
    getDataSource(parentDispatcher?: AbstractDispatcher): AbstractDataSource;
    getDataSourceInfo(options?: IDispatchOptions): Promise<IDataSourceInfo<AbstractDataSource>>;
    getSchema(options?: IDispatchOptions, _parentDispatcher?: AbstractDispatcher): Promise<IProperty>;
    private processProxyPropertiesSchema;
    isMethodAllowed(methodName: Action, options?: IDispatchOptions): Promise<Boolean>;
    get(options?: IDispatchOptions): Promise<any>;
    set(options?: IDispatchOptions): Promise<any>;
    update(options?: IDispatchOptions): Promise<any>;
    push(options?: IDispatchOptions): Promise<any>;
    delete(options?: IDispatchOptions): Promise<any>;
    registerProxy(proxy: IProxy): void;
    registerProxies(proxies: Array<IProxy>): void;
    dispatch(methodName: Action, options?: IDispatchOptions): Promise<any>;
    private processProxyPropertiesValues;
    private eachRemoteField;
    private findEntryPoints;
    private getProxyForPath;
    private getProxyWithinPath;
    private getProxy;
    registerTransformer({ name, fn }: renderOptions): void;
    registerTransformers(transformers: Array<renderOptions>): void;
    getTransformer(name: string): renderFunction;
}
export {};
//# sourceMappingURL=dispatcher.d.ts.map
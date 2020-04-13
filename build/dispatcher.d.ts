import { IProperty, IProxyInfo, IDispatchOptions } from './interfaces';
import { AbstractDispatcher, AbstractDataSource } from './datasource';
import { JsonSchema } from './jsonschema';
interface IEntryPointInfo {
    proxyInfo: IProxyInfo;
    parentPath: string;
    objPath: string;
}
export declare type Newable<T> = {
    new (...args: any[]): T;
};
interface IProxy {
    name: string;
    classRef?: Newable<AbstractDispatcher>;
    dataSource?: AbstractDispatcher;
}
export declare type IDataSourceInfo<T extends AbstractDataSource> = {
    dataSource: T;
    entryPointInfo?: IEntryPointInfo;
};
export declare class Dispatcher extends AbstractDispatcher {
    private entryPoints;
    private proxies;
    private schemaSource;
    private dataSource;
    constructor(schema: string | JsonSchema, data: string | AbstractDispatcher);
    connect(): Promise<void>;
    close(): Promise<void>;
    getSchemaDataSource(parentDispatcher?: AbstractDispatcher): AbstractDataSource;
    getDataSource(parentDispatcher?: AbstractDispatcher): AbstractDataSource;
    getDataSourceInfo(options?: IDispatchOptions): Promise<IDataSourceInfo<AbstractDataSource>>;
    getSchema(options?: IDispatchOptions, parentDispatcher?: AbstractDispatcher): Promise<IProperty>;
    get(options?: IDispatchOptions): Promise<any>;
    set(options?: IDispatchOptions): Promise<any>;
    update(options?: IDispatchOptions): Promise<any>;
    push(options?: IDispatchOptions): Promise<any>;
    del(options?: IDispatchOptions): Promise<any>;
    registerProxy(proxy: IProxy): void;
    dispatch(methodName: string, options?: IDispatchOptions): Promise<any>;
    private eachRemoteField;
    private findEntryPoints;
    private getProxyForPath;
    private getProxyWithinPath;
    private getProxy;
}
export {};
//# sourceMappingURL=dispatcher.d.ts.map
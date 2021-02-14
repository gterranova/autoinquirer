import { IProperty, IDispatchOptions, Action, IProxy, renderFunction, renderOptions, IDataSourceInfo } from './interfaces';
import { AutoinquirerPush, AutoinquirerUpdate, AutoinquirerSet, AutoinquirerDelete } from './interfaces';
import { AbstractDispatcher, AbstractDataSource } from './datasource';
import { JsonSchema } from './jsonschema';
export declare class Dispatcher extends AbstractDispatcher implements AutoinquirerPush, AutoinquirerUpdate, AutoinquirerSet, AutoinquirerDelete {
    private entryPoints;
    private proxies;
    private schemaSource;
    private dataSource;
    private transformers;
    constructor(schema: string | JsonSchema, data: string | AbstractDispatcher);
    connect(parentDispatcher: AbstractDispatcher): Promise<void>;
    close(): Promise<void>;
    getSchemaDataSource(): AbstractDataSource;
    getDataSource(): AbstractDataSource;
    getDataSourceInfo(options?: IDispatchOptions): Promise<IDataSourceInfo<AbstractDataSource>>;
    getSchema(options?: IDispatchOptions): Promise<IProperty>;
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
//# sourceMappingURL=dispatcher.d.ts.map
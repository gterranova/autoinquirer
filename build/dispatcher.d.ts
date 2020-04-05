import { IProperty, IDispatchOptions } from './interfaces';
import { AbstractDispatcher } from './datasource';
import { JsonSchema } from './jsonschema';
export declare class Dispatcher extends AbstractDispatcher {
    private entryPoints;
    private proxies;
    private schemaSource;
    private dataSource;
    constructor(schema: string | JsonSchema, data: string | AbstractDispatcher);
    connect(): Promise<void>;
    close(): Promise<void>;
    getSchema(options?: IDispatchOptions): Promise<IProperty>;
    get(options?: IDispatchOptions): Promise<any>;
    set(options?: IDispatchOptions): Promise<any>;
    update(options?: IDispatchOptions): Promise<any>;
    push(options?: IDispatchOptions): Promise<any>;
    del(options?: IDispatchOptions): Promise<any>;
    registerProxy(name: string, dataSource: AbstractDispatcher): void;
    dispatch(methodName: string, options?: IDispatchOptions): Promise<any>;
    private findEntryPoints;
    private getProxyForPath;
    private getProxyWithinPath;
    private getProxy;
}
//# sourceMappingURL=dispatcher.d.ts.map
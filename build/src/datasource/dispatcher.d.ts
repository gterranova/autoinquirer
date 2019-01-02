import { IProperty } from '../interfaces';
import { DataRenderer, DataSource } from './datasource';
import { JsonSchema } from './jsonschema';
export declare class Dispatcher extends DataSource {
    private entryPoints;
    private proxies;
    private schemaSource;
    private dataSource;
    private renderer;
    constructor(schema: string | JsonSchema, data: string | DataSource, renderer?: DataRenderer);
    connect(): Promise<void>;
    close(): Promise<void>;
    getSchema(itemPath?: string): Promise<IProperty>;
    get(itemPath?: string, propertySchema?: IProperty): Promise<any>;
    set(itemPath?: string, propertySchema?: IProperty, value?: any): Promise<any>;
    update(itemPath?: string, propertySchema?: IProperty, value?: any): Promise<any>;
    push(itemPath?: string, propertySchema?: IProperty, value?: any): Promise<any>;
    del(itemPath?: string, propertySchema?: IProperty): Promise<any>;
    registerProxy(name: string, dataSource: DataSource): void;
    dispatch(methodName: string, itemPath?: string, propertySchema?: IProperty, value?: any): Promise<any>;
    render(methodName?: string, itemPath?: string, schema?: IProperty, value?: any): Promise<any>;
    private findEntryPoints;
    private getProxyForPath;
    private getProxyWithinPath;
    private getProxy;
}

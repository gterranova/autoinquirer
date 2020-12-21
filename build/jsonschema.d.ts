import { IProperty, IDispatchOptions } from './interfaces';
import { AbstractDataSource, AbstractDispatcher } from './datasource';
export declare class JsonSchema extends AbstractDataSource {
    private validator;
    private schemaData;
    private basePath;
    constructor(data: IProperty | string);
    connect(): Promise<void>;
    close(): Promise<void>;
    isMethodAllowed(methodName: string, options?: IDispatchOptions): Promise<boolean>;
    get(options?: IDispatchOptions): Promise<IProperty>;
    coerce(schema: IProperty, value?: any): any;
    validate(schema?: IProperty, data?: any): any;
    dispatch(methodName: string, options?: IDispatchOptions): Promise<any>;
    getSchema(_options?: IDispatchOptions, _schemaSource?: AbstractDispatcher): Promise<IProperty>;
    getSchemaDataSource(parentDispatcher?: AbstractDispatcher): AbstractDataSource;
    getDataSource(_parentDispatcher?: AbstractDispatcher): AbstractDataSource;
}
//# sourceMappingURL=jsonschema.d.ts.map
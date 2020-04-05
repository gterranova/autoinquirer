import { IProperty, IDispatchOptions } from './interfaces';
import { AbstractDataSource } from './datasource';
export declare class JsonSchema extends AbstractDataSource {
    private validator;
    private schemaData;
    private basePath;
    constructor(data: IProperty | string);
    connect(): Promise<void>;
    close(): Promise<void>;
    get(options?: IDispatchOptions): Promise<IProperty>;
    coerce(schema: IProperty, value?: any): any;
    validate(schema?: IProperty, data?: any): any;
    dispatch(methodName: string, options?: IDispatchOptions): Promise<any>;
}
//# sourceMappingURL=jsonschema.d.ts.map
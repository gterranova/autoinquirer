import { IProperty } from './interfaces';
import { DataSource } from './datasource';
export declare class JsonSchema extends DataSource {
    private validator;
    private schemaData;
    private basePath;
    constructor(data: IProperty | string);
    connect(): Promise<void>;
    close(): Promise<void>;
    get(itemPath?: string): Promise<IProperty>;
    coerce(schema: IProperty, value?: any): any;
    validate(schema?: IProperty, data?: any): any;
    dispatch(methodName: string, itemPath?: string, schema?: IProperty, value?: any, parentPath?: string, params?: any): Promise<any>;
    getSchema(_itemPath?: string, _schemaSource?: JsonSchema, _parentPath?: string, _params?: any): Promise<IProperty>;
}
//# sourceMappingURL=jsonschema.d.ts.map
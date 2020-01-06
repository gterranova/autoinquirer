import { IProperty } from '../interfaces';
import { DataSource } from './datasource';
import { JsonSchema } from './jsonschema';
export declare class JsonDataSource extends DataSource {
    private jsonDocument;
    private dataFile;
    constructor(data: any);
    connect(): Promise<void>;
    close(): Promise<void>;
    save(): Promise<void>;
    getSchema(_itemPath?: string, _schemaSource?: JsonSchema, _parentPath?: string, _params?: any): Promise<IProperty>;
    get(itemPath?: string): Promise<any>;
    push(itemPath: string, _?: IProperty, value?: any): Promise<any>;
    set(itemPath: string, _: IProperty, value: any): Promise<void>;
    update(itemPath: string, _: IProperty, value: any): Promise<any>;
    del(itemPath?: string): Promise<void>;
    delCascade(itemPath?: string): Promise<void>;
    dispatch(methodName: string, itemPath?: string, schema?: IProperty, value?: any, parentPath?: string, params?: any): Promise<any>;
}

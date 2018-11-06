import { IProperty } from '../interfaces';
import { DataSource } from './datasource';
export declare class JsonDataSource extends DataSource {
    private jsonDocument;
    private dataFile;
    constructor(data: any);
    connect(): Promise<void>;
    close(): Promise<void>;
    save(): Promise<void>;
    get(itemPath?: string): Promise<any>;
    push(itemPath: string, _?: IProperty, value?: any): Promise<void>;
    set(itemPath: string, _: IProperty, value: any): Promise<void>;
    del(itemPath?: string): Promise<void>;
    dispatch(methodName: string, itemPath?: string, schema?: IProperty, value?: any, parentPath?: string, params?: any): Promise<any>;
}

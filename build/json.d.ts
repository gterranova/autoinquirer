import { IProperty, IDispatchOptions } from './interfaces';
import { AbstractDispatcher } from './datasource';
import { JsonSchema } from './jsonschema';
export declare class JsonDataSource extends AbstractDispatcher {
    private jsonDocument;
    private dataFile;
    constructor(data: any);
    connect(): Promise<void>;
    close(): Promise<void>;
    save(): Promise<void>;
    getSchema(options?: IDispatchOptions, schemaSource?: JsonSchema): Promise<IProperty>;
    get(options?: IDispatchOptions): Promise<any>;
    push({ itemPath, value }: {
        itemPath: any;
        value: any;
    }): Promise<any>;
    set({ itemPath, value }: {
        itemPath: any;
        value: any;
    }): Promise<void>;
    update(options?: IDispatchOptions): Promise<any>;
    del({ itemPath }: {
        itemPath: any;
    }): Promise<void>;
    delCascade({ itemPath }: {
        itemPath: any;
    }): Promise<void>;
    dispatch(methodName: string, options?: IDispatchOptions): Promise<any>;
}
//# sourceMappingURL=json.d.ts.map
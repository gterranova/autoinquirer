import { IProperty, IDispatchOptions, Action } from './interfaces';
import { AbstractDispatcher, AbstractDataSource } from './datasource';
export declare class JsonDataSource extends AbstractDispatcher {
    private jsonDocument;
    private dataFile;
    constructor(data: any);
    connect(): Promise<void>;
    close(): Promise<void>;
    save(): Promise<void>;
    getSchemaDataSource(parentDispatcher?: AbstractDispatcher): AbstractDataSource;
    getDataSource(_parentDispatcher?: AbstractDispatcher): AbstractDataSource;
    getSchema(options?: IDispatchOptions, parentDispatcher?: AbstractDispatcher): Promise<IProperty>;
    isMethodAllowed(_methodName: string, _options?: IDispatchOptions): Promise<boolean>;
    get(options?: IDispatchOptions): Promise<any>;
    push({ itemPath, value }: {
        itemPath: any;
        value: any;
    }): Promise<any>;
    set({ itemPath, value }: {
        itemPath: any;
        value: any;
    }): Promise<any>;
    update(options?: IDispatchOptions): Promise<any>;
    delete({ itemPath }: {
        itemPath: any;
    }): Promise<void>;
    delCascade({ itemPath }: {
        itemPath: any;
    }): Promise<void>;
    dispatch(methodName: Action, options?: IDispatchOptions): Promise<any>;
}
//# sourceMappingURL=json.d.ts.map
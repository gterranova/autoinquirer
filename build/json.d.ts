import { IProperty, IDispatchOptions, Action } from './interfaces';
import { AbstractDispatcher, AbstractDataSource } from './datasource';
export declare class JsonDataSource extends AbstractDispatcher {
    private jsonDocument;
    private dataFile;
    constructor(data: any);
    connect(parentDispatcher: AbstractDispatcher): Promise<void>;
    close(): Promise<void>;
    save(): Promise<void>;
    getSchemaDataSource(): AbstractDataSource;
    getDataSource(): AbstractDataSource;
    getSchema(options?: IDispatchOptions): Promise<IProperty>;
    isMethodAllowed(_methodName: string, _options?: IDispatchOptions): Promise<boolean>;
    get(options?: IDispatchOptions): Promise<any>;
    push(options: IDispatchOptions): Promise<any>;
    set(options: IDispatchOptions): Promise<any>;
    update(options?: IDispatchOptions): Promise<any>;
    delete(options: IDispatchOptions): Promise<void>;
    delCascade({ itemPath }: {
        itemPath: any;
    }): Promise<void>;
    dispatch(methodName: Action, options?: IDispatchOptions): Promise<any>;
}
//# sourceMappingURL=json.d.ts.map
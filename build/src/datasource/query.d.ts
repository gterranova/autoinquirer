import { IProperty, IQuery } from '../interfaces';
import { DataSource } from './datasource';
export declare class Query implements IQuery {
    private ds;
    private promise;
    constructor(ds: DataSource);
    query(itemPath?: string, propertySchema?: IProperty): IQuery;
    transform(cb: any): this;
    pluck(fields: string[]): IQuery;
    omit(fields: string[]): IQuery;
    exec(): Promise<any>;
    private apply;
    private pluckFn;
    private omitFn;
}

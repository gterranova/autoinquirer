// tslint:disable:no-any
declare type TransformClause = (input: any) => any;

export interface IQuery {
    query(itemPath?: string, propertySchema?: any): IQuery;
    transform?(cb: TransformClause): IQuery;
    pluck?(fields: string[]): IQuery;
    omit?(fields: string[]): IQuery;
    exec(): any;
}
// tslint:disable:no-any
import { IProperty, IQuery } from '../interfaces';
import { getType } from '../utils';
import { DataSource } from './datasource';

export class Query implements IQuery {
    private ds: DataSource;
    private promise: Promise<any>;
    private schema: IProperty;

    constructor(ds: DataSource) {
        this.ds = ds;
    }

    public query(itemPath?: string, propertySchema?: IProperty): IQuery {
        this.schema = propertySchema;
        this.promise = this.ds.dispatch('get', itemPath, propertySchema);
        
        return this;
    }    

    public transform(cb: any) {
        this.apply(cb);

        return this;
    }
    
    public pluck(fields: string[]): IQuery {
        this.apply(this.pluckFn(fields));
        
        return this;
    }    

    public omit(fields: string[]): IQuery {
        this.apply(this.omitFn(fields));
        
        return this;
    }    
    
    public exec() {
        return this.promise;
    }

    private apply(fn: any) {
        this.promise = this.promise.then((result: any) => {
            if (Array.isArray(result)) {
                return result.map(fn)
            }
            
            return fn(result);
        });
    }

    private pluckFn(fields: string[]): any {
        return (item: any) => {
            if (getType(item) !== 'Object') {
                return item;
            }
            const filtered = {}
            fields.forEach((field: string) => {
                if (item[field] !== undefined) { filtered[field] = item[field]; };
            });

            return filtered;
        };
    }

    private omitFn(fields: string[]): any {
        return (item: any) => {
            if (getType(item) !== 'Object') {
                return item;
            }
            const filtered = {};
            Object.keys(item).forEach((field: string) => {
                // tslint:disable-next-line:no-bitwise
                if (!~fields.indexOf(field)) { filtered[field] = item[field]; } 
            });
            
            return filtered;
        };
    }
}
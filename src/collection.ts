// tslint:disable:no-any
// tslint:disable:no-console
import objectPath from 'object-path';
import { IDocument, IPropertyClass } from './interfaces';
import { ifArrayToObject, ifObjectToArray } from './utils';

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c: string) => {
        // tslint:disable-next-line:insecure-random no-bitwise
        const r = Math.random() * 16 | 0;
        // tslint:disable-next-line:no-bitwise
        const v = c === 'x' ? r : (r & 0x3 | 0x8);

        return v.toString(16);
    });
}

export class Definition implements IPropertyClass {
    public $name: string;

    private $id: string;
    private data: IDocument;

    constructor($name: string, $id: string, data: IDocument) {
        this.$name = $name;
        this.$id = $id;
        this.$name = this.$name;
        this.data = ifArrayToObject(data) || {};
    }

    public create(value: any) {
        Object.assign(this.data, value);

        return value;
    };

    public value() {
        return this.data;
    }

    // tslint:disable-next-line:no-reserved-keywords
    public get(id: string | string[]) {
        if (!id) { return this.value(); }

        return objectPath.get(this.data, id);
    };

    public update(id: string | null, value: any) {
        if (id === null) {
            this.data = value;
        } else {
            this.data[id] = value;    
        }
    };

    public remove(id?: string) {
        if (id) {
            delete this.data[id];
        } else {
            this.data = {};
        }
    };

    public fromData($name: string, data: IDocument) {
        if (this.get($name).type === 'array') {
            return new Collection($name, data || []);
        }

        return new Definition($name, `${this.$id}/${$name}`, data || {})
    }

}
export class Collection implements IPropertyClass {
    public $name: string;

    private $id: string;
    private data: IDocument;

    constructor($id: string, data?: IDocument) {
        this.$name = this.$id = $id;
        this.$name = this.$name;
        this.data = ifArrayToObject(data, '_id') || {};
    }

    public create(value: any) {
        this.data[uuidv4()] = value;    
        
        return value;
    };

    public value() {
        return ifObjectToArray(this.data, '_id');
    }

    // tslint:disable-next-line:no-reserved-keywords
    public get(id: string | string[]) {
        if (!id) { return this.value(); }

        return objectPath.get(this.data, id);
    };

    public find(filter: any) {
        // tslint:disable-next-line:no-suspicious-comment
        // TODO: Fix
        return Object.keys(this.data).map( (key: string) => this.data[key]).find((item: any) => {
            const keys = Object.keys(filter);
            const test = keys.map( (k: string) => (item[k] === filter[k])?1:0)
                .reduce((prev: number, curr: number) => prev+curr, 0);
            
            return test === keys.length;
        });
    };

    public filter(filter: any) {
        return Object.keys(this.data).map( (key: string) => this.data[key]).filter((item: any) => {
            const keys = Object.keys(filter);
            const test = keys.map( (k: string) => (item[k] === filter[k])?1:0)
                .reduce((prev: number, curr: number) => prev+curr, 0);
           
            return test === keys.length;
        });
    };

    public update(id: string | null, value: any) {
        if (id === null) {
            this.data = value;
        } else {
            this.data[id] = value;    
        }
    };

    public remove(id?: string) {
        if (id) {
            delete this.data[id];
        } else {
            this.data = [];
        }
    };
};

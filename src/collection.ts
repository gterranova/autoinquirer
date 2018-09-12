// tslint:disable:no-any
// tslint:disable:no-console

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c: string) => {
        // tslint:disable-next-line:insecure-random no-bitwise
        const r = Math.random() * 16 | 0;
        // tslint:disable-next-line:no-bitwise
        const v = c === 'x' ? r : (r & 0x3 | 0x8);

        return v.toString(16);
    });
}

export class Collection {
    public name: string;
    protected data: any[];
    private relatedFields: any[];

    constructor(collectionName: string, data: any) {
        this.data = data || [];
        this.name = collectionName;
        this.relatedFields = [];
        this.setupRelated();
    }

    public all() {
        return this.data || [];
    }

    public empty() {
        return this.data.length === 0;
    }

    public create(value: any) {
        value._id = uuidv4();
        this.setupRelated(value);
        this.data.push(value);
        
        return value;
    };

    // tslint:disable-next-line:no-reserved-keywords
    public get(id: string) {
        const entry = this.data.find((item: any) => item._id === id);
        for (const related of this.relatedFields) {
            if (entry[related.name] && entry[related.name].value) {
                entry[related.name] = entry[related.name].value();
            }
        }

        return entry;
    };

    public find(filter: any) {
        const entry = this.data.find((item: any) => {
            const keys = Object.keys(filter);
            const test = keys.map( (k: string) => (item[k] === filter[k])?1:0)
                .reduce((prev: number, curr: number) => prev+curr, 0);
           
            return test === keys.length;
        });
        for (const related of this.relatedFields) {
            if (entry[related.name] && entry[related.name].value) {
                entry[related.name] = entry[related.name].value();
            }
        }

        return entry;
    };

    public filter(filter: any) {
        return this.data.filter((item: any) => {
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
            const idx = this.data.indexOf(this.get(id));
            this.setupRelated(value);
            this.data[idx] = value;    
        }
    };

    public remove(id?: string) {
        if (id) {
            const idx = this.data.indexOf(this.get(id));
            this.data.splice(idx, 1);    
        } else {
            this.data = [];
        }
    };

    public value() {
        const data: any[] = Array.from(this.data);
        for (const entry of data) {
            for (const related of this.relatedFields) {
                if (entry[related.name] && entry[related.name].value) {
                    entry[related.name] = entry[related.name].value();
                }
            }  
        }

        return data;
    };

    // private addRelated(name: string, collection: Collection, isArray: boolean) {
    //     this.relatedFields.push({ name, collection, isArray });
    // };

    private setupRelated(entry?: any) {
        if (!entry) {
            for (const e of this.data) {
                this.setupRelated(e);
            }    
        } else {
            for (const related of this.relatedFields) {
                entry[related.name] = new CollectionArrayField(related.name, related.collection, entry[related.name] || []);
            }
        }
    }
};

export class CollectionArrayField extends Collection {
    private collection: Collection;

    constructor(name: string, collection: Collection, data: any) {
        //Object.assign(this, new Collection(name, data));
        super(name, data);
        this.collection = collection;
    }

    public all() {
        return this.data.map( (id: string) => this.collection.get(id)) || [];
    };

    public create(value: any) {
        const item = this.collection.create(value);
        this.data.push(item._id);
        
        return item;
    };

    // tslint:disable-next-line:no-reserved-keywords
    public get(id: string) {
        if (this.data.indexOf(id) === -1) { return null; }
        
        return this.collection.get(id);
    };

    public update(id: string, values: any[]) {
        if (this.data.indexOf(id) === -1) { return null; }
        this.collection.update(id, values);
    };
};


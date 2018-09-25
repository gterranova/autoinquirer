// tslint:disable:no-any
// tslint:disable:no-console

import objectPath from 'object-path';
import { actualPath } from '../utils';
import { DataSource } from './index';

export class MemoryDataSource extends DataSource {
    protected jsonDocument: any;

    constructor(schemaFile: string) {
        super(schemaFile);
    }

    public async setup() {
        const schema = this.getDefinition('');
        this.jsonDocument = this.coerce(schema);
    }

    // tslint:disable-next-line:no-empty
    public async save() {}

    // tslint:disable-next-line:no-reserved-keywords
    public async get(itemPath?: string) {
        if (!itemPath) { return this.jsonDocument; }

        const schemaParts = actualPath(itemPath);

        return objectPath.get(this.jsonDocument, schemaParts.split('/'));
    }

    public async push(itemPath: string, value: any) {
        const schemaPath = actualPath(itemPath);
        const schema = this.getDefinition(schemaPath);
    
        //console.log('addItemByPath', schemaPath.split('/'), schema.type, value);
        if (schema.type === 'array') {
            const arrayItemSchema: any = schema.items;

            // tslint:disable-next-line:no-parameter-reassignment
            value = this.coerce(arrayItemSchema, value);    

            if (!schemaPath) { 
                this.jsonDocument.push(value); 
            } else {
                objectPath.push(this.jsonDocument, schemaPath.split('/'), value);
            }
        } else {
            throw new Error('not implemented')
        }
        this.save();    
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async set(itemPath: string, value: any) {
        if (value !== undefined) {
            const schemaPath = actualPath(itemPath);
            const schema = this.getDefinition(schemaPath);
            const prepValue = this.coerce(schema, value);
            if (!this.validate(schema, prepValue)) {
                throw new Error(JSON.stringify(this.validator.errors));
            }
            objectPath.set(this.jsonDocument, schemaPath.split('/'), prepValue);
            this.save();                
        }
    }

    public async del(itemPath: string) {
        const schemaPath = actualPath(itemPath);
        objectPath.del(this.jsonDocument, schemaPath.split('/'));
        this.save();
    }
};

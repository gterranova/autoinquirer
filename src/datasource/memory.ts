// tslint:disable:no-any
// tslint:disable:no-console

import fs from "fs";
import { ObjectID } from 'mongodb';
import objectPath from 'object-path';
import { IProperty } from '../interfaces';
import { getType, loadJSON } from '../utils';
import { DataSource } from './index';

export class MemoryDataSource extends DataSource {
    private jsonDocument: any;
    private dataFile: string;

    constructor(data: any) {
        super();
        this.dataFile = (typeof data === 'string') && data;
        this.jsonDocument = this.dataFile && loadJSON(this.dataFile) || {};
    }

    public async connect() {
        // Nothing to do
    }

    public async close() {
        return this.save();
    }

    public async save() {
        if (this.dataFile) { fs.writeFileSync(this.dataFile, JSON.stringify(this.jsonDocument, null, 2)); }
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async get(itemPath?: string) {
        const schemaPath = !itemPath? '' : await this.convertObjIDToIndex(itemPath);
        if (!itemPath) { return this.jsonDocument; }

        return objectPath.get(this.jsonDocument, schemaPath.split('/'));
    }

    public async push(itemPath: string, _?: IProperty, value?: any) {
        if (value !== undefined) {
            if (getType(value) === 'Object') {
                value._id = new ObjectID().toHexString();
            }
    
            if (!itemPath) { 
                this.jsonDocument.push(value); 
            } else {
                const schemaPath = !itemPath? '' : await this.convertObjIDToIndex(itemPath);
                objectPath.push(this.jsonDocument, schemaPath.split('/'), value);
            }
            
            return this.save();    
        }
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async set(itemPath: string, _: IProperty, value: any) {
        if (value !== undefined) {
            if (!itemPath) {
                this.jsonDocument = value;
            } else {
                const schemaPath = !itemPath? '' : await this.convertObjIDToIndex(itemPath);
                objectPath.set(this.jsonDocument, schemaPath.split('/'), value);    
            }

            return this.save();                
        }
    }

    public async del(itemPath: string) {
        const schemaPath = await this.convertObjIDToIndex(itemPath);
        objectPath.del(this.jsonDocument, schemaPath.split('/'));
        
        return this.save();
    }

    public async dispatch(methodName: string, itemPath?: string, schema?: IProperty, value?: any, parentPath?: string, params?: any) {
        if (!this[methodName]) {
            throw new Error(`Method ${methodName} not implemented`);
        }

        // tslint:disable-next-line:no-return-await
        return await this[methodName].call(this, itemPath, schema, value, parentPath, params);
    }

}

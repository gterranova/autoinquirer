// tslint:disable:no-any
// tslint:disable:no-console

import fs from "fs";
import objectPath from 'object-path';
import { loadJSON } from '../utils';
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
        this.save();
    }

    public async save() {
        if (this.dataFile) { fs.writeFileSync(this.dataFile, JSON.stringify(this.jsonDocument, null, 2)); }
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async get(itemPath?: string) {
        if (!itemPath) { return this.jsonDocument; }

        return objectPath.get(this.jsonDocument, itemPath.split('/'));
    }

    public async push(itemPath: string, value: any) {    
        if (!itemPath) { 
            this.jsonDocument.push(value); 
        } else {
            objectPath.push(this.jsonDocument, itemPath.split('/'), value);
        }
        this.save();    
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async set(itemPath: string, value: any) {
        if (value !== undefined) {
            objectPath.set(this.jsonDocument, itemPath.split('/'), value);
            this.save();                
        }
    }

    public async del(itemPath: string) {
        const schemaPath = await this.convertObjIDToIndex(itemPath);
        objectPath.del(this.jsonDocument, schemaPath.split('/'));
        this.save();
    }

    public delCascade() {
        throw new Error("Method not implemented.");
    }

}

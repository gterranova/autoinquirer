// tslint:disable:no-any
// tslint:disable:no-console

import fs from "fs";
import objectPath from 'object-path';
import { IProperty } from './interfaces';
import { Document } from './types';
import { actualPath, loadJSON } from './utils';

export abstract class BaseDataSource {
    private schemaFile: string;
    private schemaDocument: Document;

    constructor(schemaFile: string) {
        this.schemaFile = schemaFile;
    }

    public async initialize() {
        this.schemaDocument = await Document.load(this.schemaFile);
    } 

    public getDefinition(schemaPath: string): IProperty {
        const schemaParts = actualPath(schemaPath);

        return this.schemaDocument.getDefinition(schemaParts);
    }

    // tslint:disable-next-line:no-reserved-keywords
    public abstract get(itemPath?: string): any;
    // tslint:disable-next-line:no-reserved-keywords
    public abstract set(itemPath: string, value: any)
    public abstract push(itemPath: string, value: any);
    public abstract del(itemPath: string);
    public abstract save();
}

export class FileSystemDataSource extends BaseDataSource {
    private dataFile: string;
    private jsonDocument: any;

    constructor(schemaFile: string, dataFile: string) {
        super(schemaFile);
        this.dataFile = dataFile;
        this.jsonDocument = loadJSON(this.dataFile) || {};
    }

    public save() {
        fs.writeFileSync(this.dataFile, JSON.stringify(this.jsonDocument, null, 2));
    }

    // tslint:disable-next-line:no-reserved-keywords
    public get(itemPath?: string): any {
        if (!itemPath) { return this.jsonDocument; }

        const schemaParts = actualPath(itemPath);

        return objectPath.get(this.jsonDocument, schemaParts.split('/'));
    }

    public push(itemPath: string, value: any) {
        const schemaPath = actualPath(itemPath);
        const schema = this.getDefinition(schemaPath);

        console.log('addItemByPath', schemaPath.split('/'), schema.type, value);
        if (schema.type === 'array') {
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
    public set(itemPath: string, value: any) {
        const schemaPath = actualPath(itemPath);
        objectPath.set(this.jsonDocument, schemaPath.split('/'), value);
        this.save();
    }

    public del(itemPath: string) {
        const schemaPath = actualPath(itemPath);
        objectPath.del(this.jsonDocument, schemaPath.split('/'));
        this.save();
    }
};

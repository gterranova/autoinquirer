// tslint:disable:no-any
// tslint:disable:no-console

import fs from "fs";
import { loadJSON } from '../utils';
import { MemoryDataSource } from './memory';

function getType(value: any) {
    // tslint:disable-next-line:no-reserved-keywords
    const type = typeof value;
    if (type === 'object') {
        return value ? Object.prototype.toString.call(value).slice(8, -1) : 'null';
    }

    return type;
}

export class FileSystemDataSource extends MemoryDataSource {
    private dataFile: string;

    constructor(schemaFile: string, dataFile: string) {
        super(schemaFile);
        this.dataFile = dataFile;
    }

    public async setup() {
        const schema = this.getDefinition('');
        const defaultValue = this.coerce(schema);
        this.jsonDocument = loadJSON(this.dataFile);
        if (!this.jsonDocument || getType(this.jsonDocument) !== getType(defaultValue)) {
            this.jsonDocument = defaultValue;
        }
    }

    public async save() {
        fs.writeFileSync(this.dataFile, JSON.stringify(this.jsonDocument, null, 2));
    }

};

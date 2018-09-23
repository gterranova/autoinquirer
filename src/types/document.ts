// tslint:disable-next-line:import-name
import $RefParser from 'json-schema-ref-parser';

import { IProperty } from '../interfaces';
import { Definition } from './definition';

export class Document extends Definition {
    
    constructor(data: IProperty) {
        super();
        Object.assign(this, data);
    }

    // tslint:disable-next-line:function-name
    public static async load(fileName: string): Promise<Document> {
        const parser = new $RefParser();
        const schema = await parser.dereference(fileName);

        return new Document(schema);
    }

    public getDefinition(name: string): IProperty {
        let definition = Object(this);
        if (!name || !name.length) { 
            return { ...Object(this) };
        }
        const parts = name.split('/');

        while (definition && parts.length) {
            const key = parts.shift();

            if (definition.type === 'array' && key==='items' || (/^[a-f0-9-]{36}$/.test(key) || /^\d+$/.test(key) || /^#$/.test(key))) {
                definition = definition.items;
            } else if (definition.type === 'object' && definition.properties && definition.properties[key]) {
                definition = definition.properties[key];
            } else if (definition.type === 'object' && key==='properties') {
                definition = definition.properties;
            } else {
                definition = definition[key];
            }
        }

        return definition;
    }

}

import fs from "fs";

import { BlockType, IDefinitions, IDocument, IEntity, ISchema } from '../interfaces';
import { loadJSON } from '../utils';
import { Definition } from './definition';

export class Document extends Definition<IDocument> implements IDocument {
    public $discriminator: BlockType.DOCUMENT;
    public schema: ISchema[];
    
    private $definitions: IDefinitions;
    
    constructor(data?: IDocument) {
        super(data);

        if (this.schema) {
            this.$definitions = <IDefinitions>this.schema.reduce( (acc: IDefinitions, curr: ISchema) => {
                if (curr.uri && fs.existsSync(curr.uri)) {
                    const importedDefinitions: IDefinitions = Document.load(curr.uri).getProcessedDefinitions();
                    for (const defName of Object.keys(importedDefinitions)) {
                        const def = importedDefinitions[defName];
                        if (acc[defName]) {
                            Object.assign(acc[defName], def, {$discriminator: BlockType.PROPERTIES});
                        } else {
                            acc[defName] = def;
                            Object.assign(acc[defName], {$discriminator: BlockType.PROPERTIES});
                        }
                    }
                }   

                return acc;
            }, {});
            this.definitions.$discriminator = this.$definitions.$discriminator = BlockType.DEFINITIONS;
        }

        this.$definitions = {...this.$definitions, ...this.definitions};
    }

    // tslint:disable-next-line:function-name
    public static load(fileName: string): Document {
        return new Document(loadJSON(fileName));
    }

    // tslint:disable-next-line:function-name
    public static empty(): IDocument {
        return { $discriminator: BlockType.DOCUMENT, definitions: {$discriminator: BlockType.DEFINITIONS} };
    }

    // tslint:disable-next-line:no-any
    public empty(..._: any[]): IDocument {
        return Document.empty();
    }

    public getProcessedDefinitions(): IDefinitions {
        return this.$definitions;
    }

    // tslint:disable-next-line:no-any
    public completeDefinition(obj: any) {
        if (typeof obj !== 'object') { return obj; }

        if (obj.$ref && typeof obj.$ref === 'string') {
            // tslint:disable-next-line:no-console
            while (obj.$ref) {
                const inheritedDef = this.getDefinition(obj.$ref.replace(/^#\/definitions\//, ''));
                if (inheritedDef) { 
                    // tslint:disable-next-line:no-parameter-reassignment
                    obj = {...obj, $ref: undefined, ...inheritedDef } 
                } else {
                    throw new Error(`Definition ${obj.$ref.replace(/^#\/definitions\//, '')} not found`);
                };    
            }
        }
        obj.$discriminator = this.inferDefinitionType(obj);

        return obj;        
    }

    // tslint:disable-next-line:no-any
    public inferDefinitionType(obj: any): BlockType {
        if (obj && obj.$discriminator) { return obj.$discriminator; }
        // tslint:disable-next-line:no-reserved-keywords
        const type = obj && obj.type;
        switch (type) {
            case 'object':
            case 'array':
                return BlockType.PROPERTY;
            default:
        }

        return BlockType.PROPERTIES;
    }

    public getDefinition(name: string): IEntity {
        if (!name || !name.length) { 
            return this.definitions;
        }
        const parts = name.split('/');
        let definition = Object(this.$definitions);

        while (definition && parts.length) {
            const key = parts.shift();
            definition = Object(this.completeDefinition(definition));
            switch (definition.$discriminator) {
                case BlockType.DEFINITIONS:
                case BlockType.PROPERTIES:
                    definition = <IEntity>definition[key];
                    break;
                case BlockType.PROPERTY:
                    if (key==='items' || (/^[a-f0-9-]{36}$/.test(key) || /^\d+$/.test(key) || /^#$/.test(key) && 
                        definition.type === 'array')) {
                        definition = this.completeDefinition(definition.items);
                    } else if (definition.type === 'object' && definition.properties && definition.properties[key]) {
                        definition = <IEntity>definition.properties[key];
                    } else if (key==='properties' && definition.type === 'object' && definition.properties) {
                        definition = <IEntity>definition.properties;
                    } else {
                        return null;
                    }
                    break;

                default:
                    return null;
            }
        }

        return definition && this.completeDefinition(definition);
    }

    // tslint:disable-next-line:no-any
    public getValue(name: string): any {
        if (!name) {
            // tslint:disable-next-line:no-any
            return Object.keys(this.definitions).filter((key: any) => key !== '$discriminator').reduce((acc: any, key: string) => {
                acc[key] = this[key];
                
                return acc;
            // tslint:disable-next-line:no-any
            }, {});
        };
        const parts = name.split('/');
        let value = <IDocument>this;
        while (value && parts.length) {
            value = value[parts.shift()];
        }

        return value;
    }

}

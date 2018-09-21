// tslint:disable:no-any
// tslint:disable:no-reserved-keywords

export interface IState {
    path: string;
    type: string;
}

export interface IAnswer {
    state: IState;
    input?: { value?: any};
}

export interface IChoice {
    name: string;
    value: string;
}
export interface IPrompt {
    name: string;
    type: string;
    message: string;
    // tslint:disable-next-line:typedef
    when?: any | (IAnswer);
    default?: any | (IAnswer);
    choices?: any | (IAnswer);
    pageSize?: number;
}

export interface IFeedBack {
    name: string;
    answer: any;
}

export declare type PrimitiveType = number | boolean | string | null;

export const enum BlockType {
    DOCUMENT, 
    SCHEMA, 
    DEFINITIONS, 
    PROPERTY, 
    PROPERTIES
}

export interface IPropertyBase {
    $ref?: string;
    $schema?: string;
    $id?: string;
    description?: string;
    allOf?: IPropertyBase[];
    oneOf?: IPropertyBase[];
    anyOf?: IPropertyBase[];
    title?: string;
    type?: string | string[];
    definitions?: IDefinitions;
    format?: string;
    items?: IProperty;
    minItems?: number;
    additionalItems?: {
        anyOf: IPropertyBase[];
    } | IPropertyBase;
    enum?: PrimitiveType[] | IPropertyBase[];
    default?: PrimitiveType | Object;
    additionalProperties?: IPropertyBase | boolean;
    required?: string[];
    propertyOrder?: string[];
    properties?: IProperties;
    defaultProperties?: string[];
    typeof?: "function";
    depends?: string;
    choices?: any;
    reference?: string;
}

export interface IProperty extends IPropertyBase {
    $discriminator: BlockType.PROPERTY;
}

export interface IProperties {
    $discriminator: BlockType.PROPERTIES;
    [key: string]: IProperty | BlockType;
}

export interface ISchema {
    $discriminator: BlockType.SCHEMA;
    uri: string;
}

export interface IDefinitions {
    $discriminator: BlockType.DEFINITIONS;
    [key: string]: IProperties | IProperty | BlockType;
}

export interface IDocument extends IPropertyBase {
    $discriminator: BlockType.DOCUMENT;
    schema?: ISchema[];
    definitions?: IDefinitions;
}

export type IEntity = IDefinitions | IProperty | IProperties;

export interface IPropertyClass {
    create(value: any);
    get(id: string);
    value();
    update(id: string, value: any);
    remove(id: string);
}

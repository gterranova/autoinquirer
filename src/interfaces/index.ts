// tslint:disable:no-any
// tslint:disable:no-reserved-keywords

export const enum Action {
    EXIT='exit',
    ADD='push',
    EDIT='set',
    REMOVE='del'
}

export interface IState {
    path: string;
    type?: Action;
}

export interface IAnswer {
    state: IState;
    input?: { value?: any};
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

export interface IProperty {
    $ref?: string;
    $schema?: string;
    $id?: string;
    description?: string;
    allOf?: IProperty[];
    oneOf?: IProperty[];
    anyOf?: IProperty[];
    title?: string;
    type?: string | string[];
    definitions?: {
        [key: string]: IProperty;
    };
    format?: string;
    items?: IProperty;
    minItems?: number;
    additionalItems?: {
        anyOf: IProperty[];
    } | IProperty;
    enum?: PrimitiveType[] | IProperty[];
    default?: PrimitiveType | Object;
    additionalProperties?: IProperty | boolean;
    required?: string[];
    propertyOrder?: string[];
    properties?: {
        [key: string]: IProperty;
    };
    defaultProperties?: string[];
    typeof?: "function";
    depends?: string;
}

export interface IPropertyClass {
    create(value: any);
    get(id: string);
    value();
    update(id: string, value: any);
    remove(id: string);
}

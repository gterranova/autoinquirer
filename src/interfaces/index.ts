// tslint:disable:no-any
// tslint:disable:no-reserved-keywords

export const enum Action {
    BACK='back',
    EXIT='exit',
    ADD='add',
    EDIT='edit',
    REMOVE='remove'
}

export interface IState {
    path: string;
    type?: Action;
    errors?: any;
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
    errors?: any;
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


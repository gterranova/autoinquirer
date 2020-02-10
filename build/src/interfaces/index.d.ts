export { IQuery } from './query';
export declare const enum Action {
    BACK = "back",
    EXIT = "exit",
    GET = "get",
    PUSH = "push",
    SET = "set",
    UPDATE = "update",
    DEL = "del"
}
export interface IState {
    path: string;
    type?: Action | string;
    errors?: string;
}
export interface INameValueState {
    name: string;
    value: IState | string;
    disabled?: boolean;
}
export interface IAnswer {
    state: IState;
    value?: any;
}
export interface IPrompt {
    name: string;
    type: string;
    message: string;
    when?: any | (IAnswer);
    default?: any | (IAnswer);
    choices?: any | (IAnswer);
    pageSize?: number;
    disabled?: boolean;
    errors?: any;
    path?: string;
}
export interface IFeedBack {
    name: string;
    answer: any;
    value?: any;
}
export declare type PrimitiveType = number | boolean | string | null;
export interface IProxyInfo {
    proxyName: string;
    params: any;
}
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
    patternProperties?: {
        [key: string]: IProperty;
    };
    defaultProperties?: string[];
    pattern?: string;
    $title?: string;
    readOnly?: boolean;
    writeOnly?: boolean;
    typeof?: "function";
    depends?: string;
    $data?: string;
    $values?: {
        [key: string]: any;
    };
    $proxy?: IProxyInfo;
}

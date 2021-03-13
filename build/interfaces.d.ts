import { AbstractDataSource } from './datasource';
export declare const enum Action {
    BACK = "back",
    EXIT = "exit",
    GET = "get",
    PUSH = "push",
    SET = "set",
    UPDATE = "update",
    DELETE = "delete",
    DELETE_CASCADE = "delCascade"
}
export declare type DispatchAction = (options?: IDispatchOptions) => any;
export interface AutoinquirerGet {
    [Action.GET]: DispatchAction;
}
export interface AutoinquirerPush {
    [Action.PUSH]: DispatchAction;
}
export interface AutoinquirerUpdate {
    [Action.UPDATE]: DispatchAction;
}
export interface AutoinquirerSet {
    [Action.SET]: DispatchAction;
}
export interface AutoinquirerDelete {
    [Action.DELETE]: DispatchAction;
}
export declare type PrimitiveType = number | boolean | string | null;
export interface IProxyInfo {
    proxyName: string;
    params?: any;
    initParams?: any;
    singleton?: boolean;
}
export interface IRelationship {
    path: string;
    remoteField?: string;
    groupBy?: string;
    filterBy?: string;
    orderBy?: string[];
    actions?: string[];
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
    required?: boolean | string[];
    propertyOrder?: string[];
    properties?: {
        [key: string]: IProperty;
    };
    patternProperties?: {
        [key: string]: IProperty;
    };
    defaultProperties?: string[];
    pattern?: string;
    $parent?: IProperty;
    $title?: string;
    readOnly?: boolean;
    writeOnly?: boolean;
    $visible?: boolean;
    $data?: IRelationship;
    $proxy?: IProxyInfo;
    $orderBy?: string[];
    $groupBy?: string;
    $widget?: {
        type?: string;
        wrappers?: string[];
        actions?: string[];
        [property: string]: any;
    };
    $expressionProperties?: {
        [property: string]: string;
    };
}
export interface IDispatchOptions {
    itemPath?: string;
    schema?: IProperty;
    value?: any;
    parentPath?: string;
    params?: any;
    query?: any;
    files?: any;
    user?: any;
    proxyInfo?: IProxyInfo;
}
export interface ICursorObject {
    jsonObjectID: string;
    self?: string;
    index?: number;
    total?: number;
    prev?: string;
    next?: string;
    first?: string;
    last?: string;
}
export declare type IEntryPoints = {
    [key: string]: IProxyInfo;
};
export interface IEntryPointInfo {
    proxyInfo: IProxyInfo;
    parentPath: string;
    itemPath: string;
    params?: any;
}
export declare type Newable<T> = {
    new (...args: any[]): T;
};
export interface IProxy {
    name: string;
    classRef?: Newable<AbstractDataSource>;
    dataSource?: AbstractDataSource;
}
export declare type IDataSourceInfo<T extends AbstractDataSource> = {
    dataSource: T;
    entryPointOptions?: IDispatchOptions;
};
export declare type renderFunction = (_methodName: string, options?: IDispatchOptions) => Promise<any>;
export declare interface renderOptions {
    name: string;
    fn: renderFunction;
}
//# sourceMappingURL=interfaces.d.ts.map
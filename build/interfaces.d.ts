export declare const enum Action {
    BACK = "back",
    EXIT = "exit",
    GET = "get",
    PUSH = "push",
    SET = "set",
    UPDATE = "update",
    DEL = "del"
}
export declare type PrimitiveType = number | boolean | string | null;
export interface IProxyInfo {
    proxyName: string;
    params: any;
    initParams?: any;
    singleton?: boolean;
}
export interface IRelationship {
    path: string;
    remoteField?: string;
    groupBy: string;
    filterBy: string;
    orderBy: string[];
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
    user?: any;
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
//# sourceMappingURL=interfaces.d.ts.map
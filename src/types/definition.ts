import { IProperty, PrimitiveType } from '../interfaces';

export abstract class Definition implements IProperty {
    public $ref?: string;
    public $schema?: string;
    public $id?: string;
    public description?: string;
    public allOf?: IProperty[];
    public oneOf?: IProperty[];
    public anyOf?: IProperty[];
    public title?: string;
    // tslint:disable-next-line:no-reserved-keywords
    public type?: string | string[];
    public definitions?: {
        [key: string]: IProperty;
    };
    public format?: string;
    public items?: IProperty;
    public minItems?: number;
    public additionalItems?: IProperty | { anyOf: IProperty[] };
    // tslint:disable-next-line:no-reserved-keywords
    public enum?: IProperty[] | PrimitiveType[];
    // tslint:disable-next-line:no-reserved-keywords
    public default?: string | number | boolean | Object;
    public additionalProperties?: boolean | IProperty;
    public required?: string[];
    public propertyOrder?: string[];
    public properties?: {
        [key: string]: IProperty;
    };
    public defaultProperties?: string[];
    // tslint:disable-next-line:no-reserved-keywords
    public typeof?: "function";
    public depends?: string;
}
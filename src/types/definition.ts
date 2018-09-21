import { IDefinitions, IProperties, IProperty, IPropertyBase, PrimitiveType } from '../interfaces';

export abstract class Definition<T extends IPropertyBase> implements IPropertyBase {
    public $ref?: string;
    public $schema?: string;
    public $id?: string;
    public description?: string;
    public allOf?: IPropertyBase[];
    public oneOf?: IPropertyBase[];
    public anyOf?: IPropertyBase[];
    public title?: string;
    // tslint:disable-next-line:no-reserved-keywords
    public type?: string | string[];
    public definitions?: IDefinitions;
    public format?: string;
    public items?: IProperty;
    public minItems?: number;
    public additionalItems?: IPropertyBase | { anyOf: IPropertyBase[] };
    // tslint:disable-next-line:no-reserved-keywords
    public enum?: IPropertyBase[] | PrimitiveType[];
    // tslint:disable-next-line:no-reserved-keywords
    public default?: string | number | boolean | Object;
    public additionalProperties?: boolean | IPropertyBase;
    public required?: string[];
    public propertyOrder?: string[];
    public properties?: IProperties;
    public defaultProperties?: string[];
    // tslint:disable-next-line:no-reserved-keywords
    public typeof?: "function";
    public depends?: string;
    // tslint:disable-next-line:no-any
    public choices?: any;
    public reference?: string;

    constructor(data?: IPropertyBase) {
        Object.assign(this, data || this.empty());
    }

    // tslint:disable-next-line:function-name
    public abstract empty(): T;
}
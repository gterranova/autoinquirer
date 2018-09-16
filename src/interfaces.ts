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

export interface IProperty {
    $name?: string;
    type?: string;
    default?: any;
    properties?: IProperties;
    depends?: string;
    choices?: any;
    $ref?: string;
    reference?: string;
    items?: IProperty;
}

export interface IProperties {
    [key: string]: IProperty
}

export interface ISchema {
    uri: string;
}

export interface IDocument extends IProperty {
    schema?: ISchema[];
    definitions?: { [key: string]: IProperty };
    [key: string]: any;
}

export interface IPropertyClass {
    create(value: any);
    get(id: string);
    value();
    update(id: string, value: any);
    remove(id: string);
}

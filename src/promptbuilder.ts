// tslint:disable:no-console

import { Action, INameValueState, IPrompt, IProperty, IState, PrimitiveType } from './interfaces';

import { DataSource } from './datasource';
import { absolute, backPath, evalExpr } from './utils';

// tslint:disable-next-line:no-any
export declare type Item = any;

const separatorChoice = {type: 'separator'};

const defaultActions: { [key: string]: string[] } = {
    'object': [Action.BACK, Action.DEL, Action.EXIT],
    'array': [Action.PUSH, Action.BACK, Action.EXIT]
};

export class PromptBuilder {
    private dataSource: DataSource;
    
    constructor(parent: DataSource) {
        this.dataSource = parent;
    }

    public async generatePrompts(initialState: IState, propertySchema: IProperty): Promise<IPrompt> {
        if (initialState.type === Action.EXIT) { return null; }

        return this.evaluate(initialState, propertySchema);
    }
    
    private getActions(initialState: IState, propertySchema: IProperty): INameValueState[] {
        const actions: INameValueState[] = [];
        if (defaultActions[propertySchema.type]) {
            defaultActions[propertySchema.type].map( (name: string) => {
                if (name === Action.BACK) {
                    if (initialState.path) {
                        actions.push({ name: 'Back', value: { path: backPath(initialState.path) }});
                    }
                } else {
                    actions.push({ name: (name.slice(0,1).toUpperCase()+name.slice(1)), value: { ...initialState, type: name }});
                }
            });
        }

        return actions;
    } 

    private async checkAllowed(path: string, propertySchema: IProperty): Promise<boolean> {
        if (!propertySchema || !propertySchema.depends) { return true; }
        const parentPath = backPath(path);
        //if (path.indexOf('/') === -1) { return true; }
        
        const parentPropertyValue: Promise<Item> = await this.dataSource.dispatch('get', parentPath);
        
        return parentPropertyValue? !!evalExpr(propertySchema.depends, parentPropertyValue): true;
        //console.log(propertySchema.depends, path, parentPropertyValue, allowed);

        //return allowed;        
    
    }

    private async makeMenu(initialState: IState, propertySchema: IProperty): Promise<IPrompt> {
        // select item
        const baseChoices = await this.getChoices(initialState, propertySchema);

        const choices = [...baseChoices, separatorChoice];
                
        return {
            name: 'state',
            type: 'list',
            message: `${initialState.path}\n${this.getName(propertySchema, null, propertySchema)}`,
            choices: [...choices, ...this.getActions(initialState, propertySchema)],
            pageSize: 20
        };
    }
    
    private async makePrompt(initialState: IState, propertySchema: IProperty): Promise<IPrompt> {        
        const currentValue = await this.dataSource.dispatch('get', initialState.path);
        const defaultValue = currentValue!==undefined ? currentValue : propertySchema.default;
        const isCheckbox = this.isCheckBox(propertySchema);
        const choices = await this.getOptions(initialState, propertySchema);

        return {
            name: `value`,
            message: `Enter ${propertySchema.type ? propertySchema.type.toLowerCase(): 'value'}:`,
            default: defaultValue,
            type: propertySchema.type==='boolean'? 'confirm': 
                (isCheckbox? 'checkbox':
                    (choices && choices.length? 'list':
                        'input')),
            choices,
            errors: initialState.type === Action.SET && initialState.errors
        };
    }

    private async getChoices(initialState: IState, propertySchema: IProperty): Promise<INameValueState[]> {
        const schemaPath = initialState.path;
        const value =  await this.dataSource.dispatch('get', schemaPath);

        const basePath = schemaPath && schemaPath.length ? `${schemaPath}/`: '';
        if (propertySchema) {
            switch (propertySchema.type) {

                case 'string':
                case 'number':
                case 'boolean':
                    return null; 
                case 'object':
                    return propertySchema.properties && await Promise.all(Object.keys(propertySchema.properties).map( (key: string) => {
                        const property: IProperty = propertySchema.properties[key];
                        if (!property) {
                            throw new Error(`${schemaPath}/${key} not found`);
                        }
                        
                        return this.checkAllowed(`${schemaPath}/${key}`, property).then( (allowed: boolean) => {
                            const item: INameValueState = { 
                                name: this.getName(value && value[key], key, property), 
                                value: { path: `${basePath}${key}` },
                                disabled: !allowed
                            };
                            if (this.isPrimitive(property)) { 
                                // tslint:disable-next-line:no-string-literal
                                item.value['type'] = Action.SET; 
                            }
                            
                            return item;    
                        });

                    })) || [];
                case 'array':
                    const arrayItemSchema: IProperty = propertySchema.items;

                    return value && value.map( (arrayItem: Item, idx: number) => {
                        const myId = (arrayItem && arrayItem._id) || idx;
                        const item: INameValueState = { 
                            name: this.getName(arrayItem, myId, arrayItemSchema), 
                            value: {  
                                path: `${basePath}${myId}`
                            } 
                        };
                        if (this.isPrimitive(arrayItemSchema)) { 
                            // tslint:disable-next-line:no-string-literal
                            item.value['type'] = Action.SET; 
                        }
                    
                        return item;
                    }) || [];

                default:
                    return value && Object.keys(value).map( (key: string) => {
                        return { 
                            name: key, 
                            value: {  
                                type: Action.SET,
                                path: `${basePath}${key}`
                            } 
                        };
                    }) || [];        
            }    
        }
        
        return [];
    }

    private getName(value: Item, propertyNameOrIndex: string | number, propertySchema: IProperty): string {
        const head = propertyNameOrIndex !== null ? `${propertyNameOrIndex}: `:'';
        const tail = (value !== undefined && value !== null) ?
            (propertySchema.type !== 'object' && propertySchema.type !== 'array' ? JSON.stringify(value) :  
                (value.title || value.name || (propertyNameOrIndex? `[${propertySchema.type}]`: ''))):
            '';

        return `${head}${tail}`;
    }

    private isPrimitive(propertySchema: IProperty): boolean {
        return propertySchema.type !== 'object' && 
            propertySchema.type !== 'array' || 
            this.isSelect(propertySchema) ||
            this.isCheckBox(propertySchema);
    }

    private isCheckBox(propertySchema: IProperty): boolean {
        return propertySchema && propertySchema.type === 'array' && 
            this.isSelect(propertySchema.items);
    }

    private isSelect(propertySchema: IProperty): boolean {
        return propertySchema && propertySchema.enum !== undefined || propertySchema.$data !== undefined;
    }

    private async getOptions(initialState: IState, propertySchema: IProperty): Promise<INameValueState[] | PrimitiveType[] | IProperty[]> {
        const isCheckBox = this.isCheckBox(propertySchema);
        const property = isCheckBox? propertySchema.items : propertySchema;
        const $data = property.$data; 
        if ($data) {
            const absolutePath = absolute($data, initialState.path);
            const values = await this.dataSource.dispatch('get', absolutePath);

            return values.map( (value: Item, idx: number) => {
                return { 
                    name: this.getName(value, idx, property), 
                    value: `${absolutePath}/${value._id}` 
                };
            });
        }
        
        return isCheckBox? propertySchema.items.enum : propertySchema.enum;         
    }
        
    private evaluate(initialState: IState, propertySchema: IProperty): Promise<IPrompt> {
        if (initialState.type === Action.SET && this.isCheckBox(propertySchema)) {
            return this.makePrompt({...initialState, type: Action.SET}, propertySchema);
        }
        switch (propertySchema.type) {
            case 'array':
            case 'object':
                return this.makeMenu(initialState, propertySchema);
            default:
                //console.log("evaluate_primitives", path, propertySchema);    
                return this.makePrompt({...initialState, type: Action.SET}, propertySchema);
        }
    }

}

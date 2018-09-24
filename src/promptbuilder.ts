// tslint:disable:no-any
// tslint:disable:no-console

import { BaseDataSource } from './datasource';
import { Action, IPrompt, IProperty, IState } from './interfaces';

import { backPath, evalExpr } from './utils';

// tslint:disable-next-line:one-variable-per-declaration
const separatorChoice = {type: 'separator'};

const defaultActions = {
    'object': [Action.BACK, Action.REMOVE, Action.EXIT],
    'array': [Action.ADD, Action.BACK, Action.EXIT]
};

export class PromptBuilder {
    private dataSource: BaseDataSource;
    // tslint:disable-next-line:no-reserved-keywords
    private customActions: { name: string; value: { type: string}}[] = [];
    
    constructor(dataSource: BaseDataSource) {
        this.dataSource = dataSource;
    }

    public addAction(name: string, title?: any) {
        this.customActions.push({ name: title||(name.slice(0,1).toUpperCase()+name.slice(1)), value: { type: name }});
    } 

    public getActions(initialState: IState, propertySchema: any) {
        const actions = this.customActions.map( (action: any) => {
            return { name: action.name, value: {...initialState, ...action.value}};
        });
        const additionalActions = propertySchema.$actions || defaultActions[propertySchema.type];
        if (additionalActions) {
            additionalActions.map( (name: string) => {
                console.log(name, Action.BACK, name === Action.BACK, initialState.path)
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

    public async generatePrompts(initialState: IState, propertySchema: IProperty): Promise<IPrompt> {
        if (initialState.type === Action.EXIT) { return null; }

        return this.evaluate(initialState, propertySchema);
    }
    
    private async checkAllowed(path: string, propertySchema: any): Promise<boolean> {
        if (!propertySchema || !propertySchema.depends) { return true; }
        const parentPath = backPath(path);
        //if (path.indexOf('/') === -1) { return true; }
        
        const parentPropertyValue = await this.dataSource.get(parentPath);
        
        return parentPropertyValue? !!evalExpr(propertySchema.depends, parentPropertyValue): true;
        //console.log(propertySchema.depends, path, parentPropertyValue, allowed);

        //return allowed;        
    
    }

    private async makeMenu(initialState: IState, propertySchema: any): Promise<IPrompt> {
        // select item
        const baseChoices = await this.getChoices(initialState, propertySchema);

        const choices = [...baseChoices, separatorChoice];
                
        return {
            name: 'state',
            type: 'list',
            message: `select:`,
            choices: [...choices, ...this.getActions(initialState, propertySchema)],
            pageSize: 20
        };
    }
    
    private async makePrompt(initialState: IState, propertySchema: any): Promise<IPrompt> {        
        const currentValue = await this.dataSource.get(initialState.path);
        const defaultValue = currentValue!==undefined ? currentValue : propertySchema.default;
        const isCheckbox = propertySchema.items && propertySchema.items.enum;
        const choices = !isCheckbox? propertySchema.enum: propertySchema.items.enum;

        return {
            name: `input.value`,
            message: `Enter ${propertySchema.type ? propertySchema.type.toLowerCase(): 'value'}:`,
            default: defaultValue,
            type: propertySchema.type==='boolean'? 'confirm': 
                (isCheckbox? 'checkbox':
                    (propertySchema.enum? 'list':
                        'input')),
            choices,
            errors: initialState.type === Action.EDIT && initialState.errors
        };
    }

    private async getChoices(initialState: IState, propertySchema: any): Promise<any[]> {
        const schemaPath = initialState.path;
        const value =  await this.dataSource.get(schemaPath);

        const basePath = schemaPath && schemaPath.length ? `${schemaPath}/`: '';
        if (propertySchema) {
            switch (propertySchema.type) {

                case 'string':
                case 'number':
                case 'boolean':
                    return null; //value && { name: value, path: `${basePath}${value?Action.EDIT:Action.ADD}` };
                case 'object':
                    return propertySchema.properties && await Promise.all(Object.keys(propertySchema.properties).map( (key: string) => {
                        const property: any = propertySchema.properties[key];
                        if (!property) {
                            throw new Error(`${schemaPath}/${key} not found`);
                        }
                        
                        return this.checkAllowed(`${schemaPath}/${key}`, property).then( (allowed: boolean) => {
                            const item = { 
                                name: key, 
                                value: { path: `${basePath}${key}` },
                                disabled: !allowed
                            };
                            if (property.type !== 'object' || property.type !== 'array' || (property.items && property.items.enum)) { 
                                // tslint:disable-next-line:no-string-literal
                                item.value['type'] = Action.EDIT; 
                            }
                            
                            return item;    
                        });

                    })) || [];
                case 'array':
                    const arrayItemSchema: any = propertySchema.items;
                    const arrayItemType = arrayItemSchema && arrayItemSchema.type;
                    const action = arrayItemType === 'object' || arrayItemType === 'array'? undefined: Action.EDIT; 
        
                    return value && value.map( (key: string, idx: number) => {
                        const item = { 
                            name: JSON.stringify(key), 
                            value: {  
                                path: `${basePath}${idx}`
                            } 
                        };
                        // tslint:disable-next-line:no-string-literal
                        if (action) { item.value['type'] = action; }
                        
                        return item;
                    }) || [];

                default:
                    return value && Object.keys(value).map( (key: string) => {
                        return { 
                            name: key, 
                            value: {  
                                type: Action.EDIT,
                                path: `${basePath}${key}`
                            } 
                        };
                    }) || [];        
            }    
        }
        
        return [];
    }
        
    private evaluate(initialState: IState, propertySchema: IProperty): Promise<IPrompt> {
        switch (propertySchema.type) {
            case 'array':
                if (propertySchema.items && propertySchema.items.enum) {
                    return this.makePrompt({...initialState, type: Action.EDIT}, propertySchema);
                }
            case 'object':
                return this.makeMenu(initialState, propertySchema);
            default:
                //console.log("evaluate_primitives", path, propertySchema);    
                return this.makePrompt({...initialState, type: Action.EDIT}, propertySchema);
        }
    }

}

// tslint:disable:no-any
// tslint:disable:no-console

import { BaseDataSource } from './datasource';
import { Action, IPrompt, IProperty, IState } from './interfaces';

import { backPath, evalExpr } from './utils';

// tslint:disable-next-line:one-variable-per-declaration
const separatorChoice = {type: 'separator'}, cancelChoice= {name: 'Cancel', value: { type: Action.EXIT } };

export class PromptBuilder {
    private dataSource: BaseDataSource;

    constructor(dataSource: BaseDataSource) {
        this.dataSource = dataSource;
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

    private makeMenu(_: IState, choices: any): IPrompt {
        return {
            name: 'state',
            type: 'list',
            message: `select:`,
            choices,
            pageSize: 20
        };
    }
    
    private async makePrompt(initialState: IState, propertySchema: any): Promise<IPrompt> {        
        const currentValue = await this.dataSource.get(initialState.path);
        const defaultValue = currentValue!==undefined ? currentValue : propertySchema.default;
        
        return {
            name: `input.value`,
            message: `Enter ${propertySchema.type ? propertySchema.type.toLowerCase(): 'value'}:`,
            default: defaultValue,
            type: propertySchema.type==='boolean'? 'confirm': 
                (propertySchema.type==='checkbox'? 'checkbox':
                    (propertySchema.type==='collection' || propertySchema.enum? 'list':
                        'input')),
            choices: propertySchema.enum
        };
    }

    private async getChoices(initialState: IState, propertySchema: any): Promise<any[]> {
        const schemaPath = initialState.path;
        const value =  await this.dataSource.get(schemaPath);

        const basePath = schemaPath.length ? `${schemaPath}/`: '';
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
                            // tslint:disable-next-line:no-string-literal
                            if (['array','object'].indexOf(property.type) === -1) { item.value['type'] = Action.EDIT; }
                            
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
    
    private async evaluate_object(initialState: IState, propertySchema: any): Promise<IPrompt> {
        const baseChoices = await this.getChoices(initialState, propertySchema);
        const choices = [...baseChoices, separatorChoice,
            {
                name: `Remove`, 
                value: {...initialState, type: Action.REMOVE }
            },{
                name: `Back`, 
                value: { path: backPath(initialState.path) }
            }, cancelChoice];
    
        return this.makeMenu(initialState, choices);
    }

    private async evaluate_array(initialState: IState, propertySchema: any): Promise<IPrompt> {
        // select item
        const arrayItemSchema: any = propertySchema.items;
        const arrayItemType = arrayItemSchema && arrayItemSchema.type;
        const baseChoices = await this.getChoices(initialState, propertySchema);

        const choices = [...baseChoices, separatorChoice, {
                name: `Add ${arrayItemType || '?'}`, 
                value: {...initialState, type: Action.ADD}
            },{
                name: `Back`, 
                value: { path: backPath(initialState.path) }
            }, cancelChoice];
    
        return this.makeMenu(initialState, choices);
    }
    
    private evaluate(initialState: IState, propertySchema: IProperty): Promise<IPrompt> {
        switch (propertySchema.type) {
            case 'object':
                return this.evaluate_object(initialState, propertySchema);
            case 'array':
                return this.evaluate_array(initialState, propertySchema);
            default:
                //console.log("evaluate_primitives", path, propertySchema);    
                return this.makePrompt({...initialState, type: Action.EDIT}, propertySchema);
        }
    }

}

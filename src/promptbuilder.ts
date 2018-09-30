// tslint:disable:no-any
// tslint:disable:no-console

import { Action, IPrompt, IProperty, IState } from './interfaces';

import { DataSource } from './datasource';
import { absolute, backPath, evalExpr } from './utils';

// tslint:disable-next-line:one-variable-per-declaration
const separatorChoice = {type: 'separator'};

const defaultActions = {
    'object': [Action.BACK, Action.REMOVE, Action.EXIT],
    'array': [Action.ADD, Action.BACK, Action.EXIT]
};

export class PromptBuilder {
    private dataSource: DataSource;
    // tslint:disable-next-line:no-reserved-keywords
    private customActions: { name: string; value: { type: string}}[] = [];
    
    constructor(parent: DataSource) {
        this.dataSource = parent;
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
            message: `${initialState.path}\n${this.getName(propertySchema, null, propertySchema)}`,
            choices: [...choices, ...this.getActions(initialState, propertySchema)],
            pageSize: 20
        };
    }
    
    private async makePrompt(initialState: IState, propertySchema: any): Promise<IPrompt> {        
        const currentValue = await this.dataSource.get(initialState.path);
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
                    return null; 
                case 'object':
                    return propertySchema.properties && await Promise.all(Object.keys(propertySchema.properties).map( (key: string) => {
                        const property: any = propertySchema.properties[key];
                        if (!property) {
                            throw new Error(`${schemaPath}/${key} not found`);
                        }
                        
                        return this.checkAllowed(`${schemaPath}/${key}`, property).then( (allowed: boolean) => {
                            const item = { 
                                name: this.getName(value && value[key], key, property), 
                                value: { path: `${basePath}${key}` },
                                disabled: !allowed
                            };
                            if (this.isPrimitive(property)) { 
                                // tslint:disable-next-line:no-string-literal
                                item.value['type'] = Action.EDIT; 
                            }
                            
                            return item;    
                        });

                    })) || [];
                case 'array':
                    const arrayItemSchema: any = propertySchema.items;

                    return value && value.map( (arrayItem: any, idx: number) => {
                        const myId = (arrayItem && arrayItem._id) || idx;
                        const item = { 
                            name: this.getName(arrayItem, myId, arrayItemSchema), 
                            value: {  
                                path: `${basePath}${myId}`
                            } 
                        };
                        if (this.isPrimitive(arrayItemSchema)) { 
                            // tslint:disable-next-line:no-string-literal
                            item.value['type'] = Action.EDIT; 
                        }
                    
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

    // tslint:disable-next-line:cyclomatic-complexity
    private getName(value: any, propertyNameOrIndex: string | number, propertySchema: any) {
        const head = propertyNameOrIndex !== null ? `${propertyNameOrIndex}: `:'';
        const tail = value !== undefined ?
            (propertySchema.type !== 'object' && propertySchema.type !== 'array' ? JSON.stringify(value) :  
                (value.title || value.name || (propertyNameOrIndex? `[${propertySchema.type}]`: ''))):
            '';

        return `${head}${tail}`;
    }

    private isPrimitive(propertySchema: any) {
        return propertySchema.type !== 'object' && 
            propertySchema.type !== 'array' || 
            this.isSelect(propertySchema) ||
            this.isCheckBox(propertySchema);
    }

    private isCheckBox(propertySchema: any) {
        return propertySchema && propertySchema.type === 'array' && 
            this.isSelect(propertySchema.items);
    }

    private isSelect(propertySchema: any) {
        return propertySchema && propertySchema.enum  || propertySchema.$data;
    }

    private async getOptions(initialState: IState, propertySchema: any) {
        const isCheckBox = this.isCheckBox(propertySchema);
        const property = isCheckBox? propertySchema.items : propertySchema;
        const $data = property.$data; 
        if ($data) {
            const absolutePath = absolute($data, initialState.path);
            const values = await this.dataSource.get(absolutePath);

            return values.map( (value: any, idx: number) => {
                return { 
                    name: this.getName(value, idx, property), 
                    value: `${absolutePath}/${value._id}` 
                };
            });
        }
        
        return isCheckBox? propertySchema.items.enum : propertySchema.enum;         
    }
        
    private evaluate(initialState: IState, propertySchema: IProperty): Promise<IPrompt> {
        if (initialState.type === Action.EDIT && this.isCheckBox(propertySchema)) {
            return this.makePrompt({...initialState, type: Action.EDIT}, propertySchema);
        }
        switch (propertySchema.type) {
            case 'array':
            case 'object':
                return this.makeMenu(initialState, propertySchema);
            default:
                //console.log("evaluate_primitives", path, propertySchema);    
                return this.makePrompt({...initialState, type: Action.EDIT}, propertySchema);
        }
    }

}

// tslint:disable:no-console

import { Action, INameValueState, IPrompt, IProperty, PrimitiveType } from './interfaces';

import { DataRenderer } from './datasource';
import { backPath, evalExpr, getType } from './utils';

// tslint:disable-next-line:no-any
export declare type Item = any;

const separatorChoice = {type: 'separator'};

const defaultActions: { [key: string]: string[] } = {
    'object': [Action.BACK, Action.DEL, Action.EXIT],
    'array': [Action.PUSH, Action.BACK, Action.EXIT]
};

export class PromptBuilder extends DataRenderer {
    
    public async render(methodName: string, itemPath: string, propertySchema: IProperty, propertyValue: Item): Promise<IPrompt> {
        if (methodName === Action.EXIT) { return null; }

        return this.evaluate(methodName, itemPath, propertySchema, propertyValue);
    }
    
    private getActions(itemPath: string, propertySchema: IProperty): INameValueState[] {
        const actions: INameValueState[] = [];
        if (defaultActions[propertySchema.type]) {
            defaultActions[propertySchema.type].map( (name: string) => {
                if (name === Action.BACK) {
                    if (itemPath) {
                        actions.push({ name: 'Back', value: { path: backPath(itemPath) }});
                    }
                } else {
                    actions.push({ name: (name.slice(0,1).toUpperCase()+name.slice(1)), value: { path: itemPath, type: name }});
                }
            });
        }

        return actions;
    } 

    private async checkAllowed(propertySchema: IProperty, parentPropertyValue: Item): Promise<boolean> {
        if (!propertySchema || !propertySchema.depends) { return true; }

        return parentPropertyValue? !!evalExpr(propertySchema.depends, parentPropertyValue): true;
    }

    private async makeMenu(itemPath: string, propertySchema: IProperty, propertyValue: Item): Promise<IPrompt> {
        // select item
        const baseChoices = await this.getChoices(itemPath, propertySchema, propertyValue);

        const choices = [...baseChoices, separatorChoice];
                
        return {
            name: 'state',
            type: 'list',
            message: this.getName(propertySchema, null, propertySchema),
            choices: [...choices, ...this.getActions(itemPath, propertySchema)],
            pageSize: 20
        };
    }
    
    private async makePrompt(propertySchema: IProperty, propertyValue: Item): Promise<IPrompt> {        
        const defaultValue = propertyValue!==undefined ? propertyValue : propertySchema.default;
        const isCheckbox = this.isCheckBox(propertySchema);
        const choices = await this.getOptions(propertySchema);

        return {
            name: `value`,
            message: `Enter ${propertySchema.type ? propertySchema.type.toLowerCase(): 'value'}:`,
            default: defaultValue,
            type: propertySchema.type==='boolean'? 'confirm': 
                (isCheckbox? 'checkbox':
                    (choices && choices.length? 'list':
                        'input')),
            choices
        };
    }

    private async getChoices(itemPath: string, propertySchema: IProperty, propertyValue: Item): Promise<INameValueState[]> {
        const schemaPath = itemPath;

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
                        
                        return this.checkAllowed(property, propertyValue).then( (allowed: boolean) => {
                            const item: INameValueState = { 
                                name: this.getName(propertyValue && propertyValue[key], key, property), 
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

                    return propertyValue && propertyValue.map( (arrayItem: Item, idx: number) => {
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
                    return propertyValue && Object.keys(propertyValue).map( (key: string) => {
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

    private async getOptions(propertySchema: IProperty): Promise<INameValueState[] | PrimitiveType[] | IProperty[]> {
        const isCheckBox = this.isCheckBox(propertySchema);
        
        const property = isCheckBox? propertySchema.items : propertySchema;
        const $values = property.$values; 
        if (getType($values) === 'Object') {
            return Object.keys($values).map( (key: string) => {
                return { 
                    name: this.getName($values[key], null, { type: 'object' }), 
                    value: key 
                };
            });
        }

        return isCheckBox? propertySchema.items.enum : propertySchema.enum;         
    }
        
    private evaluate(methodName: string, itemPath: string, propertySchema: IProperty, propertyValue: Item): Promise<IPrompt> {
        if (methodName === Action.SET && this.isCheckBox(propertySchema)) {
            return this.makePrompt(propertySchema, propertyValue);
        }
        switch (propertySchema.type) {
            case 'array':
            case 'object':
                return this.makeMenu(itemPath, propertySchema, propertyValue);
            default:
                //console.log("evaluate_primitives", path, propertySchema);    
                return this.makePrompt(propertySchema, propertyValue);
        }
    }

}

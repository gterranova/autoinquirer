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
                } else if (propertySchema.readOnly !== true || name === Action.EXIT) {
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
            disabled: !!propertySchema.readOnly,
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
                    const propertyProperties = propertySchema.properties? {...propertySchema.properties } : {};
                    if (propertySchema.patternProperties && getType(propertyValue) === 'Object') {
                        const objProperties = Object.keys(propertySchema.properties) || [];
                        // tslint:disable-next-line:no-bitwise
                        const otherProperties = Object.keys(propertyValue).filter( (p: string) => p[0] !== '_' && !~objProperties.indexOf(p) );
                        for (const key of otherProperties) {
                            const patternFound = Object.keys(propertySchema.patternProperties).find( (pattern: string) => RegExp(pattern).test(key));
                            if (patternFound) {
                                propertyProperties[key] = propertySchema.patternProperties[patternFound];
                            }            
                        }    
                    }

                    // tslint:disable-next-line:no-return-await
                    return await Promise.all(Object.keys(propertyProperties).map( (key: string) => {
                        const property: IProperty = propertyProperties[key];
                        if (!property) {
                            throw new Error(`${schemaPath}/${key} not found`);
                        }
                        
                        return this.checkAllowed(property, propertyValue).then( (allowed: boolean) => {
                            const readOnly = (!!propertySchema.readOnly || !!property.readOnly);
                            const writeOnly = (!!propertySchema.writeOnly || !!property.writeOnly);
                            const item: INameValueState = { 
                                name: this.getName(propertyValue && propertyValue[key], key, property), 
                                value: { path: `${basePath}${key}` },
                                disabled: !allowed || (this.isPrimitive(property) && readOnly && !writeOnly)
                            };
                            if (this.isPrimitive(property) && allowed && !readOnly || writeOnly) { 
                                // tslint:disable-next-line:no-string-literal
                                item.value['type'] = Action.SET; 
                            }
                            
                            return item;    
                        });

                    }));

                case 'array':
                    const arrayItemSchema: IProperty = propertySchema.items;
                    
                    return propertyValue && propertyValue.map( (arrayItem: Item, idx: number) => {
                        const myId = (arrayItem && arrayItem._id) || idx;
                        const readOnly = (!!propertySchema.readOnly || !!arrayItemSchema.readOnly);
                        const writeOnly = (!!propertySchema.writeOnly || !!arrayItemSchema.writeOnly);
                        const item: INameValueState = { 
                            name: this.getName(arrayItem, myId, arrayItemSchema), 
                            disabled: this.isPrimitive(arrayItemSchema) && readOnly && !writeOnly,
                            value: {  
                                path: `${basePath}${myId}`
                            } 
                        };
                        if (this.isPrimitive(arrayItemSchema) && !readOnly || writeOnly) { 
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
                (value.title || value.name || `[${propertySchema.type}]`)):
            '';

        return `${head}${tail}`;
    }

    private isPrimitive(propertySchema: IProperty = {}): boolean {
        return ((propertySchema.type !== 'object' && 
            propertySchema.type !== 'array')) || 
            this.isSelect(propertySchema) ||
            this.isCheckBox(propertySchema);
    }

    private isCheckBox(propertySchema: IProperty): boolean {
        if (propertySchema === undefined) { return false; };

        return propertySchema.type === 'array' && 
            this.isSelect(propertySchema.items);
    }

    private isSelect(propertySchema: IProperty): boolean {
        if (propertySchema === undefined) { return false; };

        return propertySchema.enum !== undefined || propertySchema.$data !== undefined;
    }

    private async getOptions(propertySchema: IProperty): Promise<INameValueState[] | PrimitiveType[] | IProperty[]> {
        const isCheckBox = this.isCheckBox(propertySchema);
        
        const property = isCheckBox? propertySchema.items : propertySchema;
        const $values = property.$values; 
        if (getType($values) === 'Object') {
            return Object.keys($values).map( (key: string) => {
                return { 
                    name: getType($values[key]) === 'Object'? this.getName($values[key], null, { type: 'object' }): $values[key], 
                    value: key,
                    disabled: !!property.readOnly
                };
            });
        }

        return isCheckBox? propertySchema.items.enum : propertySchema.enum;         
    }
        
    private evaluate(_: string, itemPath: string, propertySchema: IProperty, propertyValue: Item): Promise<IPrompt> {
        if (this.isPrimitive(propertySchema)) {
            return this.makePrompt(propertySchema, propertyValue);
        }

        return this.makeMenu(itemPath, propertySchema, propertyValue);
    }

}

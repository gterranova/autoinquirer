// tslint:disable:no-any
// tslint:disable:no-console

import { BaseDataSource } from './datasource';
import { Action, IAnswer, IPrompt, IProperty, IState } from './interfaces';

import { backPath, dummyPrompt, evalExpr, flattenDeep } from './utils';

// tslint:disable-next-line:one-variable-per-declaration
const separatorChoice = {type: 'separator'}, cancelChoice= {name: 'Cancel', value: { type: Action.EXIT } };

export class PromptBuilder {
    private dataSource: BaseDataSource;

    constructor(dataSource: BaseDataSource) {
        this.dataSource = dataSource;
    }

    public generatePrompts(initialState: IState, propertySchema: IProperty): IPrompt[] {
        if (initialState.type === Action.EXIT) { return []; }

        return flattenDeep([
            dummyPrompt((answers: IAnswer) => { Object.assign(answers, { state: initialState });}),
            // the line below won't let to jump between different trees
            this.evaluate(initialState, propertySchema)
            //this.evaluate()
        ]);
    }
    
    private checkAllowed(path: string, propertySchema: any) {
        if (!propertySchema || !propertySchema.depends) { return true; }
        const parentPath = backPath(path);
        if (parentPath.indexOf('/') === -1) { return true; }
        
        const parentPropertyValue = this.dataSource.get(parentPath);
        
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
    
    private makePrompt(_: IState, propertySchema: any): IPrompt {        
        return {
            name: `input.value`,
            message: `Enter ${propertySchema.type ? propertySchema.type.toLowerCase(): 'value'}:`,
            default: (answers: IAnswer) => {
                const { state } = answers;
                const currentValue = this.dataSource.get(state.path);

                return currentValue!==undefined ? currentValue : propertySchema.default;
            },
            type: propertySchema.type==='boolean'? 'confirm': 
                (propertySchema.type==='checkbox'? 'checkbox':
                    (propertySchema.type==='collection' || propertySchema.enum? 'list':
                        'input')),
            choices: propertySchema.enum
        };
    }

    // tslint:disable-next-line:cyclomatic-complexity
    private getChoices(initialState: IState, propertySchema: any) {
        const schemaPath = initialState.path;
        const value =  this.dataSource.get(schemaPath);

        const basePath = schemaPath.length ? `${schemaPath}/`: '';
        if (propertySchema) {
            switch (propertySchema.type) {

                case 'string':
                case 'number':
                case 'boolean':
                    return null; //value && { name: value, path: `${basePath}${value?Action.EDIT:Action.ADD}` };
                case 'object':
                    return propertySchema.properties && Object.keys(propertySchema.properties).map( (key: string) => {
                        const property: any = propertySchema.properties[key];
                        if (!property) {
                            throw new Error(`${schemaPath}/${key} not found`);
                        }
                        const disabled = !this.checkAllowed(`${schemaPath}/${key}`, property)

                        const item = { 
                            name: key, 
                            value: {  
                                path: `${basePath}${key}`
                            },
                            disabled
                        };
                        // tslint:disable-next-line:no-string-literal
                        if (['array','object'].indexOf(property.type) === -1) { item.value['type'] = Action.EDIT; }
                        
                        return item;
                    }) || [];
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
    }
    
    private evaluate_object(initialState: IState, propertySchema: any) {
        const choices = [...this.getChoices(initialState, propertySchema), separatorChoice,
            {
                name: `Remove`, 
                value: {...initialState, type: Action.REMOVE }
            },{
                name: `Back`, 
                value: { path: backPath(initialState.path) }
            }, cancelChoice];
    
        return this.makeMenu(initialState, choices);
    }

    private evaluate_array(initialState: IState, propertySchema: any) {
        // select item
        const arrayItemSchema: any = propertySchema.items;
        const arrayItemType = arrayItemSchema && arrayItemSchema.type;
        const choices = (answers: IAnswer) => {
            const { state } = answers;

            return [...this.getChoices(state, propertySchema), separatorChoice, {
                name: `Add ${arrayItemType || '?'}`, 
                value: {...state, type: Action.ADD}
            },{
                name: `Back`, 
                value: { path: backPath(state.path) }
            }, cancelChoice];
        };
    
        return this.makeMenu(initialState, choices);
    }
    
    private evaluate(initialState: IState, propertySchema: IProperty) {
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

// tslint:disable:no-any
// tslint:disable:no-console

import { DataSource } from './datasource';
import { BlockType, IAnswer, IPrompt, IState } from './interfaces';

import { backPath, dummyPrompt, evalExpr, flattenDeep } from './utils';

// tslint:disable-next-line:one-variable-per-declaration
const separatorChoice = {type: 'separator'}, cancelChoice= {name: 'Cancel', value: { type: 'none' } };

export class PromptBuilder {
    private dataSource: DataSource;

    constructor(dataSource: DataSource) {
        this.dataSource = dataSource;
    }

    public generatePrompts(initialState: IState): IPrompt[] {
        if (initialState.type === 'none') { return []; }

        return flattenDeep([
            dummyPrompt((answers: IAnswer) => { Object.assign(answers, { state: initialState });}),
            // the line below won't let to jump between different trees
            this.evaluate({ ...initialState })
            //this.evaluate()
        ]);
    }
    
    private checkAllowed(path: string, propertySchema: any) {
        if (!propertySchema.depends) { return true; }
        const parentPath = backPath(path);
        if (parentPath.indexOf('/') === -1) { return true; }
        
        const parentPropertyValue = this.dataSource.getValue(parentPath);
        
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
    
    private makePrompt(data: IState, propertySchema: any): IPrompt {
        const { type } = data;
        //console.log(action, path)
        
        return {
            name: `input.value`,
            message: `Enter ${propertySchema.type ? propertySchema.type.toLowerCase(): 'value'}:`,
            default: (answers: IAnswer) => {
                const { state } = answers;
                const defaultValue = propertySchema.type === 'array' ? [] : propertySchema.default;
                
                return type==='add'?defaultValue:this.dataSource.getValue(state.path);
            },
            type: propertySchema.type==='boolean'? 'confirm': 
                (propertySchema.type==='checkbox'? 'checkbox':
                    (propertySchema.type==='collection' || propertySchema.enum? 'list':
                        'input')),
            choices: propertySchema.enum
        };
    }

    // tslint:disable-next-line:cyclomatic-complexity
    private getChoices(initialState: IState) {
        const schemaPath = initialState.path;
        const value =  this.dataSource.getValue(schemaPath);
        const schema = this.dataSource.getDefinition(schemaPath);

        const basePath = schemaPath.length ? `${schemaPath}/`: '';
        if (schema) {
            switch (schema.$discriminator) {
                case BlockType.DEFINITIONS:
                    return schema && Object.keys(schema).map( (key: string) => {
                        return { 
                            name: key, 
                            value: {  
                                type: 'select',
                                path: `${basePath}${key}`
                            } 
                        };
                    }).filter((c: any) => c.name !== '$discriminator') || [];
                case BlockType.PROPERTIES:
                    switch (Object(schema).type) {
                        case 'string':
                        case 'number':
                        case 'boolean':
                        //case 'array':
                            return null; //value && { name: value, path: `${basePath}${value?'edit':'add'}` };
                        default:
                            return value && Object.keys(value).map( (key: string) => {
                                return { 
                                    name: key, 
                                    value: {  
                                        type: 'edit',
                                        path: `${basePath}${key}`
                                    } 
                                };
                            }).filter((c: any) => c.name !== '$discriminator') || [];        
                    }
                case BlockType.PROPERTY:
                    switch (schema.type) {
                        case 'object':
                            return schema.properties && Object.keys(schema.properties).map( (key: string) => {
                                const propertySchema: any = this.dataSource.getDefinition(`${schemaPath}/${key}`);
                                const disabled = !this.checkAllowed(`${schemaPath}/${key}`, propertySchema)

                                return { 
                                    name: key, 
                                    value: {  
                                        type: 'edit',
                                        path: `${basePath}${key}`
                                    },
                                    disabled
                                };
                            }).filter((c: any) => c.name !== '$discriminator') || [];
                        case 'array':
                            const arrayItemSchema: any = this.dataSource.getDefinition(`${schemaPath}/#`);
                            const arrayItemType = arrayItemSchema && arrayItemSchema.type;
                            const action = arrayItemType === 'object' || arrayItemType === 'array'? 'select': 'edit'; 
                
                            return value && value.map( (key: string, idx: number) => {
                                return { 
                                    name: JSON.stringify(key), 
                                    value: {  
                                        type: action,
                                        path: `${basePath}${idx}`
                                    } 
                                };
                            }).filter((c: any) => c.name !== '$discriminator') || [];
                    default:
                        return null; //[{ name: value}];
                    }
                default:
                    return null; //value && { name: value, path: `${basePath}` };
            }    
        }
    }
    
    private evaluate_object(initialState: IState, _: any) {
        const choices = [...this.getChoices(initialState), separatorChoice,
            {
                name: `Add`, 
                value: {...initialState, type: 'add'}
            },{
                name: `Remove`, 
                value: {...initialState, type: 'remove'}
            },{
                name: `Back`, 
                value: {...initialState, type: 'back' }
            }, cancelChoice];
    
        return this.makeMenu(initialState, choices);
    }

    private evaluate_array(initialState: IState, _: any) {
        // select item
        const arrayItemSchema: any = this.dataSource.getDefinition(`${initialState.path}/#`);
        const arrayItemType = arrayItemSchema && arrayItemSchema.type;
        const choices = (answers: IAnswer) => {
            const { state } = answers;

            return [...this.getChoices(state), separatorChoice, {
                name: `Add ${arrayItemType || '?'}`, 
                value: {...state, type: 'add'}
            },{
                name: `Back`, 
                value: {...state, type: 'back' }
            }, cancelChoice];
        };
    
        return this.makeMenu(initialState, choices);
    }
    
    private evaluate(initialState: IState) {
        const { path } = initialState;

        // tslint:disable-next-line:no-parameter-reassignment
        const propertySchema = this.dataSource.getDefinition(path);

        if (!path) {
            // Select collection
            const choices = [...this.getChoices(initialState), separatorChoice, 
                {name: 'Edit definitions', value: { path: 'definitions' }}, cancelChoice];

            return this.makeMenu({ path:'', type: 'select' }, choices);
        }

        switch (propertySchema.$discriminator) {
            case BlockType.PROPERTIES:
                //console.log("evaluate_properties", path, propertySchema);
                if (Object(propertySchema).type === 'object' || Object(propertySchema).type === 'array') {
                    if (initialState.type === 'add') {
                        return this.makePrompt({...initialState, type: 'edit'}, propertySchema);        
                    }

                    return this.evaluate_object(initialState, propertySchema);
                }

                return this.makePrompt({...initialState, type: 'edit'}, propertySchema);

            case BlockType.PROPERTY:
                if (propertySchema.type === 'object') {
                    return this.evaluate_object(initialState, propertySchema);
                } else if (propertySchema.type === 'array') {
                    return this.evaluate_array(initialState, propertySchema);
                } else {
                    throw new Error('not supposed to be here');
                }
            /*
            case 'collection':
                const collection = this.dataSource.rootDocument.definitions[propertySchema.reference];
                const choices = [...Object.keys(collection).map( (key: string) => { 
                    return { 
                        name: key, 
                        value: { $ref: `#/${propertySchema.reference}/${key}` }
                    }; 
                }), separatorChoice, {name: `Back`, value: {...initialState, type: 'back' }}, 
                    cancelChoice];

                return this.makePrompt(initialState, {...propertySchema, choices });
            */
            default:
                //console.log("evaluate_primitives", path, propertySchema);
    
                return this.makePrompt({...initialState, type: 'edit'}, propertySchema);
        }
    }

}

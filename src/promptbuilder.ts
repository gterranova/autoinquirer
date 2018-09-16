// tslint:disable:no-any
// tslint:disable:no-console

import { Collection, Definition } from './collection';
import { DataSource } from './datasource';
import { IAnswer, IPrompt, IProperty, IState } from './interfaces';
import { backPath, dummyPrompt, evalExpr, flattenDeep, ifObjectToArray } from './utils';

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
    
    private checkAllowed(path: string, propertySchema: IProperty) {
        if (!propertySchema.depends) { return true; }
        const parentPath = backPath(path);
        if (parentPath.indexOf('/') === -1) { return true; }    
        const parentPropertyValue = this.dataSource.parseRef(this.dataSource.getItemByPath(parentPath));
        //console.log(propertySchema.depends, path, parentPropertyValue, allowed);

        return !!evalExpr(propertySchema.depends, parentPropertyValue);        
    
    }

    private makeMenu(_: IState, choices: any, propertySchema: IProperty): IPrompt {
        return {
            name: 'state',
            type: 'list',
            message: `select ${propertySchema.$name||''}:`,
            choices,
            pageSize: 20
        };
    }
    
    private makePrompt(data: IState, propertySchema: IProperty): IPrompt {
        const { type } = data;
        //console.log(action, path)
        
        return {
            name: `input.value`,
            message: `Enter ${propertySchema.type ? propertySchema.type.toLowerCase(): 'value'}:`,
            default: (answers: IAnswer) => {
                const { state } = answers;
                const defaultValue = propertySchema.type === 'array' ? [] : propertySchema.default;
                
                return type==='add'?defaultValue:this.dataSource.getItemByPath(state.path);
            },
            type: propertySchema.type==='boolean'? 'confirm': 
                (propertySchema.type==='list'? 'list':
                    (propertySchema.type==='checkbox'? 'checkbox':
                        (propertySchema.type==='collection'? 'list':
                            'input'))),
            choices: propertySchema && propertySchema.choices
        };
    }
    
    private evaluate_object(initialState: IState, propertySchema: IProperty) {
        // tslint:disable-next-line:no-suspicious-comment
        // TODO: Fix
        const properties = propertySchema.properties ? ifObjectToArray(propertySchema.properties) : [];

        //console.log(properties);

        const choices = [...properties.map( (property: IProperty) => {
                // tslint:disable-next-line:no-parameter-reassignment
                property = this.dataSource.parseRef({...property});

                // evaluate dependency
                const itemPath = `${initialState.path}/${property.$name}`;

                if (!this.checkAllowed(itemPath, property)) { return null; }

                // parseRef required to parse $refs to related fields
                const item = this.dataSource.parseRef(this.dataSource.getItemByPath(itemPath));

                const label = item ? (
                    Array.isArray(item) ? `(${item.length})` : 
                    (typeof item === 'object' ? `(${Object.keys(item).length})` :
                        (item.name || item.$name || JSON.stringify(item)) )) : '';

                const action = property.type === 'array' ? 'select' 
                        : ((property.type === 'object') ? 'select' 
                            : 'edit');
                        
                return { 
                    name: `${action} ${property.$name} ${label} [${property.type}]`,
                    value: {...initialState,  
                        type: action,
                        path: itemPath}
                };
            }).filter( (a: any) => a !== null), separatorChoice,
            {
                name: `Remove`, 
                value: {...initialState, type: 'remove'}
            },{
                name: `Back`, 
                value: {...initialState, type: 'back' }
            }, cancelChoice];
    
        return this.makeMenu(initialState, choices, propertySchema);
    }

    private evaluate_array(initialState: IState, propertySchema: IProperty) {
        // select item
        const arrayItemSchema = propertySchema.items || {};
        
        const choices = (answers: IAnswer) => {
            const { state } = answers; 
    
            let itemValue = this.dataSource.getItemByPath(state.path) || [];
            // tslint:disable-next-line:no-suspicious-comment
            // TODO: check if needed
            //if (itemValue.value) { itemValue = itemValue.value(); }
            itemValue= ifObjectToArray({...itemValue});

            if (!Array.isArray(itemValue)) {
                throw new Error(`ERR: ${state.path} is not an array: ${itemValue}`);
            }
    
            // tslint:disable-next-line:cyclomatic-complexity
            const tmp = itemValue.map( (item: any, idx: number) => {
                const isRefToProcess = item.$ref && /^#\//.test(item.$ref) && !/^#\/definitions/.test(item.$ref);
                const newItem = isRefToProcess ? this.dataSource.parseRef({ $ref: item.$ref }) : item;
                const name = newItem.name || newItem.$name || JSON.stringify(newItem);
                const newPath = isRefToProcess ? `${state.path}/${item.$name || item._id || idx}${item.$ref.replace(/^#\//, '§')}` : state.path ? `${state.path}/${item.$name || item._id || idx}` : item.name;

                const label = item ? (
                    Array.isArray(item) ? `(${item.length})` : 
                    (typeof item === 'object' ? `(${Object.keys(item).length})` :
                        (item.name || item.$name || JSON.stringify(item)) )) : '';

                return {
                    name: `${name} ${label}`, 
                    value: {...state, 
                        path: newPath,
                        type: 'select'
                    }
                };
            });
    
            return [...tmp, separatorChoice, {
                name: `Add ${arrayItemSchema.type}`, 
                value: {...state, type: 'add'}
            },{
                name: `Back`, 
                value: {...state, type: 'back' }
            }, cancelChoice];
        };
    
        return this.makeMenu(initialState, choices, propertySchema);
    }
    
    private evaluate(initialState: IState, propertySchema?: IProperty) {
        const { path } = initialState;
        // tslint:disable-next-line:no-parameter-reassignment
        propertySchema = propertySchema || this.dataSource.getSchemaByPath(path);
        //console.log("evaluate", path, propertySchema.path);

        if (!path) {
            // Select collection
            const collections = this.dataSource.getCollections();
            const choices = [...collections.map( (c: Collection | Definition) => { 
                return { name: c.$name, value: { path: c.$name, type: 'select' }}; 
            }), separatorChoice, cancelChoice];

            return this.makeMenu({ path:'', type: 'select' }, choices, propertySchema);
        }

        switch (propertySchema.type) {
            case 'array':
                if (initialState.type === 'add') {
                    return this.evaluate({...initialState}, propertySchema.items);
                }                

                return this.evaluate_array(initialState, propertySchema);

            case 'object':
                return this.evaluate_object(initialState, propertySchema);
                
            case 'collection':
                const collection = this.dataSource[propertySchema.reference];
                const choices = [...collection.value().map( (c: Collection | Definition) => { 
                    return { 
                        name: c.$name||JSON.stringify(c), 
                        value: { $ref: `#/${propertySchema.reference}/${c.$name}` }
                    }; 
                }), separatorChoice, {name: `Back`, value: {...initialState, type: 'back' }}, 
                    cancelChoice];
                //console.log("COLLECTION", initialState, {...propertySchema, choices });

                return this.makePrompt(initialState, {...propertySchema, choices });

            default:
                return this.makePrompt({...initialState, type: 'edit'}, propertySchema);
        }
    }

}

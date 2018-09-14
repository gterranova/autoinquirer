// tslint:disable:no-any
// tslint:disable:no-console

import { DataSource } from './datasource';
import { backPath, dummyPrompt, evalExpr, flattenDeep } from './utils';

// tslint:disable-next-line:one-variable-per-declaration
const separatorChoice = {type: 'separator'}, cancelChoice= {name: 'Cancel', value: { type: 'none' } };

export class PromptBuilder {
    private dataSource: DataSource;

    constructor(dataSource: DataSource) {
        this.dataSource = dataSource;
    }

    public generatePrompts(initialState: any = { path: '' } ) {
        if (initialState.type === 'none') { return []; }

        return flattenDeep([
            dummyPrompt((answers: any) => { Object.assign(answers, { state: initialState });}),
            // the line below won't let to jump between different trees
            this.evaluate({ ...initialState })
            //this.evaluate()
        ]);
    }
    
    private checkAllowed(path: string, propertySchema: any) {
        if (!propertySchema.depends) { return true; }
        const parentPath = backPath(path);    
        const parentPropertyValue = this.dataSource.parseRef(this.dataSource.getItemByPath(parentPath));
        
        return !!evalExpr(propertySchema.depends, parentPropertyValue);        
    
    }

    private makeMenu(action: string, data: any, propertySchema: any) {
        const { choices } = data;
    
        return {
            name: 'state',
            type: 'list',
            message: `${action} ${propertySchema.name||''}:`,
            choices,
            pageSize: 20
        };
    }
    
    private makePrompt(data: any, propertySchema: any) {
        const { type } = data;
        //console.log(action, path)
        
        return {
            name: `input.value`,
            message: `Enter ${propertySchema.type.toLowerCase()}:`,
            default: (answers: any) => {
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
    
    private evaluate_object(initialState: any, propertySchema: any) {
        const { path } = initialState;
        let properties;
        if (!propertySchema.properties) {
            properties = [];
        } else if (Array.isArray(propertySchema.properties)) {
            properties = propertySchema.properties;
        } else {
            properties = Object.keys(propertySchema.properties).map( (k: string) => {
                return { ...propertySchema.properties[k], name: k };
            });
        }

        const choices = [...properties.map( (property: any) => {
                // tslint:disable-next-line:no-parameter-reassignment
                property = this.dataSource.parseRef({...property});

                // evaluate dependency
                const itemPath = `${initialState.path}/${property.name}`;

                if (!this.checkAllowed(itemPath, property)) { return null; }

                // parseRef required to parse $refs to related fields
                const item = this.dataSource.parseRef(this.dataSource.getItemByPath(itemPath));

                const label = item ? (
                    (property.type === 'array' && Array.isArray(item)) ? `(${item.length})` 
                        : ((property.type === 'object') ? '' 
                            : ` ${item.name || JSON.stringify(item)}`)
                    ) : '';

                const action = property.type === 'array' ? 'select' 
                        : ((property.type === 'object') ? 'select' 
                            : 'edit');
                        
                return { 
                    name: `${action} ${property.name}${label}`,
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
    
        return this.makeMenu('select', { path, choices }, propertySchema);
    }

    private evaluate_array(initialState: any, propertySchema: any) {
        const { path } = initialState;
        // select item
        const arrayItemSchema = propertySchema.items || {};
        
        const choices = (answers: any) => {
            const { state } = answers; 
    
            let itemValue = this.dataSource.getItemByPath(state.path) || [];
            if (itemValue.data) { itemValue = itemValue.data; }

            if (!Array.isArray(itemValue)) {
                throw new Error(`ERR: ${state.path} is not an array: ${itemValue}`);
            }
    
            const tmp = itemValue.map( (item: any, idx: number) => {
                const isRefToProcess = item.$ref && /^#\//.test(item.$ref) && !/^#\/definitions/.test(item.$ref);
                const newItem = isRefToProcess ? this.dataSource.parseRef({ $ref: item.$ref }) : item;
                const name = newItem.name || JSON.stringify(newItem);
                const newPath = isRefToProcess ? `${state.path}/${item._id || idx}${item.$ref.replace(/^#\//, '§')}` : state.path ? `${state.path}/${item._id || idx}` : item.name;

                return {
                    name: name, 
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
    
        return this.makeMenu('select', { path, choices }, propertySchema);
    }
    
    private evaluate(initialState: any = { path: '' }, propertySchema?: any) {
        const { path } = initialState;
        // tslint:disable-next-line:no-parameter-reassignment
        propertySchema = propertySchema || this.dataSource.getSchemaByPath(path);
        //console.log("evaluate", path, propertySchema.path);

        if (!path) {
            // Select collection
            const collections = this.dataSource.getCollections();
            const choices = [...collections.map( (c: any) => { 
                return { name: c.name, value: { path: c.name, type: 'select' }}; 
            }), separatorChoice, cancelChoice];

            return this.makeMenu('select', { path:'', choices }, propertySchema);
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
                const choices = [...collection.all().map( (c: any) => { 
                    return { 
                        name: c.name||JSON.stringify(c), 
                        value: { $ref: `#/${propertySchema.reference}/${c._id}` }
                    }; 
                }), separatorChoice, {name: `Back`, value: {...initialState, type: 'back' }}, 
                    cancelChoice];
                //console.log("COLLECTION", initialState, {...propertySchema, choices });

                return this.makePrompt(initialState, {...propertySchema, choices });

            default:
                return this.makePrompt(initialState, propertySchema);
        }
    }

}

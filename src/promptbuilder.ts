// tslint:disable:no-any
// tslint:disable:no-console

import { DataSource } from './datasource';
import { actualPath, backPath, dummyPrompt, evalExpr, flattenDeep, generalizedPath } from './utils';

// tslint:disable-next-line:one-variable-per-declaration
const separatorChoice = {type: 'separator'}, cancelChoice= {name: 'Cancel', value: { type: 'none' } };

export class PromptBuilder {
    private dataSource: DataSource;

    constructor(dataSource: DataSource) {
        this.dataSource = dataSource;
    }

    public generatePrompts(initialState: any = { path: '' } ) {
        return flattenDeep([
            dummyPrompt((answers: any) => { Object.assign(answers, { state: initialState });}),
            // the line below won't let to jump between different trees
            //this.evaluate({ ...initialState, path: backPath(initialState.path), type: 'select' })
            this.evaluate()
        ]);
    }
    
    private checkAllowed(path: string, propertySchema: any) {
        if (!propertySchema.depends) { return true; }
        const parentPath = backPath(path);    
        const parentPropertyValue = this.dataSource.parseRef(this.dataSource.getItemByPath(parentPath));
        
        return !!evalExpr(propertySchema.depends, parentPropertyValue);        
    
    }

    private checkPath(action: string, name: string) {
        return ((answers: any) => {
            const { state } = answers;
    
            //console.log('makePrompt when', action, name); 
            let allowed = true;
            if (!state || (!state.type && !!action)) { return true; }
            if (state.type === 'none' || state.type !== action) {
                //console.log(`1PATH ${state.type}.${state.path} ${action}.${name} false`);
                
                return false;
            }
            if (!state.path) { return true; }
    
            const itemPath = name && generalizedPath(actualPath(name).join('/')); 
            const statePath = state.path && generalizedPath(actualPath(state.path).join('/')); 
            allowed = allowed && action === 'add' ? itemPath.indexOf(statePath) === 0 : itemPath === statePath;
            //console.log(`PATH ${statePath} ${itemPath} ${action} ${allowed}`);
            if (!allowed) { return false; }
    
            if (/\/\d+$/.test(state.path)) { return allowed; }
            const propertySchema = this.dataSource.getSchemaByPath(itemPath);
            
            return this.checkAllowed(state.path, propertySchema);
        });
    }
    
    private makeMenu(action: string, data: any, propertySchema: any) {
        const { path, choices } = data;
    
        return {
            when: this.checkPath(action, path),
            name: 'state',
            type: 'list',
            message: `${action} ${propertySchema.name||''}:`,
            choices,
            pageSize: 20
        };
    }
    
    private makePrompt(action: string, data: any, propertySchema: any) {
        const { path } = data;
        //console.log(action, path)
        
        return {
            when: this.checkPath(action, path),
            description: `Visible on ${action}/${path}`,
            name: `input.${propertySchema.name}`,
            message: `Enter ${propertySchema.name}:`,
            default: (answers: any) => {
                const { state } = answers;
                const defaultValue = propertySchema.is_array ? [] : propertySchema.default;
                
                return action==='add'?defaultValue:this.dataSource.getItemByPath(state.path);
            },
            type: propertySchema.type==='boolean'? 'confirm': 
                (propertySchema.type==='list'? 'list':
                    (propertySchema.type==='checkbox'? 'checkbox':
                        (propertySchema.type==='collection'? 'list':
                            'input'))),
            choices: propertySchema && propertySchema.choices
        };
    }
    
    private evaluate_primitive(initialState: any, propertySchema: any) {
        return [
            this.makePrompt('add', initialState, propertySchema), 
            this.makePrompt('edit', initialState, propertySchema),
        ];
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
    
        const choices = (answers: any) => {
            const { state } = answers;
            
            return [...properties.map( (property: any) => {
                // tslint:disable-next-line:no-parameter-reassignment
                property = this.dataSource.parseRef({...property});

                // evaluate dependency
                const itemPath = `${state.path}/${property.name}`;

                if (!this.checkAllowed(itemPath, property)) { return null; }

                // parseRef required to parse $refs to related fields
                const item = this.dataSource.parseRef(this.dataSource.getItemByPath(itemPath));

                const label = item ? (
                    (property.is_array && Array.isArray(item)) ? `(${item.length})` 
                        : ((property.type === 'object') ? '' 
                            : ` ${item.name || JSON.stringify(item)}`)
                    ) : '';

                const action = property.is_array ? 'select' 
                        : ((property.type === 'object') ? 'select' 
                            : 'edit');
                        
                return { 
                    name: `${action} ${property.name}${label}`,
                    value: {...state,  
                        type: action,
                        path: itemPath}
                };
            }).filter( (a: any) => a !== null), separatorChoice,
            {
                name: `Remove ${propertySchema.name}`, 
                value: {...state, type: 'remove'}
            },{
                name: `Back`, 
                value: {...state, type: 'back' }
            }, cancelChoice];
        };
    
        return [
            this.makeMenu('select', { path, choices }, propertySchema),
            [...properties.map( (property: any) => this.evaluate({...initialState, 
                    path: `${path}/${property.name}`})
            )]
        ];
    }
    
    private evaluate_array(initialState: any, propertySchema: any) {
        const { path } = initialState;
        // select item
        //console.log('evaluate_array', propertySchema.name); 
        const choices = (answers: any) => {
            const { state } = answers; 
    
            let itemValue = this.dataSource.getItemByPath(state.path) || [];
            if (itemValue.data) { itemValue = itemValue.data; }
            //console.log(path, state.path, propertySchema, itemValue);
            if (!Array.isArray(itemValue)) {
                throw new Error(`ERR: ${state.path} is not an array: ${itemValue}`);
                
                return [];
            }
    
            const tmp = itemValue.map( (item: any, idx: number) => {
                const isRefToProcess = item.$ref && /^#\//.test(item.$ref) && !/^#\/definitions/.test(item.$ref);
                const newItem = isRefToProcess ? this.dataSource.parseRef({ $ref: item.$ref }) : item;
                const name = newItem.name || JSON.stringify(newItem);
                const newPath =  isRefToProcess ? `${state.path}/${item._id || idx}${item.$ref.replace(/^#\//, '§')}` : state.path ? `${state.path}/${item._id || idx}` : item.name;

                return {
                    name: `${name} ${newPath}`, 
                    value: {...state, 
                        path: newPath,
                        type: isRefToProcess ? 'reload' : 'select'
                    }
                };
            });
    
            return [...tmp, separatorChoice, {
                name: `Add ${propertySchema.name}`, 
                value: {...state, type: 'add'}
            },{
                name: `Back`, 
                value: {...state, type: 'back' }
            }, cancelChoice];
        };
    
        return [
            this.makeMenu('select', { path, choices }, propertySchema), 
            ...this.evaluate({...initialState, path: `${path}/#`, type: 'select' }, true),
        ];
    }
    
    private evaluate(initialState: any = { path: '' }, skipArray: boolean = false) {
        const { path } = initialState;
        const propertySchema = this.dataSource.getSchemaByPath(path);
        //console.log("evaluate", path, propertySchema);
        // schema is an object
        if (!path) {
            // Select collection
            const collections = this.dataSource.getCollections();
            const choices = () => [...collections.map( (c: any) => { 
                return { name: c.name, value: { path: c.name, type: 'select' }}; 
            }), separatorChoice, cancelChoice];

            return [this.makeMenu('select', { path:'', choices }, propertySchema),
                ...collections.map( (c: any) => this.evaluate({ path: c.name }) )]; 
        }

        if (!!propertySchema.is_array && !skipArray) {
            //console.log("evaluate", path, "is array");
            return this.evaluate_array(initialState, propertySchema);
        }

        switch (propertySchema.type) {
            case 'object':
                return this.evaluate_object(initialState, propertySchema);
            case 'collection':
                const collection = this.dataSource[propertySchema.reference];
                const choices = () => [...collection.all().map( (c: any) => { 
                    return { 
                        name: c.name||JSON.stringify(c), 
                        value: { $ref: `#/${propertySchema.reference}/${c._id}` }
                    }; 
                }), separatorChoice, cancelChoice];
    
                return [
                    this.makePrompt('add', initialState, {...propertySchema, choices }),     
                    this.makePrompt('edit', initialState, {...propertySchema, choices })
                ];

            default:
                return this.evaluate_primitive(initialState, propertySchema);
        }
    }

}

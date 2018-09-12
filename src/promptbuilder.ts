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

    public generatePrompts(initialState: any = {}) {
        const { state } = initialState;
        
        return flattenDeep([
            state ? dummyPrompt((answers: any) => { Object.assign(answers, { state });}) : [],
            this.evaluate(initialState)
        ]);
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
    
            const itemPath = name && actualPath(generalizedPath(name)).join('/'); 
            const statePath = state.path && actualPath(generalizedPath(state.path)).join('/'); 
            allowed = allowed && action === 'add' ? itemPath.indexOf(statePath) === 0 : itemPath === statePath;
            //console.log(`PATH ${state.path} (${state.type}.${statePath}) ${action}.${name} ${allowed}`);
            if (!allowed) { return false; }
    
            if (/\/\d+$/.test(state.path)) { return allowed; }
            const propertySchema = this.dataSource.getSchemaByPath(itemPath);
            if (!propertySchema.depends) { return true; }
            const parentPath = backPath(state.path);    
            const parentPropertyValue = this.dataSource.parseRef(this.dataSource.getItemByPath(parentPath));
            allowed = !!evalExpr(propertySchema.depends, parentPropertyValue);        
            //console.log("***", state.path, parentPath, propertySchema.depends, parentPropertyValue, allowed);
            
            return allowed;    
        });
    }
    
    private makeMenu(action: string, data: any) {
        const { path, choices } = data;
        const propertySchema = this.dataSource.getSchemaByPath(path);
    
        return {
            when: this.checkPath(action, path),
            name: 'state',
            type: 'list',
            message: `${action} ${propertySchema.name||''}:`,
            choices,
            pageSize: 20
        };
    }
    
    private makePrompt(action: string, data: any) {
        const { path } = data;
        //console.log(action, path)
        const propertySchema = this.dataSource.getSchemaByPath(path);
        
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
            type: propertySchema.type==='boolean'?'confirm': (propertySchema.type==='list'?'list':'input'),
            choices: propertySchema && propertySchema.choices
        };
    }
    
    private evaluate_primitive(initialState: any) {
        return [
            this.makePrompt('add', initialState), 
            this.makePrompt('edit', initialState),
        ];
    }
    
    private evaluate_object(initialState: any) {
        const { path } = initialState;
        const propertySchema = this.dataSource.getSchemaByPath(path);        
        const properties = propertySchema.properties||[];
    
        const choices = (answers: any) => {
            const { state } = answers;
            
            return [...properties.map( (property: any) => {
                // tslint:disable-next-line:no-parameter-reassignment
                property = this.dataSource.parseRef(property);

                // evaluate dependency
                const disabled = property.depends && !evalExpr(property.depends, this.dataSource.parseRef(this.dataSource.getItemByPath(state.path)));  
    
                const itemPath = `${state.path}/${property.name}`;
                const item = this.dataSource.getItemByPath(itemPath);
                const label = item ? (
                    property.is_array ? `(${item.length})` 
                        : ((property.type === 'object') ? '' 
                            : ` ${item.name || JSON.stringify(item)}`)
                    ) : '';

                const action = property.is_array ? 'select' 
                        : ((property.type === 'object') ? 'select' 
                            : 'edit');
                        
                return { 
                    name: `${action} ${property.name}${label}`,
                    disabled: disabled && `! ${property.depends}`, 
                    value: {...state,  
                        type: action,
                        path: itemPath}
                };
            }), separatorChoice,
            {
                name: `Remove ${propertySchema.name}`, 
                value: {...state, type: 'remove'}
            },{
                name: `Back`, 
                value: {...state, type: 'back' }
            }, cancelChoice];
        };
    
        return [
            this.makeMenu('select', { path, choices }),
            [...properties.map( (property: any) => this.evaluate({...initialState, 
                    path: `${path}/${property.name}`})
            )]
        ];
    }
    
    private evaluate_array(initialState: any) {
        const { path } = initialState;
        // select item
        const propertySchema = this.dataSource.getSchemaByPath(path);
        //console.log('evaluate_array', propertySchema.name); 
        const choices = (answers: any) => {
            const { state } = answers; 
    
            let itemValue = this.dataSource.getItemByPath(state.path) || [];
            if (itemValue.data) { itemValue = itemValue.data; }
            //console.log(path, state.path, propertySchema, itemValue);
            if (!Array.isArray(itemValue)) {
                // tslint:disable-next-line:no-console
                console.log("ERR:", state.path, itemValue);
                //makeItemArray(state.path, state);
                //itemValue = [itemValue];
            }
    
            const tmp = itemValue.map( (item: any, idx: number) => {
                const isRefToProcess = item.$ref && /^#\//.test(item.$ref) && !/^#\/definitions/.test(item.$ref);
                const newItem = isRefToProcess ? this.dataSource.parseRef({ $ref: item.$ref }) : item;
                const name = newItem.name || JSON.stringify(newItem);
                const newPath =  isRefToProcess ? 
                    `${state.path}${item.$ref.replace(/^#\//, '§')}` : 
                    state.path ? `${state.path}/${item._id || idx}` : item.name;

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
            this.makeMenu('select', { path, choices }), 
            ...this.evaluate({...initialState, path: `${path}/#`, type: 'select' }, true),
        ];
    }
    
    private evaluate(initialState: any, skipArray: boolean = false) {
        const { path } = initialState;
        //console.log("evaluate", path, propertySchema);
        // schema is an object
        if (!path) {
            // Select collection
            const collections = this.dataSource.getCollections();
            const choices = () => [...collections.map( (c: any) => { 
                return { name: c.name, value: { path: c.name, type: 'select' }}; 
            }), separatorChoice, cancelChoice];

            return [this.makeMenu('select', { path:'', choices }),
            ...collections.map( (c: any) => this.evaluate({ path: c.name }) )]; 
        }

        const propertySchema = this.dataSource.getSchemaByPath(path);
        const fullname = path || '';
        const state = {...initialState,  path: fullname};
        //console.log("EVAL:", state.path, propertySchema.name, skipArray);
        // array's schemas
        if (!!propertySchema.is_array && !skipArray) {
            //console.log("evaluate", path, "is array");
            return this.evaluate_array(state);
        } 
        let { type } = propertySchema;
        type = type || 'object';
        if (type === 'object') {
            //console.log("_evaluate", initialState.path, "is object");
            return this.evaluate_object(state);
        }
    
        return this.evaluate_primitive(state);
    
    }

}

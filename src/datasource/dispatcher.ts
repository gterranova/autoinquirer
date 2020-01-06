// tslint:disable:no-any
// tslint:disable-next-line:import-name
import { IProperty, IProxyInfo } from '../interfaces';
import { absolute, getType } from '../utils';
import { DataRenderer, DataSource } from './datasource';
import { JsonDataSource } from './json';
import { JsonSchema } from './jsonschema';

const path = require('path');

declare type IEntryPoints = { [key: string]: IProxyInfo};

interface IEntryPointInfo { 
    proxyInfo: IProxyInfo;
    parentPath: string;
    objPath: string;
};

interface IProxy {
    name: string; 
    dataSource: DataSource
}

export class Dispatcher extends DataSource {
    private entryPoints: IEntryPoints = {};
    private proxies: IProxy[] = [];
    private schemaSource: JsonSchema;
    private dataSource: DataSource;
    private renderer: DataRenderer;

    constructor(schema: string | JsonSchema, data: string | DataSource, renderer?: DataRenderer) {
        super();
        this.schemaSource = (typeof schema === 'string')? new JsonSchema(schema): schema;
        this.dataSource = (typeof data === 'string')? new JsonDataSource(data): data;
        this.renderer = renderer;
    }

    public async connect() {
        await this.schemaSource.connect();
        await this.dataSource.connect();
        
        const schema = await this.schemaSource.get();
        const rootValue = await this.dataSource.dispatch('get', '');
        const coercedValue = this.schemaSource.coerce({ type: schema.type }, rootValue);
        if (getType(rootValue) !== getType(coercedValue)) {
            // tslint:disable-next-line:no-console
            //console.log({ type: schema.type }, rootValue, coercedValue);
            this.dataSource.dispatch('set', '', schema, coercedValue);    
        }
        this.entryPoints = this.findEntryPoints('', schema);
        // tslint:disable-next-line:no-console
        //console.log("ENTRY POINTS:", this.entryPoints)
        await Promise.all(this.proxies.map( (proxy: IProxy) => proxy.dataSource.connect() ));
    } 

    public async close() {
        await this.schemaSource.close();
        await this.dataSource.close();
        await Promise.all(this.proxies.map( (proxy: IProxy) => proxy.dataSource.close() ));
    } 

    // tslint:disable-next-line:no-reserved-keywords
    public async getSchema(itemPath?: string, schemaSource?: JsonSchema): Promise<IProperty> {
        //console.log(`DISPATCH getSchema(itemPath?: ${itemPath})`);
        // tslint:disable-next-line:no-unnecessary-local-variable
        for (const proxy of this.getProxyForPath(itemPath).reverse()) {
            // tslint:disable-next-line:no-console
            //console.log("REFS", collectionRefs);
            const { parentPath, proxyInfo } = proxy;
            const dataSource = this.getProxy(proxyInfo);
            if (dataSource) {
                // tslint:disable-next-line:no-return-await
                //console.log(`DISPATCH DELEGATE getSchema(itemPath?: ${itemPath})`);
                return await dataSource.getSchema(itemPath, schemaSource || this.schemaSource, parentPath, proxyInfo.params);
            }
        };
        const schema = await (schemaSource || this.schemaSource).get(itemPath);
        
        return schema;
    }
    
    // tslint:disable-next-line:no-reserved-keywords
    public async get(itemPath?: string, propertySchema?: IProperty) {
        // tslint:disable-next-line:no-return-await
        return await this.dispatch('get', itemPath, propertySchema);
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async set(itemPath?: string, propertySchema?: IProperty, value?: any) {
        // tslint:disable-next-line:no-return-await
        return await this.dispatch('set', itemPath, propertySchema, value);
    }

    public async update(itemPath?: string, propertySchema?: IProperty, value?: any) {
        // tslint:disable-next-line:no-return-await
        return await this.dispatch('update', itemPath, propertySchema, value);
    }

    public async push(itemPath?: string, propertySchema?: IProperty, value?: any) {
        // tslint:disable-next-line:no-return-await
        return await this.dispatch('push', itemPath, propertySchema, value);
    }

    public async del(itemPath?: string, propertySchema?: IProperty) {
        // tslint:disable-next-line:no-return-await
        return await this.dispatch('del', itemPath, propertySchema);
    }
    
    public registerProxy(name: string, dataSource: DataSource) {
        this.proxies.push({ name, dataSource });
    }

    // tslint:disable-next-line:cyclomatic-complexity
    public async dispatch(methodName: string, itemPath?: string, propertySchema?: IProperty, value?: any): Promise<any> {
        // tslint:disable-next-line:no-console
        //console.log(`DISPATCH dispatch(methodName: ${methodName}, itemPath?: ${itemPath}, propertySchema?: ${propertySchema}, value?: ${value})`)
        // tslint:disable-next-line:no-parameter-reassignment
        itemPath = itemPath !== undefined? itemPath: '';
        const schema = propertySchema || await this.getSchema(itemPath);
        // tslint:disable-next-line:no-bitwise
        if (schema === undefined || (schema.readOnly === true && (~['set','push','del'].indexOf(methodName)))) {
            return;
        } 
        // tslint:disable-next-line:no-bitwise
        else if (~['set','push'].indexOf(methodName)) {
            // tslint:disable-next-line:no-parameter-reassignment
            value = this.schemaSource.validate(methodName === 'push'? schema.items : schema, value);
        } else if (methodName === 'del') {
            const promises: Promise<any>[] = [];
            for (const proxyInfo of this.getProxyWithinPath(itemPath)) {
                const dataSource = this.getProxy(proxyInfo)
                // tslint:disable-next-line:no-console
                //console.log("Must delete from", proxyInfo, "with parentPath starting with", RegExp(`^${itemPath}`));
                // tslint:disable-next-line:no-string-literal
                if (dataSource && dataSource['delCascade'] !== undefined) {
                    promises.push(dataSource.dispatch('delCascade', itemPath, proxyInfo.params));
                }
            }
            // tslint:disable-next-line:no-string-literal
            if (this.dataSource['delCascade'] !== undefined) {
                promises.push(this.dataSource.dispatch('delCascade', itemPath));
            }

            await Promise.all(promises);            
        } else if (methodName === 'get') {
            const property = (schema.type === 'array')? schema.items: schema;
            if (property && property.$data && typeof property.$data === 'string') {
                const absolutePath = absolute(property.$data, itemPath);
                const values: any[] = await this.dispatch('get', absolutePath) || [];

                property.$values = values.reduce( (acc: any, curr: any, idx: number) => {
                    if (property.type === 'integer' || property.type === 'number') {
                        acc[idx] = curr;
                    } else {
                        acc[`${absolutePath}/${curr._id||idx}`] = curr;
                    }
                    
                    return acc;
                }, {});    
            } else {
                if (schema.writeOnly === true) { return; }
            }
        }
        
        for (const proxy of this.getProxyForPath(itemPath).reverse()) {
            // tslint:disable-next-line:no-console
            //console.log("REFS", collectionRefs);
            const { objPath, parentPath, proxyInfo } = proxy;
            const dataSource = this.getProxy(proxyInfo);
            if (dataSource && dataSource[methodName]) {
                // tslint:disable-next-line:no-return-await
                return await dataSource.dispatch(methodName, objPath, schema, value, parentPath, proxyInfo.params);
            }
        };

        // tslint:disable-next-line:no-return-await
        return await this.dataSource.dispatch(methodName, itemPath, schema, value);
    }

    public async render(methodName: string = 'get', itemPath: string = '', schema?: IProperty, value?: any) {
        const propertySchema = schema || await this.getSchema(itemPath);
        const propertyValue = value || await this.dispatch('get', itemPath, propertySchema);
        if (this.renderer) {
            // tslint:disable-next-line:no-return-await
            return await this.renderer.render(methodName, itemPath, propertySchema, propertyValue);
        }
        
        return propertyValue;
    }
    
    private findEntryPoints(p: string = '', schema: IProperty): IEntryPoints {
        //console.log(`DISPATCH findEntryPoints(p: string = ${p}, schema: ${schema})`)
        let paths: IEntryPoints = {};
        if (!schema) { return {}; }

        if (schema.type=== 'object') {
            if (schema.$proxy) {
                paths[''] = schema.$proxy;
            }
            if (schema.properties) {
                Object.keys(schema.properties).map((key: string) => {
                    paths = {...paths, ...this.findEntryPoints(key, schema.properties[key])};
                });        
            } else {
                // tslint:disable-next-line:no-console
                console.warn("Malformed schema: object missing properties:", schema);
            }
        } else if (schema.type === 'array') {
            if (schema.$proxy) {
                paths[p] = schema.$proxy;
            }
            
            return {...paths, ...this.findEntryPoints('(\\d+|[a-f0-9-]{24})', schema.items)}
        } 

        return Object.keys(paths).reduce( (acc: IEntryPoints, key: string) => {
            const fixedObjKey = key.replace(/\/$/, '');
            acc[`${path.join(p, fixedObjKey)}`] = paths[key];
            // tslint:disable-next-line:no-console
            //console.log(p,key,`${p}${p?'\\/':''}${key}`)
            
            return acc; 
        }, {});
    }

    private getProxyForPath(itemPath?: string): IEntryPointInfo[] {
        //console.log(`DISPATCH getProxyForPath(itemPath?: ${itemPath})`)
        const schemaPath = itemPath !== undefined && itemPath !== null? itemPath: '';
        
        return Object.keys(this.entryPoints).filter( (k: string) => {
            return k.length? RegExp(k).test(schemaPath): true;
        }).map( (foundKey: string) => {
            const objPath = schemaPath.replace(RegExp(foundKey), ''); 
            const parentPath = schemaPath.slice(0, schemaPath.length-objPath.length+1);
            
            return { proxyInfo: this.entryPoints[foundKey], parentPath, objPath: objPath.replace(/^\//, '')};
        });        
    }

    private getProxyWithinPath(itemPath?: string): IProxyInfo[] {
        const schemaPath = itemPath !== undefined? itemPath: '';
        // tslint:disable-next-line:prefer-template
        const comparisonPath = schemaPath.replace(/(\d+|[a-f0-9-]{24})\//g, '(\\d+|[a-f0-9-]{24})/')
            .replace(/(\d+|[a-f0-9-]{24})$/g, '(\\d+|[a-f0-9-]{24})') //.replace('/', '\\/')

        //console.log(`DISPATCH getProxyWithinPath(itemPath?: ${itemPath})`, schemaPath, comparisonPath)        
        return Object.keys(this.entryPoints).filter( (k: string) => {
            return k.indexOf(comparisonPath) !== -1;
        }).map( (foundKey: string) => {
            return this.entryPoints[foundKey];
        });        
    }

    private getProxy(proxyInfo: IProxyInfo): DataSource {
        //console.log(`DISPATCH getProxy(proxyInfo: ${proxyInfo})`)
        
        const proxy = this.proxies.find( (p: IProxy) => p.name === proxyInfo.proxyName);
        
        return proxy && proxy.dataSource;
    }
    
}

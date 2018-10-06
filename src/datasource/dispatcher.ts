// tslint:disable:no-any
// tslint:disable-next-line:import-name
import { IProperty, IProxyInfo } from '../interfaces';
import { absolute } from '../utils';
import { DataRenderer, DataSource } from './index';
import { JsonSchema } from './jsonschema';
import { MemoryDataSource } from './memory';

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
        this.dataSource = (typeof data === 'string')? new MemoryDataSource(data): data;
        this.renderer = renderer;
    }

    public async connect() {
        await this.schemaSource.connect();
        await this.dataSource.connect();
        
        const schema = await this.schemaSource.get();
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
    public async getSchema(itemPath?: string): Promise<IProperty> {
        // tslint:disable-next-line:no-unnecessary-local-variable
        const schema = await this.schemaSource.get(itemPath);
        
        return schema;
    }
    
    // tslint:disable-next-line:no-reserved-keywords
    public async get() {
        throw new Error("Method not implemented.");
    }
    
    public registerProxy(name: string, dataSource: DataSource) {
        this.proxies.push({ name, dataSource });
    }

    // tslint:disable-next-line:cyclomatic-complexity
    public async dispatch(methodName: string, itemPath: string = '', propertySchema?: IProperty, value?: any): Promise<any> {
        // tslint:disable-next-line:no-console
        //console.log(`DISPATCH ${methodName}:`, itemPath, value)

        const schema = propertySchema || await this.getSchema(itemPath);
        // tslint:disable-next-line:no-bitwise
        if (schema.readOnly === true && (~['set','push','del'].indexOf(methodName))) {
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
                if (dataSource['delCascade'] !== undefined) {
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
                const values: any[] = await this.dispatch('get', absolutePath);

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
        
        const collectionRefs = this.getProxyForPath(itemPath);
        if (collectionRefs.length>0) {
            // tslint:disable-next-line:no-console
            //console.log("REFS", collectionRefs);
            const lastCollection = collectionRefs.pop();
            const { objPath, parentPath, proxyInfo } = lastCollection;
            const dataSource = this.getProxy(proxyInfo);
            if (dataSource && dataSource[methodName]) {
                // tslint:disable-next-line:no-return-await
                return await dataSource.dispatch(methodName, objPath, schema, value, parentPath, proxyInfo.params);
            }
        };

        // tslint:disable-next-line:no-console
        if (methodName === 'push') { console.log("this.dataSource.dispatch", methodName, itemPath, schema, value); }

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
        let paths: IEntryPoints = {};
        if (!schema) { return {}; }

        if (schema.type=== 'object') {
            if (schema.$proxy) {
                paths[p] = schema.$proxy;
            }
            Object.keys(schema.properties).map((key: string) => {
                paths = {...paths, ...this.findEntryPoints(key, schema.properties[key])};
            });
        } else if (schema.type === 'array') {
            if (schema.$proxy) {
                paths[p] = schema.$proxy;
            }
            
            return {...paths, ...this.findEntryPoints('(\\d+|[a-f0-9-]{24})', schema.items)}
        } 
    
        return Object.keys(paths).reduce( (acc: IEntryPoints, key: string) => {
            acc[`${p}${p?'\\/':''}${key}`] = paths[key];
            
            return acc; 
        }, {});
    }
    
    private getProxyForPath(schemaPath: string): IEntryPointInfo[] {
        return Object.keys(this.entryPoints).filter( (k: string) => {
            return RegExp(k).test(schemaPath);
        }).map( (foundKey: string) => {
            const objPath = schemaPath.replace(RegExp(foundKey), ''); 
            const parentPath = schemaPath.slice(0, schemaPath.length-objPath.length);
            
            return { proxyInfo: this.entryPoints[foundKey], parentPath, objPath: objPath.replace(/^\//, '')};
        });        
    }

    private getProxyWithinPath(schemaPath: string): IProxyInfo[] {
        // tslint:disable-next-line:prefer-template
        const comparisonPath = schemaPath.replace(/(\d+|[a-f0-9-]{24})\//g, '(\\d+|[a-f0-9-]{24})/')
            .replace(/(\d+|[a-f0-9-]{24})$/g, '(\\d+|[a-f0-9-]{24})').replace('/', '\\/')
        
        return Object.keys(this.entryPoints).filter( (k: string) => {
            return k.indexOf(comparisonPath) !== -1;
        }).map( (foundKey: string) => {
            return this.entryPoints[foundKey];
        });        
    }

    private getProxy(proxyInfo: IProxyInfo): DataSource {
        const proxy = this.proxies.find( (p: IProxy) => p.name === proxyInfo.proxyName);
        
        return proxy && proxy.dataSource;
    }
    
}

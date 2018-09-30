// tslint:disable:no-any
// tslint:disable-next-line:import-name
import { ObjectID } from 'mongodb';
import { IProperty, IProxyInfo } from '../interfaces';
import { getType } from '../utils';
import { DataSource } from './index';
import { JsonSchema } from './jsonschema';

declare type IEntryPoints = { [key: string]: IProxyInfo};

interface IEntryPointInfo { 
    proxyInfo: IProxyInfo;
    parentPath: string;
    objPath: string;
};

export class Dispatcher extends DataSource {
    private entryPoints: IEntryPoints = {};
    private proxies: { name: string; dataSource: DataSource}[] = [];
    private schemaSource: JsonSchema;
    private dataSource: DataSource;

    constructor(schema: JsonSchema, data: DataSource) {
        super();
        this.schemaSource = schema;
        this.dataSource = data;
    }

    public async connect() {
        await this.schemaSource.connect();
        await this.dataSource.connect();

        // tslint:disable-next-line:no-backbone-get-set-outside-model
        const schema = await this.schemaSource.get();
        this.entryPoints = this.findEntryPoints('', schema);
        // tslint:disable-next-line:no-console
        //console.log("ENTRY POINTS:", this.entryPoints)
        await Promise.all(this.proxies.map( (proxy: any) => proxy.dataSource.connect() ));
    } 

    public async close() {
        await this.schemaSource.close();
        await this.dataSource.close();
        await Promise.all(this.proxies.map( (proxy: any) => proxy.dataSource.close() ));
    } 

    // tslint:disable-next-line:no-reserved-keywords
    public async getSchema(itemPath?: string) {
        // tslint:disable-next-line:no-unnecessary-local-variable
        const schema = await this.schemaSource.get(itemPath);
        
        return schema;
    }
    
    // tslint:disable-next-line:no-reserved-keywords
    public async get(itemPath?: string) {
        const schema = await this.schemaSource.get(itemPath);
        let value;
        try { 
            value = await this.processProxy('get', itemPath, schema); 
        } catch (e) { 
            if (e.message !== "Not a proxy") {
                throw e;
            }
            const schemaPath = !itemPath? '' : await this.convertObjIDToIndex(itemPath);
            value = await this.dataSource.get(schemaPath, schema);
        } 
        
        return value;
    }
    
    // tslint:disable-next-line:no-reserved-keywords
    public async set(itemPath?: string, value?: any) {
        if (value !== undefined) {
            const schemaPath = await this.convertObjIDToIndex(itemPath);
            // tslint:disable-next-line:no-console
            const schema = await this.schemaSource.get(schemaPath);
            // tslint:disable-next-line:no-parameter-reassignment
            value = this.schemaSource.validate(schema, value);
            try { 
                await this.processProxy('set', itemPath, value, schema); 
            } catch (e) { 
                // not a proxy 
                if (e.message !== "Not a proxy") {
                    throw e;
                }
                await this.dataSource.set(schemaPath, value, schema);
            } 
        }
    }
    
    public async push(itemPath?: string, value?: any) {
        const schemaPath = await this.convertObjIDToIndex(itemPath);
        const schema = await this.schemaSource.get(schemaPath);
        // tslint:disable-next-line:no-parameter-reassignment
        value = this.schemaSource.validate(schema.items, value);
        if (getType(value) === 'Object' && !schema.$proxy) {
            value._id = new ObjectID().toHexString();
        }

        try { 
            await this.processProxy('push', itemPath, value, schema); 
        } catch (e) { 
            if (e.message !== "Not a proxy") {
                throw e;
            }
            // tslint:disable-next-line:no-console
            //console.log("PUSH", e.message, itemPath, value, schema);
            await this.dataSource.push(schemaPath, value, schema);
        }
    }
    
    public async del(itemPath?: string) {
        const schemaPath = await this.convertObjIDToIndex(itemPath);
        const schema = await this.schemaSource.get(schemaPath);
        try { 
            await this.processProxy('del', itemPath, schema); 
        } catch (e) { 
            // not a proxy 
            if (e.message !== "Not a proxy") {
                throw e;
            }
            await Promise.all([...this.getProxyWithinPath(itemPath).map( (proxyInfo: IProxyInfo) => {
                const dataSource = this.getProxy(proxyInfo)
                // tslint:disable-next-line:no-console
                //console.log("Must delete from", dataSource, proxyInfo, "with parentPath starting with", RegExp(`^${itemPath}`));

                return dataSource.delCascade(itemPath, proxyInfo.params);
            }), this.dataSource.del(schemaPath, schema)]);
        } 
    }
    
    public delCascade() {
        throw new Error("Method not implemented.");
    }

    public registerProxy(name: string, dataSource: DataSource) {
        this.proxies.push({ name, dataSource });
    }

    public async processProxy(methodName: string, itemPath: string, ...args: any[]) {
        const collectionRefs = this.getProxyForPath(itemPath);
        if (collectionRefs.length) {
            // tslint:disable-next-line:no-console
            //console.log("REFS", collectionRefs);
            const lastCollection = collectionRefs.pop();
            const { objPath, parentPath, proxyInfo } = lastCollection;
            const dataSource = this.getProxy(proxyInfo);
            if (dataSource && dataSource[methodName]) {
                return dataSource[methodName].call(dataSource, objPath, ...args, parentPath, proxyInfo.params);
            }
        };
        throw new Error("Not a proxy");
    }
    
    public findEntryPoints(p: string = '', schema: IProperty): IEntryPoints {
        let paths = {};
        if (schema.type=== 'object') {
            Object.keys(schema.properties).map((key: string) => {
                paths = {...paths, ...this.findEntryPoints(key, schema.properties[key])};
            });
        } else if (schema.type === 'array') {
            if (schema.$proxy) {
                paths[p] = schema.$proxy;
            }
            
            return {...paths, ...this.findEntryPoints('(\\d+|[a-f0-9-]{24})', schema.items)}
        } 
    
        return Object.keys(paths).reduce( (acc: any, key: string) => {
            acc[`${p}${p?'\\/':'^'}${key}`] = paths[key];
            
            return acc; 
        }, {});
    }
    
    public getProxyForPath(schemaPath: string): IEntryPointInfo[] {
        return Object.keys(this.entryPoints).filter( (k: string) => {
            return RegExp(k).test(schemaPath);
        }).map( (foundKey: string) => {
            const objPath = schemaPath.replace(RegExp(foundKey), ''); 
            const parentPath = schemaPath.slice(0, schemaPath.length-objPath.length);
            
            return { proxyInfo: this.entryPoints[foundKey], parentPath, objPath: objPath.replace(/^\//, '')};
        });        
    }

    public getProxyWithinPath(schemaPath: string): IProxyInfo[] {
        // tslint:disable-next-line:prefer-template
        const comparisonPath = '^'+schemaPath.replace(/(\d+|[a-f0-9-]{24})\//g, '(\\d+|[a-f0-9-]{24})/')
            .replace(/(\d+|[a-f0-9-]{24})$/g, '(\\d+|[a-f0-9-]{24})').replace('/', '\\/')
        
        return Object.keys(this.entryPoints).filter( (k: string) => {
            return k.indexOf(comparisonPath) !== -1;
        }).map( (foundKey: string) => {
            return this.entryPoints[foundKey];
        });        
    }

    public getProxy(proxyInfo: IProxyInfo): DataSource {
        const proxy = this.proxies.find( (p: any) => p.name === proxyInfo.proxyName);
        
        return proxy && proxy.dataSource;
    }
    
}

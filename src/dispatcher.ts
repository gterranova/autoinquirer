// tslint:disable:no-any
// tslint:disable-next-line:import-name
import { IProperty, IProxyInfo, IDispatchOptions } from './interfaces';
import { absolute } from './utils';
import { AbstractDispatcher, AbstractDataSource } from './datasource';
import { JsonDataSource } from './json';
import { JsonSchema } from './jsonschema';

//const path = require('path');

declare type IEntryPoints = { [key: string]: IProxyInfo };

interface IEntryPointInfo {
    proxyInfo: IProxyInfo;
    parentPath: string;
    objPath: string;
};

export type Newable<T> = { new (...args: any[]): T; };

interface IProxy {
    name: string;
    classRef?: Newable<AbstractDispatcher>,
    dataSource?: AbstractDispatcher
}

export type IDataSourceInfo<T extends AbstractDataSource> = {
    dataSource: T,
    entryPointInfo?: IEntryPointInfo
};

export class Dispatcher extends AbstractDispatcher {
    private entryPoints: IEntryPoints = {};
    private proxies: IProxy[] = [];
    private schemaSource: JsonSchema;
    private dataSource: AbstractDataSource;

    constructor(schema: string | JsonSchema, data: string | AbstractDispatcher) {
        super();
        this.schemaSource = (typeof schema === 'string') ? new JsonSchema(schema) : schema;
        this.dataSource = (typeof data === 'string') ? new JsonDataSource(data) : data;
    }

    public async connect() {
        await this.schemaSource.connect();
        await this.dataSource.connect();

        const schema = await this.schemaSource.get();
        const rootValue = await this.dataSource.dispatch('get', { itemPath: '' });
        const coercedValue = this.schemaSource.coerce({ type: schema.type }, rootValue);
        if (typeof rootValue !== typeof coercedValue) {
            // tslint:disable-next-line:no-console
            //console.log({ type: schema.type }, rootValue, coercedValue);
            this.dataSource.dispatch('set', { itemPath: '', schema, value: coercedValue});
        }
        this.entryPoints = this.findEntryPoints('', schema);
        // tslint:disable-next-line:no-console
        //console.log("ENTRY POINTS:", this.entryPoints)
        await Promise.all(this.proxies.map((proxy: IProxy) => {proxy?.dataSource?.connect()}));
    }

    public async close() {
        await this.schemaSource.close();
        await this.dataSource.close();
        await Promise.all(this.proxies.map((proxy: IProxy) => proxy?.dataSource?.close()));
    }

    public getSchemaDataSource(parentDispatcher?: AbstractDispatcher): AbstractDataSource {
        return this.schemaSource || parentDispatcher?.getSchemaDataSource();
    }

    public getDataSource(parentDispatcher?: AbstractDispatcher): AbstractDataSource {
        return this.dataSource || parentDispatcher?.getDataSource();
    }

    public async getDataSourceInfo(options?: IDispatchOptions): Promise<IDataSourceInfo<AbstractDataSource>> {
        //console.log(`DISPATCH getSchema(itemPath?: ${options?.itemPath})`);
        // tslint:disable-next-line:no-unnecessary-local-variable
        for (const entryPointInfo of this.getProxyForPath(options?.itemPath).reverse()) {
            // tslint:disable-next-line:no-console
            //console.log("REFS", collectionRefs);
            const { proxyInfo } = entryPointInfo;
            const dataSource = await this.getProxy(proxyInfo);
            if (dataSource) {
                // tslint:disable-next-line:no-return-await
                //console.log(`DISPATCH DELEGATE getSchema(itemPath?: ${objPath})`, await dataSource.getSchema({itemPath: objPath, parentPath, params: proxyInfo.params}, this.schemaSource));
                return <IDataSourceInfo<AbstractDataSource>>{ dataSource, entryPointInfo };
            }
        };
        return { dataSource: <AbstractDataSource>this };
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async getSchema(options?: IDispatchOptions, parentDispatcher?: AbstractDispatcher): Promise<IProperty> {
        //console.log(`DISPATCH getSchema(itemPath?: ${options?.itemPath})`);
        // tslint:disable-next-line:no-unnecessary-local-variable
        const { dataSource, entryPointInfo } = await this.getDataSourceInfo(options);
        if (dataSource instanceof AbstractDispatcher) {
            //console.log("CALL DELEGATED JSONSCHEMA GET", options)
            return await dataSource.getSchemaDataSource(this).get(entryPointInfo? {
                itemPath: entryPointInfo?.objPath, 
                parentPath: entryPointInfo?.parentPath, 
                params: entryPointInfo?.proxyInfo?.params
            } : options);
        }
        //console.log("CALL DEFAULT JSONSCHEMA GET", options)
        return await this.getSchemaDataSource(parentDispatcher).get(options);
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async get(options?: IDispatchOptions) {
        // tslint:disable-next-line:no-return-await
        return await this.dispatch('get', options);
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async set(options?: IDispatchOptions) {
        // tslint:disable-next-line:no-return-await
        return await this.dispatch('set', options);
    }

    public async update(options?: IDispatchOptions) {
        // tslint:disable-next-line:no-return-await
        return await this.dispatch('update', options);
    }

    public async push(options?: IDispatchOptions) {
        // tslint:disable-next-line:no-return-await
        return await this.dispatch('push', options);
    }

    public async del(options?: IDispatchOptions) {
        // tslint:disable-next-line:no-return-await
        return await this.dispatch('del', options);
    }

    public registerProxy(proxy: IProxy) {
        //if (!proxy.dataSource && proxy.classRef && args) {
        //    proxy.dataSource = new proxy.classRef(...args);
        //}
        this.proxies.push(proxy);
    }

    // tslint:disable-next-line:cyclomatic-complexity
    public async dispatch(methodName: string, options?: IDispatchOptions): Promise<any> {
        // tslint:disable-next-line:no-parameter-reassignment
        options = options || {};

        options.itemPath = options?.itemPath ? await this.convertPathToUri(options?.itemPath) : '';
        options.schema = options?.schema || await this.getSchema(options);
        options.value = options?.value;

        if (!this.isMethodAllowed(methodName, options.schema)) {
            //throw new Error(`Method "${methodName}" not allowed for path "${itemPath}"`);
            return undefined;
        }

        if (this.requestHasWildcards(options)) {
            return await this.processWildcards(methodName, options);
        }

        //console.log("DISPATCH", methodName, `${options.itemPath}`)        
        // tslint:disable-next-line:no-bitwise
        else if (~['set', 'push'].indexOf(methodName)) {
            // tslint:disable-next-line:no-parameter-reassignment
            options.value = this.schemaSource.validate(methodName === 'push' ? options.schema.items : options.schema, options.value);
        } else if (methodName === 'del') {
            const promises: Promise<any>[] = [];
            for (const proxyInfo of this.getProxyWithinPath(options.itemPath)) {
                const dataSource = await this.getProxy(proxyInfo)
                // tslint:disable-next-line:no-console
                //console.log("Must delete from", proxyInfo, "with parentPath starting with", RegExp(`^${itemPath}`));
                // tslint:disable-next-line:no-string-literal
                if (dataSource && dataSource['delCascade'] !== undefined) {
                    promises.push(dataSource.dispatch('delCascade', { itemPath: options.itemPath, params: proxyInfo.params }));
                }
            }
            // tslint:disable-next-line:no-string-literal
            if (this.dataSource['delCascade'] !== undefined) {
                promises.push(this.dataSource.dispatch('delCascade', { itemPath: options.itemPath }));
            }

            await Promise.all(promises);
        } 

        if ((~['set', 'push', 'del'].indexOf(methodName))) {
            //console.log(methodName, itemPath, schema, value)
            await this.eachRemoteField(options, (remote, $data) => {
                const refSchema = remote.schema;
                const refObject = remote.value;
                const refPath = remote.itemPath;
                //console.log("called from dispatch", refPath, refSchema, refObject);

                if (refSchema?.type === 'array') {
                    //console.log("removing from", refObject[$data.remoteField], itemPath)
                    refObject[$data.remoteField] = (refObject[$data.remoteField] || []).filter( ref => !options.itemPath.startsWith(ref) );
                    return this.set({ itemPath: refPath, value: refObject});    
                } else {
                    //refPath = [refPath, $data.remoteField].join('/');
                    //refObject = '';
                    if (options.itemPath.startsWith(refObject[$data.remoteField])) {
                        refObject[$data.remoteField] = '';
                        return this.set({ itemPath: refPath, value: refObject});    
                    }
                    //console.log(refPath, refSchema, refObject);
                    return null;
                }
            });
        }

        let result;
        const { dataSource, entryPointInfo } = await this.getDataSourceInfo(options);
        if (dataSource instanceof AbstractDispatcher) {
            //console.log("CALL DELEGATED JSON DISPATCH", {
            //    ...options,
            //    itemPath: entryPointInfo?.objPath, 
            //    parentPath: entryPointInfo?.parentPath, 
            //    params: entryPointInfo?.proxyInfo?.params
            //})
            result = await dataSource.getDataSource(this).dispatch(methodName, entryPointInfo? {
                ...options,
                itemPath: entryPointInfo?.objPath, 
                parentPath: entryPointInfo?.parentPath, 
                params: entryPointInfo?.proxyInfo?.params
            } : options);
        } else {
            console.log("CALL DEFAULT JSON DISPATCH", options)
            result = await this.getDataSource(this).dispatch(methodName, options);    
        }

        if ((~['set', 'push'].indexOf(methodName))) {
            await this.eachRemoteField(options, (remote, $data) => {
                const refSchema = remote.schema;
                const refObject = remote.value;
                const refPath = remote.itemPath;
                //console.log("called from dispatch", refPath, refSchema, refObject);
                if (refSchema?.type === 'array') {
                    refObject[$data.remoteField] = refObject[$data.remoteField] || [];
                    refObject[$data.remoteField].push(absolute('..', options.itemPath));
                    return this.set({ itemPath: refPath, value: refObject });    
                } else {
                    //refPath = [refPath, $data.remoteField].join('/');
                    refObject[$data.remoteField] = absolute('..', options.itemPath);
                    //console.log(refPath, refSchema, refObject);
                    return this.set({ itemPath: refPath, value: refObject });    
                }
            });
        }
        // tslint:disable-next-line:no-return-await
        return result;
    }

    private async eachRemoteField(options: IDispatchOptions, callback: (IDispatchOptions, IRelationship) => Promise<any>) {
        const $data = options.schema?.$data || options.schema?.items?.$data;
        if ($data?.path && $data.remoteField) {
            const refPath = absolute($data.path, options.itemPath);
            //console.log("eachRemote", refPath)
            let refSchema = await this.getSchema({ itemPath: refPath });
            if ((refSchema?.type === 'array' && refSchema?.items?.type === 'object') || (refSchema?.type === 'object')) {
                refSchema = refSchema.items || refSchema;
                refSchema = refSchema.properties[$data.remoteField];
                
                const refValues = await this.get({ itemPath: options.itemPath, schema: refSchema }) || [];
                const refPaths = Array.isArray(refValues) ? refValues: [refValues];
                return await Promise.all(refPaths.map( async refPath => {
                    let refObject = await this.get({ itemPath: refPath, schema: refSchema}) || [];
                    return callback({ itemPath: refObject._fullPath || refPath, schema: refSchema, value: refObject }, $data);
                }))
            }
        }    
        return null;        
    }

    private findEntryPoints(p: string = '', schema: IProperty): IEntryPoints {
        //console.log(`DISPATCH findEntryPoints(p: string = ${p}, schema: ${schema})`)
        let paths: IEntryPoints = {};
        if (!schema) { return {}; }

        if (schema.type === 'object') {
            if (schema.$proxy) {
                paths[''] = schema.$proxy;
            }
            if (schema.properties) {
                try {
                    Object.keys(schema.properties).map((key: string) => {
                        paths = { ...paths, ...this.findEntryPoints(key, schema.properties[key]) };
                    });
                } catch {
                    // RangeError: Maximum call stack size exceeded
                }
            } else {
                // tslint:disable-next-line:no-console
                console.warn("Malformed schema: object missing properties:", schema);
            }
        } else if (schema.type === 'array') {
            if (schema.$proxy) {
                paths[p] = schema.$proxy;
            }
            try {
                return { ...paths, ...this.findEntryPoints('(#|\\d+|[a-f0-9-]{24})', schema.items) };
            } catch {
                // RangeError: Maximum call stack size exceeded
            }
        }

        return Object.keys(paths).reduce((acc: IEntryPoints, key: string) => {
            const fixedObjKey = key.replace(/\/$/, '');
            acc[`${p}${p?'/':''}${fixedObjKey}`] = paths[key];
            // tslint:disable-next-line:no-console
            //console.log(p,key,`${p}${p?'\\/':''}${key}`)

            return acc;
        }, {});
    }

    private getProxyForPath(itemPath?: string): IEntryPointInfo[] {
        //console.log(`DISPATCH getProxyForPath(itemPath?: ${itemPath})`)
        const schemaPath = itemPath !== undefined && itemPath !== null ? itemPath : '';

        return Object.keys(this.entryPoints).filter((k: string) => {
            return k.length ? RegExp(k).test(schemaPath) : true;
        }).map((foundKey: string) => {
            const objPath = schemaPath.replace(RegExp(foundKey), '');
            const parentPath = schemaPath.slice(0, schemaPath.length - objPath.length + 1).replace(/\/$/, '');

            return { proxyInfo: this.entryPoints[foundKey], parentPath, objPath: objPath.replace(/^\//, '') };
        });
    }

    private getProxyWithinPath(itemPath?: string): IProxyInfo[] {
        const schemaPath = itemPath !== undefined ? itemPath : '';
        // tslint:disable-next-line:prefer-template
        const comparisonPath = schemaPath.replace(/(#|\d+|[a-f0-9-]{24})\//g, '(#|\\d+|[a-f0-9-]{24})/')
            .replace(/(#|\d+|[a-f0-9-]{24})$/g, '(#|\\d+|[a-f0-9-]{24})') //.replace('/', '\\/')

        //console.log(`DISPATCH getProxyWithinPath(itemPath?: ${itemPath})`, schemaPath, comparisonPath)        
        return Object.keys(this.entryPoints).filter((k: string) => {
            return k.indexOf(comparisonPath) !== -1;
        }).map((foundKey: string) => {
            return this.entryPoints[foundKey];
        });
    }

    private async getProxy(proxyInfo: IProxyInfo): Promise<AbstractDataSource> {
        //console.log(`DISPATCH getProxy(proxyInfo: ${proxyInfo})`)

        const proxy = this.proxies.find((p: IProxy) => p.name === proxyInfo.proxyName);
        if (proxy?.dataSource) return proxy.dataSource;
        if (proxy?.classRef) {
            //console.log("Instantiating",proxy?.classRef, proxyInfo.initParams);
            const dataSource = (proxy && new proxy.classRef(...(proxyInfo.initParams || [])));
            if (dataSource) {
                await dataSource.connect();
                if (proxyInfo.singleton !== false) {
                    proxy.dataSource = dataSource;
                }
            }
            //console.log("Done", dataSource);
            return dataSource
        };
        return undefined;
    }

}

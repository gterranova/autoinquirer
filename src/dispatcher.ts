// tslint:disable:no-any
// tslint:disable-next-line:import-name
import { IProperty, IProxyInfo, IDispatchOptions } from './interfaces';
import { absolute } from './utils';
import { AbstractDispatcher } from './datasource';
import { JsonDataSource } from './json';
import { JsonSchema } from './jsonschema';

//const path = require('path');

declare type IEntryPoints = { [key: string]: IProxyInfo };

interface IEntryPointInfo {
    proxyInfo: IProxyInfo;
    parentPath: string;
    objPath: string;
};

interface IProxy {
    name: string;
    dataSource: AbstractDispatcher
}

export class Dispatcher extends AbstractDispatcher {
    private entryPoints: IEntryPoints = {};
    private proxies: IProxy[] = [];
    private schemaSource: JsonSchema;
    private dataSource: AbstractDispatcher;

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
        await Promise.all(this.proxies.map((proxy: IProxy) => proxy.dataSource.connect()));
    }

    public async close() {
        await this.schemaSource.close();
        await this.dataSource.close();
        await Promise.all(this.proxies.map((proxy: IProxy) => proxy.dataSource.close()));
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async getSchema(options?: IDispatchOptions): Promise<IProperty> {
        //console.log(`DISPATCH getSchema(itemPath?: ${itemPath})`);
        // tslint:disable-next-line:no-unnecessary-local-variable
        for (const proxy of this.getProxyForPath(options?.itemPath).reverse()) {
            // tslint:disable-next-line:no-console
            //console.log("REFS", collectionRefs);
            const { parentPath, proxyInfo } = proxy;
            const dataSource = this.getProxy(proxyInfo);
            if (dataSource) {
                // tslint:disable-next-line:no-return-await
                //console.log(`DISPATCH DELEGATE getSchema(itemPath?: ${itemPath})`);
                return await dataSource.getSchema({itemPath: options.itemPath, parentPath, params: proxyInfo.params}, this.schemaSource);
            }
        };
        const schema = await this.schemaSource.get(options);

        return schema;
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

    public registerProxy(name: string, dataSource: AbstractDispatcher) {
        this.proxies.push({ name, dataSource });
    }

    // tslint:disable-next-line:cyclomatic-complexity
    public async dispatch(methodName: string, options?: IDispatchOptions): Promise<any> {
        // tslint:disable-next-line:no-parameter-reassignment
        const itemPath = options?.itemPath || '';
        const schema = options?.schema || await this.getSchema({ ...options });
        let value = options?.value;

        // tslint:disable-next-line:no-bitwise
        if (schema === undefined || (schema.readOnly === true && (~['set', 'push', 'del'].indexOf(methodName)))) {
            return;
        } else if (methodName === 'get') {
            if (schema.writeOnly === true) { return; }
        }
        // tslint:disable-next-line:no-bitwise
        else if (~['set', 'push'].indexOf(methodName)) {
            // tslint:disable-next-line:no-parameter-reassignment
            value = this.schemaSource.validate(methodName === 'push' ? schema.items : schema, value);
        } else if (methodName === 'del') {
            const promises: Promise<any>[] = [];
            for (const proxyInfo of this.getProxyWithinPath(itemPath)) {
                const dataSource = this.getProxy(proxyInfo)
                // tslint:disable-next-line:no-console
                //console.log("Must delete from", proxyInfo, "with parentPath starting with", RegExp(`^${itemPath}`));
                // tslint:disable-next-line:no-string-literal
                if (dataSource && dataSource['delCascade'] !== undefined) {
                    promises.push(dataSource.dispatch('delCascade', { itemPath, params: proxyInfo.params }));
                }
            }
            // tslint:disable-next-line:no-string-literal
            if (this.dataSource['delCascade'] !== undefined) {
                promises.push(this.dataSource.dispatch('delCascade', { itemPath }));
            }

            await Promise.all(promises);
        } 

        for (const proxy of this.getProxyForPath(itemPath).reverse()) {
            // tslint:disable-next-line:no-console
            //console.log("REFS", collectionRefs);
            const { objPath, parentPath, proxyInfo } = proxy;
            const dataSource = this.getProxy(proxyInfo);
            if (dataSource && dataSource[methodName]) {
                // tslint:disable-next-line:no-return-await
                return await dataSource.dispatch(methodName, { itemPath: objPath, schema, value, parentPath, params: proxyInfo.params });
            }
        };
        
        if ((~['set', 'push', 'del'].indexOf(methodName))) {
            //console.log(methodName, itemPath, schema, value)
            const $data = schema?.$data || schema?.items?.$data;
            if ($data?.path && $data.remoteField) {
                const refPath = absolute($data.path, itemPath);
                let refSchema = await this.getSchema({ itemPath: refPath });
                if ((refSchema?.type === 'array' && refSchema?.items?.type === 'object') || (refSchema?.type === 'object')) {
                    refSchema = refSchema.items || refSchema;
                    refSchema = refSchema.properties[$data.remoteField];
                    
                    const refValues = await this.get({ itemPath }) || [];
                    const refPaths = Array.isArray(refValues) ? refValues: [refValues];
                    refPaths.forEach( async refPath => {
                        let refObject = await this.get({ itemPath: refPath, schema: refSchema}) || [];
                        //console.log("HERE", refSchema, refObject, refPath);
                        if (refSchema?.type === 'array') {
                            refObject[$data.remoteField] = (refObject[$data.remoteField] || []).filter( ref => !itemPath.startsWith(ref) );
                            //console.log(refPath, refSchema, refObject);
                            this.set({ itemPath: refPath, value: refObject});    
                        } else {
                            //refPath = [refPath, $data.remoteField].join('/');
                            //refObject = '';
                            if (itemPath.startsWith(refObject[$data.remoteField])) {
                                refObject[$data.remoteField] = '';
                                this.set({ itemPath: refPath, value: refObject});    
                            }
                            //console.log(refPath, refSchema, refObject);
                        }
                        //console.log(refPath, refSchema, refObject);
                        //this.set(refPath, refSchema, refObject);    
                    })
                }
            }    
        }

        // tslint:disable-next-line:no-return-await
        const result = await this.dataSource.dispatch(methodName, { itemPath, schema, value });
        
        if ((~['set', 'push'].indexOf(methodName))) {
            //console.log(methodName, itemPath, schema, value)
            const $data = schema?.$data || schema?.items?.$data;
            if ($data?.path && $data.remoteField) {
                const refPath = absolute($data.path, itemPath);
                let refSchema = await this.getSchema({ itemPath: refPath});
                if ((refSchema?.type === 'array' && refSchema?.items?.type === 'object') || (refSchema?.type === 'object')) {
                    refSchema = refSchema.items || refSchema;
                    refSchema = refSchema.properties[$data.remoteField];
                    const refPaths = Array.isArray(value) ? value: [value];
                    refPaths.forEach( async refPath => {
                        let refObject = await this.get({ itemPath: refPath, schema: refSchema}) || {};
                        //console.log("HERE", refSchema, refObject, refPath);
                        if (refSchema?.type === 'array') {
                            refObject[$data.remoteField] = refObject[$data.remoteField] || [];
                            refObject[$data.remoteField].push(absolute('..', itemPath));
                            this.set({ itemPath: refPath, schema: refObject });    
                        } else {
                            //refPath = [refPath, $data.remoteField].join('/');
                            refObject[$data.remoteField] = absolute('..', itemPath);
                            //console.log(refPath, refSchema, refObject);
                            this.set({ itemPath: refPath, schema: refObject });    
                        }
                    })
                }
            }    
        }

        // tslint:disable-next-line:no-return-await
        return result;
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
                return { ...paths, ...this.findEntryPoints('(\\d+|[a-f0-9-]{24})', schema.items) };
            } catch {
                // RangeError: Maximum call stack size exceeded
            }
        }

        return Object.keys(paths).reduce((acc: IEntryPoints, key: string) => {
            const fixedObjKey = key.replace(/\/$/, '');
            acc[`${p}/${fixedObjKey}`] = paths[key];
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
            const parentPath = schemaPath.slice(0, schemaPath.length - objPath.length + 1);

            return { proxyInfo: this.entryPoints[foundKey], parentPath, objPath: objPath.replace(/^\//, '') };
        });
    }

    private getProxyWithinPath(itemPath?: string): IProxyInfo[] {
        const schemaPath = itemPath !== undefined ? itemPath : '';
        // tslint:disable-next-line:prefer-template
        const comparisonPath = schemaPath.replace(/(\d+|[a-f0-9-]{24})\//g, '(\\d+|[a-f0-9-]{24})/')
            .replace(/(\d+|[a-f0-9-]{24})$/g, '(\\d+|[a-f0-9-]{24})') //.replace('/', '\\/')

        //console.log(`DISPATCH getProxyWithinPath(itemPath?: ${itemPath})`, schemaPath, comparisonPath)        
        return Object.keys(this.entryPoints).filter((k: string) => {
            return k.indexOf(comparisonPath) !== -1;
        }).map((foundKey: string) => {
            return this.entryPoints[foundKey];
        });
    }

    private getProxy(proxyInfo: IProxyInfo): AbstractDispatcher {
        //console.log(`DISPATCH getProxy(proxyInfo: ${proxyInfo})`)

        const proxy = this.proxies.find((p: IProxy) => p.name === proxyInfo.proxyName);

        return proxy && proxy.dataSource;
    }

}

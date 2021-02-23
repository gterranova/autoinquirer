// tslint:disable:no-any
// tslint:disable-next-line:import-name
import * as _ from 'lodash';
import { IProperty, IProxyInfo, IDispatchOptions, Action, IEntryPoints, IProxy, 
    renderFunction, renderOptions, IDataSourceInfo, IEntryPointInfo } from './interfaces';
import { AutoinquirerPush, AutoinquirerUpdate, AutoinquirerSet, AutoinquirerDelete } from './interfaces';
import { absolute } from './utils';
import { AbstractDispatcher, AbstractDataSource } from './datasource';
import { JsonDataSource } from './json';
import { JsonSchema } from './jsonschema';
//import { join } from 'lodash';

//const path = require('path');


export class Dispatcher extends AbstractDispatcher implements AutoinquirerPush, AutoinquirerUpdate, AutoinquirerSet, AutoinquirerDelete{
    private entryPoints: IEntryPoints = {};
    private proxies: IProxy[] = [];
    private schemaSource: JsonSchema;
    private dataSource: AbstractDispatcher;
    private transformers: { [key: string]: renderFunction} = {};

    constructor(schema: string | JsonSchema, data: string | AbstractDispatcher) {
        super();
        this.schemaSource = (typeof schema === 'string') ? new JsonSchema(schema) : schema;
        this.dataSource = (typeof data === 'string') ? new JsonDataSource(data) : data;
        (typeof data !== 'string') && this.dataSource.setParent(this);
    }

    public async connect(parentDispatcher: AbstractDispatcher) {
        await this.schemaSource.connect(this);
        await this.dataSource.connect(this);
        this.setParent(parentDispatcher);

        const schema = await this.schemaSource.get();
        const rootValue = await this.dataSource.dispatch(Action.GET, { itemPath: '' });
        const coercedValue = this.schemaSource.coerce({ type: schema.type }, rootValue);
        if (typeof rootValue !== typeof coercedValue) {
            // tslint:disable-next-line:no-console
            //console.log({ type: schema.type }, rootValue, coercedValue);
            this.dataSource.dispatch(Action.SET, { itemPath: '', schema, value: coercedValue});
        }
        this.entryPoints = this.findEntryPoints('', schema);
        // tslint:disable-next-line:no-console
        //console.log("ENTRY POINTS:", this.entryPoints)
        await Promise.all(this.proxies.map((proxy: IProxy) => {proxy?.dataSource?.connect(this)}));
    }

    public async close() {
        await this.schemaSource.close();
        await this.dataSource.close();
        await Promise.all(this.proxies.map((proxy: IProxy) => proxy?.dataSource?.close()));
    }

    public getSchemaDataSource(): AbstractDataSource {
        return this.schemaSource || this.parentDispatcher.getSchemaDataSource();
    }

    public getDataSource(): AbstractDataSource {
        return this.dataSource || this.parentDispatcher?.getDataSource();
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
                return <IDataSourceInfo<AbstractDataSource>>{ dataSource, entryPointOptions: {...options, ...entryPointInfo } };
            }
        };
        return { dataSource: <AbstractDataSource>this, entryPointOptions: options };
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async getSchema(options?: IDispatchOptions): Promise<IProperty> {
        if (/^archived\/?/.test(options.itemPath)) {
            options.itemPath = options.itemPath.replace(/^archived\/?/, '');
            options.params = {...options.params, archived: true };
        }
        //console.log(`DISPATCH getSchema(itemPath?: ${options?.itemPath})`);
        // tslint:disable-next-line:no-unnecessary-local-variable
        const { dataSource, entryPointOptions } = await this.getDataSourceInfo(options);

        const schema = await dataSource.getSchemaDataSource().get(entryPointOptions);
        if (!schema?.type) {
            //console.error("Something wrong with", entryPointInfo?.itemPath, options);
            return null;
        }
        return await this.processProxyPropertiesSchema(schema, options, true);
    }

    private async processProxyPropertiesSchema(schema: any, options: IDispatchOptions, _enterProxy = false) {
        /*
        const itemPath = _.compact([options.parentPath, options.itemPath]).join('/');
        //console.log(`processProxyPropertiesSchema ${itemPath}`)
        if (schema?.$proxy && enterProxy) {
            const { dataSource, entryPointOptions } = await this.getDataSourceInfo(options);
            //console.log(`processProxy ${schema.$proxy?.proxyName} ${itemPath}`, { entryPointOptions })

            if ((<AbstractDispatcher>dataSource).parent ) {
                //console.log(dataSource, "has parent")
                schema = await (<AbstractDispatcher>dataSource).parent.getSchema(entryPointOptions);
                //return await dataSource.getSchema({ itemPath: '' });
            } else {
                //    let { dataSource, entryPointOptions } = await this.getDataSourceInfo(options);
            //    //console.log("DELEGATE Proxy", schema.$proxy.proxyName, dataSource, "for", schema, {...entryPointOptions, parentPath: join(options.parentPath, entryPointOptions.parentPath)})
                schema = await dataSource.getSchemaDataSource().get(entryPointOptions);
            //    schema = await this.getSchema(options);
            }

            
            //options = {...entryPointOptions, schema, parentPath: join(options.parentPath, entryPointOptions.parentPath)};
            //console.log("Should eval into", options.itemPath, "props", _.keys(schema.properties))
        }
        */
        if (schema?.type === 'object') {
            const subSchemas = await Promise.all(_.chain(schema.properties || {}).keys()
                .filter(p => !!schema.properties[p].$proxy)
                .map(async (proxiedProp) => {
                    const newOptions = <IDispatchOptions>{
                        itemPath: _.compact([options.params?.archived && 'archived', options.itemPath, proxiedProp]).join('/'),
                        schema: schema.properties[proxiedProp]
                    };
                    let subSchema = await this.getSchema(newOptions);
                    //console.log("Should enter into", newOptions.itemPath)
                    //subSchema = await this.processProxyPropertiesSchema(subSchema, newOptions, true);
                    //if (newOptions.itemPath.startsWith('duediligence')) console.log("AFTER", subSchema)
                    return [proxiedProp, { ...schema.properties[proxiedProp], ...subSchema }];
                }).value());
            schema.properties = { ...schema.properties, ..._.fromPairs(subSchemas) };
        } 
        return schema;
    }

    public async isMethodAllowed(methodName: Action, options?: IDispatchOptions): Promise<Boolean> {
        for (const proxyInfo of this.getProxyWithinPath(options.itemPath)) {
            const dataSource = await this.getProxy(proxyInfo)
            if (dataSource && !await dataSource.isMethodAllowed(methodName, options)) {
                return false;
            }
        }
        return true;
    }
        
    // tslint:disable-next-line:no-reserved-keywords
    public async get(options?: IDispatchOptions) {
        // tslint:disable-next-line:no-return-await
        return await this.dispatch(Action.GET, options);
    }

    // tslint:disable-next-line:no-reserved-keywords
    public async set(options?: IDispatchOptions) {
        // tslint:disable-next-line:no-return-await
        return await this.dispatch(Action.SET, options);
    }

    public async update(options?: IDispatchOptions) {
        // tslint:disable-next-line:no-return-await
        return await this.dispatch(Action.UPDATE, options);
    }

    public async push(options?: IDispatchOptions) {
        // tslint:disable-next-line:no-return-await
        return await this.dispatch(Action.PUSH, options);
    }

    public async delete(options?: IDispatchOptions) {
        // tslint:disable-next-line:no-return-await
        return await this.dispatch(Action.DELETE, options);
    }

    public registerProxy(proxy: IProxy) {
        //if (!proxy.dataSource && proxy.classRef && args) {
        //    proxy.dataSource = new proxy.classRef(...args);
        //}
        this.proxies.push(proxy);
    }

    public registerProxies(proxies: Array<IProxy>) {
        proxies.map( p => this.registerProxy(p));
    }

    // tslint:disable-next-line:cyclomatic-complexity
    public async dispatch(methodName: Action, options?: IDispatchOptions): Promise<any> {
        // tslint:disable-next-line:no-parameter-reassignment
        options = options || {};

        options.itemPath = options?.itemPath ? await this.convertPathToUri(options?.itemPath) : '';
        options.schema = options?.schema || await this.getSchema(options);
        options.value = options?.value;

        //console.log("DISPATCH", methodName, `${options.itemPath}`)        
                
        if (!await this.isMethodAllowed(methodName, options)) {
            throw new Error(`Method "${methodName}" not allowed for path "${options}"`);
            return undefined;
        }

        if (this.requestHasWildcards(options)) {
            //console.log("in dispatcher", { hasSchema: !!options.schema });
            return await this.processWildcards(methodName, options);
        }

        // tslint:disable-next-line:no-bitwise
        else if (~[Action.SET, Action.UPDATE, Action.PUSH].indexOf(methodName)) {
            // Process $refs 
            if (options.value?.$ref?.value) {
                const refValue = await this.dispatch(Action.GET, { ...options, itemPath: options.value.$ref.value });
                if (options.schema.type==='array' && _.isArray(refValue)) {
                    return await Promise.all(_.map(refValue, item => {
                        return this.dispatch(Action.PUSH, {...options, value: _.cloneDeep(item) })
                    }));
                }
                //console.log(`DISPATCH ${methodName} for ${options.value.$ref} value:\n${JSON.stringify(refValue, null, 2)}`);
                return await this.dispatch(options.schema.type==='object'? Action.SET: Action.PUSH, {...options, value: _.cloneDeep(refValue) });
            }
            // tslint:disable-next-line:no-parameter-reassignment
            //try {
                options.value = this.schemaSource.validate(methodName === Action.PUSH ? options.schema.items : options.schema, options.value);
            //} catch (e) {
                //console.log('Validation Error', { value: options.value, errors: e.errors});
                //throw e;
            //}
        } else if (methodName === Action.DELETE) {
            const promises: Promise<any>[] = [];
            for (const proxyInfo of this.getProxyWithinPath(options.itemPath)) {
                const dataSource = await this.getProxy(proxyInfo)
                // tslint:disable-next-line:no-console
                //console.log("Must delete from", proxyInfo, "with parentPath starting with", RegExp(`^${itemPath}`));
                // tslint:disable-next-line:no-string-literal
                if (dataSource && dataSource[Action.DELETE_CASCADE] !== undefined) {
                    promises.push(dataSource.dispatch(Action.DELETE_CASCADE, { itemPath: options.itemPath, params: proxyInfo.params }));
                }
            }
            // tslint:disable-next-line:no-string-literal
            if (this.dataSource[Action.DELETE_CASCADE] !== undefined) {
                promises.push(this.dataSource.dispatch(Action.DELETE_CASCADE, { itemPath: options.itemPath }));
            }

            await Promise.all(promises);
        } 

        if ((~[Action.SET, Action.PUSH, Action.DELETE].indexOf(methodName))) {
            //console.log(methodName, itemPath, schema, value)
            await this.eachRemoteField(options, (remote, $data) => {
                const refSchema = remote.schema;
                const refObject = remote.value;
                const refPath = remote.itemPath;
                //console.log("called from dispatch", refPath, refSchema, refObject);
                if (!refObject?.[$data.remoteField]) return null;

                if (refSchema?.type === 'array') {
                    //console.log("removing from", refObject[$data.remoteField], refPath)
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
        const { dataSource, entryPointOptions } = await this.getDataSourceInfo(options);
        //console.log("IS ARCHIVED?", options.params?.archived, entryPointOptions.itemPath)
        result = await dataSource.getDataSource().dispatch(methodName, entryPointOptions);            
        result = await this.processProxyPropertiesValues(result, options, true);            

        if ((~[Action.SET, Action.PUSH].indexOf(methodName))) {
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

    private async processProxyPropertiesValues(result: any, options: IDispatchOptions, _enterProxy = false) {
        /*
        if (options.schema.$proxy && enterProxy) {
            const { dataSource, entryPointOptions } = await this.getDataSourceInfo(options);
            const schema = {...(await dataSource.getSchema({ itemPath: entryPointOptions.itemPath})) };
            options = {...entryPointOptions, schema, parentPath: join(options.parentPath, entryPointOptions.parentPath)};
            //console.log({...entryPointOptions, parentPath: join(options.parentPath, entryPointOptions.parentPath)})
            if (schema.$proxy?.proxyName === 'Dispatcher') {
                return await (<Dispatcher>dataSource).processProxyPropertiesValues(schema, options);
            }

            //console.log("Should eval into", entryPointOptions, "props", _.keys(schema.properties))    
        }
        */

        if (options.schema?.type === 'object' && !_.isArray(result)) {
            const subValues = await Promise.all(_.chain(options.schema.properties || []).keys()
                .filter(p => !!options.schema.properties[p].$proxy)
                .map(async (proxiedProp) => {
                    const { dataSource, entryPointOptions } = await this.getDataSourceInfo({
                        itemPath: _.compact([options.params?.archived && 'archived', options.itemPath, proxiedProp]).join('/'),
                        schema: options.schema.properties[proxiedProp], 
                        params: options.params
                    });
                    let subValue = await dataSource.getDataSource().dispatch(Action.GET, entryPointOptions);
                    return [proxiedProp, subValue];
                }).value());
            //console.log(_.chain(options.schema.properties||[]).keys()
            //.filter( p => !!options.schema.properties[p].$proxy).value(), _.fromPairs(subValues));
            result = { ...result, ..._.fromPairs(subValues) };
        }
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
                
                const defaultValue = refSchema.type === 'object'? {} : [];
                const refValues = await this.get({ itemPath: options.itemPath, schema: refSchema }) || defaultValue;
                const refPaths = Array.isArray(refValues) ? refValues: [refValues];
                return await Promise.all(refPaths.map( async refPath => {
                    let refObject = await this.get({ itemPath: refPath, schema: refSchema}) || defaultValue;
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
        //console.log(this.entryPoints)
        return Object.keys(this.entryPoints).filter((k: string) => {
            return k.length ? RegExp(k).test(schemaPath) : true;
        }).map((foundKey: string) => {
            const itemPath = schemaPath.replace(RegExp("([/]?"+foundKey+"[/]?)"), '');
            const parentPath = itemPath? schemaPath.split(itemPath)[0].replace(/\/$/, ''): schemaPath.replace(/\/$/, '');
            const params = this.entryPoints[foundKey].params;
            //console.log(`"${schemaPath}", "${foundKey}", "${itemPath}", "${parentPath}"`)

            return { proxyInfo: this.entryPoints[foundKey], parentPath, itemPath, params };
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
                await dataSource.connect(this);
                if (proxyInfo.singleton !== false) {
                    proxy.dataSource = dataSource;
                }
            }
            //console.log("Done", dataSource);
            return dataSource
        };
        return undefined;
    }

    public registerTransformer({ name, fn }: renderOptions) {
        this.transformers[name] = fn.bind(this);
    }

    public registerTransformers(transformers: Array<renderOptions>) {
        transformers.map(t => {
            this.transformers[t.name] = t.fn.bind(this);
        })
    }

    public getTransformer(name: string): renderFunction {
        return this.transformers[name];
    }

}

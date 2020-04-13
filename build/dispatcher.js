"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const utils_1 = require("./utils");
const datasource_1 = require("./datasource");
const json_1 = require("./json");
const jsonschema_1 = require("./jsonschema");
;
class Dispatcher extends datasource_1.AbstractDispatcher {
    constructor(schema, data) {
        super();
        this.entryPoints = {};
        this.proxies = [];
        this.schemaSource = (typeof schema === 'string') ? new jsonschema_1.JsonSchema(schema) : schema;
        this.dataSource = (typeof data === 'string') ? new json_1.JsonDataSource(data) : data;
    }
    connect() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.schemaSource.connect();
            yield this.dataSource.connect();
            const schema = yield this.schemaSource.get();
            const rootValue = yield this.dataSource.dispatch('get', { itemPath: '' });
            const coercedValue = this.schemaSource.coerce({ type: schema.type }, rootValue);
            if (typeof rootValue !== typeof coercedValue) {
                this.dataSource.dispatch('set', { itemPath: '', schema, value: coercedValue });
            }
            this.entryPoints = this.findEntryPoints('', schema);
            yield Promise.all(this.proxies.map((proxy) => { var _a, _b; (_b = (_a = proxy) === null || _a === void 0 ? void 0 : _a.dataSource) === null || _b === void 0 ? void 0 : _b.connect(); }));
        });
    }
    close() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.schemaSource.close();
            yield this.dataSource.close();
            yield Promise.all(this.proxies.map((proxy) => { var _a, _b; return (_b = (_a = proxy) === null || _a === void 0 ? void 0 : _a.dataSource) === null || _b === void 0 ? void 0 : _b.close(); }));
        });
    }
    getSchemaDataSource(parentDispatcher) {
        var _a;
        return this.schemaSource || ((_a = parentDispatcher) === null || _a === void 0 ? void 0 : _a.getSchemaDataSource());
    }
    getDataSource(parentDispatcher) {
        var _a;
        return this.dataSource || ((_a = parentDispatcher) === null || _a === void 0 ? void 0 : _a.getDataSource());
    }
    getDataSourceInfo(options) {
        var _a;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            for (const entryPointInfo of this.getProxyForPath((_a = options) === null || _a === void 0 ? void 0 : _a.itemPath).reverse()) {
                const { proxyInfo } = entryPointInfo;
                const dataSource = yield this.getProxy(proxyInfo);
                if (dataSource) {
                    return { dataSource, entryPointInfo };
                }
            }
            ;
            return { dataSource: this };
        });
    }
    getSchema(options, parentDispatcher) {
        var _a, _b, _c, _d;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { dataSource, entryPointInfo } = yield this.getDataSourceInfo(options);
            if (dataSource instanceof datasource_1.AbstractDispatcher) {
                return yield dataSource.getSchemaDataSource(this).get(entryPointInfo ? {
                    itemPath: (_a = entryPointInfo) === null || _a === void 0 ? void 0 : _a.objPath,
                    parentPath: (_b = entryPointInfo) === null || _b === void 0 ? void 0 : _b.parentPath,
                    params: (_d = (_c = entryPointInfo) === null || _c === void 0 ? void 0 : _c.proxyInfo) === null || _d === void 0 ? void 0 : _d.params
                } : options);
            }
            return yield this.getSchemaDataSource(parentDispatcher).get(options);
        });
    }
    get(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return yield this.dispatch('get', options);
        });
    }
    set(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return yield this.dispatch('set', options);
        });
    }
    update(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return yield this.dispatch('update', options);
        });
    }
    push(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return yield this.dispatch('push', options);
        });
    }
    del(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return yield this.dispatch('del', options);
        });
    }
    registerProxy(proxy) {
        this.proxies.push(proxy);
    }
    dispatch(methodName, options) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            options = options || {};
            options.itemPath = ((_a = options) === null || _a === void 0 ? void 0 : _a.itemPath) ? yield this.convertPathToUri((_b = options) === null || _b === void 0 ? void 0 : _b.itemPath) : '';
            options.schema = ((_c = options) === null || _c === void 0 ? void 0 : _c.schema) || (yield this.getSchema(options));
            options.value = (_d = options) === null || _d === void 0 ? void 0 : _d.value;
            if (!this.isMethodAllowed(methodName, options.schema)) {
                return undefined;
            }
            if (this.requestHasWildcards(options)) {
                return yield this.processWildcards(methodName, options);
            }
            else if (~['set', 'push'].indexOf(methodName)) {
                options.value = this.schemaSource.validate(methodName === 'push' ? options.schema.items : options.schema, options.value);
            }
            else if (methodName === 'del') {
                const promises = [];
                for (const proxyInfo of this.getProxyWithinPath(options.itemPath)) {
                    const dataSource = yield this.getProxy(proxyInfo);
                    if (dataSource && dataSource['delCascade'] !== undefined) {
                        promises.push(dataSource.dispatch('delCascade', { itemPath: options.itemPath, params: proxyInfo.params }));
                    }
                }
                if (this.dataSource['delCascade'] !== undefined) {
                    promises.push(this.dataSource.dispatch('delCascade', { itemPath: options.itemPath }));
                }
                yield Promise.all(promises);
            }
            if ((~['set', 'push', 'del'].indexOf(methodName))) {
                yield this.eachRemoteField(options, (remote, $data) => {
                    var _a;
                    const refSchema = remote.schema;
                    const refObject = remote.value;
                    const refPath = remote.itemPath;
                    if (((_a = refSchema) === null || _a === void 0 ? void 0 : _a.type) === 'array') {
                        refObject[$data.remoteField] = (refObject[$data.remoteField] || []).filter(ref => !options.itemPath.startsWith(ref));
                        return this.set({ itemPath: refPath, value: refObject });
                    }
                    else {
                        if (options.itemPath.startsWith(refObject[$data.remoteField])) {
                            refObject[$data.remoteField] = '';
                            return this.set({ itemPath: refPath, value: refObject });
                        }
                        return null;
                    }
                });
            }
            let result;
            const { dataSource, entryPointInfo } = yield this.getDataSourceInfo(options);
            if (dataSource instanceof datasource_1.AbstractDispatcher) {
                result = yield dataSource.getDataSource(this).dispatch(methodName, entryPointInfo ? Object.assign(Object.assign({}, options), { itemPath: (_e = entryPointInfo) === null || _e === void 0 ? void 0 : _e.objPath, parentPath: (_f = entryPointInfo) === null || _f === void 0 ? void 0 : _f.parentPath, params: (_h = (_g = entryPointInfo) === null || _g === void 0 ? void 0 : _g.proxyInfo) === null || _h === void 0 ? void 0 : _h.params }) : options);
            }
            else {
                console.log("CALL DEFAULT JSON DISPATCH", options);
                result = yield this.getDataSource(this).dispatch(methodName, options);
            }
            if ((~['set', 'push'].indexOf(methodName))) {
                yield this.eachRemoteField(options, (remote, $data) => {
                    var _a;
                    const refSchema = remote.schema;
                    const refObject = remote.value;
                    const refPath = remote.itemPath;
                    if (((_a = refSchema) === null || _a === void 0 ? void 0 : _a.type) === 'array') {
                        refObject[$data.remoteField] = refObject[$data.remoteField] || [];
                        refObject[$data.remoteField].push(utils_1.absolute('..', options.itemPath));
                        return this.set({ itemPath: refPath, value: refObject });
                    }
                    else {
                        refObject[$data.remoteField] = utils_1.absolute('..', options.itemPath);
                        return this.set({ itemPath: refPath, value: refObject });
                    }
                });
            }
            return result;
        });
    }
    eachRemoteField(options, callback) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const $data = ((_a = options.schema) === null || _a === void 0 ? void 0 : _a.$data) || ((_c = (_b = options.schema) === null || _b === void 0 ? void 0 : _b.items) === null || _c === void 0 ? void 0 : _c.$data);
            if (((_d = $data) === null || _d === void 0 ? void 0 : _d.path) && $data.remoteField) {
                const refPath = utils_1.absolute($data.path, options.itemPath);
                let refSchema = yield this.getSchema({ itemPath: refPath });
                if ((((_e = refSchema) === null || _e === void 0 ? void 0 : _e.type) === 'array' && ((_g = (_f = refSchema) === null || _f === void 0 ? void 0 : _f.items) === null || _g === void 0 ? void 0 : _g.type) === 'object') || (((_h = refSchema) === null || _h === void 0 ? void 0 : _h.type) === 'object')) {
                    refSchema = refSchema.items || refSchema;
                    refSchema = refSchema.properties[$data.remoteField];
                    const refValues = (yield this.get({ itemPath: options.itemPath, schema: refSchema })) || [];
                    const refPaths = Array.isArray(refValues) ? refValues : [refValues];
                    return yield Promise.all(refPaths.map((refPath) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                        let refObject = (yield this.get({ itemPath: refPath, schema: refSchema })) || [];
                        return callback({ itemPath: refObject._fullPath || refPath, schema: refSchema, value: refObject }, $data);
                    })));
                }
            }
            return null;
        });
    }
    findEntryPoints(p = '', schema) {
        let paths = {};
        if (!schema) {
            return {};
        }
        if (schema.type === 'object') {
            if (schema.$proxy) {
                paths[''] = schema.$proxy;
            }
            if (schema.properties) {
                try {
                    Object.keys(schema.properties).map((key) => {
                        paths = Object.assign(Object.assign({}, paths), this.findEntryPoints(key, schema.properties[key]));
                    });
                }
                catch (_a) {
                }
            }
            else {
                console.warn("Malformed schema: object missing properties:", schema);
            }
        }
        else if (schema.type === 'array') {
            if (schema.$proxy) {
                paths[p] = schema.$proxy;
            }
            try {
                return Object.assign(Object.assign({}, paths), this.findEntryPoints('(#|\\d+|[a-f0-9-]{24})', schema.items));
            }
            catch (_b) {
            }
        }
        return Object.keys(paths).reduce((acc, key) => {
            const fixedObjKey = key.replace(/\/$/, '');
            acc[`${p}${p ? '/' : ''}${fixedObjKey}`] = paths[key];
            return acc;
        }, {});
    }
    getProxyForPath(itemPath) {
        const schemaPath = itemPath !== undefined && itemPath !== null ? itemPath : '';
        return Object.keys(this.entryPoints).filter((k) => {
            return k.length ? RegExp(k).test(schemaPath) : true;
        }).map((foundKey) => {
            const objPath = schemaPath.replace(RegExp(foundKey), '');
            const parentPath = schemaPath.slice(0, schemaPath.length - objPath.length + 1).replace(/\/$/, '');
            return { proxyInfo: this.entryPoints[foundKey], parentPath, objPath: objPath.replace(/^\//, '') };
        });
    }
    getProxyWithinPath(itemPath) {
        const schemaPath = itemPath !== undefined ? itemPath : '';
        const comparisonPath = schemaPath.replace(/(#|\d+|[a-f0-9-]{24})\//g, '(#|\\d+|[a-f0-9-]{24})/')
            .replace(/(#|\d+|[a-f0-9-]{24})$/g, '(#|\\d+|[a-f0-9-]{24})');
        return Object.keys(this.entryPoints).filter((k) => {
            return k.indexOf(comparisonPath) !== -1;
        }).map((foundKey) => {
            return this.entryPoints[foundKey];
        });
    }
    getProxy(proxyInfo) {
        var _a, _b;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const proxy = this.proxies.find((p) => p.name === proxyInfo.proxyName);
            if ((_a = proxy) === null || _a === void 0 ? void 0 : _a.dataSource)
                return proxy.dataSource;
            if ((_b = proxy) === null || _b === void 0 ? void 0 : _b.classRef) {
                const dataSource = (proxy && new proxy.classRef(...(proxyInfo.initParams || [])));
                if (dataSource) {
                    yield dataSource.connect();
                    if (proxyInfo.singleton !== false) {
                        proxy.dataSource = dataSource;
                    }
                }
                return dataSource;
            }
            ;
            return undefined;
        });
    }
}
exports.Dispatcher = Dispatcher;
//# sourceMappingURL=dispatcher.js.map
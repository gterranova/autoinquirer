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
    getSchema(options) {
        var _a;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            for (const proxy of this.getProxyForPath((_a = options) === null || _a === void 0 ? void 0 : _a.itemPath).reverse()) {
                const { objPath, parentPath, proxyInfo } = proxy;
                const dataSource = yield this.getProxy(proxyInfo);
                if (dataSource) {
                    return yield dataSource.getSchema({ itemPath: objPath, parentPath, params: proxyInfo.params }, this.schemaSource);
                }
            }
            ;
            const schema = yield this.schemaSource.get(options);
            return schema;
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
        var _a, _b, _c;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const itemPath = ((_a = options) === null || _a === void 0 ? void 0 : _a.itemPath) || '';
            const schema = ((_b = options) === null || _b === void 0 ? void 0 : _b.schema) || (yield this.getSchema(Object.assign({}, options)));
            let value = (_c = options) === null || _c === void 0 ? void 0 : _c.value;
            if (schema === undefined || (schema.readOnly === true && (~['set', 'push', 'del'].indexOf(methodName)))) {
                return;
            }
            else if (methodName === 'get') {
                if (schema.writeOnly === true) {
                    return;
                }
            }
            else if (~['set', 'push'].indexOf(methodName)) {
                value = this.schemaSource.validate(methodName === 'push' ? schema.items : schema, value);
            }
            else if (methodName === 'del') {
                const promises = [];
                for (const proxyInfo of this.getProxyWithinPath(itemPath)) {
                    const dataSource = yield this.getProxy(proxyInfo);
                    if (dataSource && dataSource['delCascade'] !== undefined) {
                        promises.push(dataSource.dispatch('delCascade', { itemPath, params: proxyInfo.params }));
                    }
                }
                if (this.dataSource['delCascade'] !== undefined) {
                    promises.push(this.dataSource.dispatch('delCascade', { itemPath }));
                }
                yield Promise.all(promises);
            }
            for (const proxy of this.getProxyForPath(itemPath).reverse()) {
                const { objPath, parentPath, proxyInfo } = proxy;
                const dataSource = yield this.getProxy(proxyInfo);
                if (dataSource && dataSource[methodName]) {
                    return yield dataSource.dispatch(methodName, { itemPath: objPath, schema, value, parentPath, params: proxyInfo.params });
                }
            }
            ;
            if ((~['set', 'push', 'del'].indexOf(methodName))) {
                yield this.eachRemoteField({ itemPath, schema, value }, (remote, $data) => {
                    var _a;
                    const refSchema = remote.schema;
                    const refObject = remote.value;
                    const refPath = remote.itemPath;
                    if (((_a = refSchema) === null || _a === void 0 ? void 0 : _a.type) === 'array') {
                        refObject[$data.remoteField] = (refObject[$data.remoteField] || []).filter(ref => !itemPath.startsWith(ref));
                        return this.set({ itemPath: refPath, value: refObject });
                    }
                    else {
                        if (itemPath.startsWith(refObject[$data.remoteField])) {
                            refObject[$data.remoteField] = '';
                            return this.set({ itemPath: refPath, value: refObject });
                        }
                        return null;
                    }
                });
            }
            const result = yield this.dataSource.dispatch(methodName, { itemPath, schema, value });
            if ((~['set', 'push'].indexOf(methodName))) {
                yield this.eachRemoteField({ itemPath, schema, value }, (remote, $data) => {
                    var _a;
                    const refSchema = remote.schema;
                    const refObject = remote.value;
                    const refPath = remote.itemPath;
                    if (((_a = refSchema) === null || _a === void 0 ? void 0 : _a.type) === 'array') {
                        refObject[$data.remoteField] = refObject[$data.remoteField] || [];
                        refObject[$data.remoteField].push(utils_1.absolute('..', itemPath));
                        return this.set({ itemPath: refPath, value: refObject });
                    }
                    else {
                        refObject[$data.remoteField] = utils_1.absolute('..', itemPath);
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
                return Object.assign(Object.assign({}, paths), this.findEntryPoints('(\\d+|[a-f0-9-]{24})', schema.items));
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
        const comparisonPath = schemaPath.replace(/(\d+|[a-f0-9-]{24})\//g, '(\\d+|[a-f0-9-]{24})/')
            .replace(/(\d+|[a-f0-9-]{24})$/g, '(\\d+|[a-f0-9-]{24})');
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
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const _ = tslib_1.__importStar(require("lodash"));
const utils_1 = require("./utils");
const datasource_1 = require("./datasource");
const json_1 = require("./json");
const jsonschema_1 = require("./jsonschema");
class Dispatcher extends datasource_1.AbstractDispatcher {
    constructor(schema, data) {
        super();
        this.entryPoints = {};
        this.proxies = [];
        this.transformers = {};
        this.schemaSource = (typeof schema === 'string') ? new jsonschema_1.JsonSchema(schema) : schema;
        this.dataSource = (typeof data === 'string') ? new json_1.JsonDataSource(data) : data;
        (typeof data !== 'string') && this.dataSource.setParent(this);
    }
    connect(parentDispatcher) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.schemaSource.connect(this);
            yield this.dataSource.connect(this);
            this.setParent(parentDispatcher);
            const schema = yield this.schemaSource.get();
            const rootValue = yield this.dataSource.dispatch("get", { itemPath: '' });
            const coercedValue = this.schemaSource.coerce({ type: schema.type }, rootValue);
            if (typeof rootValue !== typeof coercedValue) {
                this.dataSource.dispatch("set", { itemPath: '', schema, value: coercedValue });
            }
            this.entryPoints = this.findEntryPoints('', schema);
            yield Promise.all(this.proxies.map((proxy) => { var _a; (_a = proxy === null || proxy === void 0 ? void 0 : proxy.dataSource) === null || _a === void 0 ? void 0 : _a.connect(this); }));
        });
    }
    close() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.schemaSource.close();
            yield this.dataSource.close();
            yield Promise.all(this.proxies.map((proxy) => { var _a; return (_a = proxy === null || proxy === void 0 ? void 0 : proxy.dataSource) === null || _a === void 0 ? void 0 : _a.close(); }));
        });
    }
    getSchemaDataSource() {
        return this.schemaSource || this.parentDispatcher.getSchemaDataSource();
    }
    getDataSource() {
        var _a;
        return this.dataSource || ((_a = this.parentDispatcher) === null || _a === void 0 ? void 0 : _a.getDataSource());
    }
    getDataSourceInfo(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            for (const entryPointInfo of this.getProxyForPath(options === null || options === void 0 ? void 0 : options.itemPath).reverse()) {
                const { proxyInfo } = entryPointInfo;
                const dataSource = yield this.getProxy(proxyInfo);
                if (dataSource) {
                    return { dataSource, entryPointOptions: Object.assign(Object.assign({}, options), entryPointInfo) };
                }
            }
            ;
            return { dataSource: this, entryPointOptions: options };
        });
    }
    getSchema(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (/^archived\/?/.test(options.itemPath)) {
                options.itemPath = options.itemPath.replace(/^archived\/?/, '');
                options.params = Object.assign(Object.assign({}, options.params), { archived: true });
            }
            const { dataSource, entryPointOptions } = yield this.getDataSourceInfo(options);
            const schema = yield dataSource.getSchemaDataSource().get(entryPointOptions);
            if (!(schema === null || schema === void 0 ? void 0 : schema.type)) {
                return null;
            }
            return yield this.processProxyPropertiesSchema(schema, options, true);
        });
    }
    processProxyPropertiesSchema(schema, options, _enterProxy = false) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if ((schema === null || schema === void 0 ? void 0 : schema.type) === 'object') {
                const subSchemas = yield Promise.all(_.chain(schema.properties || {}).keys()
                    .filter(p => !!schema.properties[p].$proxy)
                    .map((proxiedProp) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const newOptions = {
                        itemPath: _.compact([((_a = options.params) === null || _a === void 0 ? void 0 : _a.archived) && 'archived', options.itemPath, proxiedProp]).join('/'),
                        schema: schema.properties[proxiedProp]
                    };
                    let subSchema = yield this.getSchema(newOptions);
                    return [proxiedProp, Object.assign(Object.assign({}, schema.properties[proxiedProp]), subSchema)];
                })).value());
                schema.properties = Object.assign(Object.assign({}, schema.properties), _.fromPairs(subSchemas));
            }
            return schema;
        });
    }
    isMethodAllowed(methodName, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            for (const proxyInfo of this.getProxyWithinPath(options.itemPath)) {
                const dataSource = yield this.getProxy(proxyInfo);
                if (dataSource && !(yield dataSource.isMethodAllowed(methodName, options))) {
                    return false;
                }
            }
            return true;
        });
    }
    get(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return yield this.dispatch("get", options);
        });
    }
    set(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return yield this.dispatch("set", options);
        });
    }
    update(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return yield this.dispatch("update", options);
        });
    }
    push(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return yield this.dispatch("push", options);
        });
    }
    delete(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return yield this.dispatch("delete", options);
        });
    }
    registerProxy(proxy) {
        this.proxies.push(proxy);
    }
    registerProxies(proxies) {
        proxies.map(p => this.registerProxy(p));
    }
    dispatch(methodName, options) {
        var _a, _b;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            options = options || {};
            options.itemPath = (options === null || options === void 0 ? void 0 : options.itemPath) ? yield this.convertPathToUri(options === null || options === void 0 ? void 0 : options.itemPath) : '';
            options.schema = (options === null || options === void 0 ? void 0 : options.schema) || (yield this.getSchema(options));
            options.value = options === null || options === void 0 ? void 0 : options.value;
            if (!(yield this.isMethodAllowed(methodName, options))) {
                throw new Error(`Method "${methodName}" not allowed for path "${options}"`);
                return undefined;
            }
            if (this.requestHasWildcards(options)) {
                return yield this.processWildcards(methodName, options);
            }
            else if (~["set", "update", "push"].indexOf(methodName)) {
                if ((_b = (_a = options.value) === null || _a === void 0 ? void 0 : _a.$ref) === null || _b === void 0 ? void 0 : _b.value) {
                    const refValue = yield this.dispatch("get", Object.assign(Object.assign({}, options), { itemPath: options.value.$ref.value }));
                    if (options.schema.type === 'array' && _.isArray(refValue)) {
                        return yield Promise.all(_.map(refValue, item => {
                            return this.dispatch("push", Object.assign(Object.assign({}, options), { value: _.cloneDeep(item) }));
                        }));
                    }
                    return yield this.dispatch(options.schema.type === 'object' ? "set" : "push", Object.assign(Object.assign({}, options), { value: _.cloneDeep(refValue) }));
                }
                options.value = this.schemaSource.validate(methodName === "push" ? options.schema.items : options.schema, options.value);
            }
            else if (methodName === "delete") {
                const promises = [];
                for (const proxyInfo of this.getProxyWithinPath(options.itemPath)) {
                    const dataSource = yield this.getProxy(proxyInfo);
                    if (dataSource && dataSource["delCascade"] !== undefined) {
                        promises.push(dataSource.dispatch("delCascade", { itemPath: options.itemPath, params: proxyInfo.params }));
                    }
                }
                if (this.dataSource["delCascade"] !== undefined) {
                    promises.push(this.dataSource.dispatch("delCascade", { itemPath: options.itemPath }));
                }
                yield Promise.all(promises);
            }
            if ((~["set", "push", "delete"].indexOf(methodName))) {
                yield this.eachRemoteField(options, (remote, $data) => {
                    const refSchema = remote.schema;
                    const refObject = remote.value;
                    const refPath = remote.itemPath;
                    if (!(refObject === null || refObject === void 0 ? void 0 : refObject[$data.remoteField]))
                        return null;
                    if ((refSchema === null || refSchema === void 0 ? void 0 : refSchema.type) === 'array') {
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
            const { dataSource, entryPointOptions } = yield this.getDataSourceInfo(options);
            result = yield dataSource.getDataSource().dispatch(methodName, entryPointOptions);
            result = yield this.processProxyPropertiesValues(result, options, true);
            if ((~["set", "push"].indexOf(methodName))) {
                yield this.eachRemoteField(options, (remote, $data) => {
                    const refSchema = remote.schema;
                    const refObject = remote.value;
                    const refPath = remote.itemPath;
                    if ((refSchema === null || refSchema === void 0 ? void 0 : refSchema.type) === 'array') {
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
    processProxyPropertiesValues(result, options, _enterProxy = false) {
        var _a;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (((_a = options.schema) === null || _a === void 0 ? void 0 : _a.type) === 'object' && !_.isArray(result)) {
                const subValues = yield Promise.all(_.chain(options.schema.properties || []).keys()
                    .filter(p => !!options.schema.properties[p].$proxy)
                    .map((proxiedProp) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    var _b;
                    const { dataSource, entryPointOptions } = yield this.getDataSourceInfo({
                        itemPath: _.compact([((_b = options.params) === null || _b === void 0 ? void 0 : _b.archived) && 'archived', options.itemPath, proxiedProp]).join('/'),
                        schema: options.schema.properties[proxiedProp],
                        params: options.params
                    });
                    let subValue = yield dataSource.getDataSource().dispatch("get", entryPointOptions);
                    return [proxiedProp, subValue];
                })).value());
                result = Object.assign(Object.assign({}, result), _.fromPairs(subValues));
            }
            return result;
        });
    }
    eachRemoteField(options, callback) {
        var _a, _b, _c, _d;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const $data = ((_a = options.schema) === null || _a === void 0 ? void 0 : _a.$data) || ((_c = (_b = options.schema) === null || _b === void 0 ? void 0 : _b.items) === null || _c === void 0 ? void 0 : _c.$data);
            if (($data === null || $data === void 0 ? void 0 : $data.path) && $data.remoteField) {
                const refPath = utils_1.absolute($data.path, options.itemPath);
                let refSchema = yield this.getSchema({ itemPath: refPath });
                if (((refSchema === null || refSchema === void 0 ? void 0 : refSchema.type) === 'array' && ((_d = refSchema === null || refSchema === void 0 ? void 0 : refSchema.items) === null || _d === void 0 ? void 0 : _d.type) === 'object') || ((refSchema === null || refSchema === void 0 ? void 0 : refSchema.type) === 'object')) {
                    refSchema = refSchema.items || refSchema;
                    refSchema = refSchema.properties[$data.remoteField];
                    const defaultValue = refSchema.type === 'object' ? {} : [];
                    const refValues = (yield this.get({ itemPath: options.itemPath, schema: refSchema })) || defaultValue;
                    const refPaths = Array.isArray(refValues) ? refValues : [refValues];
                    return yield Promise.all(refPaths.map((refPath) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                        let refObject = (yield this.get({ itemPath: refPath, schema: refSchema })) || defaultValue;
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
            const itemPath = schemaPath.replace(RegExp("([/]?" + foundKey + "[/]?)"), '');
            const parentPath = itemPath ? schemaPath.split(itemPath)[0].replace(/\/$/, '') : schemaPath.replace(/\/$/, '');
            const params = this.entryPoints[foundKey].params;
            return { proxyInfo: this.entryPoints[foundKey], parentPath, itemPath, params };
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
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const proxy = this.proxies.find((p) => p.name === proxyInfo.proxyName);
            if (proxy === null || proxy === void 0 ? void 0 : proxy.dataSource)
                return proxy.dataSource;
            if (proxy === null || proxy === void 0 ? void 0 : proxy.classRef) {
                const dataSource = (proxy && new proxy.classRef(...(proxyInfo.initParams || [])));
                if (dataSource) {
                    yield dataSource.connect(this);
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
    registerTransformer({ name, fn }) {
        this.transformers[name] = fn.bind(this);
    }
    registerTransformers(transformers) {
        transformers.map(t => {
            this.transformers[t.name] = t.fn.bind(this);
        });
    }
    getTransformer(name) {
        return this.transformers[name];
    }
}
exports.Dispatcher = Dispatcher;
//# sourceMappingURL=dispatcher.js.map
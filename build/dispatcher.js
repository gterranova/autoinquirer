"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const utils_1 = require("./utils");
const datasource_1 = require("./datasource");
const json_1 = require("./json");
const jsonschema_1 = require("./jsonschema");
;
class Dispatcher extends datasource_1.DataSource {
    constructor(schema, data, renderer) {
        super();
        this.entryPoints = {};
        this.proxies = [];
        this.schemaSource = (typeof schema === 'string') ? new jsonschema_1.JsonSchema(schema) : schema;
        this.dataSource = (typeof data === 'string') ? new json_1.JsonDataSource(data) : data;
        this.setRenderer(renderer);
    }
    connect() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.schemaSource.connect();
            yield this.dataSource.connect();
            const schema = yield this.schemaSource.get();
            const rootValue = yield this.dataSource.dispatch('get', '');
            const coercedValue = this.schemaSource.coerce({ type: schema.type }, rootValue);
            if (utils_1.getType(rootValue) !== utils_1.getType(coercedValue)) {
                this.dataSource.dispatch('set', '', schema, coercedValue);
            }
            this.entryPoints = this.findEntryPoints('', schema);
            yield Promise.all(this.proxies.map((proxy) => proxy.dataSource.connect()));
        });
    }
    close() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.schemaSource.close();
            yield this.dataSource.close();
            yield Promise.all(this.proxies.map((proxy) => proxy.dataSource.close()));
        });
    }
    getSchema(itemPath, schemaSource) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            for (const proxy of this.getProxyForPath(itemPath).reverse()) {
                const { parentPath, proxyInfo } = proxy;
                const dataSource = this.getProxy(proxyInfo);
                if (dataSource) {
                    return yield dataSource.getSchema(itemPath, schemaSource || this.schemaSource, parentPath, proxyInfo.params);
                }
            }
            ;
            const schema = yield (schemaSource || this.schemaSource).get(itemPath);
            return schema;
        });
    }
    get(itemPath, propertySchema) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return yield this.dispatch('get', itemPath, propertySchema);
        });
    }
    set(itemPath, propertySchema, value) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return yield this.dispatch('set', itemPath, propertySchema, value);
        });
    }
    update(itemPath, propertySchema, value) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return yield this.dispatch('update', itemPath, propertySchema, value);
        });
    }
    push(itemPath, propertySchema, value) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return yield this.dispatch('push', itemPath, propertySchema, value);
        });
    }
    del(itemPath, propertySchema) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return yield this.dispatch('del', itemPath, propertySchema);
        });
    }
    registerProxy(name, dataSource) {
        this.proxies.push({ name, dataSource });
    }
    dispatch(methodName, itemPath, propertySchema, value) {
        var _a, _b, _c, _d;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            itemPath = itemPath !== undefined ? itemPath : '';
            const schema = propertySchema || (yield this.getSchema(itemPath));
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
                    const dataSource = this.getProxy(proxyInfo);
                    if (dataSource && dataSource['delCascade'] !== undefined) {
                        promises.push(dataSource.dispatch('delCascade', itemPath, proxyInfo.params));
                    }
                }
                if (this.dataSource['delCascade'] !== undefined) {
                    promises.push(this.dataSource.dispatch('delCascade', itemPath));
                }
                yield Promise.all(promises);
            }
            for (const proxy of this.getProxyForPath(itemPath).reverse()) {
                const { objPath, parentPath, proxyInfo } = proxy;
                const dataSource = this.getProxy(proxyInfo);
                if (dataSource && dataSource[methodName]) {
                    return yield dataSource.dispatch(methodName, objPath, schema, value, parentPath, proxyInfo.params);
                }
            }
            ;
            if ((~['set', 'push', 'del'].indexOf(methodName))) {
                const $data = (schema === null || schema === void 0 ? void 0 : schema.$data) || ((_a = schema === null || schema === void 0 ? void 0 : schema.items) === null || _a === void 0 ? void 0 : _a.$data);
                if (($data === null || $data === void 0 ? void 0 : $data.path) && $data.remoteField) {
                    const refPath = utils_1.absolute($data.path, itemPath);
                    let refSchema = yield this.getSchema(refPath);
                    if (((refSchema === null || refSchema === void 0 ? void 0 : refSchema.type) === 'array' && ((_b = refSchema === null || refSchema === void 0 ? void 0 : refSchema.items) === null || _b === void 0 ? void 0 : _b.type) === 'object') || ((refSchema === null || refSchema === void 0 ? void 0 : refSchema.type) === 'object')) {
                        refSchema = refSchema.items || refSchema;
                        refSchema = refSchema.properties[$data.remoteField];
                        const refValues = (yield this.get(itemPath)) || [];
                        const refPaths = Array.isArray(refValues) ? refValues : [refValues];
                        refPaths.forEach((refPath) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                            let refObject = (yield this.get(refPath, refSchema)) || [];
                            if ((refSchema === null || refSchema === void 0 ? void 0 : refSchema.type) === 'array') {
                                refObject[$data.remoteField] = (refObject[$data.remoteField] || []).filter(ref => !itemPath.startsWith(ref));
                                this.set(refPath, null, refObject);
                            }
                            else {
                                if (itemPath.startsWith(refObject[$data.remoteField])) {
                                    refObject[$data.remoteField] = '';
                                    this.set(refPath, null, refObject);
                                }
                            }
                        }));
                    }
                }
            }
            const result = yield this.dataSource.dispatch(methodName, itemPath, schema, value);
            if ((~['set', 'push'].indexOf(methodName))) {
                const $data = (schema === null || schema === void 0 ? void 0 : schema.$data) || ((_c = schema === null || schema === void 0 ? void 0 : schema.items) === null || _c === void 0 ? void 0 : _c.$data);
                if (($data === null || $data === void 0 ? void 0 : $data.path) && $data.remoteField) {
                    const refPath = utils_1.absolute($data.path, itemPath);
                    let refSchema = yield this.getSchema(refPath);
                    if (((refSchema === null || refSchema === void 0 ? void 0 : refSchema.type) === 'array' && ((_d = refSchema === null || refSchema === void 0 ? void 0 : refSchema.items) === null || _d === void 0 ? void 0 : _d.type) === 'object') || ((refSchema === null || refSchema === void 0 ? void 0 : refSchema.type) === 'object')) {
                        refSchema = refSchema.items || refSchema;
                        refSchema = refSchema.properties[$data.remoteField];
                        const refPaths = Array.isArray(value) ? value : [value];
                        refPaths.forEach((refPath) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                            let refObject = (yield this.get(refPath, refSchema)) || {};
                            if ((refSchema === null || refSchema === void 0 ? void 0 : refSchema.type) === 'array') {
                                refObject[$data.remoteField] = refObject[$data.remoteField] || [];
                                refObject[$data.remoteField].push(utils_1.absolute('..', itemPath));
                                this.set(refPath, null, refObject);
                            }
                            else {
                                refObject[$data.remoteField] = utils_1.absolute('..', itemPath);
                                this.set(refPath, null, refObject);
                            }
                        }));
                    }
                }
            }
            return result;
        });
    }
    render(methodName = 'get', itemPath = '', schema, value) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const propertySchema = schema || (yield this.getSchema(itemPath));
            const propertyValue = value || (yield this.dispatch('get', itemPath, propertySchema));
            if (this.renderer) {
                return yield this.renderer.render(methodName, itemPath, propertySchema, propertyValue, this);
            }
            return propertyValue;
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
            acc[`${p}/${fixedObjKey}`] = paths[key];
            return acc;
        }, {});
    }
    getProxyForPath(itemPath) {
        const schemaPath = itemPath !== undefined && itemPath !== null ? itemPath : '';
        return Object.keys(this.entryPoints).filter((k) => {
            return k.length ? RegExp(k).test(schemaPath) : true;
        }).map((foundKey) => {
            const objPath = schemaPath.replace(RegExp(foundKey), '');
            const parentPath = schemaPath.slice(0, schemaPath.length - objPath.length + 1);
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
        const proxy = this.proxies.find((p) => p.name === proxyInfo.proxyName);
        return proxy && proxy.dataSource;
    }
}
exports.Dispatcher = Dispatcher;
//# sourceMappingURL=dispatcher.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const utils_1 = require("../utils");
const datasource_1 = require("./datasource");
const json_1 = require("./json");
const jsonschema_1 = require("./jsonschema");
const path = require('path');
;
class Dispatcher extends datasource_1.DataSource {
    constructor(schema, data, renderer) {
        super();
        this.entryPoints = {};
        this.proxies = [];
        this.schemaSource = (typeof schema === 'string') ? new jsonschema_1.JsonSchema(schema) : schema;
        this.dataSource = (typeof data === 'string') ? new json_1.JsonDataSource(data) : data;
        this.renderer = renderer;
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
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            itemPath = itemPath !== undefined ? itemPath : '';
            const schema = propertySchema || (yield this.getSchema(itemPath));
            if (schema === undefined || (schema.readOnly === true && (~['set', 'push', 'del'].indexOf(methodName)))) {
                return;
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
            else if (methodName === 'get') {
                const property = (schema.type === 'array') ? schema.items : schema;
                if (property && property.$data && typeof property.$data === 'string') {
                    const absolutePath = utils_1.absolute(property.$data, itemPath);
                    const values = (yield this.dispatch('get', absolutePath)) || [];
                    property.$values = values.reduce((acc, curr, idx) => {
                        if (property.type === 'integer' || property.type === 'number') {
                            acc[idx] = curr;
                        }
                        else {
                            acc[`${absolutePath}/${curr._id || idx}`] = curr;
                        }
                        return acc;
                    }, {});
                }
                else {
                    if (schema.writeOnly === true) {
                        return;
                    }
                }
            }
            for (const proxy of this.getProxyForPath(itemPath).reverse()) {
                const { objPath, parentPath, proxyInfo } = proxy;
                const dataSource = this.getProxy(proxyInfo);
                if (dataSource && dataSource[methodName]) {
                    return yield dataSource.dispatch(methodName, objPath, schema, value, parentPath, proxyInfo.params);
                }
            }
            ;
            return yield this.dataSource.dispatch(methodName, itemPath, schema, value);
        });
    }
    render(methodName = 'get', itemPath = '', schema, value) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const propertySchema = schema || (yield this.getSchema(itemPath));
            const propertyValue = value || (yield this.dispatch('get', itemPath, propertySchema));
            if (this.renderer) {
                return yield this.renderer.render(methodName, itemPath, propertySchema, propertyValue);
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
            acc[`${path.join(p, fixedObjKey)}`] = paths[key];
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
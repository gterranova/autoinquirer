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
    getSchema(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            for (const proxy of this.getProxyForPath(options.itemPath).reverse()) {
                const { parentPath, proxyInfo } = proxy;
                const dataSource = this.getProxy(proxyInfo);
                if (dataSource) {
                    return yield dataSource.getSchema({ itemPath: options.itemPath, parentPath, params: proxyInfo.params }, this.schemaSource);
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
    registerProxy(name, dataSource) {
        this.proxies.push({ name, dataSource });
    }
    dispatch(methodName, options) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
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
                    const dataSource = this.getProxy(proxyInfo);
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
                const dataSource = this.getProxy(proxyInfo);
                if (dataSource && dataSource[methodName]) {
                    return yield dataSource.dispatch(methodName, { itemPath: objPath, schema, value, parentPath, params: proxyInfo.params });
                }
            }
            ;
            if ((~['set', 'push', 'del'].indexOf(methodName))) {
                const $data = ((_d = schema) === null || _d === void 0 ? void 0 : _d.$data) || ((_f = (_e = schema) === null || _e === void 0 ? void 0 : _e.items) === null || _f === void 0 ? void 0 : _f.$data);
                if (((_g = $data) === null || _g === void 0 ? void 0 : _g.path) && $data.remoteField) {
                    const refPath = utils_1.absolute($data.path, itemPath);
                    let refSchema = yield this.getSchema({ itemPath: refPath });
                    if ((((_h = refSchema) === null || _h === void 0 ? void 0 : _h.type) === 'array' && ((_k = (_j = refSchema) === null || _j === void 0 ? void 0 : _j.items) === null || _k === void 0 ? void 0 : _k.type) === 'object') || (((_l = refSchema) === null || _l === void 0 ? void 0 : _l.type) === 'object')) {
                        refSchema = refSchema.items || refSchema;
                        refSchema = refSchema.properties[$data.remoteField];
                        const refValues = (yield this.get({ itemPath })) || [];
                        const refPaths = Array.isArray(refValues) ? refValues : [refValues];
                        refPaths.forEach((refPath) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                            var _v;
                            let refObject = (yield this.get({ itemPath: refPath, schema: refSchema })) || [];
                            if (((_v = refSchema) === null || _v === void 0 ? void 0 : _v.type) === 'array') {
                                refObject[$data.remoteField] = (refObject[$data.remoteField] || []).filter(ref => !itemPath.startsWith(ref));
                                this.set({ itemPath: refPath, value: refObject });
                            }
                            else {
                                if (itemPath.startsWith(refObject[$data.remoteField])) {
                                    refObject[$data.remoteField] = '';
                                    this.set({ itemPath: refPath, value: refObject });
                                }
                            }
                        }));
                    }
                }
            }
            const result = yield this.dataSource.dispatch(methodName, { itemPath, schema, value });
            if ((~['set', 'push'].indexOf(methodName))) {
                const $data = ((_m = schema) === null || _m === void 0 ? void 0 : _m.$data) || ((_p = (_o = schema) === null || _o === void 0 ? void 0 : _o.items) === null || _p === void 0 ? void 0 : _p.$data);
                if (((_q = $data) === null || _q === void 0 ? void 0 : _q.path) && $data.remoteField) {
                    const refPath = utils_1.absolute($data.path, itemPath);
                    let refSchema = yield this.getSchema({ itemPath: refPath });
                    if ((((_r = refSchema) === null || _r === void 0 ? void 0 : _r.type) === 'array' && ((_t = (_s = refSchema) === null || _s === void 0 ? void 0 : _s.items) === null || _t === void 0 ? void 0 : _t.type) === 'object') || (((_u = refSchema) === null || _u === void 0 ? void 0 : _u.type) === 'object')) {
                        refSchema = refSchema.items || refSchema;
                        refSchema = refSchema.properties[$data.remoteField];
                        const refPaths = Array.isArray(value) ? value : [value];
                        refPaths.forEach((refPath) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                            var _w;
                            let refObject = (yield this.get({ itemPath: refPath, schema: refSchema })) || {};
                            if (((_w = refSchema) === null || _w === void 0 ? void 0 : _w.type) === 'array') {
                                refObject[$data.remoteField] = refObject[$data.remoteField] || [];
                                refObject[$data.remoteField].push(utils_1.absolute('..', itemPath));
                                this.set({ itemPath: refPath, schema: refObject });
                            }
                            else {
                                refObject[$data.remoteField] = utils_1.absolute('..', itemPath);
                                this.set({ itemPath: refPath, schema: refObject });
                            }
                        }));
                    }
                }
            }
            return result;
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
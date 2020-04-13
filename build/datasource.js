"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const _ = tslib_1.__importStar(require("lodash"));
const lodash_1 = require("lodash");
class AbstractDataSource {
    convertObjIDToIndex(path, basePath = '', obj, ...others) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!path) {
                return '';
            }
            const parts = typeof path === 'string' ? path.split('/') : path;
            const converted = [];
            let currentObj = obj || (yield this.dispatch.call(this, 'get', basePath, ...others));
            for (const key of parts) {
                if (Array.isArray(currentObj)) {
                    let idx = key;
                    if (/^[a-f0-9-]{24}$/.test(key)) {
                        const item = currentObj.find((itemObj) => {
                            return itemObj && itemObj._id === key;
                        });
                        if (!item) {
                            return [...converted, ...parts.slice(converted.length)].join('/');
                        }
                        idx = currentObj.indexOf(item).toString();
                    }
                    else {
                        const item = currentObj.find((itemObj) => {
                            return itemObj && itemObj.slug === key;
                        });
                        if (item) {
                            idx = currentObj.indexOf(item).toString();
                        }
                    }
                    converted.push(idx);
                    currentObj = currentObj[idx];
                    continue;
                }
                else if (lodash_1.isObject(currentObj) && currentObj[key]) {
                    converted.push(key);
                    currentObj = currentObj[key];
                    continue;
                }
                return [...converted, ...parts.slice(converted.length)].join('/');
            }
            return converted.join('/');
        });
    }
}
exports.AbstractDataSource = AbstractDataSource;
class AbstractDispatcher extends AbstractDataSource {
    convertPathToUri(path) {
        var _a, _b, _c;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const pathParts = path.split('/');
            let nextIsArrayItem = false;
            const result = [];
            let idx = 0;
            for (let key of pathParts) {
                const itemPath = pathParts.slice(0, ++idx).join('/');
                if (nextIsArrayItem && key != '#' && !/^[a-f0-9-]{24}$/.test(key)) {
                    const model = yield this.getDataSource(this).dispatch('get', { itemPath });
                    if (!model) {
                        return result.concat(pathParts.slice(idx - 1)).join('/');
                    }
                    nextIsArrayItem = false;
                    key = model._id;
                }
                const schema = yield this.getSchema({ itemPath });
                nextIsArrayItem = (((_a = schema) === null || _a === void 0 ? void 0 : _a.type) === 'array' && ((_c = (_b = schema) === null || _b === void 0 ? void 0 : _b.items) === null || _c === void 0 ? void 0 : _c.type) === 'object');
                result.push(key);
            }
            return result.filter(p => p).join('/');
        });
    }
    isMethodAllowed(methodName, schema) {
        if (schema === undefined || (schema.readOnly === true && (~['set', 'push', 'del'].indexOf(methodName)))) {
            return false;
        }
        else if (schema.writeOnly === true && methodName === 'get') {
            return false;
        }
        return true;
    }
    requestHasWildcards(options, wildcard = '#') {
        var _a;
        return (((_a = options) === null || _a === void 0 ? void 0 : _a.itemPath) && options.itemPath.indexOf(wildcard) != -1);
    }
    processWildcards(methodName, options, wildcard = '#') {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const base = options.itemPath.split(wildcard, 1)[0];
            const remaining = options.itemPath.slice(base.length + 1);
            const baseItems = (yield this.dispatch('get', Object.assign(Object.assign({}, options), { itemPath: base.replace(/\/$/, '') }))) || [];
            const result = yield Promise.all(baseItems.map((baseItem, idx) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c, _d, _e;
                let _fullPath = [base, remaining].join(baseItem._id || `${idx}`);
                if (remaining.indexOf(wildcard) == -1) {
                    if ((_c = (_b = (_a = options) === null || _a === void 0 ? void 0 : _a.schema) === null || _b === void 0 ? void 0 : _b.$data) === null || _c === void 0 ? void 0 : _c.remoteField) {
                        _fullPath = [_fullPath, options.schema.$data.remoteField].join('/');
                    }
                    const item = yield this.dispatch(methodName, Object.assign(Object.assign({}, options), { itemPath: _fullPath }));
                    if ((((_e = (_d = options) === null || _d === void 0 ? void 0 : _d.schema) === null || _e === void 0 ? void 0 : _e.items) || options.schema).type === 'object') {
                        return Object.assign({ _fullPath }, item);
                    }
                    return item;
                }
                return yield this.dispatch(methodName, Object.assign(Object.assign({}, options), { itemPath: [base, remaining].join(baseItem._id || `${idx}`) }));
            })));
            return _.flatten(result);
        });
    }
}
exports.AbstractDispatcher = AbstractDispatcher;
//# sourceMappingURL=datasource.js.map
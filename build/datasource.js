"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const _ = tslib_1.__importStar(require("lodash"));
const lodash_1 = require("lodash");
class AbstractDataSource {
    convertPathToUri(path) {
        var _a;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const pathParts = path.split('/');
            let nextIsArrayItem = false;
            const result = [];
            let idx = 0;
            for (let key of pathParts) {
                const itemPath = pathParts.slice(0, ++idx).join('/').replace(/\/$/, '');
                if (nextIsArrayItem && key != '#' && !/^[a-f0-9-]{24}$/.test(key)) {
                    const model = yield this.getDataSource(this).dispatch("get", { itemPath });
                    if (!model) {
                        return result.concat(pathParts.slice(idx - 1)).join('/');
                    }
                    nextIsArrayItem = false;
                    key = model._id || model.slug;
                }
                const schema = yield this.getSchema({ itemPath });
                nextIsArrayItem = ((schema === null || schema === void 0 ? void 0 : schema.type) === 'array' && ((_a = schema === null || schema === void 0 ? void 0 : schema.items) === null || _a === void 0 ? void 0 : _a.type) === 'object');
                result.push(key);
            }
            return result.filter(p => p).join('/');
        });
    }
    convertObjIDToIndex(path, basePath = '', obj, options) {
        var _a;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!path) {
                return { jsonObjectID: '' };
            }
            const parts = typeof path === 'string' ? path.split('/') : path;
            const converted = [];
            let currentObj = obj || (yield this.dispatch.call(this, "get", Object.assign(Object.assign({}, options), { itemPath: basePath })));
            const cursorData = {};
            const objResolver = (obj, idx) => obj[idx] && (`${basePath || ''}${[...parts.slice(0, converted.length - 1), obj[idx].slug || obj[idx]._id || idx].join('/')}`);
            for (const key of parts) {
                cursorData.index = undefined;
                if (Array.isArray(currentObj)) {
                    if (/^[a-f0-9-]{24}$/.test(key)) {
                        const item = currentObj.find((itemObj) => {
                            return itemObj && (itemObj._id === key);
                        });
                        if (!item) {
                            break;
                        }
                        cursorData.index = currentObj.indexOf(item);
                    }
                    else {
                        const item = currentObj.find((itemObj) => {
                            return itemObj && itemObj.slug === key;
                        });
                        if (item) {
                            cursorData.index = currentObj.indexOf(item);
                        }
                    }
                    converted.push(((_a = cursorData.index) === null || _a === void 0 ? void 0 : _a.toString()) || key);
                    if (converted.length == parts.length) {
                        Object.assign(cursorData, {
                            index: cursorData.index + 1,
                            total: currentObj.length,
                            self: objResolver(currentObj, cursorData.index),
                            first: (cursorData.index > 0 && objResolver(currentObj, 0)) || undefined,
                            prev: (cursorData.index > 0 && objResolver(currentObj, cursorData.index - 1)) || undefined,
                            next: (cursorData.index < currentObj.length - 1 && objResolver(currentObj, cursorData.index + 1)) || undefined,
                            last: (cursorData.index < currentObj.length - 1 && objResolver(currentObj, currentObj.length - 1)) || undefined,
                        });
                        currentObj = currentObj[cursorData.index - 1];
                    }
                    else {
                        currentObj = currentObj[cursorData.index];
                    }
                    continue;
                }
                else if (lodash_1.isObject(currentObj) && currentObj[key]) {
                    converted.push(key);
                    currentObj = currentObj[key];
                    continue;
                }
                break;
            }
            return Object.assign(Object.assign({}, cursorData), { jsonObjectID: `${basePath || ''}${[...converted, ...parts.slice(converted.length)].join('/')}` });
        });
    }
}
exports.AbstractDataSource = AbstractDataSource;
class AbstractDispatcher extends AbstractDataSource {
    requestHasWildcards(options, wildcard = '#') {
        return ((options === null || options === void 0 ? void 0 : options.itemPath) && options.itemPath.indexOf(wildcard) != -1);
    }
    processWildcards(methodName, options, wildcard = '#') {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const parts = options.itemPath.split(wildcard);
            const [base, remaining] = [parts[0], parts.slice(1).join(wildcard)];
            const baseOptions = Object.assign(Object.assign({}, options), { schema: { type: 'array', items: options.schema } });
            let baseItems = (yield this.dispatch("get", Object.assign(Object.assign({}, baseOptions), { itemPath: base.replace(/\/$/, '') }))) || [];
            const result = yield Promise.all(baseItems.map((baseItem, idx) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c;
                let _fullPath = [base, remaining].join(baseItem._id || baseItem.slug || `${idx}`);
                if (remaining.indexOf(wildcard) == -1) {
                    if ((_b = (_a = options === null || options === void 0 ? void 0 : options.schema) === null || _a === void 0 ? void 0 : _a.$data) === null || _b === void 0 ? void 0 : _b.remoteField) {
                        _fullPath = [_fullPath, options.schema.$data.remoteField].join('/');
                    }
                    const item = yield this.dispatch(methodName, { itemPath: _fullPath });
                    if ((((_c = options === null || options === void 0 ? void 0 : options.schema) === null || _c === void 0 ? void 0 : _c.items) || options.schema).type === 'object') {
                        return Object.assign({ _fullPath }, item);
                    }
                    return item;
                }
                return yield this.dispatch(methodName, { itemPath: [base, remaining].join(baseItem._id || baseItem.slug || `${idx}`) });
            })));
            return _.flatten(result);
        });
    }
}
exports.AbstractDispatcher = AbstractDispatcher;
//# sourceMappingURL=datasource.js.map
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = __importStar(require("lodash"));
const lodash_1 = require("lodash");
const utils_1 = require("./utils");
class AbstractDataSource {
    constructor() {
        this._id = utils_1.objectId();
    }
    setParent(parentDispatcher) {
        this.parentDispatcher = parentDispatcher;
    }
    canHandle(options) {
        return !!(options === null || options === void 0 ? void 0 : options.itemPath);
    }
    convertPathToUri(path) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const pathParts = path.split('/');
            let nextIsArrayItem = false;
            const result = [];
            let idx = 0;
            for (let key of pathParts) {
                const itemPath = pathParts.slice(0, ++idx).join('/').replace(/\/$/, '');
                if (nextIsArrayItem && key != '#' && !/^[a-f0-9-]{24}$/.test(key)) {
                    const model = yield this.getDataSource().dispatch("get", { itemPath });
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
    convertObjIDToIndex(options, basePath = '') {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (!(options === null || options === void 0 ? void 0 : options.itemPath)) {
                return { jsonObjectID: '' };
            }
            const { itemPath: path } = options;
            const parts = path.split('/');
            const converted = [];
            let currentObj = yield this.get({ itemPath: basePath, params: options.params });
            let parentObj = null;
            const cursorData = {};
            const objResolver = (obj, idx) => obj[idx] && (`${basePath || ''}${[...parts.slice(0, converted.length - 1), obj[idx].slug || obj[idx]._id || idx].join('/')}`);
            for (const key of parts) {
                cursorData.index = undefined;
                parentObj = currentObj;
                if (Array.isArray(currentObj)) {
                    if (/^[a-f0-9-]{24}$/.test(key)) {
                        const item = currentObj.find((itemObj) => {
                            return (itemObj === null || itemObj === void 0 ? void 0 : itemObj._id) === key;
                        });
                        if (!item) {
                            break;
                        }
                        cursorData.index = currentObj.indexOf(item);
                        currentObj = item;
                    }
                    else if (/^\d+$/.test(key)) {
                        cursorData.index = parseInt(key);
                        currentObj = currentObj[cursorData.index];
                    }
                    else {
                        const item = currentObj.find((itemObj) => {
                            return (itemObj === null || itemObj === void 0 ? void 0 : itemObj.slug) === key;
                        });
                        if (!item) {
                            break;
                        }
                        cursorData.index = currentObj.indexOf(item);
                        currentObj = item;
                    }
                    converted.push(((_a = cursorData.index) === null || _a === void 0 ? void 0 : _a.toString()) || key);
                    if (converted.length == parts.length) {
                        const schema = yield this.getSchemaDataSource().get({ itemPath: parts.slice(0, parts.length - 1).join('/') });
                        const $order = (schema === null || schema === void 0 ? void 0 : schema.$orderBy) || [];
                        let orderedMap = Array.from({ length: parentObj.length }).map((_o, idx) => idx);
                        if ($order.length) {
                            const order = _.zip(...$order.map(o => /^!/.test(o) ? [o.slice(1), 'desc'] : [o, 'asc']));
                            const orderedValues = _.orderBy(parentObj, ...order);
                            orderedMap = _.map(orderedValues, i => _.indexOf(_.map(parentObj, o => o._id), i._id));
                        }
                        Object.assign(cursorData, {
                            index: cursorData.index + 1,
                            total: parentObj.length,
                            self: objResolver(parentObj, cursorData.index),
                            first: (orderedMap.indexOf(cursorData.index) > 0 && objResolver(parentObj, orderedMap[0])) || undefined,
                            prev: (orderedMap[cursorData.index] > 0 && objResolver(parentObj, orderedMap[orderedMap.indexOf(cursorData.index) - 1])) || undefined,
                            next: (orderedMap[cursorData.index] < parentObj.length - 1 && objResolver(parentObj, orderedMap[orderedMap.indexOf(cursorData.index) + 1])) || undefined,
                            last: (orderedMap.indexOf(cursorData.index) < parentObj.length - 1 && objResolver(parentObj, orderedMap[parentObj.length - 1])) || undefined,
                        });
                    }
                }
                else if (lodash_1.isObject(currentObj) && currentObj[key]) {
                    converted.push(key);
                    currentObj = currentObj[key];
                }
                else
                    break;
            }
            return Object.assign(Object.assign({}, cursorData), { jsonObjectID: `${basePath || ''}${[...converted, ...parts.slice(converted.length)].join('/')}` });
        });
    }
}
exports.AbstractDataSource = AbstractDataSource;
class AbstractDispatcher extends AbstractDataSource {
    getDataSourceInfo(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return { dataSource: this, entryPointOptions: options };
        });
    }
    ;
    requestHasWildcards(options, wildcard = '#') {
        return ((options === null || options === void 0 ? void 0 : options.itemPath) && options.itemPath.indexOf(wildcard) != -1);
    }
    processWildcards(methodName, options, wildcard = '#') {
        return __awaiter(this, void 0, void 0, function* () {
            const parts = options.itemPath.split(wildcard);
            const [base, remaining] = [parts[0], parts.slice(1).join(wildcard)];
            const baseOptions = Object.assign(Object.assign({}, options), { schema: { type: 'array', items: options.schema } });
            let baseItems = (yield this.dispatch("get", Object.assign(Object.assign({}, baseOptions), { itemPath: base.replace(/\/$/, '') }))) || [];
            const result = yield Promise.all(baseItems.map((baseItem, idx) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c, _d;
                let _fullPath = [base, remaining].join(baseItem._id || baseItem.slug || `${idx}`);
                if (remaining.indexOf(wildcard) == -1) {
                    if ((_b = (_a = options === null || options === void 0 ? void 0 : options.schema) === null || _a === void 0 ? void 0 : _a.$data) === null || _b === void 0 ? void 0 : _b.remoteField) {
                        _fullPath = [_fullPath, options.schema.$data.remoteField].join('/');
                    }
                    const item = yield this.dispatch(methodName, { itemPath: _fullPath, value: options.value, params: options.params });
                    if (((_d = (((_c = options === null || options === void 0 ? void 0 : options.schema) === null || _c === void 0 ? void 0 : _c.items) || options.schema)) === null || _d === void 0 ? void 0 : _d.type) === 'object') {
                        return Object.assign({ _fullPath }, item);
                    }
                    return item;
                }
                return yield this.dispatch(methodName, { value: options.value, itemPath: [base, remaining].join(baseItem._id || baseItem.slug || `${idx}`), params: options.params });
            })));
            return _.flatten(result);
        });
    }
}
exports.AbstractDispatcher = AbstractDispatcher;
//# sourceMappingURL=datasource.js.map
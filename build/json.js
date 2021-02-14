"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const path_1 = require("path");
const _ = tslib_1.__importStar(require("lodash"));
const object_path_1 = tslib_1.__importDefault(require("object-path"));
const utils_1 = require("./utils");
const datasource_1 = require("./datasource");
class JsonDataSource extends datasource_1.AbstractDispatcher {
    constructor(data) {
        super();
        this.dataFile = (typeof data === 'string') ? path_1.resolve(process.cwd(), data) : undefined;
        this.jsonDocument = this.dataFile !== undefined ? utils_1.loadJSON(this.dataFile) : data;
    }
    connect(parentDispatcher) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.setParent(parentDispatcher);
        });
    }
    close() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.save();
        });
    }
    save() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (this.dataFile) {
                fs_1.default.writeFileSync(this.dataFile, JSON.stringify(this.jsonDocument, null, 2));
            }
        });
    }
    getSchemaDataSource() {
        if (!this.parentDispatcher) {
            return Object.assign(Object.assign({}, this), { get: (o) => this.getSchema(o) });
        }
        return this.parentDispatcher.getSchemaDataSource();
    }
    getDataSource() {
        return this;
    }
    getSchema(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!this.parentDispatcher) {
                return {};
            }
            const { parentPath, itemPath } = options;
            const newPath = [parentPath, itemPath].filter(p => p === null || p === void 0 ? void 0 : p.length).join('/');
            return yield this.parentDispatcher.getSchemaDataSource().get({ itemPath: newPath });
        });
    }
    isMethodAllowed(_methodName, _options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return true;
        });
    }
    get(options) {
        var _a, _b;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!(options === null || options === void 0 ? void 0 : options.itemPath)) {
                if (((_a = options === null || options === void 0 ? void 0 : options.schema) === null || _a === void 0 ? void 0 : _a.type) === 'array' && !Array.isArray(this.jsonDocument)) {
                    return this.jsonDocument ? [this.jsonDocument] : [];
                }
                return this.jsonDocument;
            }
            const { jsonObjectID: schemaPath } = yield this.convertObjIDToIndex(options);
            let schema = yield this.getSchemaDataSource().get({ itemPath: options.itemPath });
            let $order = [];
            if ((schema === null || schema === void 0 ? void 0 : schema.type) === 'array') {
                $order = schema.$orderBy || [];
            }
            else if ((schema === null || schema === void 0 ? void 0 : schema.type) === 'object') {
                schema = (_b = schema === null || schema === void 0 ? void 0 : schema.properties) === null || _b === void 0 ? void 0 : _b[path_1.basename(options.itemPath)];
                $order = (schema === null || schema === void 0 ? void 0 : schema.$orderBy) || [];
            }
            let value = object_path_1.default.get(this.jsonDocument, schemaPath.split('/'));
            if ($order.length) {
                const order = _.zip(...$order.map(o => /^!/.test(o) ? [o.slice(1), 'desc'] : [o, 'asc']));
                value = _.orderBy(value, ...order);
            }
            return value;
        });
    }
    push(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { itemPath, value } = options;
            if (value !== undefined) {
                if (_.isObject(value)) {
                    value._id = utils_1.objectId();
                }
                if (!itemPath) {
                    this.jsonDocument.push(value);
                }
                else {
                    const { jsonObjectID: schemaPath } = yield this.convertObjIDToIndex(options);
                    object_path_1.default.push(this.jsonDocument, schemaPath.split('/'), value);
                }
                this.save();
                return value;
            }
        });
    }
    set(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { itemPath, value } = options;
            if (value !== undefined) {
                if (!itemPath) {
                    this.jsonDocument = value;
                }
                else {
                    const { jsonObjectID: schemaPath } = yield this.convertObjIDToIndex(options);
                    object_path_1.default.set(this.jsonDocument, schemaPath.split('/'), value);
                }
                this.save();
            }
            return value;
        });
    }
    update(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { itemPath, value } = options;
            let newValue;
            if (value !== undefined) {
                if (!itemPath) {
                    newValue = _.merge(this.jsonDocument, value);
                }
                else {
                    const { jsonObjectID: schemaPath } = yield this.convertObjIDToIndex(options);
                    newValue = _.merge(object_path_1.default.get(this.jsonDocument, schemaPath.split('/')), value);
                    object_path_1.default.set(this.jsonDocument, schemaPath.split('/'), newValue);
                }
                this.save();
            }
            return newValue;
        });
    }
    delete(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { itemPath } = options;
            if (!itemPath) {
                this.jsonDocument = undefined;
                this.save();
                return;
            }
            const { jsonObjectID: schemaPath } = yield this.convertObjIDToIndex(options);
            object_path_1.default.del(this.jsonDocument, schemaPath.split('/'));
            this.save();
        });
    }
    delCascade({ itemPath }) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            itemPath;
        });
    }
    dispatch(methodName, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!this[methodName]) {
                throw new Error(`Method ${methodName} not implemented`);
            }
            if (this.requestHasWildcards(options)) {
                return yield this.processWildcards(methodName, options);
            }
            return yield this[methodName].call(this, options);
        });
    }
}
exports.JsonDataSource = JsonDataSource;
//# sourceMappingURL=json.js.map
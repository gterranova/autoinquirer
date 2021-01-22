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
    connect() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
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
    getSchemaDataSource(parentDispatcher) {
        return parentDispatcher.getSchemaDataSource();
    }
    getDataSource(_parentDispatcher) {
        return this;
    }
    getSchema(options, parentDispatcher) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { parentPath, itemPath } = options;
            const newPath = [parentPath, itemPath].filter(p => p === null || p === void 0 ? void 0 : p.length).join('/');
            return yield this.getSchemaDataSource(parentDispatcher).get({ itemPath: newPath });
        });
    }
    isMethodAllowed(_methodName, _options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return true;
        });
    }
    get(options) {
        var _a;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!(options === null || options === void 0 ? void 0 : options.itemPath)) {
                if (((_a = options === null || options === void 0 ? void 0 : options.schema) === null || _a === void 0 ? void 0 : _a.type) === 'array' && !Array.isArray(this.jsonDocument)) {
                    return this.jsonDocument ? [this.jsonDocument] : [];
                }
                return this.jsonDocument;
            }
            const { jsonObjectID: schemaPath } = yield this.convertObjIDToIndex(options.itemPath);
            return object_path_1.default.get(this.jsonDocument, schemaPath.split('/'));
        });
    }
    push({ itemPath, value }) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (value !== undefined) {
                if (_.isObject(value)) {
                    value._id = utils_1.objectId();
                }
                if (!itemPath) {
                    this.jsonDocument.push(value);
                }
                else {
                    const { jsonObjectID: schemaPath } = yield this.convertObjIDToIndex(itemPath);
                    object_path_1.default.push(this.jsonDocument, schemaPath.split('/'), value);
                }
                this.save();
                return value;
            }
        });
    }
    set({ itemPath, value }) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (value !== undefined) {
                if (!itemPath) {
                    this.jsonDocument = value;
                }
                else {
                    const { jsonObjectID: schemaPath } = yield this.convertObjIDToIndex(itemPath);
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
                    const { jsonObjectID: schemaPath } = yield this.convertObjIDToIndex(itemPath);
                    newValue = _.merge(object_path_1.default.get(this.jsonDocument, schemaPath.split('/')), value);
                    object_path_1.default.set(this.jsonDocument, schemaPath.split('/'), newValue);
                }
                this.save();
            }
            return newValue;
        });
    }
    del({ itemPath }) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!itemPath) {
                this.jsonDocument = undefined;
                this.save();
                return;
            }
            const { jsonObjectID: schemaPath } = yield this.convertObjIDToIndex(itemPath);
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
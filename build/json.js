"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const _ = tslib_1.__importStar(require("lodash"));
const object_path_1 = tslib_1.__importDefault(require("object-path"));
const utils_1 = require("./utils");
const datasource_1 = require("./datasource");
class JsonDataSource extends datasource_1.DataSource {
    constructor(data) {
        super();
        this.dataFile = (typeof data === 'string') ? data : undefined;
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
    getSchema(itemPath, schemaSource, _parentPath, _params) {
        return schemaSource.get(itemPath);
    }
    get(itemPath, schema) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!itemPath) {
                if (schema && schema.type === 'array' && !Array.isArray(this.jsonDocument)) {
                    return this.jsonDocument ? [this.jsonDocument] : [];
                }
                return this.jsonDocument;
            }
            if (itemPath.indexOf('#') != -1) {
                const base = itemPath.split('#', 1)[0];
                const remaining = itemPath.slice(base.length + 1);
                const baseItems = object_path_1.default.get(this.jsonDocument, (yield this.convertObjIDToIndex(base)).split('/').filter(p => p != '')) || [];
                const result = yield Promise.all(baseItems.map((baseItem) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    var _a;
                    let _fullPath = [base, remaining].join(baseItem._id);
                    if (remaining.indexOf('#') == -1) {
                        if ((_a = schema.$data) === null || _a === void 0 ? void 0 : _a.remoteField) {
                            _fullPath = [_fullPath, schema.$data.remoteField].join('/');
                        }
                        return Object.assign({ _fullPath }, yield this.get(_fullPath, schema));
                    }
                    return yield this.get([base, remaining].join(baseItem._id), schema);
                })));
                return _.flatten(result);
            }
            const schemaPath = yield this.convertObjIDToIndex(itemPath);
            return object_path_1.default.get(this.jsonDocument, schemaPath.split('/'));
        });
    }
    push(itemPath, _, value) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (value !== undefined) {
                if (utils_1.getType(value) === 'Object') {
                    value._id = utils_1.objectId();
                }
                if (!itemPath) {
                    this.jsonDocument.push(value);
                }
                else {
                    const schemaPath = yield this.convertObjIDToIndex(itemPath);
                    object_path_1.default.push(this.jsonDocument, schemaPath.split('/'), value);
                }
                this.save();
                return value;
            }
        });
    }
    set(itemPath, _, value) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (value !== undefined) {
                if (!itemPath) {
                    this.jsonDocument = value;
                }
                else {
                    const schemaPath = yield this.convertObjIDToIndex(itemPath);
                    object_path_1.default.set(this.jsonDocument, schemaPath.split('/'), value);
                }
                this.save();
            }
        });
    }
    update(itemPath, _, value) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (value !== undefined) {
                if (!itemPath) {
                    this.jsonDocument = Object.assign(Object.assign({}, this.jsonDocument), value);
                }
                else {
                    const schemaPath = yield this.convertObjIDToIndex(itemPath);
                    value = Object.assign(Object.assign({}, object_path_1.default.get(this.jsonDocument, schemaPath.split('/'))), value);
                    object_path_1.default.set(this.jsonDocument, schemaPath.split('/'), value);
                }
                this.save();
                return value;
            }
        });
    }
    del(itemPath) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!itemPath) {
                this.jsonDocument = undefined;
                this.save();
                return;
            }
            const schemaPath = yield this.convertObjIDToIndex(itemPath);
            object_path_1.default.del(this.jsonDocument, schemaPath.split('/'));
            this.save();
        });
    }
    delCascade(itemPath) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            itemPath;
        });
    }
    dispatch(methodName, itemPath, schema, value, parentPath, params) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!this[methodName]) {
                throw new Error(`Method ${methodName} not implemented`);
            }
            return yield this[methodName].call(this, itemPath, schema, value, parentPath, params);
        });
    }
}
exports.JsonDataSource = JsonDataSource;
//# sourceMappingURL=json.js.map
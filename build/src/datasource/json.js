"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const object_path_1 = tslib_1.__importDefault(require("object-path"));
const utils_1 = require("../utils");
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
    getSchema(_itemPath, _schemaSource, _parentPath, _params) {
        throw new Error("Method not implemented.");
    }
    get(itemPath) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!itemPath) {
                return this.jsonDocument;
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
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const _ = tslib_1.__importStar(require("lodash"));
const object_path_1 = tslib_1.__importDefault(require("object-path"));
const utils_1 = require("./utils");
const datasource_1 = require("./datasource");
class JsonDataSource extends datasource_1.AbstractDispatcher {
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
    getSchema(options, schemaSource) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { parentPath, itemPath } = options;
            const newPath = [parentPath, itemPath].filter(p => { var _a; return (_a = p) === null || _a === void 0 ? void 0 : _a.length; }).join('/');
            return yield schemaSource.get({ itemPath: newPath });
        });
    }
    get(options) {
        var _a, _b, _c;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!((_a = options) === null || _a === void 0 ? void 0 : _a.itemPath)) {
                if (((_c = (_b = options) === null || _b === void 0 ? void 0 : _b.schema) === null || _c === void 0 ? void 0 : _c.type) === 'array' && !Array.isArray(this.jsonDocument)) {
                    return this.jsonDocument ? [this.jsonDocument] : [];
                }
                return this.jsonDocument;
            }
            if (options.itemPath.indexOf('#') != -1) {
                const base = options.itemPath.split('#', 1)[0];
                const remaining = options.itemPath.slice(base.length + 1);
                const baseItems = object_path_1.default.get(this.jsonDocument, (yield this.convertObjIDToIndex(base)).split('/').filter(p => p != '')) || [];
                const result = yield Promise.all(baseItems.map((baseItem) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    var _d, _e;
                    let _fullPath = [base, remaining].join(baseItem._id);
                    if (remaining.indexOf('#') == -1) {
                        if ((_e = (_d = options.schema) === null || _d === void 0 ? void 0 : _d.$data) === null || _e === void 0 ? void 0 : _e.remoteField) {
                            _fullPath = [_fullPath, options.schema.$data.remoteField].join('/');
                        }
                        return Object.assign({ _fullPath }, yield this.get({ itemPath: _fullPath, schema: options.schema }));
                    }
                    return yield this.get({ itemPath: [base, remaining].join(baseItem._id), schema: options.schema });
                })));
                return _.flatten(result);
            }
            const schemaPath = yield this.convertObjIDToIndex(options.itemPath);
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
                    const schemaPath = yield this.convertObjIDToIndex(itemPath);
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
                    const schemaPath = yield this.convertObjIDToIndex(itemPath);
                    object_path_1.default.set(this.jsonDocument, schemaPath.split('/'), value);
                }
                this.save();
            }
        });
    }
    update(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { itemPath, value } = options;
            let newValue;
            if (value !== undefined) {
                if (!itemPath) {
                    newValue = this.jsonDocument = Object.assign(Object.assign({}, this.jsonDocument), value);
                }
                else {
                    const schemaPath = yield this.convertObjIDToIndex(itemPath);
                    newValue = Object.assign(Object.assign({}, object_path_1.default.get(this.jsonDocument, schemaPath.split('/'))), value);
                    object_path_1.default.set(this.jsonDocument, schemaPath.split('/'), newValue);
                }
                this.save();
                return newValue;
            }
        });
    }
    del({ itemPath }) {
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
            return yield this[methodName].call(this, options);
        });
    }
}
exports.JsonDataSource = JsonDataSource;
//# sourceMappingURL=json.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const path_1 = require("path");
const _ = tslib_1.__importStar(require("lodash"));
const moment_1 = tslib_1.__importDefault(require("moment"));
const object_path_1 = tslib_1.__importDefault(require("object-path"));
const utils_1 = require("./utils");
const datasource_1 = require("./datasource");
function mergeDeep(...objects) {
    const isObject = obj => obj && typeof obj === 'object';
    return objects.reduce((prev, obj) => {
        Object.keys(obj).forEach(key => {
            const pVal = prev[key];
            const oVal = obj[key];
            if (Array.isArray(pVal) && Array.isArray(oVal)) {
                _.each(oVal, v => {
                    const pArrayItem = _.find(pVal, { _id: v._id });
                    if (pArrayItem) {
                        const pIdx = pVal.indexOf(pArrayItem);
                        prev[key][pIdx] = mergeDeep(pArrayItem, v);
                    }
                    else {
                        if (!pVal.includes(v))
                            prev[key].push(v);
                    }
                });
            }
            else if (isObject(pVal) && isObject(oVal)) {
                prev[key] = mergeDeep(pVal, oVal);
            }
            else {
                prev[key] = oVal;
            }
        });
        return prev;
    }, {});
}
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
        return Object.assign(Object.assign({}, this), { get: (o) => this.getSchema(o) });
    }
    getDataSource() {
        return this;
    }
    getSchema(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            options = _.defaults(options, { itemPath: '', params: {} });
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
            const { archived } = ((options === null || options === void 0 ? void 0 : options.params) || {});
            const jsonDocument = archived ? utils_1.loadJSON(this.dataFile.replace('.json', '.archive.json')) : this.jsonDocument;
            if (!(options === null || options === void 0 ? void 0 : options.itemPath)) {
                if (((_a = options === null || options === void 0 ? void 0 : options.schema) === null || _a === void 0 ? void 0 : _a.type) === 'array' && !Array.isArray(jsonDocument)) {
                    return jsonDocument ? [jsonDocument] : [];
                }
                return jsonDocument;
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
            let value = object_path_1.default.get(jsonDocument, schemaPath.split('/'));
            if ($order.length) {
                const order = _.zip(...$order.map(o => /^!/.test(o) ? [o.slice(1), 'desc'] : [o, 'asc']));
                value = _.orderBy(value, ...order);
            }
            return value;
        });
    }
    push(options) {
        var _a;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { itemPath, schema } = options;
            let value = options.value;
            if (value !== undefined) {
                if ((schema === null || schema === void 0 ? void 0 : schema.type) === 'array' && ((_a = schema === null || schema === void 0 ? void 0 : schema.items) === null || _a === void 0 ? void 0 : _a.type) === 'object' && (value === null || value === void 0 ? void 0 : value._id)) {
                    value = this.prepareValue(Object.assign(Object.assign({}, options), { schema: schema.items }), { [value._id]: utils_1.objectId() }, true);
                }
                else if ((schema === null || schema === void 0 ? void 0 : schema.type) === 'object' && (value === null || value === void 0 ? void 0 : value._id)) {
                    throw new Error("Pushing to an object");
                }
                else if (_.isObject(value)) {
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
            else if (options.files) {
                const { jsonObjectID: schemaPath } = yield this.convertObjIDToIndex(options);
                const files = _.isArray(options.files.file) ? options.files.file : [options.files.file];
                const destFolder = path_1.join(path_1.dirname(this.dataFile), '_uploads', itemPath);
                if (!fs_1.default.existsSync(destFolder)) {
                    fs_1.default.mkdirSync(destFolder, { recursive: true });
                }
                const oldFiles = object_path_1.default.get(this.jsonDocument, schemaPath.split('/'));
                oldFiles && oldFiles.map(f => { if (fs_1.default.existsSync(f.path))
                    fs_1.default.unlinkSync(f.path); });
                value = yield Promise.all(files.map(file => new Promise((resolve, reject) => {
                    var source = fs_1.default.createReadStream(file.path);
                    const destFile = path_1.join(destFolder, file.name);
                    var dest = fs_1.default.createWriteStream(destFile);
                    source.pipe(dest);
                    source.on('end', function () {
                        fs_1.default.unlinkSync(file.path);
                        resolve(Object.assign(Object.assign({}, _.pick(file, ['name', 'size', 'type'])), { lastModifiedDate: moment_1.default(file.lastModifiedDate).toISOString(), path: destFile }));
                    });
                    source.on('error', function () {
                        console.log(`error copying ${file.path} to ${destFile}`);
                        reject();
                    });
                })));
                object_path_1.default.set(this.jsonDocument, schemaPath.split('/'), value);
                this.save();
                return value;
            }
        });
    }
    prepareValue(options, idsMap = {}, firstCall = false) {
        var _a;
        const { schema } = options;
        let value = options.value;
        if (schema.type === 'object') {
            if ((value === null || value === void 0 ? void 0 : value._id) && !(schema.$data || ((_a = schema.items) === null || _a === void 0 ? void 0 : _a.$data))) {
                value._id = idsMap[value._id] = idsMap[value._id] ? idsMap[value._id] : utils_1.objectId();
                if (firstCall && value.slug)
                    value.slug = value._id;
                _.keys(schema.properties).map(prop => {
                    if (prop == 'slug' && value.slug) {
                        value.slug = value._id;
                    }
                    else if (~['object', 'array'].indexOf(schema.properties[prop].type)) {
                        value[prop] = this.prepareValue(Object.assign(Object.assign({}, options), { schema: schema.properties[prop], value: value[prop] }), idsMap);
                    }
                });
            }
        }
        else if (schema.type === 'array' && _.isArray(value)) {
            value = value.map(item => this.prepareValue(Object.assign(Object.assign({}, options), { schema: schema.items, value: item }), idsMap));
        }
        if (firstCall) {
            value = value && JSON.parse(_.reduce(_.keys(idsMap), (acc, oldId) => {
                return acc.replace(RegExp(oldId, 'g'), idsMap[oldId]);
            }, JSON.stringify(value)));
        }
        return value;
    }
    set(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { itemPath, schema } = options;
            let value = options.value;
            if (value !== undefined) {
                if (!itemPath) {
                    this.jsonDocument = value;
                }
                else {
                    if ((schema === null || schema === void 0 ? void 0 : schema.type) === 'object' && (value === null || value === void 0 ? void 0 : value._id)) {
                        const oldValue = (yield this.dispatch("get", options));
                        value = this.prepareValue(options, { [value._id]: oldValue._id }, true);
                    }
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
    prepareArchiveValue(schemaPathArray, value) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const currentValue = schemaPathArray.length ? object_path_1.default.get(this.jsonDocument, schemaPathArray) : this.jsonDocument;
            if (!value) {
                value = currentValue;
            }
            if (!schemaPathArray.length) {
                return value;
            }
            const schema = yield this.getSchema({ itemPath: schemaPathArray.join('/') });
            const prop = schemaPathArray.pop();
            if (schema.type === 'array') {
                return this.prepareArchiveValue(schemaPathArray, { [prop]: _.isArray(value) ? value : [value] });
            }
            else if (schema.type === 'object') {
                if (/^[0-9]+$/.test(prop)) {
                    return this.prepareArchiveValue(schemaPathArray, [Object.assign(Object.assign({}, value), { _id: value._id || currentValue._id })]);
                }
                return this.prepareArchiveValue(schemaPathArray, { [prop]: Object.assign(Object.assign({}, value), { _id: value._id || currentValue._id }) });
            }
            return value;
        });
    }
    archive(options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!this.dataFile)
                return {};
            const archiveFile = this.dataFile.replace('.json', '.archive.json');
            let archive = utils_1.loadJSON(archiveFile);
            const { jsonObjectID: schemaPath } = yield this.convertObjIDToIndex(options);
            const value = yield this.prepareArchiveValue(schemaPath.length ? schemaPath.split('/') : []);
            fs_1.default.writeFileSync(archiveFile, JSON.stringify(mergeDeep(archive, value), null, 2));
            return { message: "ok", value };
        });
    }
    delCascade({ itemPath }) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            itemPath;
        });
    }
    dispatch(methodName, options) {
        var _a;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            options = _.defaults(options, { itemPath: '', params: {} });
            if (/^archived\/?/.test(options.itemPath)) {
                options.itemPath = options.itemPath.replace(/^archived\/?/, '');
                options.params = Object.assign(Object.assign({}, options.params), { archived: true });
            }
            if (((_a = options.params) === null || _a === void 0 ? void 0 : _a.archived) && methodName !== "get")
                throw new Error(`Method ${methodName} not implemented for archived items`);
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
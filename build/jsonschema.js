"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const json_schema_ref_parser_1 = tslib_1.__importDefault(require("@apidevtools/json-schema-ref-parser"));
const ajv_1 = tslib_1.__importDefault(require("ajv"));
const path_1 = tslib_1.__importDefault(require("path"));
const _ = tslib_1.__importStar(require("lodash"));
const utils_1 = require("./utils");
const datasource_1 = require("./datasource");
const defaultTypeValue = {
    'object': (value) => _.isObject(value) ? value : {},
    'array': (value) => _.isArray(value) ? value : [],
    'string': (value) => _.toString(value),
    'number': (value) => parseFloat(value) || 0,
    'integer': (value) => parseFloat(value) || 0,
    'boolean': (value) => (value === true || value === 'true' || value === 1 || value === '1' || value === 'yes')
};
class JsonSchema extends datasource_1.AbstractDataSource {
    constructor(data) {
        super();
        this.validator = new ajv_1.default({ coerceTypes: true });
        this.schemaData = (typeof data === 'string') ? utils_1.loadJSON(data) : data;
        this.basePath = (typeof data === 'string') ? path_1.default.resolve(path_1.default.dirname(data)) : path_1.default.resolve(path_1.default.dirname(utils_1.findUp('package.json', process.cwd())));
    }
    connect() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const parser = new json_schema_ref_parser_1.default();
            const currentPath = process.cwd();
            process.chdir(this.basePath);
            this.schemaData = yield parser.dereference(this.schemaData);
            process.chdir(currentPath);
        });
    }
    close() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
        });
    }
    get(options) {
        var _a, _b, _c, _d, _e;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let definition = this.schemaData;
            if (!((_b = (_a = options) === null || _a === void 0 ? void 0 : _a.itemPath) === null || _b === void 0 ? void 0 : _b.length)) {
                return definition;
            }
            const parts = options.itemPath.split('/');
            while (definition && parts.length) {
                const key = parts.shift();
                if (definition.type === 'array' && key === 'items' ||
                    (/^[a-f0-9-]{24}$/.test(key) || /^\d+$/.test(key) || /^#$/.test(key)) ||
                    ((_d = (_c = definition.items) === null || _c === void 0 ? void 0 : _c.properties) === null || _d === void 0 ? void 0 : _d.slug)) {
                    definition = definition.items;
                }
                else if (definition.type === 'object' && ((_e = definition.properties) === null || _e === void 0 ? void 0 : _e[key])) {
                    definition = definition.properties[key];
                }
                else if (definition.type === 'object' && key === 'properties') {
                    definition = definition.properties;
                }
                else if (definition.type === 'object' && definition.patternProperties) {
                    const patternFound = Object.keys(definition.patternProperties).find((pattern) => RegExp(pattern).test(key));
                    if (patternFound) {
                        definition = definition.patternProperties[patternFound];
                    }
                    else {
                        definition = undefined;
                    }
                }
                else {
                    definition = definition[key];
                }
            }
            return definition;
        });
    }
    coerce(schema, value) {
        if (schema.type && !Array.isArray(schema.type) && typeof defaultTypeValue[schema.type] === 'function') {
            if (value !== undefined || ((schema.type !== 'number' && schema.type !== 'integer') ||
                /^(\d+|\d*(\.\d+)?)$/.test(value))) {
                return defaultTypeValue[schema.type](value !== undefined ? value : schema.default);
            }
        }
        return value;
    }
    validate(schema, data) {
        if (schema === undefined) {
            return;
        }
        schema = Object.assign(Object.assign({}, schema), { $ref: undefined });
        const value = this.coerce(schema, data !== undefined ? data : schema.default);
        if (value !== schema.default && value !== undefined && (data !== undefined || schema.default !== undefined) && value.toString() !== (data !== undefined ? data : schema.default).toString()) {
            throw new Error(`Error: expecting an ${schema.type}`);
        }
        try {
            if (!this.validator.validate(schema, value)) {
                throw new Error(JSON.stringify(this.validator.errors, null, 2));
            }
            ;
        }
        catch (error) {
            if (!~error.message.indexOf("Converting circular structure to JSON")) {
                throw error;
            }
            ;
        }
        return value;
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
exports.JsonSchema = JsonSchema;
//# sourceMappingURL=jsonschema.js.map
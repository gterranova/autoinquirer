"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const json_schema_ref_parser_1 = tslib_1.__importDefault(require("@apidevtools/json-schema-ref-parser"));
const ajv_1 = tslib_1.__importDefault(require("ajv"));
const path_1 = tslib_1.__importDefault(require("path"));
const _ = tslib_1.__importStar(require("lodash"));
const moment_1 = tslib_1.__importDefault(require("moment"));
const utils_1 = require("./utils");
const datasource_1 = require("./datasource");
const defaultTypeValue = {
    'object': (value) => value !== undefined && _.isObject(value) ? value : {},
    'array': (value) => value !== undefined && _.isArray(value) ? value : [],
    'string': (value) => _.toString(value),
    'number': (value) => parseFloat(value) || 0,
    'integer': (value) => parseFloat(value) || 0,
    'boolean': (value) => (value === true || value === 'true' || value === 1 || value === '1' || value === 'yes'),
    'date': (value) => {
        const formats = ['DD/MM/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY'];
        const validFormat = _.find(formats, (f) => moment_1.default(value, f).isValid());
        return validFormat ? moment_1.default(value, validFormat).format("YYYY[-]MM[-]DD") : value;
    },
    'date-time': (value) => {
        const formats = ['DD/MM/YYYY HH:mm', 'YYYY-MM-DD HH:mm', 'DD-MM-YYYY HH:mm'];
        const validFormat = _.find(formats, (f) => moment_1.default(value, f).isValid());
        return validFormat ? moment_1.default(value, validFormat).format("YYYY[-]MM[-]DD[T]HH[:]mm[:]SS.000[Z]") : value;
    },
    'time': (value) => value
};
class JsonSchema extends datasource_1.AbstractDataSource {
    constructor(data) {
        super();
        this.validator = new ajv_1.default({ coerceTypes: true });
        this.schemaData = (typeof data === 'string') ? utils_1.loadJSON(data) : data;
        this.basePath = (typeof data === 'string') ? path_1.default.resolve(path_1.default.dirname(data)) : path_1.default.resolve(path_1.default.dirname(utils_1.findUp('package.json', process.cwd())));
    }
    connect(parentDispartcher) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const parser = new json_schema_ref_parser_1.default();
            const currentPath = process.cwd();
            process.chdir(this.basePath);
            this.schemaData = yield parser.dereference(this.schemaData);
            process.chdir(currentPath);
            this.setParent(parentDispartcher);
        });
    }
    close() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
        });
    }
    isMethodAllowed(methodName, options) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { schema } = options;
            if (schema === undefined || (schema.readOnly === true && (~["set", "push", "delete"].indexOf(methodName)))) {
                return false;
            }
            else if (schema.writeOnly === true && methodName === "get") {
                return false;
            }
            return true;
        });
    }
    get(options) {
        var _a, _b, _c, _d;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let definition = this.schemaData;
            if (!((_a = options === null || options === void 0 ? void 0 : options.itemPath) === null || _a === void 0 ? void 0 : _a.length)) {
                return definition;
            }
            const parts = options.itemPath.split('/');
            while (definition && parts.length) {
                const key = parts.shift();
                const parent = definition;
                if (definition.type === 'array' && key === 'items' ||
                    (/^[a-f0-9-]{24}$/.test(key) || /^\d+$/.test(key) || /^#$/.test(key)) ||
                    ((_c = (_b = definition.items) === null || _b === void 0 ? void 0 : _b.properties) === null || _c === void 0 ? void 0 : _c.slug)) {
                    definition = definition.items;
                }
                else if (definition.type === 'object' && ((_d = definition.properties) === null || _d === void 0 ? void 0 : _d[key])) {
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
                if (definition && !definition.$parent) {
                    Object.defineProperty(definition, '$parent', { get: () => parent, configurable: true });
                }
            }
            return definition;
        });
    }
    coerce(schema, value) {
        if (schema.type === 'string' && (schema.format === 'date' || schema.format === 'date-time')) {
            return defaultTypeValue[schema.format](value !== undefined ? value : schema.default);
        }
        else if (schema.type === 'object') {
            _.each(schema.properties || {}, (propSchema, key) => {
                if (value && value[key]) {
                    value[key] = this.coerce(propSchema, value[key]);
                }
            });
            return defaultTypeValue['object'](value || {});
        }
        else if (schema.type && !Array.isArray(schema.type) && typeof defaultTypeValue[schema.type] === 'function') {
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
        try {
            if (!this.validator.validate(schema, value)) {
                throw new ajv_1.default.ValidationError(this.validator.errors);
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
    getSchema(_options, _schemaSource) {
        throw new Error('Method not implemented.');
    }
    getSchemaDataSource(parentDispatcher) {
        return parentDispatcher.getSchemaDataSource();
    }
    getDataSource(_parentDispatcher) {
        return this;
    }
}
exports.JsonSchema = JsonSchema;
//# sourceMappingURL=jsonschema.js.map
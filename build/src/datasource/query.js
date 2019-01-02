"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../utils");
class Query {
    constructor(ds) {
        this.ds = ds;
    }
    query(itemPath, propertySchema) {
        this.promise = this.ds.dispatch('get', itemPath, propertySchema);
        return this;
    }
    transform(cb) {
        this.apply(cb);
        return this;
    }
    pluck(fields) {
        this.apply(this.pluckFn(fields));
        return this;
    }
    omit(fields) {
        this.apply(this.omitFn(fields));
        return this;
    }
    exec() {
        return this.promise;
    }
    apply(fn) {
        this.promise = this.promise.then((result) => {
            if (Array.isArray(result)) {
                return result.map(fn);
            }
            return fn(result);
        });
    }
    pluckFn(fields) {
        return (item) => {
            if (utils_1.getType(item) !== 'Object') {
                return item;
            }
            const filtered = {};
            fields.forEach((field) => {
                if (item[field] !== undefined) {
                    filtered[field] = item[field];
                }
                ;
            });
            return filtered;
        };
    }
    omitFn(fields) {
        return (item) => {
            if (utils_1.getType(item) !== 'Object') {
                return item;
            }
            const filtered = {};
            Object.keys(item).forEach((field) => {
                if (!~fields.indexOf(field)) {
                    filtered[field] = item[field];
                }
            });
            return filtered;
        };
    }
}
exports.Query = Query;
//# sourceMappingURL=query.js.map
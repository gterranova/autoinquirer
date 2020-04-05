"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const lodash_1 = require("lodash");
class AbstractDataSource {
    convertObjIDToIndex(path, basePath = '', obj, ...others) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!path) {
                return '';
            }
            const parts = typeof path === 'string' ? path.split('/') : path;
            const converted = [];
            let currentObj = obj || (yield this.dispatch.call(this, 'get', basePath, ...others));
            for (const key of parts) {
                if (Array.isArray(currentObj)) {
                    let idx = key;
                    if (/^[a-f0-9-]{24}$/.test(key)) {
                        const item = currentObj.find((itemObj) => {
                            return itemObj && itemObj._id === key;
                        });
                        if (!item) {
                            return [...converted, ...parts.slice(converted.length)].join('/');
                        }
                        idx = currentObj.indexOf(item).toString();
                    }
                    else {
                        const item = currentObj.find((itemObj) => {
                            return itemObj && itemObj.slug === key;
                        });
                        if (item) {
                            idx = currentObj.indexOf(item).toString();
                        }
                    }
                    converted.push(idx);
                    currentObj = currentObj[idx];
                    continue;
                }
                else if (lodash_1.isObject(currentObj) && currentObj[key]) {
                    converted.push(key);
                    currentObj = currentObj[key];
                    continue;
                }
                return [...converted, ...parts.slice(converted.length)].join('/');
            }
            return converted.join('/');
        });
    }
}
exports.AbstractDataSource = AbstractDataSource;
class AbstractDispatcher extends AbstractDataSource {
}
exports.AbstractDispatcher = AbstractDispatcher;
//# sourceMappingURL=datasource.js.map
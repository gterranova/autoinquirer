// tslint:disable:no-any
import fs from "fs";

export function flattenDeep(arr1: any[]) {
    return arr1.reduce((acc: any[], val: any) => Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val), []);
}

export const actualPath = (itemPath: string): string => {
    if (!itemPath) { return ''; }
    const parts = itemPath.split('§');
    if (parts.length > 1 && parts[parts.length-1].indexOf('/') === -1) {
        return actualPath(itemPath.slice(0, itemPath.lastIndexOf('§')-1));
    }

    return parts[parts.length-1];
};

export const backPath = (itemPath: string): string => {
    if (!itemPath) { return ''; }
    const parent = itemPath.lastIndexOf('/') !== -1 ? itemPath.slice(0, itemPath.lastIndexOf('/')) : '';
    const isComplexPath = parent.lastIndexOf('§') !== -1;
    if (isComplexPath && parent.slice(parent.lastIndexOf('§')).split('/').length === 1) {
        return backPath(parent);
    }

    return parent;
};


export function evalExpr(expression: string, context: any) {
    try {
        // tslint:disable-next-line:no-eval no-function-expression
        return (function() { return eval(expression); }).bind(context).call(context);
    } catch (e) {
        // tslint:disable-next-line:prefer-template
        console.warn('•Expression: {{x \'' + expression + '\'}}\n•JS-Error: ', e, '\n•Context: ', context);
        
        return;
    }    
}

export const ifObjectToArray = (obj: any, namedKey: string = '$name') => {
    if (Array.isArray(obj)) { return obj || []; }

    return Object.keys(obj).map( (key:string) => {
        // tslint:disable-next-line:no-string-literal
        const pair = {}; pair[namedKey] = obj[key][namedKey] || key;
        
        return {...obj[key], ...pair};
    });
}

export const ifArrayToObject = (arr: any, namedKey: string = '$name') => {
    if (!Array.isArray(arr)) { return arr || {}; }

    return arr.reduce( (acc: any, curr: any) => {
        acc[curr[namedKey]] = curr;

        return acc;
    },{});
}

// tslint:disable-next-line:no-any
export function loadJSON(fileName: string): any {
    if (fileName && fs.existsSync(fileName)) {
        const buffer: Buffer = fs.readFileSync(fileName);
        
        return JSON.parse(buffer.toString());
    }
    
    return undefined;
}

export function absolute(testPath: string, absolutePath: string) {
    if (testPath && testPath[0] === '/') { return testPath; }
    if (!testPath) { return absolutePath; }
    const p0 = absolutePath.split('/');
    const rel = testPath.split('/');
    while (rel.length) { 
        const t = rel.shift(); 
        if (t === '.') { continue; } 
        else if (t === '..') { if (p0) { p0.pop(); } } 
        else { p0.push(t) } 
    }

    return p0.join('/');
}

export function getType(value: any) {
    // tslint:disable-next-line:no-reserved-keywords
    const type = typeof value;
    if (type === 'object') {
        return value ? Object.prototype.toString.call(value).slice(8, -1) : 'null';
    }

    return type;
}


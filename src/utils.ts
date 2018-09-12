// tslint:disable:no-any

export function flattenDeep(arr1: any[]) {
    return arr1.reduce((acc: any[], val: any) => Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val), []);
}

export const actualPath = (itemPath: string | string[]) => {
    if (Array.isArray(itemPath)) { return itemPath; }
    const parts = itemPath.split('§');
    if (parts.length > 1 && parts[parts.length-1].indexOf('/') === -1) {
        return actualPath(itemPath.slice(0, itemPath.lastIndexOf('§')-1));
    }

    return parts[parts.length-1].split('/');
};

export const generalizedPath = (itemPath: string) => {
    return itemPath.replace(/\/[a-f0-9-]{36}/g, '/#').replace(/\/\d+/g, '/#');
};

export const backPath = (itemPath: string) => {
    const parent = itemPath.lastIndexOf('/') !== -1 ? itemPath.slice(0, itemPath.lastIndexOf('/')) : '';
    const isComplexPath = parent.lastIndexOf('§') !== -1;
    if (isComplexPath && parent.slice(parent.lastIndexOf('§')).split('/').length === 1) {
        return itemPath.slice(0, itemPath.lastIndexOf('§'));
    }

    return parent;
};

export const schemaPath = (itemPath: string) => {
    return itemPath.slice().replace(/\/[a-f0-9-]{36}/g, '').replace(/\/\d+/g, '');
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

export const dummyPrompt = (cb?: any) => {
    // tslint:disable-next-line:no-parameter-reassignment no-empty
    if (!cb) { cb = () => {}; }
    
    return { 
        when: (answers: any) => {
            cb(answers);

            return false;    
        },
        message: 'continue',
        type: 'confirm',
        name: 'confirm'
    }    
}

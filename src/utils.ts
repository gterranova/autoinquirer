// tslint:disable:no-any
import fs from "fs";

export const backPath = (itemPath: string): string => {
    if (!itemPath) { return ''; }
    const parts = itemPath.split('/');
    parts.pop();
    
    return parts.join('/');
};


export function evalExpr(expression: string, context: any): boolean {
    try {
        // tslint:disable-next-line:no-eval no-function-expression
        return (function() { return eval(expression); }).bind(context).call(context);
    } catch (e) {
        // tslint:disable-next-line:prefer-template
        console.warn('•Expression: {{x \'' + expression + '\'}}\n•JS-Error: ', e, '\n•Context: ', context);
        
        return true;
    }    
}

// tslint:disable-next-line:no-any
export function loadJSON(fileName: string): any {
    if (fileName && fs.existsSync(fileName)) {
        const buffer: Buffer = fs.readFileSync(fileName);
        
        return JSON.parse(buffer.toString());
    }
    
    return undefined;
}

export function absolute(testPath: string, absolutePath: string): string {
    if (testPath && testPath[0] === '/') { return testPath; }
    if (!testPath) { return absolutePath; }
    const p0 = absolutePath.split('/');
    const rel = testPath.split('/');
    while (rel.length) { 
        const t = rel.shift(); 
        if (t === '.') { continue; } 
        else if (t === '..') { 
            if (!p0.length) {  
                continue;
            }
            p0.pop(); 
        } else { p0.push(t) } 
    }

    return p0.join('/');
}

export function getType(value: any): string {
    // tslint:disable-next-line:no-reserved-keywords
    const type = typeof value;
    if (type === 'object') {
        return value ? Object.prototype.toString.call(value).slice(8, -1) : 'null';
    }

    return type;
}


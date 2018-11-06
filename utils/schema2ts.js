// tslint:disable:no-any
// tslint:disable:no-console
const fs = require('fs');
const program = require('commander');
const camelcase = require('camelcase');
const $RefParser = require('json-schema-ref-parser');

function getReturnType(entry, data, interfaces) {
    const baseName = data[entry].$ref? data[entry].$ref: entry; 
    let iName = camelcase(baseName.slice(baseName.lastIndexOf('/')+1).replace(/^\{\{([^}]*)[Ii]d\}\}/, '$1').replace('#','') || 'Root');
    iName = iName[0].toUpperCase()+iName.slice(1);
    if (data[entry].returnType === 'object[]') {
        return iName+'[]';
    } else if (data[entry].returnType === 'object') {
        let members = Object.keys(data)
            .filter( key => RegExp(`^${entry}\/`).test(key))
            .reduce( (acc, curr) => {
                const subKey = curr.replace(RegExp(`^${entry}\/`), '/');
                if (subKey) 
                    acc[subKey] = data[curr];
                return acc;
            }, {} );
        Object.keys(members).map( key => members[key] = getReturnType(key, members, interfaces));
        members = Object.keys(members).filter( key => key.split('/').length === 2).reduce( (acc, key) => {
            acc[key.slice(1)] = members[key];
            return acc;
        }, {});
        if (data[entry].hasPattern) {
            members['[key: string]'] = 'any';
        }
        interfaces[iName] = members;
        return iName;       
    }
    return data[entry].returnType.replace('integer', 'number');
}

function createApi(data, excludedTypes, maxDepth) {
    const interfaces = {};
    excludedTypes = excludedTypes || [];
    maxDepth = maxDepth || 100;
    const output = [
        "// tslint:disable:variable-name interface-name no-return-await no-any no-reserved-keywords prefer-template"
    ];
    const members = [`export abstract class ${program.className} {`];
    for (let entry of Object.keys(data)) {
        if (entry.split('/').length>maxDepth+1) {
            continue;
        }
        const name = entry.replace(/\/\{\{[^}]+\}\}/g,'').replace(/\//g,'-');
        const matches = entry.match(/\/\{\{([^}]+)/g);
        const params = matches? matches.map( e => e.slice(3)): [];
        const hasPattern = data[entry].hasPattern;
        let intepolatedEntry = entry.replace(/\{\{/g, '${').replace(/\}\}/g, '}');

        const returnType = getReturnType(entry, data, interfaces);
        if (~excludedTypes.indexOf(returnType)) { continue; }
        const funcParams = [...params.map( p=> `${p}: string`)]

        if (/\[\]$/.test(returnType) && data[entry].set) {
            const funcName = camelcase(`push${name}`);
            const baseType = returnType.replace(/\[\]$/, '');
            const funcParamsDef = [...funcParams, `value: ${baseType}`];

            const requestParams = ["'push'", `\`${intepolatedEntry}\``, 'value']
            members.push(`    public async ${funcName}(${funcParamsDef.join(', ')}): Promise<${baseType}> {`);
            members.push(`        return await this.request(${requestParams.join(', ')});`);
            members.push(`    }\n`);
        }
        if (hasPattern) {
            const funcName = camelcase(`${/\[\]$/.test(returnType)?'All':''}${name?name:'Root'}`);
            const funcParamsDef = [...funcParams, 'pattern: string'];
            const requestParams = ["'get'", `\`${intepolatedEntry+'/${pattern}'}\``]
            members.push(`    public async ${funcName}(${funcParamsDef.join(', ')}): Promise<any> {`);
            members.push(`        return await this.request(${requestParams.join(', ')});`);
            members.push(`    }\n`);
        } else if (data[entry].get) {
            const funcName = camelcase(`get${/\[\]$/.test(returnType)?'All':''}${name?name:'Root'}`);
            const requestParams = ["'get'", `\`${intepolatedEntry}\``]
            members.push(`    public async ${funcName}(${funcParams.join(', ')}): Promise<${returnType}> {`);
            members.push(`        return await this.request(${requestParams.join(', ')});`);
            members.push(`    }\n`);
        }
        if (data[entry].set) {
            const funcName = camelcase(`set${/\[\]$/.test(returnType)?'All':''}${name?name:'Root'}`);
            const funcParamsDef = [...funcParams, `value: ${returnType}`];
            const requestParams = ["'set'", `\`${intepolatedEntry}\``, 'value']
            members.push(`    public async ${funcName}(${funcParamsDef.join(', ')}): Promise<void> {`);
            members.push(`        await this.request(${requestParams.join(', ')});`);
            members.push(`    }\n`);
        }
    }
    members.push("    protected abstract request(method: string, itemPath: string, value?: any);");
    members.push("}\n");
    for (let iName of Object.keys(interfaces)) {
        output.push(`export interface ${iName} {`);
        for (let attr of Object.keys(interfaces[iName])) {
            const quotedAttr = ~attr.indexOf('-')? `'${attr}'`: attr;
            output.push(`    ${quotedAttr}: ${interfaces[iName][attr]};`);        
        }
        output.push(`}\n`);
    } 
    return [...output, ...members].join('\n');
}

function loadJSON(fileName) {
    if (fileName && fs.existsSync(fileName)) {
        const buffer = fs.readFileSync(fileName);
        return JSON.parse(buffer.toString());
    }
    
    return undefined;
}


function describe(p, schema, originalSchema) {
    let paths = {};
    if (!schema) { return {}; }
    paths[p] = { 
        returnType: schema.type === 'array'? `${schema.items.type}[]` : schema.type, 
        'get': schema.writeOnly !== true, 
        'set': schema.readOnly !== true,
        hasPattern: schema.patternProperties,
        '$ref': originalSchema && (schema.type === 'array'? originalSchema.items && originalSchema.items.$ref: originalSchema.$ref) 
    };

    if (schema.type=== 'object') {
        if (schema.properties) {
            Object.keys(schema.properties).map(key => {
                Object.assign(paths, describe(
                    `${p}/${key}`, 
                    Object.assign({}, schema.properties[key], { 
                        readOnly: schema.readOnly || schema.properties[key].readOnly, 
                        writeOnly: schema.writeOnly || schema.properties[key].writeOnly,
                        hasPattern: schema.patternProperties,
                        $ref: originalSchema && originalSchema.properties && originalSchema.properties.$ref 
                    }), 
                    (originalSchema && originalSchema.properties)? originalSchema.properties[key]: {}
                ));
            });
        }
    } else if (schema.type === 'array') {
        const lastPart = p.slice(p.lastIndexOf('/')+1);
        Object.assign(paths, describe(
            `${p}/{{${camelcase(lastPart+'-id')}}}`, 
            Object.assign({}, schema.items, { 
                readOnly: schema.readOnly, 
                writeOnly: schema.writeOnly,
                hasPattern: schema.patternProperties,
                $ref: originalSchema && originalSchema.items && originalSchema.items.$ref 
            }), 
            originalSchema? originalSchema.items : {}
        ));
    }
    return paths;
}

async function main() { // jshint ignore:line
    process.on('unhandledRejection', (err, p) => {
        console.log('An unhandledRejection occurred');
        console.log(`Rejected Promise: ${p}`);
        console.log(`Rejection:`, err);
    });

    const parser = new $RefParser();
    const originalSchema = loadJSON(program.args[0]);
    let jsonSchema = await parser.dereference(loadJSON(program.args[0])); // jshint ignore:line
    const apiTs = createApi(describe('', jsonSchema, originalSchema), program.exclude, parseInt(program.maxDepth, 10));
    if (program.outputFile) {
        fs.writeFileSync(program.outputFile, apiTs);
    } else {
        console.log(apiTs);
    }
}
  
program
  .version('1.0.0')
  .description('Example json editor')
  .arguments('<jsonfile>')
  .option('-o, --output-file [output.ts]', 'Output to file', 'output.ts')
  .option('-c, --class-Name [name]', 'Class name', 'BaseApi')
  .option('-e, --exclude [values]', 'Types to exclude', (val) => val.split(','), ['string','number','boolean'])
  .option('-d, --max-depth [value]', 'Max depth', 6)
  .parse(process.argv);

if (program.args.length < 1) {
    program.outputHelp();
} else {
    main();
}

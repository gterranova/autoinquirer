// tslint:disable-next-line:no-unused-expression
import path from 'path';
import { JsonSchema } from '../../src/datasource/index';

let defaultSchema;
beforeEach(() => {
    defaultSchema = new JsonSchema(path.join(process.cwd(), '__tests__', 'datasource', 'schema.json'));
});

describe('JsonSchema', () => {
    const schema = new JsonSchema(undefined);
    it('to be defined', () => {
        expect(schema).toBeDefined();
    });
    //it('schemaData to be undefined', () => {
    //    expect(schema.schemaData).not.toBeDefined();
    //});
    //it('validator to be defined', () => {
    //    expect(schema.validator).toBeDefined();
    //});
    it('abstract members to be defined', () => {
        expect(schema.connect).toBeDefined();
        expect(schema.get).toBeDefined();
        expect(schema.dispatch).toBeDefined();
    });
    it('convertObjIDToIndex', async () => {
        expect(schema.convertObjIDToIndex).toBeDefined();
    });
});

describe('constructor', () => {
    it('constructor to accept object', async () => {
        const schema = new JsonSchema({ type: 'string' });
        expect(await schema.get()).toEqual({ type: 'string' });
    });
    it('schemaData to undefined on not existent json file', () => {
        let schema;
        let exception;
        try {
            schema = new JsonSchema(path.join(process.cwd(), '__tests__', 'notexists.json'));
        } catch (e) {
            exception = e;
        }
        expect(exception).not.toBeDefined();
        expect(schema.schemaData).not.toBeDefined();
    });
    it('constructor to throw on malformed json file', () => {
        let exception;
        try {
            new JsonSchema(path.join(process.cwd(), '__tests__', 'malformed.json'));
        } catch (e) {
            exception = e;
        }
        expect(exception).toBeDefined();
    });
});

describe('connect', () => {
    it('to dereference $refs', async () => {
        await defaultSchema.connect();
        const data = await defaultSchema.get();
        expect(data.type).toBe('array'); 
    });
});

describe('close', () => {
    it('does nothing', () => {
        expect(defaultSchema.close).toBeDefined(); 
        expect(defaultSchema.close()).resolves.toBeFalsy(); 
    });
});

describe('coerce', () => {
    const schema = new JsonSchema({});
    it('to provide defaults', async () => {
        expect(schema.coerce({ type: 'object' }, 'a string')).toEqual({});
        expect(schema.coerce({ type: 'object' }, { name: 'a string'})).toEqual({ name: 'a string'});
        expect(schema.coerce({ type: 'array' }, 'a string')).toEqual([]);
        expect(schema.coerce({ type: 'array' }, ['a string'])).toEqual(['a string']);
        expect(schema.coerce({ type: 'string' }, 'a string')).toBe('a string');
        expect(schema.coerce({ type: 'string' }, 1)).toBe('1');
        expect(schema.coerce({ type: 'string' }, false)).toBe('false');
        expect(schema.coerce({ type: 'string' }, true)).toBe('true');
        expect(schema.coerce({ type: 'number' }, 'a string')).toBe(0);
        expect(schema.coerce({ type: 'integer' }, 'a string')).toBe(0);
        expect(schema.coerce({ type: 'number' }, '100')).toBe(100);
        expect(schema.coerce({ type: 'number' }, '10.12')).toBe(10.12);
        expect(schema.coerce({ type: 'number' }, '.12')).toBe(0.12);
        expect(schema.coerce({ type: 'boolean' }, 'a string')).toBe(false);
        expect(schema.coerce({ type: 'boolean' }, 'true')).toBe(true);
        expect(schema.coerce({ type: 'boolean' }, 'yes')).toBe(true);
        expect(schema.coerce({ type: 'boolean' }, '1')).toBe(true);
        expect(schema.coerce({ type: 'boolean' }, 1)).toBe(true);
        expect(schema.coerce({ type: 'boolean' }, 0)).toBe(false);

        expect(schema.coerce({ type: 'string' }, undefined)).toBe(undefined);
        expect(schema.coerce({ type: 'number' }, undefined)).toBe(undefined);

        expect(schema.coerce({}, 1234)).toBe(1234);
        expect(schema.coerce({ type: 'foo' }, 1234)).toBe(1234);
        expect(schema.coerce({ type: ['foo', 'bar'] }, 1234)).toBe(1234);
    });
});

describe('validate', () => {
    it('to validate input or throw error', async () => {
        await defaultSchema.connect();

        expect(()=>defaultSchema.validate({ type: 'object' }, 'a string')).toThrowError();
        expect(()=>defaultSchema.validate({ type: 'object' }, { name: 'a string'})).not.toThrowError();
        expect(()=>defaultSchema.validate({ type: 'array' }, 'a string')).toThrowError();
        expect(()=>defaultSchema.validate({ type: 'array' }, ['a string'])).not.toThrowError();
        expect(()=>defaultSchema.validate({ type: 'string' }, 'a string')).not.toThrowError();
        expect(()=>defaultSchema.validate({ type: 'string' }, 1)).not.toThrowError();
        expect(()=>defaultSchema.validate({ type: 'string' }, false)).not.toThrowError();
        expect(()=>defaultSchema.validate({ type: 'string' }, true)).not.toThrowError();
        expect(()=>defaultSchema.validate({ type: 'number' }, 'a string')).toThrowError();
        expect(()=>defaultSchema.validate({ type: 'integer' }, 'a string')).toThrowError();
        expect(()=>defaultSchema.validate({ type: 'number' }, '100')).not.toThrowError();
        expect(()=>defaultSchema.validate({ type: 'number' }, '10.12')).not.toThrowError();
        expect(()=>defaultSchema.validate({ type: 'number' }, '.12')).toThrowError();
        expect(()=>defaultSchema.validate({ type: 'boolean' }, 'a string')).toThrowError();
        expect(()=>defaultSchema.validate({ type: 'boolean' }, 'true')).not.toThrowError();
        expect(()=>defaultSchema.validate({ type: 'boolean' }, 'false')).not.toThrowError();
        expect(()=>defaultSchema.validate({ type: 'boolean' }, 'yes')).toThrowError();
        expect(()=>defaultSchema.validate({ type: 'boolean' }, '1')).toThrowError();
        expect(()=>defaultSchema.validate({ type: 'boolean' }, 1)).toThrowError();
        expect(()=>defaultSchema.validate({ type: 'boolean' }, 0)).toThrowError();

        expect(()=>defaultSchema.validate({ type: 'string' }, undefined)).toThrowError();
        expect(()=>defaultSchema.validate({ type: 'number' }, undefined)).toThrowError()
        expect(()=>defaultSchema.validate({ type: 'string', default: '' }, undefined)).not.toThrowError();
        expect(()=>defaultSchema.validate({ type: 'number', default: 0 }, undefined)).not.toThrowError()
        expect(()=>defaultSchema.validate({ type: 'number', default: '0' }, undefined)).not.toThrowError()

        expect(()=>defaultSchema.validate(undefined, 1234)).not.toThrowError();
        expect(defaultSchema.validate(undefined, 1234)).not.toBeDefined();
        expect(()=>defaultSchema.validate({}, 1234)).not.toThrowError();
        expect(()=>defaultSchema.validate({ type: 'foo' }, 1234)).toThrowError();

        expect(()=>defaultSchema.validate({ type: 'string', pattern: '^([A-Z]*)$' }, 'a string')).toThrowError();
    });
});

describe('dispatch', () => {
    it('dispatches method calls', async () => {
        const expected = await defaultSchema.dispatch('get', '');
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        const received = await defaultSchema.get('');
        expect(expected).toEqual(received);
    });

    it('throws if method does not exists', async () => {
        let exception;
        try {
            await defaultSchema.dispatch('foo', '')
        } catch (e) {
            exception = e;
        }
        expect(exception).toBeDefined();
    })
});

describe('dispatch', () => {
    it('walks array', async () => {
        await defaultSchema.connect();
        const received = await defaultSchema.dispatch('get', '#');
        const expected = "object";
        expect(received.type).toEqual(expected);
    });
    it('walks objects', async () => {
        await defaultSchema.connect();
        const received = await defaultSchema.dispatch('get', '#/uri');
        const expected = "string";
        expect(received.type).toBe(expected);
    });
    it('walks named properties', async () => {
        await defaultSchema.connect();
        const received = await defaultSchema.dispatch('get', '#/properties');
        const expected = "string";
        expect(received.uri.type).toBe(expected);
    });
    it('walks pattern properties', async () => {
        await defaultSchema.connect();
        let received = await defaultSchema.dispatch('get', '#/ABC');
        const expected = "boolean";
        expect(received.type).toBe(expected);
        received = await defaultSchema.dispatch('get', '#/abcNotInPattern');
        expect(received).not.toBeDefined();
    });
    it('returns undefined in any other case', async () => {
        await defaultSchema.connect();
        const received = await defaultSchema.dispatch('get', '#/another/hhh/sdsada');
        expect(received).not.toBeDefined();
    });
});
// tslint:disable-next-line:no-unused-expression
import fs from 'fs';
import path from 'path';
import { JsonDataSource } from '../../src/index';

const mockWrite = jest.spyOn(fs, 'writeFileSync');
let dsValues;
beforeEach(() => {
    dsValues = new JsonDataSource(path.join(process.cwd(), '__tests__', 'datasource', 'values.json'));
    mockWrite.mockReset();
});

describe('JsonDataSource', () => {
    const ds = new JsonDataSource({  test: 1 });
    it('to be defined', () => {
        expect(ds).toBeDefined();
    });
    it('abstract members to be defined', () => {
        expect(ds.connect).toBeDefined();
        expect(ds.get).toBeDefined();
        expect(ds.dispatch).toBeDefined();
    });
    it('convertObjIDToIndex', async () => {
        expect(ds.convertObjIDToIndex).toBeDefined();
    });
});

describe('constructor', () => {
    it('constructor to accept object', async () => {
        const ds0 = new JsonDataSource({ test: 1 });
        const value = await ds0.get();
        expect(value).toEqual({ test: 1 });
        //expect(ds0.dataFile).not.toBeDefined(); 
    });
    it('jsonDocument is udefined on not existent json file', async () => {
        let ds;
        let exception;
        try {
            ds = new JsonDataSource(path.join(process.cwd(), '__tests__', 'notexists.json'));
        } catch (e) {
            exception = e;
        }
        expect(exception).not.toBeDefined();
        expect(ds.dataFile).toBe(path.join(process.cwd(), '__tests__', 'notexists.json'));
        const newValue = await ds.get();
        expect(newValue).toEqual(undefined);
    });
    it('constructor to throw on malformed json file', () => {
        let exception;
        try {
            new JsonDataSource(path.join(process.cwd(), '__tests__', 'malformed.json'));
        } catch (e) {
            exception = e;
        }
        expect(exception).toBeDefined();
    });
});

describe('connect', () => {
    it('to be defined', () => {
        expect(dsValues.connect).toBeDefined();
        expect(dsValues.connect()).resolves.toBeFalsy(); 
    });
});

describe('close', () => {
    it('does nothing', () => {
        const ds = new JsonDataSource(path.join(process.cwd(), '__tests__', 'datasource', 'values.json'));
        expect(ds.close).toBeDefined(); 
        expect(ds.close()).resolves.toBeFalsy(); 
    });
});

describe('dispatch', () => {
    it('dispatches method calls', async () => {
        const expected = await dsValues.dispatch('get');
        const received = await dsValues.get();
        expect(expected).toEqual(received);
    });

    it('throws if method does not exists', async () => {
        let exception;
        try {
            await dsValues.dispatch('foo', '')
        } catch (e) {
            exception = e;
        }
        expect(exception).toBeDefined();
    })
});

describe('dispatch', () => {
    it('walks array', async () => {
        const received = await dsValues.dispatch('get', '0/another/foo');
        const expected = "bar";
        expect(received).toBe(expected);
    });
    it('walks objects', async () => {
        const received = await dsValues.dispatch('get', '0/uri');
        const expected = "test";
        expect(received).toBe(expected);
    });
    it('walks pattern properties', async () => {
        const received = await dsValues.dispatch('get', '0/ABC');
        const expected = true;
        expect(received).toBe(expected);
    });
    it('returns undefined in any other case', async () => {
        const received = await dsValues.dispatch('get', 'another/hhh/sdsada');
        expect(received).not.toBeDefined();
    });
});

describe('save', () => {
    it('does nothing if not dataFile', async () => {
        const ds1 = new JsonDataSource({});
        await ds1.save();
        expect(mockWrite).not.toBeCalled();
    });
});

describe('set', () => {
    it('does nothing if no value is provided', async () => {
        await dsValues.set('', null, undefined);
        expect(mockWrite).not.toHaveBeenCalled();
    });
    it('set a value', async () => {
        await dsValues.set('0/another/foo', null, 'baz');
        expect(mockWrite).toHaveBeenCalledTimes(1);
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        expect(dsValues.get('0/another/foo')).resolves.toBe('baz');
    });
    it('set a value', async () => {
        await dsValues.set(null, null, { baz: 1});
        expect(mockWrite).toHaveBeenCalledTimes(1);
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        expect(dsValues.get()).resolves.toEqual({ baz: 1});
    });
});

describe('push', () => {
    it('does nothing if no value is provided', async () => {
        await dsValues.push('', null, undefined);
        expect(mockWrite).not.toHaveBeenCalled();
    });
    it('push a value', async () => {
        await dsValues.push('0/myArray', null, 'baz');
        expect(mockWrite).toHaveBeenCalledTimes(1);
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        expect(dsValues.get('0/myArray')).resolves.toContain('baz');
    });
    it('set a value', async () => {
        await dsValues.set('0/myArray', null, ['baz']);
        expect(mockWrite).toHaveBeenCalledTimes(1);
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        const newValue = await dsValues.get('0/myArray');
        expect(newValue).toContain('baz');
        expect(newValue).toHaveLength(1);
    });
    it('pushes to root if no path is provided', async () => {
        const arrayDs = new JsonDataSource([]);
        await arrayDs.push(null, null, {'baz': 1});
        expect(mockWrite).not.toBeCalled();
        const newValue = await arrayDs.get();
        expect(newValue).toHaveLength(1);
        expect(newValue[0].baz).toBe(1);
    });
    it('adds _id to objects', async () => {
        await dsValues.push('0/myObjArray', null, {'baz': 1});
        expect(mockWrite).toHaveBeenCalledTimes(1);
        const newValue = await dsValues.get('0/myObjArray/0');
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        expect(newValue.baz).toBe(1);
        expect(newValue._id).toBeDefined();
        expect(newValue._id).toHaveLength(24);
    });
});

describe('del', () => {
    it('delete root if not pah is provided', async () => {
        await dsValues.del('', null);
        expect(mockWrite).toHaveBeenCalledTimes(1);
        const newValue = await dsValues.get('0/myArray');
        expect(newValue).not.toBeDefined();
    });
    it('del a value', async () => {
        await dsValues.del('0/myArray/0', null);
        expect(mockWrite).toHaveBeenCalledTimes(1);
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        const newValue = await dsValues.get('0/myArray');
        expect(newValue).not.toContain('A');
        expect(newValue).toHaveLength(2);
    });
    it('deletes whole element', async () => {
        await dsValues.del('0/myArray', null);
        expect(mockWrite).toHaveBeenCalledTimes(1);
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        const newValue = await dsValues.get('0/myArray');
        expect(newValue).not.toBeDefined();
    });
});


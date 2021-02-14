// tslint:disable-next-line:no-unused-expression
import fs from 'fs';
import path from 'path';
import { Dispatcher, JsonDataSource, JsonSchema } from '../../src/index';

const mockWrite = jest.spyOn(fs, 'writeFileSync');
let dispatcher;
beforeEach(async () => {
    dispatcher = new Dispatcher(path.join(process.cwd(), '__tests__', 'datasource', 'schema.json'), path.join(process.cwd(), '__tests__', 'datasource', 'values.json'));
    await dispatcher.connect(null);
    mockWrite.mockReset();
});

describe('Dispatcher', () => {
    it('to be defined', () => {
        expect(dispatcher).toBeDefined();
    });
    it('abstract members to be defined', () => {
        expect(dispatcher.connect).toBeDefined();
        expect(dispatcher.get).toBeDefined();
        expect(dispatcher.dispatch).toBeDefined();
    });
    it('convertObjIDToIndex', async () => {
        expect(dispatcher.convertObjIDToIndex).toBeDefined();
    });
});

describe('constructor', () => {
    it('constructor to accept object', async () => {
        const ds = new Dispatcher(
            new JsonSchema(path.join(process.cwd(), '__tests__', 'datasource', 'schema.json')),
            new JsonDataSource(path.join(process.cwd(), '__tests__', 'datasource', 'values.json'))
        );
        await ds.connect(null)
        const value = await ds.get();
        const schema = await ds.getSchema();
        expect(value).toEqual([{"_id": "5e8bb02edd0d6073701ab174", "ABC": true, "another": {"foo": "bar"}, "myArray": ["A", "B", "C"], "myObjArray": [], "uri": "test"}]);
        expect(value).toBeDefined(); 
        expect(schema).toBeDefined(); 
    });
    it('schemaSource and dataSource are defined on not existent json files', async () => {
        let ds;
        let exception;
        try {
            ds = new Dispatcher(path.join(process.cwd(), '__tests__', 'notexists.json'), path.join(process.cwd(), '__tests__', 'notexists.json'));
        } catch (e) {
            exception = e;
        }
        expect(exception).not.toBeDefined();
        expect(ds.schemaSource).toBeDefined(); 
        expect(ds.dataSource).toBeDefined(); 
        expect(ds.dataSource.dataFile).toBe(path.join(process.cwd(), '__tests__', 'notexists.json'));
    });
    it('dispatch returns undefined on not existent json files', async () => {
        let ds;
        let exception;
        try {
            ds = new Dispatcher(path.join(process.cwd(), '__tests__', 'notexists.json'), path.join(process.cwd(), '__tests__', 'notexists.json'));
        } catch (e) {
            exception = e;
        }
        expect(exception).not.toBeDefined();
        const newValue = await ds.get();
        expect(newValue).toEqual(undefined);
    });
    it('constructor to throw on malformed json file', () => {
        let exception;
        try {
            new Dispatcher(path.join(process.cwd(), '__tests__', 'malformed.json'), path.join(process.cwd(), '__tests__', 'malformed.json'));
        } catch (e) {
            exception = e;
        }
        expect(exception).toBeDefined();
    });
});

describe('connect', () => {
    it('to be defined', () => {
        expect(dispatcher.connect).toBeDefined();
        expect(dispatcher.connect()).resolves.toBeFalsy(); 
    });
    it('to fix wrong root type', async () => {
        const ds = new Dispatcher(
            new JsonSchema(path.join(process.cwd().replace('\\', '/'), '__tests__', 'datasource', 'arrschema.json')),
            new JsonDataSource({})
        );
        await ds.connect(null)
        const value = await ds.get();
        const schema = await ds.getSchema();
        expect(value).toEqual([{}]);
        expect(value).toBeDefined(); 
        expect(schema).toBeDefined(); 
    });
    it('calls connect on schema, data source and proxies', async () => {
        const schema = new JsonSchema(path.join(process.cwd(), '__tests__', 'datasource', 'schema.json'));
        const data = new JsonDataSource(path.join(process.cwd(), '__tests__', 'datasource', 'values.json'));
        const ds = new Dispatcher(schema, data);
        const proxyDs = new JsonDataSource({});
        ds.registerProxy({ name: 'myProxy', dataSource: proxyDs});
        const mockSchemaConnect = jest.spyOn(schema, 'connect');
        const mockDataConnect = jest.spyOn(schema, 'connect');
        const mockProxyConnect = jest.spyOn(proxyDs, 'connect');
        await ds.connect(null);
        expect(mockSchemaConnect).toHaveBeenCalled(); 
        expect(mockDataConnect).toHaveBeenCalled(); 
        expect(mockProxyConnect).toHaveBeenCalled(); 
    });
});

describe('close', () => {
    it('does nothing', () => {
        expect(dispatcher.close).toBeDefined(); 
        expect(dispatcher.close()).resolves.toBeFalsy(); 
    });
    it('calls close on schema, data source and proxies', async () => {
        const schema = new JsonSchema(path.join(process.cwd(), '__tests__', 'datasource', 'schema.json'));
        const data = new JsonDataSource(path.join(process.cwd(), '__tests__', 'datasource', 'values.json'));
        const ds = new Dispatcher(schema, data);
        const proxyDs = new JsonDataSource({});
        ds.registerProxy({ name: 'myProxy', dataSource: proxyDs});
        const mockSchemaClose = jest.spyOn(schema, 'close');
        const mockDataClose = jest.spyOn(schema, 'close');
        const mockProxyClose = jest.spyOn(proxyDs, 'close');
        await ds.close()
        expect(mockSchemaClose).toHaveBeenCalled(); 
        expect(mockDataClose).toHaveBeenCalled(); 
        expect(mockProxyClose).toHaveBeenCalled(); 
    });
});

describe('dispatch', () => {
    it('dispatches method calls', async () => {
        const expected = await dispatcher.dispatch('get');
        const received = await dispatcher.get();
        expect(expected).toEqual(received);
    });
    it('throws if method does not exists', async () => {
        let exception;
        try {
            await dispatcher.dispatch('foo', { itemPath: ''})
        } catch (e) {
            exception = e;
        }
        expect(exception).toBeDefined();
    })
    it('dispatched getSchema return schema', async () => {
        const received = await dispatcher.getSchema({ itemPath: '0/another/foo'});
        const expected = {type: "string"};
        expect(received).toStrictEqual(expected);
    });
    it('walks array', async () => {
        const received = await dispatcher.dispatch('get', { itemPath: '0/another/foo'});
        const expected = "bar";
        expect(received).toBe(expected);
    });
    it('walks objects', async () => {
        const received = await dispatcher.dispatch('get', { itemPath: '0/uri'});
        const expected = "test";
        expect(received).toBe(expected);
    });
    it('walks pattern properties', async () => {
        const received = await dispatcher.dispatch('get', { itemPath: '0/ABC'});
        const expected = true;
        expect(received).toBe(expected);
    });
    it('returns undefined in any other case', async () => {
        const received = await dispatcher.dispatch('get', { itemPath: 'another/hhh/sdsada'});
        expect(received).not.toBeDefined();
    });
    it('returns undefined on writeOnly gets', async () => {
        const received = await dispatcher.dispatch('get', { itemPath: '0/woTEST'});
        expect(received).not.toBeDefined();
    });
    it('routes calls to proxy', async () => {
        const proxyDs = new JsonDataSource({});
        const mockGetListener = jest.spyOn(proxyDs, 'get');
        dispatcher.registerProxy({ name: 'myProxy', dataSource: proxyDs});
        await dispatcher.connect(null);
        await dispatcher.get({ itemPath: '0/myDataProxy'});
        expect(mockGetListener).toHaveBeenCalledTimes(1);
        expect(mockGetListener.mock.calls[0][0].itemPath).toBe('');
        expect(mockGetListener.mock.calls[0][0].parentPath).toBe('0/myDataProxy');
    });
    it('does not route calls to proxy not in path', async () => {
        const proxyDs = new JsonDataSource({});
        const mockGetListener = jest.spyOn(proxyDs, 'get');
        dispatcher.registerProxy({ name: 'myProxy', dataSource: proxyDs});
        await dispatcher.connect(null);
        await dispatcher.get({ itemPath: '0/myLinkedArray'});
        expect(mockGetListener).not.toHaveBeenCalled();
    });
});

describe('set', () => {
    it('reset item if no value is provided', async () => {
        await dispatcher.set();
        expect(mockWrite).toHaveBeenCalled();
        expect(dispatcher.get()).resolves.toEqual([]);
    });
    it('set a value', async () => {
        await dispatcher.set({ itemPath: '0/another/foo', value: 'baz'});
        expect(mockWrite).toHaveBeenCalledTimes(1);
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        expect(dispatcher.get({ itemPath: '0/another/foo'})).resolves.toBe('baz');
    });
    it('set a value array', async () => {
        await dispatcher.connect();
        await dispatcher.set({ value: [{ uri: "test2"}]});
        expect(mockWrite).toHaveBeenCalledTimes(1);
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        expect(dispatcher.get()).resolves.toEqual([{ uri: "test2"}]);
    });
    it('set a value (wrong type 1, no additionalProperties)', async () => {
        expect(dispatcher.set({ value: [{ baz: 1}]})).rejects.toThrowError();
        expect(mockWrite).not.toHaveBeenCalled();
    });
    it('set a value (wrong type 2)', async () => {
        let exception;
        try { await dispatcher.set({ value: dispatcher.set({ value: { baz: 1}})}) } catch (e) {
            exception = e;
        }
        const value = await dispatcher.get();
        expect(exception).not.toBeDefined();
        expect(value).toEqual([]);
        expect(mockWrite).toHaveBeenCalled();
    });
});

describe('push', () => {
    it('pushes empty item if no value is provided', async () => {
        await dispatcher.dispatch('push');
        expect(mockWrite).toHaveBeenCalled();
        const value = await dispatcher.get({ itemPath: '1'});
        expect(value._id).toBeDefined();
    });
    it('push a value', async () => {
        await dispatcher.push({ itemPath: '0/myArray', value: 'baz'});
        expect(mockWrite).toHaveBeenCalledTimes(1);
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        expect(dispatcher.get({ itemPath: '0/myArray'})).resolves.toContain('baz');
    });
    it('set a value', async () => {
        await dispatcher.set({ itemPath: '0/myArray', value: ['baz']});
        expect(mockWrite).toHaveBeenCalledTimes(1);
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        const newValue = await dispatcher.get({ itemPath: '0/myArray'});
        expect(newValue).toContain('baz');
        expect(newValue).toHaveLength(1);
    });
    it('pushes to root if no path is provided', async () => {
        await dispatcher.push({ value: {'uri': "another uri"}});
        expect(mockWrite).toBeCalled();
        const newValue = await dispatcher.get({ itemPath: '1'});
        expect(newValue.uri).toBe("another uri");
    });
    it('adds _id to objects', async () => {
        await dispatcher.push({ itemPath: '0/myObjArray', value: {'uri': 'test'}});
        expect(mockWrite).toHaveBeenCalledTimes(1);
        const newValue = await dispatcher.get({ itemPath: '0/myObjArray/0'});
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        expect(newValue.uri).toBe('test');
        expect(newValue._id).toBeDefined();
        expect(newValue._id).toHaveLength(24);
    });
    it('resolves slugs', async () => {
        await dispatcher.push({ itemPath: '0/myObjArray', value: {'name': 'my test', 'slug': 'my-test'}});
        expect(mockWrite).toHaveBeenCalledTimes(1);
        expect(dispatcher.convertObjIDToIndex({ itemPath: '0/myObjArray/my-test'}))
            .resolves.toHaveProperty('jsonObjectID', '0/myObjArray/0');

        const newValue = await dispatcher.get({ itemPath: '0/myObjArray/my-test'});
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        expect(newValue.name).toBe('my test');
        expect(newValue._id).toBeDefined();
        expect(newValue._id).toHaveLength(24);
    });
});

describe('delete', () => {
    it('delete root if no path is provided', async () => {
        await dispatcher.delete();
        expect(mockWrite).toHaveBeenCalledTimes(1);
        const newValue = await dispatcher.get({ itemPath: '0/myArray'});
        expect(newValue).not.toBeDefined();
    });
    it('deleteCascade on proxies within the path', async () => {
        const proxyDs = new JsonDataSource({});
        proxyDs.delCascade = jest.fn();
        dispatcher.dataSource.delCascade = jest.fn();
        dispatcher.registerProxy({ name: 'myProxy', dataSource: proxyDs});
        await dispatcher.connect();
        await dispatcher.delete();
        expect(mockWrite).toHaveBeenCalledTimes(1);
        expect(proxyDs.delCascade).toHaveBeenCalledTimes(1);
        expect(dispatcher.dataSource.delCascade).toHaveBeenCalledTimes(1);
        const newValue = await dispatcher.get({ itemPath: '0/myArray'});
        expect(newValue).not.toBeDefined();
    });
    it('del a value', async () => {
        await dispatcher.delete({ itemPath: '0/myArray/0' });
        expect(mockWrite).toHaveBeenCalledTimes(1);
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        const newValue = await dispatcher.get({ itemPath: '0/myArray'});
        expect(newValue).not.toContain('A');
        expect(newValue).toHaveLength(2);
    });
    it('deletes whole element', async () => {
        await dispatcher.delete({ itemPath: '0/myArray' });
        expect(mockWrite).toHaveBeenCalledTimes(1);
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        const newValue = await dispatcher.get({ itemPath: '0/myArray'});
        expect(newValue).not.toBeDefined();
    });
});
describe('dispatch with wildcards', () => {
    it('return array for paths with wildcards', async () => {
        await dispatcher.push({ value: { myArray: ['A'] }});
        const value = await dispatcher.get({ itemPath: '#/myArray' });
        expect(value).toHaveLength(4);
        expect(value[0]).not.toHaveProperty('_fullPath');
    });
    it('adds a property _fullPath for paths with wildcards', async () => {
        await dispatcher.set({ itemPath: '0/foo', value: []});
        await dispatcher.push({ value: { foo: [] }});
        await dispatcher.push({ value: { foo: [] }});
        await dispatcher.push({ itemPath: '0/foo', value: { bar: { baz: 'aaa'}} });
        await dispatcher.push({ itemPath: '1/foo', value: { bar: { baz: 'bbb'}} });
        await dispatcher.push({ itemPath: '2/foo', value: { bar: { baz: 'ccc'}} });
        const value = await dispatcher.get({ itemPath: '#/foo/#/bar' });
        expect(value).toHaveLength(3);
        expect(value[0]).toHaveProperty('_fullPath');
        expect(value[0].baz).toStrictEqual('aaa');
    });    
    it('set bulk for paths with wildcards', async () => {
        await dispatcher.set({ itemPath: '0/foo', value: []});
        await dispatcher.push({ value: { foo: [] }});
        await dispatcher.push({ value: { foo: [] }});
        await dispatcher.push({ itemPath: '0/foo', value: { bar: { baz: 'aaa'}} });
        await dispatcher.push({ itemPath: '1/foo', value: { bar: { baz: 'bbb'}} });
        await dispatcher.push({ itemPath: '2/foo', value: { bar: { baz: 'ccc'}} });
        await dispatcher.set({ itemPath: '#/foo/#/bar', value: { baz: 'changed'} });
        const value = await dispatcher.get({ itemPath: '#/foo/#/bar' });

        expect(value).toHaveLength(3);
        expect(value[0]).toHaveProperty('_fullPath');
        expect(value[2].baz).toStrictEqual('changed');
    });    
});
describe('proxies', () => {
    it('registerProxy is defined', () => {
        expect(dispatcher.registerProxy).toBeDefined();     
    });
    it('registerProxy adds proxies', () => {
        const proxyDs = new JsonDataSource({});
        dispatcher.registerProxy({ name: 'myProxy', dataSource: proxyDs});
        expect(dispatcher.proxies).toHaveLength(1);     
    });
    it('registerProxy does not init proxies at registration', () => {
        dispatcher.registerProxy({ name: 'myProxy', classRef: JsonDataSource});
        expect(dispatcher.proxies[0].dataSource).not.toBeInstanceOf(JsonDataSource);     
    });
    it('getProxy retrieves proxy by proxyInfo', () => {
        const proxyDs = new JsonDataSource({});
        dispatcher.registerProxy({ name: 'myProxy', dataSource: proxyDs});
        expect(dispatcher.getProxy({ proxyName: 'myProxy'})).resolves.toBe(proxyDs);     
    });
    it('getProxy init proxies at registration', () => {
        dispatcher.registerProxy({ name: 'myProxy', classRef: JsonDataSource});
        expect(dispatcher.getProxy({ proxyName: 'myProxy'})).resolves.toBeInstanceOf(JsonDataSource);     
    });
    it('findEntryPoints retrieves proxyInfos', async () => {
        const schema = await dispatcher.getSchema();
        const entryPoints = dispatcher.findEntryPoints('', schema);
        expect(Object.keys(entryPoints)).toHaveLength(3);
        expect(entryPoints['(#|\\d+|[a-f0-9-]{24})/myDataProxy']).toEqual({ proxyName: 'myProxy', params: {} });     
    });
    it('findEntryPoints retrieves proxyInfos relative to provided path', async () => {
        const schema = await dispatcher.getSchema();
        const entryPoints = dispatcher.findEntryPoints('', schema.items.properties.myDataProxy);
        expect(Object.keys(entryPoints)).toHaveLength(1);     
        expect(entryPoints['']).toEqual({ proxyName: 'myProxy', params: {} });     
    });
    it('getProxyWithinPath retrieves proxyInfos within path', async () => {
        const paths = dispatcher.getProxyWithinPath();
        expect(paths).toHaveLength(3);     
        expect(paths.map(p => p.proxyName)).toContain('dummyProxy');     
        expect(paths.map(p => p.proxyName)).toContain('myProxy');     
        expect(paths.map(p => p.proxyName)).toContain('myObjProxy');     
    });
});

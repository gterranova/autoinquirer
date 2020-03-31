// tslint:disable-next-line:no-unused-expression
import fs from 'fs';
import path from 'path';
import { Dispatcher, JsonDataSource, JsonSchema, DataRenderer, DataSource } from '../../src/datasource/index';

const mockWrite = jest.spyOn(fs, 'writeFileSync');
let dispatcher;
beforeEach(async () => {
    dispatcher = new Dispatcher(path.join(process.cwd(), '__tests__', 'datasource', 'schema.json'), path.join(process.cwd(), '__tests__', 'datasource', 'values.json'));
    await dispatcher.connect();
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
        await ds.connect()
        const value = await ds.get();
        const schema = await ds.getSchema();
        expect(value).toEqual([{"ABC": true, "another": {"foo": "bar"}, "myArray": ["A", "B", "C"], "myObjArray": [], "uri": "test"}]);
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
            new JsonSchema(path.join(process.cwd().replace('\\', '/'), /*'__tests__', 'datasource',*/ 'schema.json')),
            new JsonDataSource({})
        );
        await ds.connect()
        const value = await ds.get();
        const schema = await ds.getSchema();
        expect(value).toEqual([]);
        expect(value).toBeDefined(); 
        expect(schema).toBeDefined(); 
    });
    it('calls connect on schema, data source and proxies', async () => {
        const schema = new JsonSchema(path.join(process.cwd(), '__tests__', 'datasource', 'schema.json'));
        const data = new JsonDataSource(path.join(process.cwd(), '__tests__', 'datasource', 'values.json'));
        const ds = new Dispatcher(schema, data);
        const proxyDs = new JsonDataSource({});
        ds.registerProxy('myProxy', proxyDs);
        const mockSchemaConnect = jest.spyOn(schema, 'connect');
        const mockDataConnect = jest.spyOn(schema, 'connect');
        const mockProxyConnect = jest.spyOn(proxyDs, 'connect');
        await ds.connect()
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
        ds.registerProxy('myProxy', proxyDs);
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
            await dispatcher.dispatch('foo', '')
        } catch (e) {
            exception = e;
        }
        expect(exception).toBeDefined();
    })
    it('walks array', async () => {
        const received = await dispatcher.dispatch('get', '0/another/foo');
        const expected = "bar";
        expect(received).toBe(expected);
    });
    it('walks objects', async () => {
        const received = await dispatcher.dispatch('get', '0/uri');
        const expected = "test";
        expect(received).toBe(expected);
    });
    it('walks pattern properties', async () => {
        const received = await dispatcher.dispatch('get', '0/ABC');
        const expected = true;
        expect(received).toBe(expected);
    });
    it('returns undefined in any other case', async () => {
        const received = await dispatcher.dispatch('get', 'another/hhh/sdsada');
        expect(received).not.toBeDefined();
    });
    it('returns undefined on writeOnly gets', async () => {
        const received = await dispatcher.dispatch('get', '0/woTEST');
        expect(received).not.toBeDefined();
    });
    it('adds $values on $data link reference', async () => {
        await dispatcher.push('0/myObjArray', null, {'name': 'test'});
        expect(mockWrite).toHaveBeenCalledTimes(1);
        await dispatcher.get('0/myLinkedArray');
        const schema = await dispatcher.getSchema('0/myLinkedArray');
        expect(Object.keys(schema.items.$values)).toHaveLength(1);
        // console.log(Object.keys(schema.items.$values)[0]);
        expect(/^0\/myObjArray\/[a-f0-9]{24}$/.test(Object.keys(schema.items.$values)[0])).toBe(true);
    });
    it('adds $values on $data link reference (obj without _id)', async () => {
        await dispatcher.push('0/myObjArray', null, {'name': 'test'});
        await dispatcher.set('0/myObjArray/0', null, {'name': 'test'});
        expect(mockWrite).toHaveBeenCalledTimes(2);
        await dispatcher.get('0/myLinkedArray');
        const schema = await dispatcher.getSchema('0/myLinkedArray');
        expect(Object.keys(schema.items.$values)).toHaveLength(1);
        // console.log(Object.keys(schema.items.$values)[0]);
        expect(/^0\/myObjArray\/0$/.test(Object.keys(schema.items.$values)[0])).toBe(true);
    });
    it('adds $values on $data link reference (number)', async () => {
        await dispatcher.push('0/myObjArray', null, {'name': 'test'});
        expect(mockWrite).toHaveBeenCalledTimes(1);
        await dispatcher.get('0/myNumberLinkedArray');
        const schema = await dispatcher.getSchema('0/myNumberLinkedArray');
        expect(Object.keys(schema.items.$values)).toHaveLength(1);
        // console.log(Object.keys(schema.items.$values)[0]);
        expect(Object.keys(schema.items.$values)[0]).toBe('0');
    });
    it('adds $values on $data link reference (undefined link)', async () => {
        await dispatcher.get('0/myUndefinedLinkedArray');
        const schema = await dispatcher.getSchema('0/myUndefinedLinkedArray');
        expect(Object.keys(schema.items.$values)).toBeDefined();
        expect(Object.keys(schema.items.$values)).toHaveLength(0);
    });
    it('routes calls to proxy', async () => {
        const proxyDs = new JsonDataSource({});
        const mockGetListener = jest.spyOn(proxyDs, 'get');
        dispatcher.registerProxy('myProxy', proxyDs);
        await dispatcher.connect();
        await dispatcher.get('0/myDataProxy');
        expect(mockGetListener).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(mockGetListener.mock.calls[0])).toBe('["",{"type":"array","$proxy":{"proxyName":"myProxy","params":{}}},null,"0/myDataProxy",{}]');
    });
    it('does not route calls to proxy not in path', async () => {
        const proxyDs = new JsonDataSource({});
        const mockGetListener = jest.spyOn(proxyDs, 'get');
        dispatcher.registerProxy('myProxy', proxyDs);
        await dispatcher.connect();
        await dispatcher.get('0/myLinkedArray');
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
        await dispatcher.set('0/another/foo', null, 'baz');
        expect(mockWrite).toHaveBeenCalledTimes(1);
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        expect(dispatcher.get('0/another/foo')).resolves.toBe('baz');
    });
    it('set a value array', async () => {
        await dispatcher.connect();
        await dispatcher.set(null, null, [{ uri: "test2"}]);
        expect(mockWrite).toHaveBeenCalledTimes(1);
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        expect(dispatcher.get()).resolves.toEqual([{ uri: "test2"}]);
    });
    it('set a value (wrong type 1, no additionalProperties)', async () => {
        let exception;
        try { await dispatcher.set(null, null, [{ baz: 1}]) } catch (e) {
            exception = e;
        }
        expect(exception).toBeDefined();
        expect(mockWrite).not.toHaveBeenCalled();
    });
    it('set a value (wrong type 2)', async () => {
        let exception;
        try { await dispatcher.set(null, null, dispatcher.set(null, null, { baz: 1})) } catch (e) {
            exception = e;
        }
        expect(exception).toBeDefined();
        expect(mockWrite).not.toHaveBeenCalled();
    });
});

describe('push', () => {
    it('pushes empty item if no value is provided', async () => {
        await dispatcher.push(null, null, undefined);
        expect(mockWrite).toHaveBeenCalled();
        const value = await dispatcher.get('1');
        expect(value._id).toBeDefined();
    });
    it('push a value', async () => {
        await dispatcher.push('0/myArray', null, 'baz');
        expect(mockWrite).toHaveBeenCalledTimes(1);
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        expect(dispatcher.get('0/myArray')).resolves.toContain('baz');
    });
    it('set a value', async () => {
        await dispatcher.set('0/myArray', null, ['baz']);
        expect(mockWrite).toHaveBeenCalledTimes(1);
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        const newValue = await dispatcher.get('0/myArray');
        expect(newValue).toContain('baz');
        expect(newValue).toHaveLength(1);
    });
    it('pushes to root if no path is provided', async () => {
        await dispatcher.push(null, null, {'uri': "another uri"});
        expect(mockWrite).toBeCalled();
        const newValue = await dispatcher.get('1');
        expect(newValue.uri).toBe("another uri");
    });
    it('adds _id to objects', async () => {
        await dispatcher.push('0/myObjArray', null, {'baz': 1});
        expect(mockWrite).toHaveBeenCalledTimes(1);
        const newValue = await dispatcher.get('0/myObjArray/0');
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        expect(newValue.baz).toBe(1);
        expect(newValue._id).toBeDefined();
        expect(newValue._id).toHaveLength(24);
    });
    it('resolves slugs', async () => {
        await dispatcher.push('0/myObjArray', null, {'name': 'my test', 'slug': 'my-test'});
        expect(mockWrite).toHaveBeenCalledTimes(1);
        expect(dispatcher.convertObjIDToIndex('0/myObjArray/my-test'))
            .resolves.toBe('0/myObjArray/0');
        const newValue = await dispatcher.get('0/myObjArray/my-test');
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        expect(newValue.name).toBe('my test');
        expect(newValue._id).toBeDefined();
        expect(newValue._id).toHaveLength(24);
    });
});

describe('del', () => {
    it('delete root if no path is provided', async () => {
        await dispatcher.del();
        expect(mockWrite).toHaveBeenCalledTimes(1);
        const newValue = await dispatcher.get('0/myArray');
        expect(newValue).not.toBeDefined();
    });
    it('deleteCascade on proxies within the path', async () => {
        const proxyDs = new JsonDataSource({});
        proxyDs.delCascade = jest.fn();
        dispatcher.dataSource.delCascade = jest.fn();
        dispatcher.registerProxy('myProxy', proxyDs);
        await dispatcher.connect();
        await dispatcher.del();
        expect(mockWrite).toHaveBeenCalledTimes(1);
        expect(proxyDs.delCascade).toHaveBeenCalledTimes(1);
        expect(dispatcher.dataSource.delCascade).toHaveBeenCalledTimes(1);
        const newValue = await dispatcher.get('0/myArray');
        expect(newValue).not.toBeDefined();
    });
    it('del a value', async () => {
        await dispatcher.del('0/myArray/0', null);
        expect(mockWrite).toHaveBeenCalledTimes(1);
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        const newValue = await dispatcher.get('0/myArray');
        expect(newValue).not.toContain('A');
        expect(newValue).toHaveLength(2);
    });
    it('deletes whole element', async () => {
        await dispatcher.del('0/myArray', null);
        expect(mockWrite).toHaveBeenCalledTimes(1);
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        const newValue = await dispatcher.get('0/myArray');
        expect(newValue).not.toBeDefined();
    });
});

describe('proxies', () => {
    it('registerProxy is defined', () => {
        expect(dispatcher.registerProxy).toBeDefined();     
    });
    it('registerProxy adds proxies', () => {
        const proxyDs = new JsonDataSource({});
        dispatcher.registerProxy('myProxy', proxyDs);
        expect(dispatcher.proxies).toHaveLength(1);     
    });
    it('getProxy retrieves proxy by proxyInfo', () => {
        const proxyDs = new JsonDataSource({});
        dispatcher.registerProxy('myProxy', proxyDs);
        expect(dispatcher.getProxy({ proxyName: 'myProxy'})).toBe(proxyDs);     
    });
    it('findEntryPoints returns {} if not schema is passed', async () => {
        const entryPoints = dispatcher.findEntryPoints();
        expect(entryPoints).toEqual({});     
    });
    it('findEntryPoints retrieves proxyInfos', async () => {
        const schema = await dispatcher.getSchema();
        const entryPoints = dispatcher.findEntryPoints('', schema);
        expect(Object.keys(entryPoints)).toHaveLength(3);     
        expect(entryPoints['(\\d+|[a-f0-9-]{24})\\/myDataProxy']).toEqual({ proxyName: 'myProxy', params: {} });     
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

describe('render', () => {
    it('calls renderer if provided', async () => {
        class MockRenderer extends DataRenderer {
            public setDatasource(_datasource: DataSource) {
                throw new Error("Method not implemented.");
            }
            render = jest.fn();

        }
        const renderer = new MockRenderer();
        const ds = new Dispatcher(
            new JsonSchema(path.join(process.cwd(), '__tests__', 'datasource', 'schema.json')),
            new JsonDataSource(path.join(process.cwd(), '__tests__', 'datasource', 'values.json')),
            renderer
        );
        //expect(ds.renderer).toBeDefined();
        await ds.render();
        expect(renderer.render).toHaveBeenCalledTimes(1);
    });
    it('returns value if no renderer is provided', async () => {
        expect(dispatcher.renderer).not.toBeDefined();
        const value = await dispatcher.render();
        const expected = await dispatcher.get();
        expect(value).toEqual(expected);
    })
})
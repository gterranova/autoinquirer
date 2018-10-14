// tslint:disable-next-line:no-unused-expression
import * as datasource from '../../src/datasource/index';
import { DummyDatasource } from './dummy-datasource';

describe('DataSource', () => {
    const dummy = new DummyDatasource();
    it('to be defined', () => {
        expect(datasource.DataSource).toBeDefined();
    });
    it('convertObjIDToIndex', async () => {
        expect(dummy.convertObjIDToIndex).toBeDefined();
    });
    it('convertObjIDToIndex returns empty string if not path', () => {
        expect(dummy.convertObjIDToIndex('')).resolves.toBe('');
        expect(dummy.convertObjIDToIndex([])).resolves.toBe('');
        expect(dummy.convertObjIDToIndex(null)).resolves.toBe('');
        expect(dummy.convertObjIDToIndex(undefined)).resolves.toBe('');
    });
    it('convertObjIDToIndex convert valid hashes to idx', async () => {
        let path = await dummy.convertObjIDToIndex('arrayOfObjects/ab0000000000000000000001');
        expect(path).toBe('arrayOfObjects/1');
        path = await dummy.convertObjIDToIndex('arrayOfObjects/0000000000000000000000a0');
        expect(path).toBe('arrayOfObjects/0');
        path = await dummy.convertObjIDToIndex('arrayOfObjects/ab0000000000000000000001/foo/bar');
        expect(path).toBe('arrayOfObjects/1/foo/bar');
        path = await dummy.convertObjIDToIndex('arrayOfObjects/1/foo/bar');
        expect(path).toBe('arrayOfObjects/1/foo/bar');
        path = await dummy.convertObjIDToIndex('arrayOfObjects/ab0000000000000000000000/foo/bar');
        expect(path).toBe('arrayOfObjects/ab0000000000000000000000/foo/bar');
        path = await dummy.convertObjIDToIndex('notValid/ab0000000000000000000000/foo/bar');
        expect(path).toBe('notValid/ab0000000000000000000000/foo/bar');
    });
});
describe('Dispatcher', () => {
    it('to be defined', () => {
        expect(datasource.Dispatcher).toBeDefined();
    });
});
describe('JsonSchema', () => {
    it('to be defined', () => {
        expect(datasource.JsonSchema).toBeDefined();
    });
});
describe('JsonDataSource', () => {
    it('to be defined', () => {
        expect(datasource.JsonDataSource).toBeDefined();
    });
});


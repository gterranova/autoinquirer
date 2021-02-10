// tslint:disable-next-line:no-unused-expression
import * as datasource from '../../src/index';
import { DummyDatasource } from './dummy-datasource';

describe('AbstractDataSource', () => {
    const dummy = new DummyDatasource();
    it('to be defined', () => {
        expect(datasource.AbstractDataSource).toBeDefined();
    });
    it('convertObjIDToIndex', async () => {
        expect(dummy.convertObjIDToIndex).toBeDefined();
    });
    it('convertObjIDToIndex returns empty string if not path', () => {
        expect(dummy.convertObjIDToIndex('')).resolves.toHaveProperty('jsonObjectID', '');
        expect(dummy.convertObjIDToIndex([])).resolves.toHaveProperty('jsonObjectID', '');
        expect(dummy.convertObjIDToIndex(null)).resolves.toHaveProperty('jsonObjectID', '');
        expect(dummy.convertObjIDToIndex(undefined)).resolves.toHaveProperty('jsonObjectID', '');
    });
    it('convertObjIDToIndex convert valid hashes to idx', async () => {
        let path = await dummy.convertObjIDToIndex('arrayOfObjects/ab0000000000000000000001');
        expect(path).toHaveProperty('jsonObjectID', 'arrayOfObjects/1');
        path = await dummy.convertObjIDToIndex('arrayOfObjects/0000000000000000000000a0');
        expect(path).toHaveProperty('jsonObjectID', 'arrayOfObjects/0');
        path = await dummy.convertObjIDToIndex('arrayOfObjects/ab0000000000000000000001/foo/bar');
        expect(path).toHaveProperty('jsonObjectID', 'arrayOfObjects/1/foo/bar');
        path = await dummy.convertObjIDToIndex('arrayOfObjects/1/foo/bar');
        expect(path).toHaveProperty('jsonObjectID', 'arrayOfObjects/1/foo/bar');
        path = await dummy.convertObjIDToIndex('arrayOfObjects/ab0000000000000000000000/foo/bar');
        expect(path).toHaveProperty('jsonObjectID', 'arrayOfObjects/ab0000000000000000000000/foo/bar');
        path = await dummy.convertObjIDToIndex('notValid/ab0000000000000000000000/foo/bar');
        expect(path).toHaveProperty('jsonObjectID', 'notValid/ab0000000000000000000000/foo/bar');
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


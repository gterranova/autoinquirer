import { DataSource, JsonSchema } from '../../src/datasource/index';
import { IProperty } from '../../src/interfaces';

const dummyValue = {
    primitive: 'a string',
    array: [1,2,3,4],
    object: {},
    arrayOfObjects: [{ _id: '0000000000000000000000a0'},{ _id: 'ab0000000000000000000001'}]        
};

export class DummyDatasource extends DataSource {
    public getSchema(_itemPath?: string, _schemaSource?: JsonSchema, _parentPath?: string, _params?: any): Promise<IProperty> {
        throw new Error("Method not implemented.");
    }
    public connect(): Promise<void> {
        throw new Error("Method not implemented.");
    }    
    public close(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    // tslint:disable-next-line:no-reserved-keywords no-any
    public async get(itemPath?: string): Promise<any> {
        if (!itemPath) { return dummyValue; }
        switch (itemPath) {
            case 'primitive':
                return dummyValue.primitive;
            case 'array':
                return dummyValue.array;
            case 'object':
                return dummyValue.object;
            case 'arrayOfObjects':
                return dummyValue.arrayOfObjects;
            default:
        };
        
        return null;
    }
    // tslint:disable-next-line:no-any
    public async dispatch(methodName: string, itemPath?: string, schema?: any, value?: any, parentPath?: string, params?: any) {
        // tslint:disable-next-line:no-return-await
        return await this[methodName](itemPath, schema, value, parentPath, params);
    }
}

describe('DummyDatasource', () => {
    it('to be defined', () => {
        expect(DummyDatasource).toBeDefined();
    });
});

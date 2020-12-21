import { AbstractDispatcher } from '../../src/datasource';
import { DataSource } from '../../src/index';
import { IDispatchOptions, IProperty } from '../../src/interfaces';

const dummyValue = {
    primitive: 'a string',
    array: [1,2,3,4],
    object: {},
    arrayOfObjects: [{ _id: '0000000000000000000000a0'},{ _id: 'ab0000000000000000000001'}]        
};

export class DummyDatasource extends DataSource {
    // tslint:disable-next-line:no-reserved-keywords no-any
    public async get(options?: IDispatchOptions): Promise<any> {
        const { itemPath } = options || {};
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
    public async dispatch(methodName: string, options?: IDispatchOptions) {
        // tslint:disable-next-line:no-return-await
        return await this[methodName](options);
    }

    public getSchema(_options?: IDispatchOptions, _schemaSource?: AbstractDispatcher): Promise<IProperty> {
        throw new Error('Method not implemented.');
    }
    public getDataSource(_parentDataSource?: DataSource): DataSource {
        throw new Error('Method not implemented.');
    }
    public getSchemaDataSource(_parentDataSource?: DataSource): DataSource {
        throw new Error('Method not implemented.');
    }
    public connect(): Promise<void> {
        throw new Error("Method not implemented.");
    }    
    public close(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public async isMethodAllowed(_methodName: string, _options: any): Promise<Boolean> {
        return true;
    }
}

describe('DummyDatasource', () => {
    it('to be defined', () => {
        expect(DummyDatasource).toBeDefined();
    });
});

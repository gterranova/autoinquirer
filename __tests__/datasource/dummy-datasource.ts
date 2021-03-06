import { AbstractDispatcher } from '../../src/datasource';
import { AbstractDataSource } from '../../src/index';
import { IDispatchOptions, IProperty } from '../../src/interfaces';

const dummyValue = {
    primitive: 'a string',
    array: [1,2,3,4],
    object: {},
    arrayOfObjects: [{ _id: '0000000000000000000000a0'},{ _id: 'ab0000000000000000000001'}]        
};

export class DummyDatasource extends AbstractDataSource {
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

    public async getSchema(_options?: IDispatchOptions, _schemaSource?: AbstractDispatcher): Promise<IProperty> {
        //throw new Error('Method not implemented.');
        return {};
    }
    public getDataSource(): AbstractDataSource {
        return this;
    }
    public getSchemaDataSource(_parentDataSource?: AbstractDataSource): AbstractDataSource {
        return {...this, get: (o) => this.getSchema(o) };
    }
    public async connect(parent): Promise<void> {
        this.setParent(parent);
    }    
    public async close(): Promise<void> {
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

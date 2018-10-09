import path from 'path';
import { absolute, backPath, evalExpr, getType, loadJSON } from '../src/utils';

describe('absolute', () => {
  it('does nothing to absolute paths', () => {
    expect(absolute('/test', '/whatever')).toBe(`/test`);
  });
  it('returns reference path if test path is null', () => {
    expect(absolute(null, '/whatever')).toBe(`/whatever`);
  });
  it('returns reference path if test path is undefined', () => {
    expect(absolute(undefined, '/whatever')).toBe(`/whatever`);
  });
  it('returns reference path if test path is empty', () => {
    expect(absolute('', '/whatever')).toBe(`/whatever`);
  });
  it('returns reference path if test path is .', () => {
    expect(absolute('.', '/whatever')).toBe(`/whatever`);
  });
  it('can handle ..', () => {
    expect(absolute('..', '/whatever/sub')).toBe(`/whatever`);
    expect(absolute('..', 'whatever/sub')).toBe(`whatever`);
    expect(absolute('../test', '/whatever/sub')).toBe(`/whatever/test`);
    expect(absolute('../test', 'whatever/sub')).toBe(`whatever/test`);
    expect(absolute('../../test', '/whatever/sub/level3')).toBe(`/whatever/test`);
    expect(absolute('../test/../another', '/whatever/sub/level3')).toBe(`/whatever/sub/another`);
    expect(absolute('../../test', '/whatever/sub')).toBe(`/test`);
    expect(absolute('../../test', 'whatever/sub')).toBe(`test`);
    expect(absolute('../../../../../test', '/whatever')).toBe(`test`);
    expect(absolute('../../../../../test', 'whatever')).toBe(`test`);

  });
});

describe('backPath', () => {
  it('returns empty string if path is null, undefined or empty', () => {
    expect(backPath(undefined)).toBe(``);
    expect(backPath(null)).toBe(``);
    expect(backPath('')).toBe(``);
  });
  it('works on relative paths', () => {
    expect(backPath('test')).toBe('');
    expect(backPath('test')).toBe(absolute('..', 'test'));
    
    expect(backPath('test/sub')).toBe('test');
    expect(backPath('test/sub')).toBe(absolute('..', 'test/sub'));
  });
  it('works on absolute paths', () => {
    expect(backPath('/')).toBe('');
    expect(backPath('/')).toBe(absolute('..', '/'));
    
    expect(backPath('/test')).toBe('');
    expect(backPath('/test')).toBe(absolute('..', '/test'));
    
    expect(backPath('/test/whatever')).toBe('/test');
    expect(backPath('/test/whatever')).toBe(absolute('..', '/test/whatever'));
  });
});

describe('getType', () => {
  // Assert Action values
  it('returns Object on objects', () => {
    expect(getType({})).toBe(`Object`);
  });
  it('returns Array on arrays', () => {
    expect(getType([])).toBe(`Array`);
  });
  it('returns null on nulls', () => {
    expect(getType(null)).toBe(`null`);
  });
  it('returns string on strings', () => {
    expect(getType("")).toBe(`string`);
  });
  it('returns number on numbers', () => {
    expect(getType(1)).toBe(`number`);
  });
  it('returns number on floats', () => {
    expect(getType(1.1)).toBe(`number`);
  });
  it('returns function on functions', () => {
    expect(getType(getType)).toBe(`function`);
  });
  it('returns function/Object on classes/instances', () => {
    class Test {
      private x: string;
      constructor() {
        this.x = 'test';
      }
    };
    const inst = new Test();
    expect(getType(Test)).toBe(`function`);
    expect(getType(inst)).toBe(`Object`);
  });
});

describe('evalExpr', () => {
  it('evals numberic expressions', () => {
    expect(evalExpr('1+1', {})).toBe(2);
  });
  it('evals string expressions', () => {
    expect(evalExpr('\'1\'+\'1\'', {})).toBe('11');
  });
  it('evals against context', () => {
    expect(evalExpr('this', { type: 'test' })).toEqual({ type: 'test' });
    expect(evalExpr('this.a + this.b', { a: 1, b: 2 })).toBe(3);
    expect(evalExpr('this.type === \'test\'', { type: 'test' })).toBe(true);
    expect(evalExpr('this.type === \'foo\'', { type: 'test' })).toBe(false);
  });
  it('returns true on errors', () => {
    const mockWarn = jest.spyOn(global.console, 'warn');
    expect(evalExpr('thisIsWrong', {})).toBe(true);
    expect(evalExpr('thisIsWrong', null)).toBe(true);
    expect(evalExpr('thisIsWrong', undefined)).toBe(true);
    expect(global.console.warn).toHaveBeenCalledTimes(3);
    expect(mockWarn.mock.calls[0].toString()).toMatch(/thisIsWrong is not defined/);
  });
});

describe('loadJSON', () => {
  it('load a json file', () => {
    const pkg = loadJSON(path.join(process.cwd(), 'package.json'));
    expect(pkg).toBeDefined();
  });
  it('return undefined if file do not exists', () => {
    expect(loadJSON('')).not.toBeDefined();
    expect(loadJSON('foo.json')).not.toBeDefined();
  });
  it('throws an exception on malformed json', () => {
    let exception;
    try {
      loadJSON(path.join(process.cwd(), '__tests__', 'malformed.json'))
    } catch (e) {
      exception = e;
    }
    expect(exception).toBeDefined();
  });
});
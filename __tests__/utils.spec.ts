import path from 'path';
import { absolute, backPath, findUp, loadJSON } from '../src/utils';

const mockWarn = jest.spyOn(global.console, 'warn');
beforeEach(() => {
  mockWarn.mockReset();
});

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

describe('findUp', () => {
  it('returns parent path containing a file', () => {
    const pkgFile = findUp('package.json', path.join(process.cwd()));
    expect(path.resolve(path.dirname(pkgFile))).toBe(path.resolve(path.join(__dirname, '..')));
  });
  it('returns on not existent parent path containing a file', () => {
    const pkg = findUp('notexists.json', path.join(process.cwd()));
    expect(path.resolve(path.dirname(pkg))).toBe(path.join(process.cwd()));
  });
});
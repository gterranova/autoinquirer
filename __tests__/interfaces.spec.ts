import { Action } from '../src/interfaces';

describe('Action enum', () => {
  // Assert Action values
  it('has BACK', () => {
    expect(Action.BACK).toBe(`back`);
  });
  it('has EXIT', () => {
    expect(Action.EXIT).toBe(`exit`);
  });
  it('has PUSH', () => {
    expect(Action.PUSH).toBe(`push`);
  });
  it('has SET', () => {
    expect(Action.SET).toBe(`set`);
  });
  it('has DEL', () => {
    expect(Action.DEL).toBe(`del`);
  });
});

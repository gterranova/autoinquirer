"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const events_1 = require("events");
const utils_1 = require("./utils");
class AutoInquirer extends events_1.EventEmitter {
    constructor(dataDispatcher, initialAnswer = { state: { path: '' } }) {
        super();
        this.dataDispatcher = dataDispatcher;
        this.answer = initialAnswer;
    }
    next() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { state } = this.answer;
            try {
                const prompt = yield this.dataDispatcher.render(state.type, state.path);
                if (prompt === null) {
                    this.emit('complete');
                }
                return prompt;
            }
            catch (e) {
                if (e instanceof Error) {
                    const nextPath = state.type !== "push" ? utils_1.backPath(state.path) : state.path;
                    this.answer = { state: Object.assign(Object.assign({}, state), { path: nextPath, errors: e.message }) };
                    this.emit('error', this.answer.state);
                    return this.next();
                }
            }
            return null;
        });
    }
    onAnswer(data) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.answer = Object.assign(Object.assign({}, this.answer), { [data.name]: data.answer });
            if (data.hasOwnProperty('value')) {
                this.answer.value = data.value;
            }
            yield this.performActions(this.answer);
        });
    }
    performActions(answer) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { state, value } = answer;
            if (state && state.type && state.type === "push" || state.type === "del" || (state.type === "set" && value !== undefined)) {
                const nextPath = state.type !== "push" ? utils_1.backPath(state.path) : state.path;
                try {
                    yield this.dataDispatcher.dispatch(state.type, state.path, null, value);
                    this.answer = { state: { path: nextPath } };
                    this.emit(state.type, state);
                }
                catch (e) {
                    if (e instanceof Error) {
                        this.answer = { state: Object.assign(Object.assign({}, state), { errors: e.message }) };
                        this.emit('error', this.answer.state);
                    }
                }
            }
            else {
                this.emit(state.type, state);
            }
        });
    }
    run() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.emit('prompt', yield this.next());
        });
    }
}
exports.AutoInquirer = AutoInquirer;
//# sourceMappingURL=autoinquirer.js.map
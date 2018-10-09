// tslint:disable:no-any
// tslint:disable:no-console

import { EventEmitter } from 'events';
import { Dispatcher } from './datasource/dispatcher';
import { Action, IAnswer, IFeedBack, IPrompt } from './interfaces';
import { backPath } from './utils';


export class AutoInquirer extends EventEmitter {
    private dataDispatcher: Dispatcher;
    private answer: IAnswer;

    constructor(dataDispatcher: Dispatcher, initialAnswer: IAnswer = { state: { path: '' }}) {
        super();
        this.dataDispatcher = dataDispatcher;
        this.answer = initialAnswer;
    }

    public async next(): Promise<IPrompt> {
        const { state } = this.answer;
        try {
            const prompt = await this.dataDispatcher.render(state.type, state.path);
            if (prompt === null) {
                this.emit('complete');
            }

            return prompt;
        } catch (e) {
            if (e instanceof Error) {
                const nextPath = state.type !== Action.PUSH? backPath(state.path): state.path;
                this.answer = { state: { ...state, path: nextPath, errors: e.message } };                    
                this.emit('error', this.answer.state);
                
                return this.next();    
            }
        }
        
        return null;
    }

    public async onAnswer(data: IFeedBack) {
        this.answer = {...this.answer, [data.name]: data.answer};
        await this.performActions(this.answer);
    }

    public async performActions(answer: IAnswer) {
        const { state, value } = answer;
    
        //console.log("ACTION:", answer);
        if (state && state.type && state.type === Action.PUSH || state.type === Action.DEL || (state.type === Action.SET && value !== undefined)) {
            const nextPath = state.type !== Action.PUSH? backPath(state.path): state.path;
            
            try {
                await this.dataDispatcher.dispatch(state.type, state.path, null, value);
                this.answer = { state: { path: nextPath } };
                this.emit(state.type, state);
            } catch (e) {
                if (e instanceof Error) {
                    this.answer = { state: { ...state, errors: e.message } };                    
                    this.emit('error', this.answer.state);    
                }
            }
        } else {
            this.emit(state.type, state);
        }
    }

    public async run() {
        this.emit('prompt', await this.next())
    }
}

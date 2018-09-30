// tslint:disable:no-any
// tslint:disable:no-console

import { EventEmitter } from 'events';
import { Dispatcher } from './datasource/dispatcher';
import { Action, IAnswer, IFeedBack, IPrompt } from './interfaces';
import { PromptBuilder } from './promptbuilder';
import { backPath } from './utils';


export class AutoInquirer extends EventEmitter {
    private dataDispatcher: Dispatcher;
    private promptBuilder: PromptBuilder;
    private answer: IAnswer;

    constructor(dataDispatcher: Dispatcher, initialAnswer: IAnswer = { state: { path: '' }}) {
        super();
        this.dataDispatcher = dataDispatcher;
        this.promptBuilder = new PromptBuilder(dataDispatcher);
        this.answer = initialAnswer;
    }

    public addAction(name: string, cb?: (...args: any[]) => any) {
        this.promptBuilder.addAction(name, (name.slice(0,1).toUpperCase()+name.slice(1)));
        this.on(name, cb)
    } 

    public async next(): Promise<IPrompt> {
        const { state } = this.answer;
        const propertySchema = await this.dataDispatcher.getSchema(state.path);
        const prompt = await this.promptBuilder.generatePrompts(state, propertySchema);
        if (prompt !== null) {
            return prompt;
        }
        this.emit('complete');
        
        return null;
    }

    public async onAnswer(data: IFeedBack) {
        this.answer = {...this.answer, [data.name]: data.answer};
        await this.performActions(this.answer);
    }

    // tslint:disable-next-line:cyclomatic-complexity
    public async performActions(answer: IAnswer) {
        const { state, value } = answer;
    
        //console.log("ACTION:", answer);
        if (state && state.type) {
            switch (state.type) {
                case Action.ADD:
                    try {
                        await this.dataDispatcher.push(state.path, value);
                    } catch (e) {
                        this.answer = { state: { ...state, errors: e.message } };    
                        this.emit('error', this.answer.state);
                    }
                    break;
                case Action.EDIT:
                    if (value !== undefined) {
                        try {
                            await this.dataDispatcher.set(state.path, value);
                            this.answer = { state: { path: backPath(state.path) } };
                        } catch (e) {
                            this.answer = { state: { ...state, errors: e.message } };    
                            this.emit('error', this.answer.state);
                        }
                    }
                    break;
                case Action.REMOVE:
                    try { 
                        await this.dataDispatcher.del(state.path);
                        this.answer = { state: { path: backPath(state.path) } };
                    } catch (e) { 
                        this.answer = { state: { ...state, errors: e.message } };    
                        this.emit('error', this.answer.state);
                    } 
                    break;
                default:
            }
            this.emit(state.type, state);
        }
    }

    public async run() {
        this.emit('prompt', await this.next())
    }
}

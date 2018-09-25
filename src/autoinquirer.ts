// tslint:disable:no-any
// tslint:disable:no-console

import { EventEmitter } from 'events';
import { DataSource } from './datasource';
import { Action, IAnswer, IFeedBack, IPrompt } from './interfaces';
import { PromptBuilder } from './promptbuilder';
import { backPath } from './utils';


export class AutoInquirer extends EventEmitter {
    private dataSource: DataSource;
    private promptBuilder: PromptBuilder;
    private question: IPrompt;
    private answer: IAnswer;

    constructor(dataSource: DataSource, initialAnswer: IAnswer = { state: { path: '' }}) {
        super();
        this.dataSource = dataSource;
        this.promptBuilder = new PromptBuilder(dataSource);
        this.answer = initialAnswer;
    }

    public addAction(name: string, cb?: (...args: any[]) => any) {
        this.promptBuilder.addAction(name, (name.slice(0,1).toUpperCase()+name.slice(1)));
        this.on(name, cb)
    } 

    public async next() {
        const { state } = this.answer;
        const propertySchema = this.dataSource.getDefinition(state.path);
        this.question = await this.promptBuilder.generatePrompts(state, propertySchema);
        if (this.question!==null) {
            const prompt = this.question;
            if (!prompt.when || prompt.when(this.answer)) {
                prompt.when = true;
                if (prompt.default && typeof(prompt.default) === 'function') {
                    prompt.default = prompt.default(this.answer);
                }
                if (prompt.choices && typeof(prompt.choices) === 'function') {
                    prompt.choices = prompt.choices(this.answer);
                }

                return prompt;
            }
        }
        this.emit('complete');
        
        return null;
    }

    public async onAnswer(data: IFeedBack) {
        if (/^input\./.test(data.name)) {
            const pair = {}; pair[data.name.split('.').pop()] = data.answer;
            this.answer = {...this.answer, input: pair};
        } else {
            this.answer = {...this.answer, [data.name]: data.answer};
        }
        await this.performActions(this.answer);
    }

    // tslint:disable-next-line:cyclomatic-complexity
    public async performActions(answer: IAnswer) {
        const { state, input } = answer;
    
        //console.log("ACTION:", answer);
        if (state && state.type) {
            switch (state.type) {
                case Action.ADD:
                    await this.dataSource.push(state.path, input && input.value);
                    break;
                case Action.EDIT:
                    try {
                        await this.dataSource.set(state.path, input && input.value); 
                        if (input) {
                            this.answer = { state: { path: backPath(state.path) } };
                        }
                    } catch (e) {
                        const errors = JSON.parse(e.message);
                        this.answer = { state: { ...state, errors } };
                        this.emit('error', this.answer.state)
                    }
                    break;
                case Action.REMOVE:
                    await this.dataSource.del(state.path);
                    this.answer = { state: { path: backPath(state.path) } };
                    break;
                case Action.EXIT:
                    this.question = null;
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

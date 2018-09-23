// tslint:disable:no-any
// tslint:disable:no-console

import { Subject } from 'rxjs';
import { BaseDataSource } from './datasource';
import { Action, IAnswer, IFeedBack, IPrompt } from './interfaces';
import { PromptBuilder } from './promptbuilder';
import { backPath } from './utils';


export class AutoInquirer {
    public onQuestion: Subject<any> = new Subject();
    public onComplete: Subject<any> = new Subject();

    private dataSource: BaseDataSource;
    private promptBuilder: PromptBuilder;
    private questions: IPrompt[];
    private answer: IAnswer;

    constructor(dataSource: BaseDataSource, initialAnswer: IAnswer = { state: { path: '' }}) {
        this.dataSource = dataSource;
        this.promptBuilder = new PromptBuilder(dataSource);
        this.answer = initialAnswer;
    }

    public next() {
        const { state } = this.answer;
        const propertySchema = this.dataSource.getDefinition(state.path);
        this.questions = this.promptBuilder.generatePrompts(state, propertySchema);
        while (this.questions.length!==0) {
            const prompt = { ...this.questions.shift() };
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
        if (state && state.type !== Action.EXIT) {
            //console.log("NO QUESTION", state);
            this.answer = { state: { path: backPath(state.path) } };
            this.performActions(this.answer);
            
            return this.next();
        } else {
            this.onComplete.next();
        }
    }

    public onAnswer(data: IFeedBack) {
        if (/^input\./.test(data.name)) {
            const pair = {}; pair[data.name.split('.').pop()] = data.answer;
            this.answer = {...this.answer, input: pair};
        } else {
            this.answer = {...this.answer, [data.name]: data.answer};
        }
        this.performActions(this.answer);
    }

    // tslint:disable-next-line:cyclomatic-complexity
    public performActions(answer: IAnswer) {
        const { state } = answer;
        let input = answer.input;
        const propertySchema = this.dataSource.getDefinition(state.path);
    
        //console.log("ACTION:", answer, propertySchema);
        if (state && state.type) {
            switch (state.type) {
                case Action.ADD:
                    if (input) {
                        this.dataSource.push(state.path, input.value);     
                    } else if (propertySchema.type === 'array') {
                        //console.log("this.dataSource.addItemByPath", state.path, propertySchema.items.type);     
                        const arrayItemSchema: any = propertySchema.items;
                        const arrayItemType = arrayItemSchema && arrayItemSchema.type;
                        input = {};
                        switch (arrayItemType) {
                            case 'object':
                                input.value = {};
                                break;
                            case 'array':
                                input.value = [];
                                break;

                            case 'string':
                                input.value = '???'
                                break;

                            default:
                                input.value = {};
                        }
                
                        this.dataSource.push(state.path, input.value);
                    } 
                    break;
                case Action.EDIT:
                    if (input) {
                        this.dataSource.set(state.path, input.value); 
                        this.answer = { state: { path: backPath(state.path) } };
                    }
                    break;
                case Action.REMOVE:
                    this.dataSource.del(state.path);
                    this.answer = { state: { path: backPath(state.path) } };
                    break;
                case Action.EXIT:
                    this.questions = [];
                    break;
                default:
            }
        }
    }

    public inquire(ask: any, answer: IAnswer) {
        // tslint:disable-next-line:promise-must-complete
        return new Promise( (resolve: any) => {
            this.answer = answer;
            const propertySchema = this.dataSource.getDefinition(answer.state.path);

            ask(this.promptBuilder.generatePrompts(answer.state, propertySchema)).then((res: IAnswer) => { 
                const { state } = res;
                if (state.type !== Action.EXIT) {
                    this.performActions(res);
                    const newPath = state.type === Action.ADD ? state.path : backPath(state.path);
                    this.inquire(ask, { state: { path: newPath } }).then(resolve); 
                } else {
                    resolve();
                }
            });    
        });
    }

    public run() {
        this.onQuestion.next(this.next());
    }
}

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
    private question: IPrompt;
    private answer: IAnswer;

    constructor(dataSource: BaseDataSource, initialAnswer: IAnswer = { state: { path: '' }}) {
        this.dataSource = dataSource;
        this.promptBuilder = new PromptBuilder(dataSource);
        this.answer = initialAnswer;
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
        this.onComplete.next();
        
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
    
        //console.log("ACTION:", answer, propertySchema);
        if (state && state.type) {
            switch (state.type) {
                case Action.ADD:
                    await this.dataSource.push(state.path, input && input.value);
                    break;
                case Action.EDIT:
                    if (input) {
                        await this.dataSource.set(state.path, input.value); 
                        this.answer = { state: { path: backPath(state.path) } };
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
        }
    }

    public async run() {
        this.onQuestion.next(await this.next());
    }
}

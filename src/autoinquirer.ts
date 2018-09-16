// tslint:disable:no-any
// tslint:disable:no-console

import { Subject } from 'rxjs';
import { DataSource } from './datasource';
import { IAnswer, IFeedBack, IPrompt } from './interfaces';
import { PromptBuilder } from './promptbuilder';
import { backPath } from './utils';


export class AutoInquirer {
    public onQuestion: Subject<any> = new Subject();
    public onComplete: Subject<any> = new Subject();

    private dataSource: DataSource;
    private promptBuilder: PromptBuilder;
    private questions: IPrompt[];
    private answer: IAnswer;

    constructor(dataSource: DataSource, initialAnswer: IAnswer = { state: { path: '', type: 'select'}}) {
        this.dataSource = dataSource;
        this.promptBuilder = new PromptBuilder(dataSource);
        this.answer = initialAnswer;
    }

    public next() {
        const { state } = this.answer;
        this.questions = this.promptBuilder.generatePrompts(state);
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
        if (state && state.type !== 'none') {
            //console.log("NO QUESTION", state);
            state.type = 'back';
            this.performActions(this.answer);
            
            return this.next();
        } else {
            this.onComplete.next();
        }
    }

    public onAnswer(data: IFeedBack) {
        if (/^input\./.test(data.name)) {
            const pair = {}; pair[data.name.split('.').pop()] = data.answer;
            this.updateAnswer({input: pair});
        } else {
            this.updateAnswer({[data.name]: data.answer});
        }
        this.performActions(this.answer);
    }

    public performActions(answer: IAnswer) {
        const { state } = answer;
        let input = answer.input;
        const propertySchema = this.dataSource.getSchemaByPath(state.path);
    
        //console.log("ACTION:", answer, propertySchema.type);
        if (state && state.type) {
            switch (state.type) {
                case 'add':
                    if (input) {
                        this.dataSource.addItemByPath(state.path, input.value);     
                    } else if (propertySchema.type === 'array' && propertySchema.items.type !== 'collection') {
                        //console.log("this.dataSource.addItemByPath", state.path);     
                        input = {};
                        this.dataSource.addItemByPath(state.path, input);
                    } 
                    break;
                case 'edit':
                    if (input) {
                        this.dataSource.updateItemByPath(state.path, input.value); 
                    }
                    break;
                case 'remove':
                    this.dataSource.removeItemByPath(state.path);
                    break;
                case 'back':
                    break;
                case 'none':
                    this.questions = [];
                    break;
                default:
            }
        }
        if (input || (state && state.type && ['remove', 'back'].indexOf(state.type) !== -1)) {
            const newPath = state.type === 'add' ? state.path : backPath(state.path);
            //console.log(state.type, state.path, newPath,);
            this.updateAnswer({ state: { path: newPath, type: 'select' } });
        }
    };

    public inquire(ask: any, answer: IAnswer) {
        // tslint:disable-next-line:promise-must-complete
        return new Promise( (resolve: any) => {
            this.answer = answer;
            ask(this.promptBuilder.generatePrompts(answer.state)).then((res: IAnswer) => { 
                const { state } = res;
                if (state.type !== 'none') {
                    this.performActions(res);
                    const newPath = state.type === 'add' ? state.path : backPath(state.path);
                    this.inquire(ask, { state: { path: newPath, type: 'select' } }).then(resolve); 
                } else {
                    resolve();
                }
            });    
        });
    };

    public run() {
        this.onQuestion.next(this.next());
    };

    private updateAnswer(answer: any) {
        this.answer = {...this.answer, ...answer};
    }
}
